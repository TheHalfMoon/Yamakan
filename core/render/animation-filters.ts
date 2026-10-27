// P10-02 / YU-022: FFmpeg filter fragments for opacity/volume from
// clip.animation. The curve is sampled once per output frame, as before (the
// shared sampler, at each frame's middle), but consecutive frames whose
// values agree within an explicit tolerance become one segment, so a
// graph's size follows how much the value changes, not how many frames the
// clip has. Holds and steps are one segment per key; a full 0..1 opacity
// ramp is at most 256 segments however long it lasts. The per-frame
// compiler (version 1) is kept as the reference the bounded one is checked
// against. Transform channels are not rendered (yet): a plan that has them
// is refused before rendering, never drawn without them.
import { FLICKS_PER_SECOND, type Rational } from "../time.ts";
import {
  sampleScalarChannelsAtTime,
  scalarExpressionConstant,
} from "../animation/sample.ts";
import { mediaTime } from "../animation/media-time.ts";
import type { Channel } from "../animation/types.ts";
import type { ClipAnimation } from "../timeline/animation-schema.ts";
import { CommandError } from "../command/errors.ts";

/** The animation compiler a render plan names (YU-022). */
export const ANIMATION_COMPILER = "yamakan.animation-compiler/2";

/**
 * Explicit tolerances. Opacity: one 8-bit alpha level (1/255), so the
 * merged value is the frame's own value rounded to the nearest level the
 * output can hold. Volume: 1/1000 of unity gain.
 */
export const OPACITY_TOLERANCE = 1 / 255;
export const VOLUME_TOLERANCE = 1 / 1000;

/** Hard cap on one channel's compiled segments (a larger graph is refused). */
export const MAX_COMPILED_SEGMENTS = 1024;

/** Hard cap on per-frame samples (10 min @ 30 fps; the timeline's limit). */
export const MAX_ANIMATION_SEGMENTS = 18_000;

/** Channels the renderer draws; any other channel with keys is refused. */
const RENDERED = new Set(["opacity", "volume"]);

/** Same decimal-seconds encoding as core/render.ts (avoids an import cycle). */
function seconds(ticks: number): string {
  if (!Number.isSafeInteger(ticks) || ticks < 0)
    throw new CommandError("VALIDATION", "Render time is out of range.");
  const ns = (BigInt(ticks) * 1_000_000_000n) / BigInt(FLICKS_PER_SECOND);
  const whole = ns / 1_000_000_000n;
  const frac = (ns % 1_000_000_000n).toString().padStart(9, "0");
  return `${whole}.${frac}`;
}

export type AnimationChannels = {
  opacity?: Channel<number>;
  volume?: Channel<number>;
};

/** Pick opacity/volume channels from a clip animation map for sampling. */
export function renderableAnimationChannels(
  animation: ClipAnimation | undefined | null,
): AnimationChannels {
  if (!animation) return {};
  const out: AnimationChannels = {};
  if (animation.opacity) out.opacity = animation.opacity as Channel<number>;
  if (animation.volume) out.volume = animation.volume as Channel<number>;
  return out;
}

function frameTicksFor(fps: Rational): number {
  return Math.round((FLICKS_PER_SECOND * fps.den) / fps.num);
}

/**
 * Sample a scalar channel at local clip time (flicks), shared by preview/export.
 */
export function sampleAnimationPathAtLocalTime(
  channel: Channel<number>,
  path: string,
  localTicks: number,
  fallback: number,
): number {
  const sampled = sampleScalarChannelsAtTime(
    { [path]: channel },
    mediaTime({ ticks: localTicks }),
    fallback,
  );
  return sampled.find((s) => s.path === path)?.value ?? fallback;
}

export type Segment = { t0: number; t1: number; value: number };

/**
 * Version 1 (the reference): one segment per output frame over the local
 * span [localStart, localEnd), each the value at the frame's middle.
 */
