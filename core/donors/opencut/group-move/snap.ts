// Adapted from OpenCut Classic (MIT) apps/web/src/timeline/group-move/snap.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: snap adapters;
// MediaTime helpers → addTicks; maxSnapDistance passed in (no zoom).
import { addTicks } from "../../../time.ts";
import type { SceneTracks } from "../timeline-types.ts";
import {
  buildTimelineSnapPoints,
  resolveTimelineSnap,
  type SnapPoint,
} from "../snapping.ts";
import {
  getAnimationKeyframeSnapPointsForTimeline,
  getElementEdgeSnapPoints,
  getPlayheadSnapPoints,
} from "../adapters.ts";
import type { MoveGroup } from "./types.ts";

export function snapGroupEdges({
  group,
  anchorStartTime,
  tracks,
  playheadTime,
  maxSnapDistance,
}: {
  group: MoveGroup;
  anchorStartTime: number;
  tracks: SceneTracks;
  playheadTime: number;
  maxSnapDistance: number;
}): {
  snappedAnchorStartTime: number;
  snapPoint: SnapPoint | null;
} {
  const excludeElementIds = new Set(
    group.members.map((member) => member.elementId),
  );
  const snapPoints = buildTimelineSnapPoints({
    sources: [
      () => getElementEdgeSnapPoints({ tracks, excludeElementIds }),
      () => getPlayheadSnapPoints({ playheadTime }),
      () => getAnimationKeyframeSnapPointsForTimeline(),
    ],
  });

  let closestSnapDistance = Infinity;
  let snappedAnchorStartTime = anchorStartTime;
  let snapPoint: SnapPoint | null = null;

  for (const member of group.members) {
    const memberStartTime = addTicks(anchorStartTime, member.timeOffset);
    const memberStartSnap = resolveTimelineSnap({
      targetTime: memberStartTime,
      snapPoints,
      maxSnapDistance,
    });
    if (
      memberStartSnap.snapPoint &&
      memberStartSnap.snapDistance < closestSnapDistance
    ) {
      closestSnapDistance = memberStartSnap.snapDistance;
      snappedAnchorStartTime = addTicks(
        memberStartSnap.snappedTime,
        -member.timeOffset,
      );
      snapPoint = memberStartSnap.snapPoint;
    }

    const memberEndSnap = resolveTimelineSnap({
      targetTime: addTicks(memberStartTime, member.duration),
      snapPoints,
      maxSnapDistance,
    });
    if (
      memberEndSnap.snapPoint &&
      memberEndSnap.snapDistance < closestSnapDistance
    ) {
      closestSnapDistance = memberEndSnap.snapDistance;
      snappedAnchorStartTime = addTicks(
        addTicks(memberEndSnap.snappedTime, -member.duration),
        -member.timeOffset,
      );
      snapPoint = memberEndSnap.snapPoint;
    }
  }

  return {
    snappedAnchorStartTime,
    snapPoint,
  };
}
