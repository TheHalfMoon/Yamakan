// Canonical render plan (plan T7, contract "Canonical render plan"). An
// immutable, versioned description of exactly what a render draws: derived
// only from the canonical project at one revision, its asset hashes, the
// output profile, the compiled title script and the pinned font hashes.
// It holds no paths, URLs, filters or free text other than title cues;
// export and (in T8) reference preview both render from it.
import { createHash } from "node:crypto";
import { isSupportedRate } from "../project.ts";
import type { CanonicalProject } from "../canonical.ts";
import type { Rational } from "../time.ts";
import { addTicks, rational } from "../time.ts";
import { CommandError } from "../command/errors.ts";
import { ASS_COMPILER_VERSION, compileTitles } from "./ass.ts";
import type { TitleCue } from "./ass.ts";
import type { PinnedFont } from "./fonts.ts";
import { clampRetimeRate } from "../retime/rate.ts";
import {
  DEFAULT_LOUDNORM_TARGET,
  LOUDNORM_ENABLED,
  type LoudnormSpec,
} from "../audio/loudnorm.ts";
import { ANIMATION_ENABLED } from "../animation/flags.ts";
import type { ClipAnimation } from "../timeline/animation-schema.ts";
import {
  assertAnimationRenderable,
  assertPlanAnimationBudget,
  selectedAnimationCompiler,
  type AnimationCompiler,
} from "./animation-filters.ts";
import {
  EFFECT_LIMITS,
  clipLut,
  clipTransform,
  type TransformEffect,
} from "../effects/registry.ts";
import { TRANSITION_POLICY, previousClip } from "../transitions.ts";
import {
  COLOR_POLICY,
  sourceColor,
  type ProbedColor,
  type SourceColor,
} from "../effects/color.ts";

const UNITY = rational(1, 1);
function clipSpeed(c: CanonicalProject["clips"][number]): Rational {
  return c.speed ? clampRetimeRate({ rate: c.speed }) : UNITY;
}

export const RENDER_PLAN_FORMAT = "yamakan.render-plan/v1";
// v2 (YU-023): every picture is converted to the frozen color policy and
// the output is tagged, so every plan and render changed.
export const COMPILER_VERSION = "yamakan.render-compiler/2";

// MVP output profile: SDR 8-bit 4:2:0, square pixels, fixed rational frame
// rate, 48 kHz stereo, picture fit inside the frame (letterboxed).
export type OutputProfile = {
  width: number;
  height: number;
  fps: Rational;
  sampleRate: 48000;
  pixelFormat: "yuv420p";
  fit: "contain";
};

export type VideoLayer = {
  clipId: string;
  track: number;
  kind: "video" | "image";
  assetId: string;
  assetSha256: string;
  assetBytes: number;
  assetExtension: string;
  startTicks: number;
  durationTicks: number;
  sourceStartTicks: number;
  /** Source-over-timeline rate (2/1 = twice as fast). Default 1/1. */
  speed: Rational;
  /**
   * Present only when ANIMATION_ENABLED and the clip has animation.
   * Render applies opacity; transform paths are residual.
   */
  animation?: ClipAnimation;
  /**
   * YU-020: present only when the clip has a non-identity transform, so a
   * plan without effects (and its hash) is exactly as before.
   */
  transform?: TransformEffect;
  /**
   * YU-021: the layer dissolves in over its first this-many ticks (alpha
   * k/D at its k-th frame), over the previous clip extended under it.
   * Present only for a clip with a transition, so other plans are as before.
   */
  dissolveInTicks?: number;
  /** YU-023: how the source's pixels are read (null for RGB sources). */
  color: SourceColor;
  /** YU-023: the LUT document applied before the fit, when there is one. */
  lut?: { documentId: string; contentHash: string };
};

