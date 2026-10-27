// P10-02 / YU-022: FFmpeg filter fragments for opacity/volume from
// clip.animation. Each output frame is sampled at its middle by the shared
// sampler, as before; consecutive frames whose values agree within an
// explicit tolerance then become one segment, so a graph's size follows how
// much the value changes, not how many frames the clip has. Holds and steps
// are one segment per key; a full 0..1 opacity ramp is at most 256
// segments however long it lasts. The per-frame compiler (version 1) is
// kept: it is the reference the bounded one is tested against, and an
// operator can select it again (YAMAKAN_ANIMATION_COMPILER=1). Transform
// channels are not rendered (yet): a plan that has them is refused before
// rendering, never drawn without them.
import { FLICKS_PER_SECOND, type Rational } from "../time.ts";
import { scalarExpressionConstant } from "../animation/sample.ts";
import { getScalarChannelValueAtTime } from "../animation/interpolation.ts";
import { sampleScalarChannelsAtTime } from "../animation/sample.ts";
import { mediaTime } from "../animation/media-time.ts";
import type { Channel } from "../animation/types.ts";
import type { ClipAnimation } from "../timeline/animation-schema.ts";
import { CommandError } from "../command/errors.ts";

/**
 * The compilers a render plan may name. Version 2's tolerances and caps
 * below are part of it: changing any of them needs a new version, so a
 * plan hash never covers two different renders.
 */
export const ANIMATION_COMPILER_V1 = "yamakan.animation-compiler/1";
export const ANIMATION_COMPILER = "yamakan.animation-compiler/2";
export type AnimationCompiler =
  typeof ANIMATION_COMPILER_V1 | typeof ANIMATION_COMPILER;

/** The compiler new plans use (the operator may select version 1 again). */
export function selectedAnimationCompiler(): AnimationCompiler {
  return process.env.YAMAKAN_ANIMATION_COMPILER === "1"
    ? ANIMATION_COMPILER_V1
    : ANIMATION_COMPILER;
}

/**
 * Explicit tolerances (version 2). Opacity: one 8-bit alpha level, so the
 * merged value is the frame's own value rounded to a level the output can
 * hold. Volume: 1/200 of unity gain (about 0.04 dB near unity).
 */
export const OPACITY_TOLERANCE = 1 / 255;
export const VOLUME_TOLERANCE = 1 / 200;

/** The values a channel may take: keys outside are refused, curves clamped. */
export const CHANNEL_RANGE = Object.freeze({
  opacity: Object.freeze({ min: 0, max: 1 }),
  volume: Object.freeze({ min: 0, max: 16 }),
});

/** One channel's compiled segments at most (version 2). */
export const MAX_COMPILED_SEGMENTS = 1024;
/** A whole plan's compiled segments at most (version 2). */
export const MAX_PLAN_SEGMENTS = 4096;
/** One channel's sampled frames at most (10 min @ 30 fps). */
export const MAX_SAMPLED_FRAMES = 18_000;
/** A whole plan's sampled frames at most (every track's ten minutes). */
export const MAX_PLAN_SAMPLES = 600_000;

