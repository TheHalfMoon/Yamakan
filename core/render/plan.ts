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
  ANIMATION_COMPILER,
  assertAnimationRenderable,
} from "./animation-filters.ts";
import {
  EFFECT_LIMITS,
  clipTransform,
  type TransformEffect,
} from "../effects/registry.ts";

const UNITY = rational(1, 1);
function clipSpeed(c: CanonicalProject["clips"][number]): Rational {
  return c.speed ? clampRetimeRate({ rate: c.speed }) : UNITY;
}

export const RENDER_PLAN_FORMAT = "yamakan.render-plan/v1";
export const COMPILER_VERSION = "yamakan.render-compiler/1";

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
};
export type RenderPlan = {
  format: typeof RENDER_PLAN_FORMAT;
  compilerVersion: typeof COMPILER_VERSION;
  projectId: string;
  revision: number;
  snapshotHash: string;
  profile: OutputProfile;
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
  animationCompiler?: typeof ANIMATION_COMPILER;
  /** Two-pass loudnorm; null when normalization is off for this export. */
  loudnorm: LoudnormSpec | null;
  planHash: string;
};

export type CompiledPlan = { plan: RenderPlan; ass: string | null };

export type CompilePlanOptions = {
  /** When true and LOUDNORM_ENABLED, attach the default loudnorm target. */
  normalizeLoudness?: boolean;
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
    // Refused before any render: an undrawable channel, keys at one time,
    // or a curve that would compile past the segment cap (YU-022).
    if (anim.animation)
      assertAnimationRenderable(
        anim.animation,
        c.durationTicks,
        project.output.fps,
      );
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
          project.output.width *
            project.output.height *
            (scale / 1000) ** 2 >
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
  if (!layers.length && !cues.length)
    throw new CommandError(
      "VALIDATION",
      "Timeline has no active picture or title.",
    );
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
        x.animation &&
        Object.values(x.animation).some((ch) => ch?.keys.length),
    )
      ? { animationCompiler: ANIMATION_COMPILER }
      : {}),
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
    durationTicks: plan.durationTicks,
    layers: plan.layers,
    audio: plan.audio,
    titles: plan.titles,
    fonts: plan.fonts,
    loudnorm: { ...plan.loudnorm, measured },
    ...(plan.animationCompiler
      ? { animationCompiler: plan.animationCompiler }
      : {}),
  };
  const planHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return { ...body, planHash };
}