export function perFrameSegments(
  channel: Channel<number>,
  path: string,
  localStart: number,
  localEnd: number,
  fps: Rational,
  fallback: number,
): Segment[] {
  const span = localEnd - localStart;
  if (span <= 0) return [];
  const frame = frameTicksFor(fps);
  const frames = Math.max(1, Math.ceil(span / frame));
  if (frames > MAX_ANIMATION_SEGMENTS)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Animation spans more than ${MAX_ANIMATION_SEGMENTS} frames.`,
    );
  const segments: Segment[] = [];
  for (let i = 0; i < frames; i++) {
    const t0 = localStart + i * frame;
    const t1 = Math.min(localEnd, localStart + (i + 1) * frame);
    if (t1 <= t0) continue;
    const mid = t0 + Math.floor((t1 - t0) / 2);
    segments.push({
      t0,
      t1,
      value: sampleAnimationPathAtLocalTime(channel, path, mid, fallback),
    });
  }
  return segments;
}

/**
 * Version 2: the same per-frame values, each rounded to the tolerance, with
 * consecutive equal values merged. Every frame's value is within half a
 * tolerance of the reference's; the count is bounded by the curve's travel
 * and refused above MAX_COMPILED_SEGMENTS.
 */
export function boundedSegments(
  channel: Channel<number>,
  path: string,
  localStart: number,
  localEnd: number,
  fps: Rational,
  fallback: number,
  tolerance: number,
): Segment[] {
  const merged: Segment[] = [];
  for (const s of perFrameSegments(
    channel,
    path,
    localStart,
    localEnd,
    fps,
    fallback,
  )) {
    const value = Math.round(s.value / tolerance) * tolerance;
    const last = merged[merged.length - 1];
    if (last && last.value === value && last.t1 === s.t0) last.t1 = s.t1;
    else {
      if (merged.length >= MAX_COMPILED_SEGMENTS)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          `The ${path} animation changes too often to render (more than ${MAX_COMPILED_SEGMENTS} steps).`,
        );
      merged.push({ ...s, value });
    }
  }
  return merged;
}

const toleranceOf = (path: string) =>
  path === "opacity" ? OPACITY_TOLERANCE : VOLUME_TOLERANCE;

/**
 * Before any render (compilePlan): the clip's animation is drawable. Only
 * opacity and volume are rendered; a channel's keys are at distinct times;
 * and each compiles within MAX_COMPILED_SEGMENTS over the clip.
 */
export function assertAnimationRenderable(
  animation: ClipAnimation,
  durationTicks: number,
  fps: Rational,
) {
  for (const [path, channel] of Object.entries(animation)) {
    if (!channel?.keys.length) continue;
    if (!RENDERED.has(path))
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        `Animating ${path} is not rendered yet; remove it to export.`,
      );
    const times = channel.keys.map((k) => k.time);
    if (new Set(times).size !== times.length)
      throw new CommandError(
        "VALIDATION",
        `The ${path} animation has two keys at one time.`,
      );
    boundedSegments(
      channel as Channel<number>,
      path,
      0,
      durationTicks,
      fps,
      1,
      toleranceOf(path),
    );
  }
}

/**
 * Chain colorchannelmixer aa= segments for the visible timeline range.
 * Stream `t` must be timeline seconds (same as overlay enable).
 */
export function opacityFilterChain(
  inputLabel: string,
  outputLabel: string,
  channel: Channel<number>,
  args: {
    clipStartTicks: number;
    rangeStartTicks: number;
    rangeEndTicks: number;
    fps: Rational;
  },
): string[] {
  const localStart = Math.max(0, args.rangeStartTicks - args.clipStartTicks);
  const localEnd = Math.max(
    localStart,
    args.rangeEndTicks - args.clipStartTicks,
  );
  const segments = boundedSegments(
    channel,
    "opacity",
    localStart,
    localEnd,
    args.fps,
    1,
    OPACITY_TOLERANCE,
  ).map((s) => ({
    ...s,
    t0: args.clipStartTicks + s.t0,
    t1: args.clipStartTicks + s.t1,
  }));
  if (!segments.length) return [`[${inputLabel}]null[${outputLabel}]`];
  if (segments.length === 1) {
    const aa = scalarExpressionConstant(segments[0]!.value);
    return [
      `[${inputLabel}]format=yuva420p,colorchannelmixer=aa=${aa}[${outputLabel}]`,
    ];
  }
  // format=yuva420p must stay outside enable= windows; a disabled filter
  // would otherwise skip the alpha conversion for later segments.
  const yuva = `${outputLabel}_yuva`;
  const filters: string[] = [`[${inputLabel}]format=yuva420p[${yuva}]`];
  let prev = yuva;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const next =
      i === segments.length - 1 ? outputLabel : `${outputLabel}_o${i}`;
    const aa = scalarExpressionConstant(seg.value);
    const enable = `gte(t,${seconds(seg.t0)})*lt(t,${seconds(seg.t1)})`;
    filters.push(
      `[${prev}]colorchannelmixer=aa=${aa}:enable='${enable}'[${next}]`,
    );
    prev = next;
  }
  return filters;
}

/**
 * Chain volume= segments. Stream `t` must be clip-local seconds
 * (after asetpts=PTS-STARTPTS).
 */
export function volumeFilterChain(
  channel: Channel<number>,
  durationTicks: number,
  fps: Rational,
): string[] {
  const segments = boundedSegments(
    channel,
    "volume",
    0,
    durationTicks,
    fps,
    1,
    VOLUME_TOLERANCE,
  );
  if (!segments.length) return [];
  if (segments.length === 1)
    return [`volume=${scalarExpressionConstant(segments[0]!.value)}`];
  return segments.map((seg) => {
    const v = scalarExpressionConstant(seg.value);
    const enable = `gte(t,${seconds(seg.t0)})*lt(t,${seconds(seg.t1)})`;
    return `volume=${v}:enable='${enable}'`;
  });
}

/** Constant opacity expression for a single preview frame (local mid-ticks). */
export function opacityConstantAtLocalTime(
  channel: Channel<number>,
  localTicks: number,
): string {
  const v = sampleAnimationPathAtLocalTime(channel, "opacity", localTicks, 1);
  return `format=yuva420p,colorchannelmixer=aa=${scalarExpressionConstant(v)}`;
}
