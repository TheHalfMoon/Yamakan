// The editor's timeline edits on its local edit view, in frames at the
// project's rate (YU-019; seconds from the timeline round to the nearest
// frame here, the view boundary). Split and delete
// run the same typed operations as agents and tools (core/timeline), so both
// paths produce identical projects: shots keep their order, fades are
// clamped, and invariants are checked once. Drag and trim updates from the
// timeline component are converted here and clamp fades with the same rule.
import { frameRateOf, framesPerSecond } from "../core/project.ts";
import type { Clip, Project } from "../core/project.ts";
import { framesToTicks } from "../core/time.ts";
import { fromEditView, toEditView } from "../core/canonical.ts";
import { applyBatch, clampFades } from "../core/timeline/operations.ts";
import type { Operation } from "../core/timeline/operations.ts";
import type { ClipAnimation } from "../core/timeline/animation-schema.ts";
import type { TimelineClip } from "./editor/types";

// Flicks per frame of a 30 fps edit view (a fallback with no project open).
export const FRAME_TICKS = 23_520_000;
// Flicks at a frame of the project's edit view (exact).
export const frameTicksOf = (p: Project, frames = 1) =>
  framesToTicks(frames, frameRateOf(p));

// Applies operations to the local edit view; the revision is unchanged until
// the project is saved.
export function applyLocal(p: Project, operations: Operation[]): Project {
  return {
    ...toEditView(applyBatch(fromEditView(p), operations)),
    revision: p.revision,
  };
}

// Splits a clip at `seconds` on the timeline. Locked tracks and split points
// outside the clip leave the project unchanged.
export function splitClip(
  p: Project,
  clipId: string,
  seconds: number,
  newClipId: string,
): Project {
  const c = p.clips.find((c) => c.id === clipId);
  if (!c || p.tracks.find((t) => t.id === c.trackId)?.locked) return p;
  const at = Math.round(seconds * framesPerSecond(p));
  if (at <= c.startFrame || at >= c.startFrame + c.durationFrames) return p;
  return applyLocal(p, [
    {
      type: "clip.split",
      clipId,
      atTicks: frameTicksOf(p, at),
      newClipId,
    },
  ]);
}

// Removes a clip (and its place in any shot) unless its track is locked.
export function setClipSound(
  p: Project,
  clipId: string,
  patch: {
    enabled?: boolean;
    gainDb?: number;
    fadeInFrames?: number;
    fadeOutFrames?: number;
  },
): Project {
  return applyLocal(p, [
    {
      type: "clip.setSound",
      clipId,
      enabled: patch.enabled,
      gainDb: patch.gainDb,
      fadeInTicks:
        patch.fadeInFrames !== undefined
          ? frameTicksOf(p, patch.fadeInFrames)
          : undefined,
      fadeOutTicks:
        patch.fadeOutFrames !== undefined
          ? frameTicksOf(p, patch.fadeOutFrames)
          : undefined,
    },
  ]);
}

/** Set a clip's constant retime (rational). Titles are refused by the reducer. */
export function setClipSpeed(
  p: Project,
  clipId: string,
  speed: { num: number; den: number },
): Project {
  const c = p.clips.find((c) => c.id === clipId);
  if (!c || c.title !== null) return p;
  try {
    return applyLocal(p, [{ type: "clip.setSpeed", clipId, speed }]);
  } catch {
    return p;
  }
}

/** Replace or clear clip.animation (gated by ANIMATION_ENABLED in the reducer). */
export function setClipAnimation(
  p: Project,
  clipId: string,
  animation: ClipAnimation | null,
): Project {
  const c = p.clips.find((x) => x.id === clipId);
  if (!c || c.title !== null) return p;
  try {
    return applyLocal(p, [{ type: "clip.setAnimation", clipId, animation }]);
  } catch {
    return p;
  }
}

