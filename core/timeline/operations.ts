// Timeline operations (plan T6): typed, bounded edits applied as pure
// reducers to the canonical project. A batch applies every operation in order
// to a copy and validates the result once; any failure rejects the whole
// batch, so nothing is committed. IDs are supplied by the caller, which makes
// the same operations produce the same snapshot whether they come from the
// editor or from an agent.
import { z } from "zod";
import { Id } from "../project.ts";
import { Ticks, addTicks, rational } from "../time.ts";
import { CanonicalProjectSchema } from "../canonical.ts";
import type { CanonicalProject } from "../canonical.ts";
import { CommandError } from "../command/errors.ts";
import { canPlaceTimeSpansOnTrack } from "../donors/opencut/overlap.ts";
import { resolveTimelineSnap } from "../donors/opencut/snapping.ts";
import type { SnapPoint } from "../donors/opencut/snapping.ts";
import {
  applySceneTracksToProject,
  projectToSceneTracks,
} from "../donors/opencut/adapters.ts";
import {
  applyRippleAdjustments,
  computeRippleAdjustments,
  rippleShiftElements,
} from "../donors/opencut/ripple/index.ts";
import {
  buildMoveGroup,
  resolveGroupMove,
  snapGroupEdges,
} from "../donors/opencut/group-move/index.ts";
import { clampRetimeRate } from "../donors/opencut/retime/rate.ts";
import { getSourceTimeAtClipTime } from "../donors/opencut/retime/resolve.ts";
import { relinkVideoSound, unlinkVideoSound } from "../audio/unlink.ts";

const UNITY = rational(1, 1);
function clipRetime(c: CanonicalProject["clips"][number]) {
  return { rate: c.speed ?? UNITY };
}

// The widest snap an operation may ask for: one second.
const MAX_SNAP_TICKS = 705_600_000;

const Name = z.string().min(1).max(120);
const Camera = z
  .object({
    focalLengthMm: z.number().min(8).max(300),
    shotScale: z.enum(["wide", "medium", "close"]),
    movement: z.enum(["static", "dolly", "pan", "orbit"]),
  })
  .strict();

