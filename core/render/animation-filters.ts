// P10-02: FFmpeg filter fragments for opacity/volume from clip.animation.
// Transform channels are stored on the plan but not compiled here (residual).
import { FLICKS_PER_SECOND, type Rational } from "../time.ts";
import {
  sampleScalarChannelsAtTime,
  scalarExpressionConstant,
} from "../donors/opencut/animation/sample.ts";
import { mediaTime } from "../donors/opencut/animation/media-time.ts";
import type { Channel } from "../donors/opencut/animation/types.ts";
import type { ClipAnimation } from "../timeline/animation-schema.ts";
import { CommandError } from "../command/errors.ts";

/** Hard cap on piecewise segments (10 min @ 30 fps). */
export const MAX_ANIMATION_SEGMENTS = 18_000;

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

type Segment = { t0: number; t1: number; value: number };

function piecewiseSegments(
  channel: Channel<number>,
  path: string,
  durationTicks: number,
  fps: Rational,
  fallback: number,
  /** When true, times are timeline absolute; offset is clip start. */
  timeMode: "local" | "timeline",
  clipStartTicks: number,
): Segment[] {
  const frame = frameTicksFor(fps);
  const frames = Math.max(1, Math.ceil(durationTicks / frame));
  if (frames > MAX_ANIMATION_SEGMENTS)
    throw new Error(
      `Animation segment count ${frames} exceeds ${MAX_ANIMATION_SEGMENTS}.`,
    );
  const segments: Segment[] = [];
  for (let i = 0; i < frames; i++) {
    const local0 = i * frame;
    const local1 = Math.min(durationTicks, (i + 1) * frame);
    if (local1 <= local0) continue;
    const mid = local0 + Math.floor((local1 - local0) / 2);
    const value = sampleAnimationPathAtLocalTime(channel, path, mid, fallback);
    if (timeMode === "local")
      segments.push({ t0: local0, t1: local1, value });
    else
      segments.push({
        t0: clipStartTicks + local0,
        t1: clipStartTicks + local1,
        value,
      });
  }
  return segments;
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
  const span = localEnd - localStart;
  if (span <= 0) return [`[${inputLabel}]null[${outputLabel}]`];
  const frame = frameTicksFor(args.fps);
  const frames = Math.max(1, Math.ceil(span / frame));
  if (frames > MAX_ANIMATION_SEGMENTS)
    throw new Error(
      `Animation segment count ${frames} exceeds ${MAX_ANIMATION_SEGMENTS}.`,
    );
  const segments: Segment[] = [];
  for (let i = 0; i < frames; i++) {
    const l0 = localStart + i * frame;
    const l1 = Math.min(localEnd, localStart + (i + 1) * frame);
    if (l1 <= l0) continue;
    const mid = l0 + Math.floor((l1 - l0) / 2);
    segments.push({
      t0: args.clipStartTicks + l0,
      t1: args.clipStartTicks + l1,
      value: sampleAnimationPathAtLocalTime(channel, "opacity", mid, 1),
    });
  }
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
  const segments = piecewiseSegments(
    channel,
    "volume",
    durationTicks,
    fps,
    1,
    "local",
    0,
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