export type AudioInstruction = {
  clipId: string;
  track: number;
  assetId: string;
  assetSha256: string;
  assetBytes: number;
  assetExtension: string;
  startTicks: number;
  durationTicks: number;
  sourceStartTicks: number;
  gainDb: number;
  fadeInTicks: number;
  fadeOutTicks: number;
  speed: Rational;
  /** Present only when ANIMATION_ENABLED; render applies volume. */
  animation?: ClipAnimation;
  /** YU-021: equal-power (quarter-sine) crossfade in over the first ticks. */
  crossfadeInTicks?: number;
  /** YU-021: equal-power crossfade out over the last ticks. */
  crossfadeOutTicks?: number;
};
export type RenderPlan = {
  format: typeof RENDER_PLAN_FORMAT;
  compilerVersion: typeof COMPILER_VERSION;
  projectId: string;
  revision: number;
  snapshotHash: string;
  profile: OutputProfile;
  /** YU-023: the color policy every picture is converted to. */
  colorPolicy: typeof COLOR_POLICY;
  durationTicks: number;
  layers: VideoLayer[];
  audio: AudioInstruction[];
  titles: {
    compiler: typeof ASS_COMPILER_VERSION;
    sha256: string;
    cues: TitleCue[];
  } | null;
  fonts: { name: string; sha256: string }[];
  /**
   * YU-022: the animation compiler, present only when a layer or sound is
   * animated (so a plan without animation, and its hash, is as before).
   */
  animationCompiler?: AnimationCompiler;
  /** YU-021: present only when a transition is drawn. */
  transitionPolicy?: typeof TRANSITION_POLICY;
  /** Two-pass loudnorm; null when normalization is off for this export. */
  loudnorm: LoudnormSpec | null;
  planHash: string;
};

export type CompiledPlan = { plan: RenderPlan; ass: string | null };

export type CompilePlanOptions = {
  /** When true and LOUDNORM_ENABLED, attach the default loudnorm target. */
  normalizeLoudness?: boolean;
  /**
   * YU-024: the revision's burned-in caption tracks, each a list of cues in
   * time order (read from its caption documents by the caller). They are
   * drawn above every track, through the title compiler, within the
   * timeline's duration.
   */
  captions?: { startTicks: number; endTicks: number; text: string }[][];
  /**
   * YU-023: a source's color tags, as probed when it was imported (null
   * when the asset has no recorded probe: the policy then decides from its
   * file type).
   */
  colors?: (assetId: string) => ProbedColor | null;
};