export const OperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("track.add"),
      trackId: Id,
      name: z.string().min(1).max(80),
      kind: z.enum(["video", "audio"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("track.update"),
      trackId: Id,
      name: z.string().min(1).max(80).optional(),
      muted: z.boolean().optional(),
      locked: z.boolean().optional(),
      solo: z.boolean().optional(),
      targeted: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("track.remove"), trackId: Id }).strict(),
  z
    .object({
      type: z.literal("clip.add"),
      clipId: Id,
      trackId: Id,
      assetId: Id.nullable(),
      title: z.string().max(500).nullable(),
      startTicks: Ticks,
      durationTicks: Ticks.min(1),
      sourceStartTicks: Ticks,
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.trim"),
      clipId: Id,
      // New timeline start and/or end; trimming the start moves the source in-point too.
      startTicks: Ticks.optional(),
      endTicks: Ticks.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.split"),
      clipId: Id,
      atTicks: Ticks,
      newClipId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.move"),
      clipId: Id,
      trackId: Id.optional(),
      startTicks: Ticks,
      // Snap the clip's start or end to the nearest other clip edge within
      // this distance (as an editor drag does); the result is still checked.
      snapTicks: Ticks.max(MAX_SNAP_TICKS).optional(),
    })
    .strict(),
  z.object({ type: z.literal("clip.remove"), clipId: Id }).strict(),
  z
    .object({
      type: z.literal("clip.setTitle"),
      clipId: Id,
      title: z.string().max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.setAudio"),
      clipId: Id,
      gainDb: z.number().min(-60).max(12).optional(),
      fadeInTicks: Ticks.optional(),
      fadeOutTicks: Ticks.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.setSound"),
      clipId: Id,
      enabled: z.boolean().optional(),
      gainDb: z.number().min(-60).max(12).optional(),
      fadeInTicks: Ticks.optional(),
      fadeOutTicks: Ticks.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.setSpeed"),
      clipId: Id,
      // Rational source/timeline rate in [1/100, 5/1].
      speed: z
        .object({
          num: z.number().int().positive().max(1_000_000),
          den: z.number().int().positive().max(1_000_000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.unlinkSound"),
      clipId: Id,
      audioTrackId: Id,
      audioClipId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal("clip.relinkSound"),
      clipId: Id,
      audioClipId: Id,
    })
    .strict(),
  z.object({ type: z.literal("scene.add"), sceneId: Id, name: Name }).strict(),
  z
    .object({
      type: z.literal("scene.update"),
      sceneId: Id,
      name: Name.optional(),
      referenceAssetId: Id.nullable().optional(),
      camera: Camera.optional(),
    })
    .strict(),
  z.object({ type: z.literal("scene.remove"), sceneId: Id }).strict(),
  z
    .object({
      type: z.literal("shot.add"),
      sceneId: Id,
      shotId: Id,
      name: Name,
      clipIds: z.array(Id).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("shot.update"),
      shotId: Id,
      name: Name.optional(),
      clipIds: z.array(Id).max(200).optional(),
    })
    .strict(),
  z.object({ type: z.literal("shot.remove"), shotId: Id }).strict(),
  z
    .object({
      type: z.literal("timeline.rippleDelete"),
      clipId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal("timeline.rippleTrim"),
      clipId: Id,
      startTicks: Ticks.optional(),
      endTicks: Ticks.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("timeline.insert"),
      clipId: Id,
      trackId: Id,
      assetId: Id.nullable(),
      title: z.string().max(500).nullable(),
      startTicks: Ticks,
      durationTicks: Ticks.min(1),
      sourceStartTicks: Ticks,
    })
    .strict(),
  z
    .object({
      type: z.literal("timeline.groupMove"),
      anchorClipId: Id,
      clipIds: z.array(Id).min(1).max(64),
      anchorStartTicks: Ticks,
      targetTrackId: Id,
      snapTicks: Ticks.max(MAX_SNAP_TICKS).optional(),
      playheadTicks: Ticks.optional(),
      // When set, create one new track per member (same count) instead of
      // placing onto existing tracks. Ids must be fresh.
      newTrackIds: z.array(Id).min(1).max(16).optional(),
      anchorInsertIndex: z.number().int().min(0).max(32).optional(),
    })
    .strict(),
]);
export type Operation = z.infer<typeof OperationSchema>;
export const BatchSchema = z.array(OperationSchema).min(1).max(64);

const invalid = (message: string) => new CommandError("VALIDATION", message);

function track(p: CanonicalProject, id: string) {
  const t = p.tracks.find((t) => t.id === id);
  if (!t) throw invalid("Track not found.");
  return t;
}
function clip(p: CanonicalProject, id: string) {
  const c = p.clips.find((c) => c.id === id);
  if (!c) throw invalid("Clip not found.");
  return c;
}
function unlocked(p: CanonicalProject, trackId: string) {
  if (track(p, trackId).locked) throw invalid("Track is locked.");
}
// Clips on one track never overlap (OpenCut placement rule).
function placeable(
  p: CanonicalProject,
  trackId: string,
  startTime: number,
  duration: number,
  excludeElementId?: string,
) {
  const elements = p.clips.filter((c) => c.trackId === trackId);
  if (
    !canPlaceTimeSpansOnTrack({
      track: { elements },
      timeSpans: [{ startTime, duration, excludeElementId }],
    })
  )
    throw invalid("Clips on a track cannot overlap.");
}
const end = (c: { startTicks: number; durationTicks: number }) =>
  addTicks(c.startTicks, c.durationTicks);
// Fades never outlast their clip: the fade-in keeps what fits, and the
// fade-out keeps what is left. Shared with the editor (src/edit-ops.ts), in
// any unit.
export function clampFades(
  duration: number,
  fadeIn: number,
  fadeOut: number,
): [number, number] {
  const kept = Math.min(fadeIn, duration);
  return [kept, Math.min(fadeOut, duration - kept)];
}
// Titles and still images draw the same picture at every instant: they have
// no source offset and can be extended in either direction.
function unsourced(p: CanonicalProject, c: CanonicalProject["clips"][number]) {
  return (
    c.title !== null ||
    p.assets.find((a) => a.id === c.assetId)?.kind === "image"
  );
}
// Every identifier in a project is unique; an add never reuses one.
function fresh(p: CanonicalProject, id: string) {
  const used =
    p.id === id ||
    p.assets.some((x) => x.id === id) ||
    p.tracks.some((x) => x.id === id) ||
    p.clips.some((x) => x.id === id) ||
    p.scenes.some((s) => s.id === id || s.shots.some((x) => x.id === id));
  if (used) throw invalid("Identifier is already in use.");
}

function apply(p: CanonicalProject, op: Operation): void {
  switch (op.type) {
    case "track.add":
      fresh(p, op.trackId);
      p.tracks.push({
        id: op.trackId,
        name: op.name,
        kind: op.kind,
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      });
      return;
    case "track.update": {
      const t = track(p, op.trackId);
      for (const key of [
        "name",
        "muted",
        "locked",
        "solo",
        "targeted",
      ] as const)
        if (op[key] !== undefined) Object.assign(t, { [key]: op[key] });
      return;
    }
    case "track.remove":
      track(p, op.trackId);
      if (p.clips.some((c) => c.trackId === op.trackId))
        throw invalid("Only an empty track can be removed.");
      p.tracks = p.tracks.filter((t) => t.id !== op.trackId);
      return;
    case "clip.add": {
      fresh(p, op.clipId);
      unlocked(p, op.trackId);
      placeable(p, op.trackId, op.startTicks, op.durationTicks);
      const tr = track(p, op.trackId);
      const asset =
        op.assetId === null
          ? null
          : (p.assets.find((a) => a.id === op.assetId) ?? null);
      if (op.title === null && op.assetId !== null && !asset)
        throw invalid("Clip asset is missing.");
      let sound: CanonicalProject["clips"][number]["sound"] = null;
      if (op.title === null && tr.kind === "video" && asset?.kind === "video")
        sound = {
          enabled: asset.hasAudio === true,
          gainDb: 0,
          fadeInTicks: 0,
          fadeOutTicks: 0,
        };
      p.clips.push({
        id: op.clipId,
        trackId: op.trackId,
        assetId: op.assetId,
        title: op.title,
        startTicks: op.startTicks,
        durationTicks: op.durationTicks,
        sourceStartTicks: op.sourceStartTicks,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
        sound,
      });
      return;
    }
    case "clip.trim": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      const newStart = op.startTicks ?? c.startTicks;
      const newEnd = op.endTicks ?? end(c);
      if (newEnd <= newStart) throw invalid("A clip must keep a duration.");
      const still = unsourced(p, c);
      // Retimed clips advance source by rate×timeline delta, not 1:1 ticks.
      const source = still
        ? 0
        : c.sourceStartTicks +
          getSourceTimeAtClipTime({
            clipTime: newStart - c.startTicks,
            retime: clipRetime(c),
          });
      if (!Number.isSafeInteger(source) || source < 0)
        throw invalid("Trim extends before the source.");
      placeable(p, c.trackId, newStart, newEnd - newStart, c.id);
      c.startTicks = newStart;
      c.durationTicks = newEnd - newStart;
      c.sourceStartTicks = source;
      [c.fadeInTicks, c.fadeOutTicks] = clampFades(
        c.durationTicks,
        c.fadeInTicks,
        c.fadeOutTicks,
      );
      if (c.sound) {
        [c.sound.fadeInTicks, c.sound.fadeOutTicks] = clampFades(
          c.durationTicks,
          c.sound.fadeInTicks,
          c.sound.fadeOutTicks,
        );
      }
      return;
    }
    case "clip.split": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      if (op.atTicks <= c.startTicks || op.atTicks >= end(c))
        throw invalid("Split point must fall inside the clip.");
      fresh(p, op.newClipId);
      const first = op.atTicks - c.startTicks;
      const secondSound = c.sound
        ? {
            ...c.sound,
            fadeInTicks: 0,
            fadeOutTicks: Math.min(
              c.sound.fadeOutTicks,
              c.durationTicks - first,
            ),
          }
        : null;
      const second = {
        ...c,
        id: op.newClipId,
        startTicks: op.atTicks,
        durationTicks: c.durationTicks - first,
        sourceStartTicks: unsourced(p, c)
          ? 0
          : addTicks(
              c.sourceStartTicks,
              getSourceTimeAtClipTime({
                clipTime: first,
                retime: clipRetime(c),
              }),
            ),
        fadeInTicks: 0,
        fadeOutTicks: Math.min(c.fadeOutTicks, c.durationTicks - first),
        sound: secondSound,
      };
      c.durationTicks = first;
      c.fadeOutTicks = 0;
      c.fadeInTicks = Math.min(c.fadeInTicks, first);
      if (c.sound) c.sound.fadeOutTicks = 0;
      if (c.sound) c.sound.fadeInTicks = Math.min(c.sound.fadeInTicks, first);
      p.clips.push(second);
      // The new clip joins the same shot as the clip it came from.
      for (const s of p.scenes)
        for (const shot of s.shots) {
          const at = shot.clipIds.indexOf(c.id);
          if (at >= 0) shot.clipIds.splice(at + 1, 0, second.id);
        }
      return;
    }
    case "clip.move": {
      const c = clip(p, op.clipId);
      const target = op.trackId ?? c.trackId;
      unlocked(p, c.trackId);
      unlocked(p, target);
      if (track(p, target).kind !== track(p, c.trackId).kind)
        throw invalid("Clips move only between tracks of the same kind.");
      const start = op.snapTicks
        ? (snapCandidates(p, c, op.startTicks, op.snapTicks).find((s) =>
            fits(p, target, s, c.durationTicks, c.id),
          ) ?? op.startTicks)
        : op.startTicks;
      placeable(p, target, start, c.durationTicks, c.id);
      c.trackId = target;
      c.startTicks = start;
      return;
    }
    case "clip.remove": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      p.clips = p.clips.filter((x) => x.id !== c.id);
      for (const s of p.scenes)
        for (const shot of s.shots)
          shot.clipIds = shot.clipIds.filter((id) => id !== c.id);
      return;
    }
    case "clip.setTitle": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      if (c.title === null) throw invalid("Only a title clip has text.");
      c.title = op.title;
      return;
    }
    case "clip.setAudio": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      if (track(p, c.trackId).kind !== "audio")
        throw invalid("Gain and fades apply to audio clips only.");
      if (op.gainDb !== undefined) c.gainDb = op.gainDb;
      if (op.fadeInTicks !== undefined) c.fadeInTicks = op.fadeInTicks;
      if (op.fadeOutTicks !== undefined) c.fadeOutTicks = op.fadeOutTicks;
      [c.fadeInTicks, c.fadeOutTicks] = clampFades(
        c.durationTicks,
        c.fadeInTicks,
        c.fadeOutTicks,
      );
      return;
    }
    case "clip.setSound": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      if (!c.sound) throw invalid("Only a video clip has embedded sound.");
      if (op.enabled === true && c.assetId) {
        // W18: refuse re-enabling embedded sound while an unlinked audio
        // clip still shares this asset (would double the bus).
        const unlinked = p.clips.some(
          (other) =>
            other.id !== c.id &&
            other.assetId === c.assetId &&
            track(p, other.trackId).kind === "audio",
        );
        if (unlinked)
          throw invalid(
            "Relink the unlinked audio clip before enabling embedded sound.",
          );
      }
      if (op.enabled !== undefined) c.sound.enabled = op.enabled;
      if (op.gainDb !== undefined) c.sound.gainDb = op.gainDb;
      if (op.fadeInTicks !== undefined) c.sound.fadeInTicks = op.fadeInTicks;
      if (op.fadeOutTicks !== undefined) c.sound.fadeOutTicks = op.fadeOutTicks;
      [c.sound.fadeInTicks, c.sound.fadeOutTicks] = clampFades(
        c.durationTicks,
        c.sound.fadeInTicks,
        c.sound.fadeOutTicks,
      );
      return;
    }
    case "clip.setSpeed": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      if (c.title !== null) throw invalid("Titles do not support retime.");
      c.speed = clampRetimeRate({ rate: op.speed });
      return;
    }
    case "clip.unlinkSound": {
      unlocked(p, clip(p, op.clipId).trackId);
      unlocked(p, op.audioTrackId);
      placeable(p, op.audioTrackId, clip(p, op.clipId).startTicks, clip(p, op.clipId).durationTicks);
      const next = unlinkVideoSound(p, {
        videoClipId: op.clipId,
        audioTrackId: op.audioTrackId,
        audioClipId: op.audioClipId,
      });
      p.formatVersion = next.formatVersion;
      p.clips = next.clips;
      return;
    }
    case "clip.relinkSound": {
      const video = clip(p, op.clipId);
      const audio = clip(p, op.audioClipId);
      unlocked(p, video.trackId);
      unlocked(p, audio.trackId);
      const next = relinkVideoSound(p, op.clipId, op.audioClipId);
      p.clips = next.clips;
      return;
    }
    case "scene.add":
      fresh(p, op.sceneId);
      p.scenes.push({
        id: op.sceneId,
        name: op.name,
        referenceAssetId: null,
        camera: { focalLengthMm: 35, shotScale: "medium", movement: "static" },
        shots: [],
      });
      return;
    case "scene.update": {
      const s = p.scenes.find((s) => s.id === op.sceneId);
      if (!s) throw invalid("Scene not found.");
      if (op.name !== undefined) s.name = op.name;
      if (op.referenceAssetId !== undefined)
        s.referenceAssetId = op.referenceAssetId;
      if (op.camera !== undefined) s.camera = op.camera;
      return;
    }
    case "scene.remove":
      if (!p.scenes.some((s) => s.id === op.sceneId))
        throw invalid("Scene not found.");
      p.scenes = p.scenes.filter((s) => s.id !== op.sceneId);
      return;
    case "shot.add": {
      const s = p.scenes.find((s) => s.id === op.sceneId);
      if (!s) throw invalid("Scene not found.");
      fresh(p, op.shotId);
      s.shots.push({ id: op.shotId, name: op.name, clipIds: op.clipIds });
      return;
    }
    case "shot.update": {
      const shot = p.scenes
        .flatMap((s) => s.shots)
        .find((s) => s.id === op.shotId);
      if (!shot) throw invalid("Shot not found.");
      if (op.name !== undefined) shot.name = op.name;
      if (op.clipIds !== undefined) shot.clipIds = op.clipIds;
      return;
    }
    case "shot.remove": {
      const scene = p.scenes.find((s) =>
        s.shots.some((x) => x.id === op.shotId),
      );
      if (!scene) throw invalid("Shot not found.");
      scene.shots = scene.shots.filter((x) => x.id !== op.shotId);
      return;
    }
    case "timeline.rippleDelete": {
      const c = clip(p, op.clipId);
      unlocked(p, c.trackId);
      const before = projectToSceneTracks(p);
      p.clips = p.clips.filter((x) => x.id !== c.id);
      for (const s of p.scenes)
        for (const shot of s.shots)
          shot.clipIds = shot.clipIds.filter((id) => id !== c.id);
      rippleCloseGaps(p, before);
      return;
    }
    case "timeline.rippleTrim": {
      if (op.startTicks === undefined && op.endTicks === undefined)
        throw invalid("Ripple trim needs a new start or end.");
      const before = projectToSceneTracks(p);
      apply(p, {
        type: "clip.trim",
        clipId: op.clipId,
        startTicks: op.startTicks,
        endTicks: op.endTicks,
      });
      rippleCloseGaps(p, before);
      return;
    }
    case "timeline.insert": {
      unlocked(p, op.trackId);
      fresh(p, op.clipId);
      const tracks = projectToSceneTracks(p);
      const trackRow =
        tracks.main.id === op.trackId
          ? tracks.main
          : (tracks.overlay.find((t) => t.id === op.trackId) ??
            tracks.audio.find((t) => t.id === op.trackId));
      if (!trackRow) throw invalid("Track not found.");
      // Open room for the new clip, then place it (donor shift with a
      // negative amount moves later elements to the right).
      const shifted = {
        ...tracks,
        overlay: tracks.overlay.map((t) =>
          t.id === op.trackId
            ? {
                ...t,
                elements: rippleShiftElements({
                  elements: t.elements,
                  afterTime: op.startTicks,
                  shiftAmount: -op.durationTicks,
                }),
              }
            : t,
        ),
        main:
          tracks.main.id === op.trackId
            ? {
                ...tracks.main,
                elements: rippleShiftElements({
                  elements: tracks.main.elements,
                  afterTime: op.startTicks,
                  shiftAmount: -op.durationTicks,
                }),
              }
            : tracks.main,
        audio: tracks.audio.map((t) =>
          t.id === op.trackId
            ? {
                ...t,
                elements: rippleShiftElements({
                  elements: t.elements,
                  afterTime: op.startTicks,
                  shiftAmount: -op.durationTicks,
                }),
              }
            : t,
        ),
      };
      applySceneTracksToProject(p, shifted);
      apply(p, {
        type: "clip.add",
        clipId: op.clipId,
        trackId: op.trackId,
        assetId: op.assetId,
        title: op.title,
        startTicks: op.startTicks,
        durationTicks: op.durationTicks,
        sourceStartTicks: op.sourceStartTicks,
      });
      return;
    }
    case "timeline.groupMove": {
      const tracks = projectToSceneTracks(p);
      const anchorClip = clip(p, op.anchorClipId);
      unlocked(p, anchorClip.trackId);
      unlocked(p, op.targetTrackId);
      const selected = op.clipIds
        .filter((id) => id !== op.anchorClipId)
        .map((id) => {
          const c = clip(p, id);
          unlocked(p, c.trackId);
          return { trackId: c.trackId, elementId: c.id };
        });
      const group = buildMoveGroup({
        anchorRef: {
          trackId: anchorClip.trackId,
          elementId: anchorClip.id,
        },
        selectedElements: selected,
        tracks,
      });
      if (!group) throw invalid("Group move selection is incomplete.");
      let anchorStart = op.anchorStartTicks;
      if (op.snapTicks !== undefined && op.snapTicks > 0) {
        const snapped = snapGroupEdges({
          group,
          anchorStartTime: anchorStart,
          tracks,
          playheadTime: op.playheadTicks ?? 0,
          maxSnapDistance: op.snapTicks,
        });
        anchorStart = snapped.snappedAnchorStartTime;
      }
      if (!Number.isSafeInteger(anchorStart) || anchorStart < 0)
        throw invalid("Group move start is out of range.");
      const target =
        op.newTrackIds && op.newTrackIds.length > 0
          ? {
              kind: "newTracks" as const,
              anchorInsertIndex: op.anchorInsertIndex ?? 0,
              newTrackIds: op.newTrackIds,
            }
          : {
              kind: "existingTrack" as const,
              anchorTargetTrackId: op.targetTrackId,
            };
      const resolved = resolveGroupMove({
        group,
        tracks,
        anchorStartTime: anchorStart,
        target,
      });
      if (!resolved)
        throw invalid(
          "Group move refused (overlap, cross-kind, or no compatible tracks).",
        );
      for (const created of resolved.createTracks) {
        // OpenCut's createTracks[].index is a SceneTracks display index, not a
        // Yamakan flat-array index. Append in member order; kind stays correct.
        fresh(p, created.id);
        p.tracks.push({
          id: created.id,
          name: created.type === "audio" ? "Audio" : "Video",
          kind: created.type,
          muted: false,
          locked: false,
          solo: false,
          targeted: false,
        });
      }
      const movers = new Set(resolved.moves.map((m) => m.elementId));
      // Overlap against stationary clips only; resolveGroupMove already
      // checked mover-vs-mover and mover-vs-stationary on existing tracks.
      for (const move of resolved.moves) {
        const c = clip(p, move.elementId);
        unlocked(p, move.targetTrackId);
        if (track(p, move.targetTrackId).kind !== track(p, c.trackId).kind)
          throw invalid("Clips move only between tracks of the same kind.");
        const stationary = p.clips.filter(
          (x) => x.trackId === move.targetTrackId && !movers.has(x.id),
        );
        if (
          !canPlaceTimeSpansOnTrack({
            track: { elements: stationary },
            timeSpans: [
              {
                startTime: move.newStartTime,
                duration: c.durationTicks,
              },
            ],
          })
        )
          throw invalid("Clips on a track cannot overlap.");
      }
      for (const move of resolved.moves) {
        const c = clip(p, move.elementId);
        c.trackId = move.targetTrackId;
        c.startTicks = move.newStartTime;
      }
      return;
    }
  }
}

