// Adapted from OpenCut Classic (MIT)
// apps/web/src/timeline/group-move/build-group.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: findTrack adapter;
// subMediaTime → addTicks(a, -b); flick ticks.
import { addTicks } from "../../time.ts";
import type { ElementRef, SceneTracks } from "../timeline-types.ts";
import { findTrackInSceneTracks } from "../adapters.ts";
import type { GroupMember, MoveGroup } from "./types.ts";
import { getTrackPlacementById } from "./track-placement.ts";

export function buildMoveGroup({
  anchorRef,
  selectedElements,
  tracks,
}: {
  anchorRef: ElementRef;
  selectedElements: ElementRef[];
  tracks: SceneTracks;
}): MoveGroup | null {
  const anchorTrack = findTrackInSceneTracks({
    tracks,
    trackId: anchorRef.trackId,
  });
  const anchorElement = anchorTrack?.elements.find(
    (element) => element.id === anchorRef.elementId,
  );
  const anchorPlacement = getTrackPlacementById({
    tracks,
    trackId: anchorRef.trackId,
  });
  if (!anchorTrack || !anchorElement || !anchorPlacement) {
    return null;
  }

  const seen = new Set<string>();
  const orderedRefs = [anchorRef, ...selectedElements].filter((elementRef) => {
    if (seen.has(elementRef.elementId)) {
      return false;
    }

    seen.add(elementRef.elementId);
    return true;
  });

  const members = orderedRefs.flatMap((elementRef): GroupMember[] => {
    const track = findTrackInSceneTracks({
      tracks,
      trackId: elementRef.trackId,
    });
    const element = track?.elements.find(
      (trackElement) => trackElement.id === elementRef.elementId,
    );
    const placement = getTrackPlacementById({
      tracks,
      trackId: elementRef.trackId,
    });
    if (!track || !element || !placement) {
      return [];
    }

    return [
      {
        trackId: track.id,
        elementId: element.id,
        elementType: element.type,
        duration: element.duration,
        timeOffset: addTicks(element.startTime, -anchorElement.startTime),
        trackSection: placement.section,
        sectionIndex: placement.sectionIndex,
        displayIndex: placement.displayIndex,
      },
    ];
  });

  if (members.length === 0) {
    return null;
  }

  const anchor = members.find(
    (member) =>
      member.trackId === anchorRef.trackId &&
      member.elementId === anchorRef.elementId,
  );
  if (!anchor) {
    return null;
  }

  return {
    anchor,
    members,
  };
}