type RenderedPath = keyof typeof CHANNEL_RANGE;
const RENDERED = new Set<string>(Object.keys(CHANNEL_RANGE));

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
 * The shared sampler at increasing times, without re-reading every key for
 * every frame: a time between two keys depends only on those two keys (a
 * key's handles are fixed by its neighbours), and before the first or
 * after the last key only on the first or last two, so each time is
 * sampled from that pair. The values equal sampling the whole channel.
 * A non-finite result (from extreme keys) is refused, never replaced.
 */
function sampler(channel: Channel<number>, path: string) {
  const keys = [...channel.keys].sort((a, b) => a.time - b.time);
  let i = 0;
  let window: Channel<number> | null = null;
  let windowAt = -1;
  return (time: number) => {
    if (!keys.length) return 1;
    // The pair holding `time`: keys[i], keys[i + 1] (or the edge pair).
    while (i < keys.length - 2 && time >= keys[i + 1]!.time) i++;
    if (windowAt !== i) {
      window = {
        ...channel,
        keys: keys.length === 1 ? [keys[0]!] : [keys[i]!, keys[i + 1]!],
      };
      windowAt = i;
    }
    const value = getScalarChannelValueAtTime({
      channel: window!,
      time,
      fallbackValue: Number.NaN,
    });
    if (!Number.isFinite(value))
      throw new CommandError(
        "VALIDATION",
        `The ${path} animation has a value that cannot be computed.`,
      );
    return value;
  };
}

/** Frame windows over the local span [localStart, localEnd). */
function frames(localStart: number, localEnd: number, fps: Rational) {
  const span = localEnd - localStart;
  if (span <= 0) return [];
  const frame = frameTicksFor(fps);
  const count = Math.max(1, Math.ceil(span / frame));
  if (count > MAX_SAMPLED_FRAMES)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Animation spans more than ${MAX_SAMPLED_FRAMES} frames.`,
    );
  const out: { t0: number; t1: number; mid: number }[] = [];
  for (let n = 0; n < count; n++) {
    const t0 = localStart + n * frame;
    const t1 = Math.min(localEnd, localStart + (n + 1) * frame);
    if (t1 > t0) out.push({ t0, t1, mid: t0 + Math.floor((t1 - t0) / 2) });
  }
  return out;
}

const clamp = (path: RenderedPath, v: number) =>
  Math.min(CHANNEL_RANGE[path].max, Math.max(CHANNEL_RANGE[path].min, v));

/**
 * Version 1 (the reference): one segment per output frame, each the value
 * at the frame's middle (clamped to the channel's range).
 */
export function perFrameSegments(
  channel: Channel<number>,
  path: RenderedPath,
  localStart: number,
  localEnd: number,
  fps: Rational,
): Segment[] {
  const at = sampler(channel, path);
  return frames(localStart, localEnd, fps).map((f) => ({
    t0: f.t0,
    t1: f.t1,
    value: clamp(path, at(f.mid)),
  }));
}

/**
 * Version 2: the same per-frame values, each rounded to the tolerance, with
 * consecutive equal values merged. Every frame's value is within half a
 * tolerance of the reference's; more than MAX_COMPILED_SEGMENTS is refused.
 */
export function boundedSegments(
  channel: Channel<number>,
  path: RenderedPath,
  localStart: number,
  localEnd: number,
  fps: Rational,
): Segment[] {
  const tolerance = path === "opacity" ? OPACITY_TOLERANCE : VOLUME_TOLERANCE;
  const at = sampler(channel, path);
  const merged: Segment[] = [];
  for (const f of frames(localStart, localEnd, fps)) {
    const value = Math.round(clamp(path, at(f.mid)) / tolerance) * tolerance;
    const last = merged[merged.length - 1];
    if (last && last.value === value) last.t1 = f.t1;
    else {
      if (merged.length >= MAX_COMPILED_SEGMENTS)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          `The ${path} animation changes too often to render (more than ${MAX_COMPILED_SEGMENTS} steps).`,
        );
      merged.push({ t0: f.t0, t1: f.t1, value });
    }
  }
  return merged;
}

const segmentsFor = (compiler: AnimationCompiler) =>
  compiler === ANIMATION_COMPILER_V1 ? perFrameSegments : boundedSegments;

// Plan checks are repeated for every preview of an unchanged project, so a
// channel's result is remembered (a few hundred entries at most).
const checked = new Map<string, number>();
const CHECKED_ENTRIES = 256;

/**
 * Before any render (compilePlan), for each drawn channel of each clip:
 * only opacity and volume are rendered; keys are at distinct times and
 * within the channel's range; and the curve compiles within the caps.
 * Returns the segments it compiles to, for the plan's own budget.
 */
export function assertChannelRenderable(
  clipId: string,
  path: string,
  channel: Channel<number>,
  durationTicks: number,
  fps: Rational,
  compiler: AnimationCompiler,
): { segments: number; samples: number } {
  if (!channel?.keys.length) return { segments: 0, samples: 0 };
  if (!RENDERED.has(path))
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      `Clip ${clipId} animates ${path}, which is not rendered yet; remove it to export.`,
    );
  const rendered = path as RenderedPath;
  const times = channel.keys.map((k) => k.time);
  if (new Set(times).size !== times.length)
    throw new CommandError(
      "VALIDATION",
      `Clip ${clipId}'s ${path} animation has two keys at one time.`,
    );
  const range = CHANNEL_RANGE[rendered];
  if (channel.keys.some((k) => k.value < range.min || k.value > range.max))
    throw new CommandError(
      "VALIDATION",
      `Clip ${clipId}'s ${path} keys must be between ${range.min} and ${range.max}.`,
    );
  const memo = JSON.stringify([path, channel, durationTicks, fps, compiler]);
  const known = checked.get(memo);
  const samples = frames(0, durationTicks, fps).length;
  if (known !== undefined) return { segments: known, samples };
  const segments = segmentsFor(compiler)(
    channel,
    rendered,
    0,
    durationTicks,
    fps,
  ).length;
  if (checked.size >= CHECKED_ENTRIES)
    checked.delete(checked.keys().next().value!);
  checked.set(memo, segments);
  return { segments, samples };
}