/** Close gaps left by a delete/trim using OpenCut ripple adjustments. */
function rippleCloseGaps(
  p: CanonicalProject,
  before: ReturnType<typeof projectToSceneTracks>,
) {
  const after = projectToSceneTracks(p);
  const adjustments = computeRippleAdjustments({
    beforeTracks: before,
    afterTracks: after,
  }).filter((a) => {
    const t = p.tracks.find((x) => x.id === a.trackId);
    return t !== undefined && !t.locked;
  });
  applySceneTracksToProject(
    p,
    applyRippleAdjustments({ tracks: after, adjustments }),
  );
}

// Starts a moved clip may snap to, nearest first: its start or its end on
// another clip's edge (on any track) within the threshold.
function snapCandidates(
  p: CanonicalProject,
  moving: CanonicalProject["clips"][number],
  startTicks: number,
  snapTicks: number,
) {
  const points: SnapPoint[] = p.clips
    .filter((x) => x.id !== moving.id)
    .flatMap((x) => [
      { time: x.startTicks, type: "element-start" as const, elementId: x.id },
      { time: end(x), type: "element-end" as const, elementId: x.id },
    ]);
  const byStart = resolveTimelineSnap({
    targetTime: startTicks,
    snapPoints: points,
    maxSnapDistance: snapTicks,
  });
  const byEnd = resolveTimelineSnap({
    targetTime: addTicks(startTicks, moving.durationTicks),
    snapPoints: points,
    maxSnapDistance: snapTicks,
  });
  const candidates: [number, number][] = [];
  if (byStart.snapPoint)
    candidates.push([byStart.snapDistance, byStart.snappedTime]);
  if (byEnd.snapPoint && byEnd.snappedTime >= moving.durationTicks)
    candidates.push([
      byEnd.snapDistance,
      byEnd.snappedTime - moving.durationTicks,
    ]);
  return candidates.sort((a, b) => a[0] - b[0]).map(([, start]) => start);
}
function fits(
  p: CanonicalProject,
  trackId: string,
  startTime: number,
  duration: number,
  excludeElementId: string,
) {
  try {
    placeable(p, trackId, startTime, duration, excludeElementId);
    return true;
  } catch {
    return false;
  }
}

// Applies a whole batch to a copy and validates the result once.
export function applyBatch(
  project: CanonicalProject,
  operations: Operation[],
): CanonicalProject {
  const ops = BatchSchema.parse(operations);
  const next = structuredClone(project);
  ops.forEach((op, index) => {
    try {
      apply(next, op);
    } catch (e) {
      if (e instanceof CommandError || e instanceof RangeError)
        throw new CommandError(
          e instanceof CommandError ? e.code : "VALIDATION",
          `Operation ${index + 1} (${op.type}): ${
            e instanceof CommandError ? e.message : "Time is out of range."
          }`,
        );
      throw e;
    }
  });
  const checked = CanonicalProjectSchema.safeParse(next);
  if (!checked.success)
    throw invalid(
      `The batch would leave an invalid project: ${checked.error.issues[0]?.message ?? "invalid"}`,
    );
  return checked.data;
}