/** Upsert one opacity/volume (or transform) keyframe on a clip. */
export function upsertClipAnimationKeyframe(
  p: Project,
  args: {
    clipId: string;
    channel: "opacity" | "volume";
    timeTicks: number;
    value: number;
    easing?: "step" | "linear" | "bezier";
    keyId?: string;
  },
): Project {
  const c = p.clips.find((x) => x.id === args.clipId);
  if (!c || c.title !== null) return p;
  try {
    return applyLocal(p, [
      {
        type: "clip.upsertAnimationKeyframe",
        clipId: args.clipId,
        channel: args.channel,
        timeTicks: args.timeTicks,
        value: args.value,
        easing: args.easing,
        keyId: args.keyId,
      },
    ]);
  } catch {
    return p;
  }
}

export function deleteClip(p: Project, clipId: string | null): Project {
  const c = p.clips.find((c) => c.id === clipId);
  if (!c || p.tracks.find((t) => t.id === c.trackId)?.locked) return p;
  return applyLocal(p, [{ type: "clip.remove", clipId: c.id }]);
}

/** Delete a clip and ripple later clips on unlocked tracks to close the gap. */
export function rippleDeleteClip(p: Project, clipId: string | null): Project {
  const c = p.clips.find((c) => c.id === clipId);
  if (!c || p.tracks.find((t) => t.id === c.trackId)?.locked) return p;
  return applyLocal(p, [{ type: "timeline.rippleDelete", clipId: c.id }]);
}

/** Move a multi-clip selection; returns the project unchanged when refused. */
export function groupMoveClips(
  p: Project,
  args: {
    anchorClipId: string;
    clipIds: string[];
    anchorStartTicks: number;
    targetTrackId: string;
    snapTicks?: number;
    playheadTicks?: number;
  },
): Project {
  try {
    return applyLocal(p, [
      {
        type: "timeline.groupMove",
        anchorClipId: args.anchorClipId,
        clipIds: args.clipIds,
        anchorStartTicks: args.anchorStartTicks,
        targetTrackId: args.targetTrackId,
        snapTicks: args.snapTicks,
        playheadTicks: args.playheadTicks,
      },
    ]);
  } catch {
    return p;
  }
}

// Applies drag and trim updates from the timeline component. Clips on locked
// tracks are not moved; fades are clamped to the new duration.
export function updateClips(p: Project, updates: TimelineClip[]): Project {
  return {
    ...p,
    clips: updates.reduce((clips, c) => {
      const existing = clips.find((x) => x.id === c.id);
      const old =
        existing ||
        clips.find(
          (x) => x.assetId === c.mediaId || `title-${x.id}` === c.mediaId,
        );
      if (!old) return clips;
      if (
        (existing && p.tracks.find((t) => t.id === old.trackId)?.locked) ||
        p.tracks.find((t) => t.id === c.trackId)?.locked
      )
        return clips;
      const fps = framesPerSecond(p);
      const durationFrames = Math.max(1, Math.round((c.end - c.start) * fps));
      const [fadeInFrames, fadeOutFrames] = clampFades(
        durationFrames,
        old.fadeInFrames ?? 0,
        old.fadeOutFrames ?? 0,
      );
      const converted: Clip = {
        ...old,
        id: c.id,
        trackId: c.trackId,
        startFrame: Math.max(0, Math.round(c.start * fps)),
        durationFrames,
        // Titles and still images have no source offset (as in the reducer).
        sourceFrame:
          old.title !== null ||
          p.assets.find((a) => a.id === old.assetId)?.kind === "image"
            ? 0
            : Math.max(0, Math.round((c.sourceIn || 0) * fps)),
        ...(old.fadeInFrames !== undefined || old.fadeOutFrames !== undefined
          ? { fadeInFrames, fadeOutFrames }
          : {}),
      };
      return clips.some((x) => x.id === c.id)
        ? clips.map((x) => (x.id === c.id ? converted : x))
        : [...clips, converted];
    }, p.clips),
  };
}
