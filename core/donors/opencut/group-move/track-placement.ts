// Adapted from OpenCut Classic (MIT)
 // apps/web/src/timeline/group-move/track-placement.ts
 // @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: SceneTracks from
 // adapters; TimelineTrack.type is video|audio.
import type { SceneTracks, TimelineTrack } from "../timeline-types.ts";
import type { GroupTrackSection } from "./types.ts";

export interface TrackPlacement {
  trackId: string;
  trackType: TimelineTrack["type"];
  section: GroupTrackSection;
  sectionIndex: number;
  displayIndex: number;
}

export function getDisplayTracks({
  tracks,
}: {
  tracks: SceneTracks;
}): TimelineTrack[] {
  return [...tracks.overlay, tracks.main, ...tracks.audio];
}

export function getTrackPlacementById({
  tracks,
  trackId,
}: {
  tracks: SceneTracks;
  trackId: string;
}): TrackPlacement | null {
  if (tracks.main.id === trackId) {
    return {
      trackId,
      trackType: tracks.main.type,
      section: "main",
      sectionIndex: -1,
      displayIndex: tracks.overlay.length,
    };
  }

  const overlayTrackIndex = tracks.overlay.findIndex(
    (track) => track.id === trackId,
  );
  if (overlayTrackIndex >= 0) {
    return {
      trackId,
      trackType: tracks.overlay[overlayTrackIndex]!.type,
      section: "overlay",
      sectionIndex: overlayTrackIndex,
      displayIndex: overlayTrackIndex,
    };
  }

  const audioTrackIndex = tracks.audio.findIndex(
    (track) => track.id === trackId,
  );
  if (audioTrackIndex >= 0) {
    return {
      trackId,
      trackType: tracks.audio[audioTrackIndex]!.type,
      section: "audio",
      sectionIndex: audioTrackIndex,
      displayIndex: tracks.overlay.length + 1 + audioTrackIndex,
    };
  }

  return null;
}

export function getTrackPlacementByDisplayIndex({
  tracks,
  displayIndex,
}: {
  tracks: SceneTracks;
  displayIndex: number;
}): TrackPlacement | null {
  const displayTracks = getDisplayTracks({ tracks });
  const track = displayTracks[displayIndex];
  if (!track) {
    return null;
  }

  return getTrackPlacementById({
    tracks,
    trackId: track.id,
  });
}
