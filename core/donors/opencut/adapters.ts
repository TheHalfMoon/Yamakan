// Yamakan adapters for OpenCut group-move dependencies that are not copied
 // (M4): track lookup, placement compatibility, and snap sources. Animation
 // keyframe snaps stay empty until M6.
import { addTicks } from "../../time.ts";
import type { CanonicalProject } from "../../canonical.ts";
import type { SnapPoint } from "./snapping.ts";
import type {
  ElementType,
  SceneTracks,
  TimelineElement,
  TimelineTrack,
  TrackKind,
} from "./timeline-types.ts";

const EMPTY_MAIN: TimelineTrack = {
  id: "__yamakan_empty_main__",
  type: "video",
  elements: [],
};

export function elementTypeForClip(
  project: CanonicalProject,
  clip: CanonicalProject["clips"][number],
): ElementType {
  const track = project.tracks.find((t) => t.id === clip.trackId);
  if (track?.kind === "audio") return "audio";
  if (clip.title !== null) return "text";
  const asset = project.assets.find((a) => a.id === clip.assetId);
  if (asset?.kind === "image") return "image";
  return "video";
}

export function clipToElement(
  project: CanonicalProject,
  clip: CanonicalProject["clips"][number],
): TimelineElement {
  return {
    id: clip.id,
    startTime: clip.startTicks,
    duration: clip.durationTicks,
    type: elementTypeForClip(project, clip),
  };
}

export function projectToSceneTracks(project: CanonicalProject): SceneTracks {
  const videos = project.tracks.filter((t) => t.kind === "video");
  const audios = project.tracks.filter((t) => t.kind === "audio");
  const elementsOn = (trackId: string) =>
    project.clips
      .filter((c) => c.trackId === trackId)
      .map((c) => clipToElement(project, c));

  const mainTrack = videos[0];
  const main: TimelineTrack = mainTrack
    ? {
        id: mainTrack.id,
        type: "video",
        elements: elementsOn(mainTrack.id),
      }
    : { ...EMPTY_MAIN, elements: [] };

  return {
    overlay: videos.slice(1).map((t) => ({
      id: t.id,
      type: "video" as const,
      elements: elementsOn(t.id),
    })),
    main,
    audio: audios.map((t) => ({
      id: t.id,
      type: "audio" as const,
      elements: elementsOn(t.id),
    })),
  };
}

export function findTrackInSceneTracks({
  tracks,
  trackId,
}: {
  tracks: SceneTracks;
  trackId: string;
}): TimelineTrack | null {
  if (tracks.main.id === trackId) return tracks.main;
  return (
    tracks.overlay.find((t) => t.id === trackId) ??
    tracks.audio.find((t) => t.id === trackId) ??
    null
  );
}

export function getTrackTypeForElementType({
  elementType,
}: {
  elementType: ElementType;
}): TrackKind {
  return elementType === "audio" ? "audio" : "video";
}

export function getElementEdgeSnapPoints({
  tracks,
  excludeElementIds,
}: {
  tracks: SceneTracks;
  excludeElementIds: ReadonlySet<string>;
}): SnapPoint[] {
  const points: SnapPoint[] = [];
  for (const track of [
    ...tracks.overlay,
    tracks.main,
    ...tracks.audio,
  ]) {
    for (const element of track.elements) {
      if (excludeElementIds.has(element.id)) continue;
      points.push({
        time: element.startTime,
        type: "element-start",
        elementId: element.id,
        trackId: track.id,
      });
      points.push({
        time: addTicks(element.startTime, element.duration),
        type: "element-end",
        elementId: element.id,
        trackId: track.id,
      });
    }
  }
  return points;
}

export function getPlayheadSnapPoints({
  playheadTime,
}: {
  playheadTime: number;
}): SnapPoint[] {
  if (!Number.isSafeInteger(playheadTime) || playheadTime < 0) return [];
  return [{ time: playheadTime, type: "playhead" }];
}

export function getAnimationKeyframeSnapPointsForTimeline(): SnapPoint[] {
  // M6 adds animation snap points; until then the source is empty.
  return [];
}

/** Write SceneTracks element times/tracks back onto canonical clips. */
export function applySceneTracksToProject(
  project: CanonicalProject,
  tracks: SceneTracks,
): void {
  const byId = new Map<string, { trackId: string; startTime: number }>();
  for (const track of [
    ...tracks.overlay,
    tracks.main,
    ...tracks.audio,
  ]) {
    if (track.id === EMPTY_MAIN.id) continue;
    for (const element of track.elements) {
      byId.set(element.id, {
        trackId: track.id,
        startTime: element.startTime,
      });
    }
  }
  for (const clip of project.clips) {
    const next = byId.get(clip.id);
    if (!next) continue;
    clip.trackId = next.trackId;
    clip.startTicks = next.startTime;
  }
}