/** A plan's totals must stay within the plan budgets (version 2). */
export function assertPlanAnimationBudget(
  totals: { segments: number; samples: number },
  compiler: AnimationCompiler,
) {
  if (totals.samples > MAX_PLAN_SAMPLES)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `This timeline animates more than ${MAX_PLAN_SAMPLES} frames in all.`,
    );
  if (compiler === ANIMATION_COMPILER && totals.segments > MAX_PLAN_SEGMENTS)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `This timeline's animation compiles to more than ${MAX_PLAN_SEGMENTS} steps in all.`,
    );
}

// A bounded decimal: values are clamped to a channel's range first, so
// six places never become exponent notation.
const decimal = (v: number) => scalarExpressionConstant(v);

/**
 * Chain colorchannelmixer aa= segments for the visible timeline range.
 * Stream `t` must be timeline seconds (same as overlay enable). The span is
 * taken on the clip's own frame grid, so a window shows the frames the
 * whole export shows.
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
    compiler?: AnimationCompiler;
  },
): string[] {
  const frame = frameTicksFor(args.fps);
  const from = Math.max(0, args.rangeStartTicks - args.clipStartTicks);
  const localStart = Math.floor(from / frame) * frame;
  const localEnd = Math.max(
    localStart,
    args.rangeEndTicks - args.clipStartTicks,
  );
  const segments = segmentsFor(args.compiler ?? ANIMATION_COMPILER)(
    channel,
    "opacity",
    localStart,
    localEnd,
    args.fps,
  ).map((s) => ({
    ...s,
    t0: args.clipStartTicks + s.t0,
    t1: args.clipStartTicks + s.t1,
  }));
  if (!segments.length) return [`[${inputLabel}]null[${outputLabel}]`];
  if (segments.length === 1) {
    const aa = decimal(segments[0]!.value);
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
    const enable = `gte(t,${seconds(seg.t0)})*lt(t,${seconds(seg.t1)})`;
    filters.push(
      `[${prev}]colorchannelmixer=aa=${decimal(seg.value)}:enable='${enable}'[${next}]`,
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
  compiler: AnimationCompiler = ANIMATION_COMPILER,
): string[] {
  const segments = segmentsFor(compiler)(
    channel,
    "volume",
    0,
    durationTicks,
    fps,
  );
  if (!segments.length) return [];
  if (segments.length === 1) return [`volume=${decimal(segments[0]!.value)}`];
  return segments.map((seg) => {
    const enable = `gte(t,${seconds(seg.t0)})*lt(t,${seconds(seg.t1)})`;
    return `volume=${decimal(seg.value)}:enable='${enable}'`;
  });
}

/** Constant opacity expression for a single preview frame (local mid-ticks). */
export function opacityConstantAtLocalTime(
  channel: Channel<number>,
  localTicks: number,
): string {
  const v = sampleAnimationPathAtLocalTime(channel, "opacity", localTicks, 1);
  return `format=yuva420p,colorchannelmixer=aa=${decimal(clamp("opacity", v))}`;
}

/**
 * Before any render: a clip's animation is drawable. Any channel the
 * renderer does not draw is refused; of the rendered ones, only those this
 * clip draws (`drawn`) are compiled. Adds to the plan's totals.
 */
export function assertAnimationRenderable(
  clipId: string,
  animation: ClipAnimation,
  durationTicks: number,
  fps: Rational,
  compiler: AnimationCompiler,
  drawn: ReadonlySet<string>,
  totals: { segments: number; samples: number },
) {
  for (const [path, channel] of Object.entries(animation)) {
    if (!channel?.keys.length) continue;
    if (RENDERED.has(path) && !drawn.has(path)) continue;
    const r = assertChannelRenderable(
      clipId,
      path,
      channel as Channel<number>,
      durationTicks,
      fps,
      compiler,
    );
    totals.segments += r.segments;
    totals.samples += r.samples;
  }
}
