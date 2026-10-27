// Transitions (YU-021): one frame-exact dissolve between two adjacent clips
// on a video track, stored on the incoming clip. Browser-safe (no Node
// imports): the editor and the service apply the same rules.
//
// Semantics, under the named policy `centeredDissolve/v1`:
// - Adjacency. The incoming clip B starts exactly where the previous clip A
//   on the same track ends (the cut). There is no overlap on the timeline:
//   clip times, the cut and the timeline's length are unchanged.
// - Handles. The dissolve of D frames (an even number) is centred on the
//   cut: A plays on for D/2 frames past its end, from its source after its
//   out-point, and B starts D/2 frames early, from its source before its
//   in-point. Footage must have that much source; a still has any.
// - Picture. A stays opaque; B is drawn over it with alpha k/D at the k-th
//   frame of the dissolve (0 at its first frame), so the dissolve shows A
//   at its first frame and is exactly B from frame D on.
// - Sound (`audio: "equalPower"`). Each clip's embedded sound is extended
//   the same way and crossfaded with quarter-sine gains (sin and cos of the
//   same angle, so the summed power stays constant). `"cut"` leaves both
//   sounds at the cut.
import { z } from "zod";
import { Ticks, ticksToFrames, type Rational } from "./time.ts";

export const TRANSITION_POLICY = "centeredDissolve/v1";
export const TRANSITION_LIMITS = Object.freeze({
  minFrames: 2,
  // At most two seconds of the project's frames.
  maxSeconds: 2,
});

export const TransitionAudio = z.enum(["equalPower", "cut"]);
// Stored on the incoming clip (canonical ticks).
export const TransitionSchema = z
  .object({
    kind: z.literal("dissolve"),
    durationTicks: Ticks.min(1),
    audio: TransitionAudio,
  })
  .strict();
export type Transition = z.infer<typeof TransitionSchema>;
// The editing view's form, in frames.
export const EditTransitionSchema = z
  .object({
    kind: z.literal("dissolve"),
    durationFrames: z.number().int().min(1),
    audio: TransitionAudio,
  })
  .strict();

/**
 * Rollback switch for new transitions: YAMAKAN_TRANSITIONS_OFF=1 refuses
 * setting one (by command or whole-project save); stored transitions stay,
 * render and can be removed.
 */
export const TRANSITIONS_OFF =
  "Adding transitions is turned off on this service (YAMAKAN_TRANSITIONS_OFF); saved transitions stay and still render.";
export function transitionWritesEnabled(): boolean {
  return (
    typeof process === "undefined" ||
    process.env?.YAMAKAN_TRANSITIONS_OFF !== "1"
  );
}

type Clip = {
  id: string;
  trackId: string;
  assetId: string | null;
  title: string | null;
  startTicks: number;
  durationTicks: number;
  sourceStartTicks: number;
  sound: { enabled: boolean; fadeInTicks: number; fadeOutTicks: number } | null;
  speed?: Rational;
  animation?: Record<string, { keys: unknown[] } | undefined>;
  transition?: Transition;
};
type Project = {
  output: { fps: Rational };
  tracks: { id: string; kind: "video" | "audio" }[];
  assets: { id: string; kind: string; durationTicks: number }[];
  clips: Clip[];
};

/** The clip a transition into `clip` comes from: the one ending at its start. */
export const previousClip = <C extends Clip>(clips: C[], clip: C) =>
  clips.find(
    (c) =>
      c.id !== clip.id &&
      c.trackId === clip.trackId &&
      c.startTicks + c.durationTicks === clip.startTicks,
  ) ?? null;

const retimed = (c: Clip) =>
  c.speed !== undefined && c.speed.num !== c.speed.den;
const animated = (c: Clip) =>
  c.animation !== undefined &&
  Object.values(c.animation).some((ch) => (ch?.keys.length ?? 0) > 0);

/**
 * Why the transition into `clip` cannot be drawn, or null when it can.
 * Checked on every project (canonical validation), so an edit that would
 * break a transition (moving, trimming or replacing either clip) is refused
 * and names it; the transition is removed explicitly first.
 */
export function transitionProblem(p: Project, clip: Clip): string | null {
  const t = clip.transition;
  if (!t) return null;
  const fps = p.output.fps;
  let frames: number;
  try {
    frames = ticksToFrames(t.durationTicks, fps, "exact");
  } catch {
    return "A transition lasts a whole number of frames.";
  }
  const maxFrames = Math.floor(
    (TRANSITION_LIMITS.maxSeconds * fps.num) / fps.den,
  );
  if (frames < TRANSITION_LIMITS.minFrames || frames > maxFrames)
    return `A transition lasts ${TRANSITION_LIMITS.minFrames} to ${maxFrames} frames.`;
  if (frames % 2 !== 0)
    return "A transition lasts an even number of frames (it is centred on the cut).";
  if (p.tracks.find((x) => x.id === clip.trackId)?.kind !== "video")
    return "Transitions join clips on a video track.";
  const before = previousClip(p.clips, clip);
  if (!before)
    return "A transition needs its clip to start where the previous clip on its track ends; remove the transition first.";
  const half = t.durationTicks / 2;
  for (const [c, side] of [
    [before, "outgoing"],
    [clip, "incoming"],
  ] as const) {
    if (c.title !== null)
      return "A transition joins footage or stills, not titles.";
    const asset = p.assets.find((a) => a.id === c.assetId);
    if (!asset || asset.kind === "audio")
      return "A transition joins footage or stills, not audio.";
    if (retimed(c)) return "A transition joins clips at normal speed.";
    if (animated(c)) return "A transition joins clips without animation.";
    if (t.durationTicks > c.durationTicks)
      return "A transition is no longer than either clip.";
    if (asset.kind === "video") {
      const enough =
        side === "outgoing"
          ? c.sourceStartTicks + c.durationTicks + half <= asset.durationTicks
          : c.sourceStartTicks >= half;
      if (!enough)
        return `The ${side} clip has too little source media for this transition (half of it is needed beyond the cut).`;
    }
    if (t.audio === "equalPower" && c.sound?.enabled) {
      const fade =
        side === "outgoing" ? c.sound.fadeOutTicks : c.sound.fadeInTicks;
      if (fade > 0)
        return "Remove the sound fade at the cut before an equal-power crossfade.";
    }
  }
  // The outgoing clip's own transition in and this one do not overlap.
  if (
    before.transition &&
    before.transition.durationTicks / 2 + half > before.durationTicks
  )
    return "Two transitions on one clip cannot overlap.";
  return null;
}