// Compiles the plan for `project` at its revision. `snapshotHash` is the
// stored snapshot the project was read from.
export function compilePlan(
  project: CanonicalProject,
  snapshotHash: string,
  fonts: PinnedFont[],
  options: CompilePlanOptions = {},
): CompiledPlan {
  if (!/^[a-f0-9]{64}$/.test(snapshotHash))
    throw new CommandError("VALIDATION", "Snapshot hash is invalid.");
  // Qualified render rates: 30 (the MVP profile) and 24000/1001 (YU-019).
  // Other rates need their own timing and verification qualification.
  if (!isSupportedRate(project.output.fps))
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      "Rendering supports 30 and 24000/1001 frames per second.",
    );
  const trackIndex = new Map(project.tracks.map((t, i) => [t.id, i]));
  // Mute removes a track; solo on any track of a kind keeps only soloed
  // tracks of that kind.
  const audible = (trackId: string) => {
    const track = project.tracks.find((t) => t.id === trackId)!;
    const soloed = project.tracks.some((t) => t.kind === track.kind && t.solo);
    return !track.muted && (!soloed || track.solo);
  };
  const active = project.clips
    .filter((c) => audible(c.trackId))
    .sort(
      (a, b) =>
        trackIndex.get(a.trackId)! - trackIndex.get(b.trackId)! ||
        a.startTicks - b.startTicks ||
        a.id.localeCompare(b.id),
    );
  const kindOf = (trackId: string) =>
    project.tracks.find((t) => t.id === trackId)!.kind;
  const asset = (id: string) => project.assets.find((a) => a.id === id)!;
  const layers: VideoLayer[] = [];
  const audio: AudioInstruction[] = [];
  const cues: TitleCue[] = [];
  for (const c of active) {
    const track = trackIndex.get(c.trackId)!;
    if (c.title !== null) {
      cues.push({
        layer: track,
        startTicks: c.startTicks,
        endTicks: addTicks(c.startTicks, c.durationTicks),
        text: c.title,
      });
      continue;
    }
    const a = asset(c.assetId!);
    const speed = clipSpeed(c);
    const timing = {
      clipId: c.id,
      track,
      assetId: a.id,
      assetSha256: a.hash,
      assetBytes: a.bytes,
      assetExtension: a.extension,
      startTicks: c.startTicks,
      durationTicks: c.durationTicks,
      sourceStartTicks: c.sourceStartTicks,
      speed,
    };
    const anim =
      ANIMATION_ENABLED && c.animation ? { animation: c.animation } : {};
    if (kindOf(c.trackId) === "audio" || a.kind === "audio")
      audio.push({
        ...timing,
        gainDb: c.gainDb,
        fadeInTicks: c.fadeInTicks,
        fadeOutTicks: c.fadeOutTicks,
        ...anim,
      });
    else {
      const transform = clipTransform(c.effects);
      const lut = clipLut(c.effects);
      if (transform) {
        const { crop, scale } = transform;
        if (
          (crop.left || crop.top || crop.right || crop.bottom) &&
          (a.width < EFFECT_LIMITS.cropSourcePixels ||
            a.height < EFFECT_LIMITS.cropSourcePixels)
        )
          throw new CommandError(
            "VALIDATION",
            `A source smaller than ${EFFECT_LIMITS.cropSourcePixels} pixels cannot be cropped.`,
          );
        // The fitted picture is at most the frame; scaled, it must stay
        // within the pixel budget.
        if (
          project.output.width * project.output.height * (scale / 1000) ** 2 >
          EFFECT_LIMITS.scaledPixels
        )
          throw new CommandError(
            "LIMIT_EXCEEDED",
            "This scale makes the picture too large to render at this output size.",
          );
      }
      layers.push({
        ...timing,
        kind: a.kind === "image" ? "image" : "video",
        color: sourceColor(options.colors?.(a.id) ?? null, {
          height: a.height,
          extension: a.extension,
        }),
        ...(lut
          ? {
              lut: { documentId: lut.documentId, contentHash: lut.contentHash },
            }
          : {}),
        ...anim,
        ...(transform ? { transform } : {}),
      });
      if (a.kind === "video" && c.sound?.enabled)
        audio.push({
          ...timing,
          gainDb: c.sound.gainDb,
          fadeInTicks: c.sound.fadeInTicks,
          fadeOutTicks: c.sound.fadeOutTicks,
          ...anim,
        });
    }
  }
  // Transitions (YU-021, core/transitions.ts): each dissolve becomes
  // handle-extended layers and sounds, so the compiler below and the render
  // need no other notion of a transition. Clip times are validated already.
  let transitions = 0;
  for (const c of active) {
    const t = c.transition;
    if (!t) continue;
    const before = previousClip(project.clips, c);
    if (!before)
      throw new CommandError(
        "VALIDATION",
        "A transition has no previous clip.",
      );
    const half = t.durationTicks / 2;
    if (!Number.isSafeInteger(half))
      throw new CommandError(
        "VALIDATION",
        "A transition is not on whole ticks.",
      );
    const outgoing = layers.find((x) => x.clipId === before.id);
    const incoming = layers.find((x) => x.clipId === c.id);
    if (!outgoing || !incoming)
      throw new CommandError(
        "VALIDATION",
        "A transition joins clips not drawn.",
      );
    transitions++;
    outgoing.durationTicks += half;
    incoming.startTicks -= half;
    incoming.durationTicks += half;
    if (incoming.kind === "video") incoming.sourceStartTicks -= half;
    incoming.dissolveInTicks = t.durationTicks;
    if (t.audio !== "equalPower") continue;
    const soundOut = audio.find((x) => x.clipId === before.id);
    const soundIn = audio.find((x) => x.clipId === c.id);
    if (soundOut) {
      soundOut.durationTicks += half;
      soundOut.crossfadeOutTicks = t.durationTicks;
    }
    if (soundIn) {
      soundIn.startTicks -= half;
      soundIn.sourceStartTicks -= half;
      soundIn.durationTicks += half;
      soundIn.crossfadeInTicks = t.durationTicks;
    }
  }
  if (!layers.length && !cues.length)
    throw new CommandError(
      "VALIDATION",
      "Timeline has no active picture or title.",
    );
  // Refused before any render (YU-022): an undrawable channel, keys at one
  // time or out of range, a curve past its cap, or a plan past its budget.
  // Each clip is checked for the channels it draws: opacity on a picture,
  // volume on a sound.
  const compiler = selectedAnimationCompiler();
  const totals = { segments: 0, samples: 0 };
  const opacityOnly = new Set(["opacity"]);
  const volumeOnly = new Set(["volume"]);
  for (const x of layers)
    if (x.animation)
      assertAnimationRenderable(
        x.clipId,
        x.animation,
        x.durationTicks,
        project.output.fps,
        compiler,
        opacityOnly,
        totals,
      );
  for (const x of audio)
    if (x.animation)
      assertAnimationRenderable(
        x.clipId,
        x.animation,
        x.durationTicks,
        project.output.fps,
        compiler,
        volumeOnly,
        totals,
      );
  assertPlanAnimationBudget(totals, compiler);
  const durationTicks = Math.max(
    ...active.map((c) => addTicks(c.startTicks, c.durationTicks)),
  );
  const profile: OutputProfile = {
    width: project.output.width,
    height: project.output.height,
    fps: project.output.fps,
    sampleRate: 48000,
    pixelFormat: "yuv420p",
    fit: "contain",
  };
  // Burned-in captions (YU-024): above every track, each track on its own
  // layer, cut to the timeline (a cue after its end is not shown).
  (options.captions ?? []).forEach((track, n) => {
    for (const cue of track) {
      if (cue.startTicks >= durationTicks) break;
      cues.push({
        layer: project.tracks.length + n,
        startTicks: cue.startTicks,
        endTicks: Math.min(cue.endTicks, durationTicks),
        text: cue.text,
      });
    }
  });
  const compiled = cues.length
    ? compileTitles(cues, profile.width, profile.height, fonts)
    : null;
  const body: Omit<RenderPlan, "planHash"> = {
    format: RENDER_PLAN_FORMAT,
    compilerVersion: COMPILER_VERSION,
    projectId: project.id,
    revision: project.revision,
    snapshotHash,
    profile,
    colorPolicy: COLOR_POLICY,
    durationTicks,
    layers,
    audio,
    titles: compiled
      ? { compiler: ASS_COMPILER_VERSION, sha256: compiled.sha256, cues }
      : null,
    fonts: compiled
      ? fonts.map((f) => ({ name: f.name, sha256: f.sha256 }))
      : [],
    loudnorm:
      LOUDNORM_ENABLED && options.normalizeLoudness
        ? { target: { ...DEFAULT_LOUDNORM_TARGET }, measured: null }
        : null,
    ...([...layers, ...audio].some(
      (x) =>
        x.animation && Object.values(x.animation).some((ch) => ch?.keys.length),
    )
      ? { animationCompiler: compiler }
      : {}),
    ...(transitions ? { transitionPolicy: TRANSITION_POLICY } : {}),
  };
  const planHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return { plan: { ...body, planHash }, ass: compiled?.ass ?? null };
}

/** Attach measured loudnorm values and recompute planHash. */
export function withMeasuredLoudnorm(
  plan: RenderPlan,
  measured: NonNullable<LoudnormSpec["measured"]>,
): RenderPlan {
  if (!plan.loudnorm)
    throw new CommandError(
      "VALIDATION",
      "Plan has no loudnorm target to measure.",
    );
  const body: Omit<RenderPlan, "planHash"> = {
    format: plan.format,
    compilerVersion: plan.compilerVersion,
    projectId: plan.projectId,
    revision: plan.revision,
    snapshotHash: plan.snapshotHash,
    profile: plan.profile,
    colorPolicy: plan.colorPolicy,
    durationTicks: plan.durationTicks,
    layers: plan.layers,
    audio: plan.audio,
    titles: plan.titles,
    fonts: plan.fonts,
    loudnorm: { ...plan.loudnorm, measured },
    ...(plan.animationCompiler
      ? { animationCompiler: plan.animationCompiler }
      : {}),
    ...(plan.transitionPolicy
      ? { transitionPolicy: plan.transitionPolicy }
      : {}),
  };
  const planHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return { ...body, planHash };
}
