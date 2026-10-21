// Adapted from OpenCut Classic (MIT)
 // apps/web/src/timeline/group-move/resolve-move.ts
 // @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: MediaTime → flick
 // ticks via addTicks; compatibility/overlap from local adapters; main-track
 // clamp kept for the projected primary video track.
import { addTicks } from "../../../time.ts";
import type { SceneTracks } from "../timeline-types.ts";
import { getTrackTypeForElementType } from "../adapters.ts";
import { canPlaceTimeSpansOnTrack } from "../overlap.ts";
import type {
  GroupMoveResult,
  MoveGroup,
  PlannedElementMove,
  PlannedTrackCreation,
} from "./types.ts";
import {
  getDisplayTracks,
  getTrackPlacementByDisplayIndex,
  getTrackPlacementById,
} from "./track-placement.ts";

type GroupMoveTarget =
  | {
      kind: "existingTrack";
      anchorTargetTrackId: string;
    }
  | {
      kind: "newTracks";
      anchorInsertIndex: number;
      newTrackIds: string[];
    };

const ZERO = 0;

function maxTicks(a: number, b: number): number {
  return a > b ? a : b;
}

export function resolveGroupMove({
  group,
  tracks,
  anchorStartTime,
  target,
}: {
  group: MoveGroup;
  tracks: SceneTracks;
  anchorStartTime: number;
  target: GroupMoveTarget;
}): GroupMoveResult | null {
  if (target.kind === "newTracks") {
    return resolveNewTrackMove({
      group,
      tracks,
      anchorStartTime,
      anchorInsertIndex: target.anchorInsertIndex,
      newTrackIds: target.newTrackIds,
    });
  }

  return resolveExistingTrackMove({
    group,
    tracks,
    anchorStartTime,
    anchorTargetTrackId: target.anchorTargetTrackId,
  });
}

function resolveExistingTrackMove({
  group,
  tracks,
  anchorStartTime,
  anchorTargetTrackId,
}: {
  group: MoveGroup;
  tracks: SceneTracks;
  anchorStartTime: number;
  anchorTargetTrackId: string;
}): GroupMoveResult | null {
  const anchorTargetPlacement = getTrackPlacementById({
    tracks,
    trackId: anchorTargetTrackId,
  });
  if (!anchorTargetPlacement) {
    return null;
  }

  const targetTrackIdsByElementId = resolveExistingTrackIdsByElementId({
    group,
    tracks,
    anchorTargetDisplayIndex: anchorTargetPlacement.displayIndex,
  });
  if (!targetTrackIdsByElementId) {
    return null;
  }

  const clampedAnchorStartTime = clampAnchorStartTime({
    group,
    anchorStartTime,
  });

  const moves = group.members.map((member) => ({
    sourceTrackId: member.trackId,
    targetTrackId:
      targetTrackIdsByElementId.get(member.elementId) ?? member.trackId,
    elementId: member.elementId,
    newStartTime: addTicks(clampedAnchorStartTime, member.timeOffset),
  }));

  if (!canApplyMovesToExistingTracks({ tracks, moves })) {
    return null;
  }

  return {
    moves,
    createTracks: [],
    targetSelection: moves.map(({ elementId, targetTrackId }) => ({
      trackId: targetTrackId,
      elementId,
    })),
  };
}

function resolveNewTrackMove({
  group,
  tracks,
  anchorStartTime,
  anchorInsertIndex,
  newTrackIds,
}: {
  group: MoveGroup;
  tracks: SceneTracks;
  anchorStartTime: number;
  anchorInsertIndex: number;
  newTrackIds: string[];
}): GroupMoveResult | null {
  const sortedMembers = [...group.members].sort(
    (leftMember, rightMember) =>
      leftMember.displayIndex - rightMember.displayIndex,
  );
  const anchorMemberIndex = sortedMembers.findIndex(
    (member) => member.elementId === group.anchor.elementId,
  );
  if (anchorMemberIndex < 0 || newTrackIds.length < sortedMembers.length) {
    return null;
  }

  const hasAudioMember = sortedMembers.some(
    (member) => member.trackSection === "audio",
  );
  const hasNonAudioMember = sortedMembers.some(
    (member) => member.trackSection !== "audio",
  );
  if (hasAudioMember && hasNonAudioMember) {
    return null;
  }

  const clampedAnchorStartTime = clampAnchorStartTime({
    group,
    anchorStartTime,
  });
  const blockStartIndex = hasAudioMember
    ? clampAudioInsertIndex({
        tracks,
        insertIndex: anchorInsertIndex - anchorMemberIndex,
      })
    : Math.max(
        0,
        Math.min(anchorInsertIndex - anchorMemberIndex, tracks.overlay.length),
      );

  const createTracks: PlannedTrackCreation[] = sortedMembers.map(
    (member, memberIndex) => ({
      id: newTrackIds[memberIndex]!,
      type: getTrackTypeForElementType({
        elementType: member.elementType,
      }),
      index: blockStartIndex + memberIndex,
    }),
  );
  const moves = sortedMembers.map((member, memberIndex) => ({
    sourceTrackId: member.trackId,
    targetTrackId: newTrackIds[memberIndex]!,
    elementId: member.elementId,
    newStartTime: addTicks(clampedAnchorStartTime, member.timeOffset),
  }));

  return {
    moves,
    createTracks,
    targetSelection: moves.map(({ elementId, targetTrackId }) => ({
      trackId: targetTrackId,
      elementId,
    })),
  };
}

function clampAudioInsertIndex({
  tracks,
  insertIndex,
}: {
  tracks: SceneTracks;
  insertIndex: number;
}): number {
  const minimumAudioInsertIndex = tracks.overlay.length + 1;
  return Math.max(
    minimumAudioInsertIndex,
    Math.min(insertIndex, minimumAudioInsertIndex + tracks.audio.length),
  );
}

function resolveExistingTrackIdsByElementId({
  group,
  tracks,
  anchorTargetDisplayIndex,
}: {
  group: MoveGroup;
  tracks: SceneTracks;
  anchorTargetDisplayIndex: number;
}): Map<string, string> | null {
  const sortedMembers = [...group.members].sort(
    (leftMember, rightMember) =>
      leftMember.displayIndex - rightMember.displayIndex,
  );
  const anchorMemberIndex = sortedMembers.findIndex(
    (member) => member.elementId === group.anchor.elementId,
  );
  if (anchorMemberIndex < 0) {
    return null;
  }

  const targetTrackIdsByElementId = new Map<string, string>();
  const usedTrackIds = new Set<string>();
  const anchorPlacement = getTrackPlacementByDisplayIndex({
    tracks,
    displayIndex: anchorTargetDisplayIndex,
  });
  if (!anchorPlacement) {
    return null;
  }

  targetTrackIdsByElementId.set(
    group.anchor.elementId,
    anchorPlacement.trackId,
  );
  usedTrackIds.add(anchorPlacement.trackId);

  let upperBoundaryIndex = anchorTargetDisplayIndex;
  for (
    let memberIndex = anchorMemberIndex - 1;
    memberIndex >= 0;
    memberIndex -= 1
  ) {
    const member = sortedMembers[memberIndex]!;
    const targetPlacement = findCompatibleTrackPlacement({
      tracks,
      requiredTrackType: getTrackTypeForElementType({
        elementType: member.elementType,
      }),
      startDisplayIndex: upperBoundaryIndex - 1,
      step: -1,
      usedTrackIds,
    });
    if (!targetPlacement) {
      return null;
    }

    targetTrackIdsByElementId.set(member.elementId, targetPlacement.trackId);
    usedTrackIds.add(targetPlacement.trackId);
    upperBoundaryIndex = targetPlacement.displayIndex;
  }

  let lowerBoundaryIndex = anchorTargetDisplayIndex;
  for (
    let memberIndex = anchorMemberIndex + 1;
    memberIndex < sortedMembers.length;
    memberIndex += 1
  ) {
    const member = sortedMembers[memberIndex]!;
    const targetPlacement = findCompatibleTrackPlacement({
      tracks,
      requiredTrackType: getTrackTypeForElementType({
        elementType: member.elementType,
      }),
      startDisplayIndex: lowerBoundaryIndex + 1,
      step: 1,
      usedTrackIds,
    });
    if (!targetPlacement) {
      return null;
    }

    targetTrackIdsByElementId.set(member.elementId, targetPlacement.trackId);
    usedTrackIds.add(targetPlacement.trackId);
    lowerBoundaryIndex = targetPlacement.displayIndex;
  }

  return targetTrackIdsByElementId;
}

function findCompatibleTrackPlacement({
  tracks,
  requiredTrackType,
  startDisplayIndex,
  step,
  usedTrackIds,
}: {
  tracks: SceneTracks;
  requiredTrackType: ReturnType<typeof getTrackTypeForElementType>;
  startDisplayIndex: number;
  step: -1 | 1;
  usedTrackIds: Set<string>;
}) {
  for (
    let displayIndex = startDisplayIndex;
    displayIndex >= 0 &&
    displayIndex < tracks.overlay.length + 1 + tracks.audio.length;
    displayIndex += step
  ) {
    const placement = getTrackPlacementByDisplayIndex({
      tracks,
      displayIndex,
    });
    if (!placement) {
      continue;
    }

    if (
      placement.trackType === requiredTrackType &&
      !usedTrackIds.has(placement.trackId)
    ) {
      return placement;
    }
  }

  return null;
}

function clampAnchorStartTime({
  group,
  anchorStartTime,
}: {
  group: MoveGroup;
  anchorStartTime: number;
}): number {
  const minimumAnchorStartTime = group.members.reduce(
    (minimumStartTime, member) =>
      member.timeOffset < ZERO
        ? maxTicks(minimumStartTime, addTicks(ZERO, -member.timeOffset))
        : minimumStartTime,
    ZERO,
  );
  // Yamakan: keep the non-negative clamp only. The donor's "main track must
  // start at zero when it would become the earliest clip" rule does not apply
  // to the canonical model (no distinguished main fill-from-zero invariant).
  return anchorStartTime < minimumAnchorStartTime
    ? minimumAnchorStartTime
    : anchorStartTime;
}

function canApplyMovesToExistingTracks({
  tracks,
  moves,
}: {
  tracks: SceneTracks;
  moves: PlannedElementMove[];
}): boolean {
  const movingElementIds = new Set(moves.map((move) => move.elementId));
  const sourceElements = new Map(
    getDisplayTracks({ tracks }).flatMap((track) =>
      track.elements.map((element) => [element.id, element] as const),
    ),
  );
  const movesByTargetTrackId = new Map<string, PlannedElementMove[]>();
  for (const move of moves) {
    const targetMoves = movesByTargetTrackId.get(move.targetTrackId) ?? [];
    targetMoves.push(move);
    movesByTargetTrackId.set(move.targetTrackId, targetMoves);
  }

  for (const [targetTrackId, targetMoves] of movesByTargetTrackId) {
    const targetPlacement = getTrackPlacementById({
      tracks,
      trackId: targetTrackId,
    });
    if (!targetPlacement) {
      return false;
    }

    const targetTrack = getDisplayTracks({ tracks })[
      targetPlacement.displayIndex
    ];
    if (!targetTrack) {
      return false;
    }

    const timeSpans = targetMoves.map((move) => {
      const sourceElement = sourceElements.get(move.elementId);
      return {
        startTime: move.newStartTime,
        duration: sourceElement?.duration ?? ZERO,
      };
    });
    if (hasOverlappingTimeSpans({ timeSpans })) {
      return false;
    }

    if (
      !canPlaceTimeSpansOnTrack({
        track: {
          // overlap.ts uses Yamakan clip field names (startTicks/durationTicks).
          elements: targetTrack.elements
            .filter((element) => !movingElementIds.has(element.id))
            .map((element) => ({
              id: element.id,
              startTicks: element.startTime,
              durationTicks: element.duration,
            })),
        },
        timeSpans,
      })
    ) {
      return false;
    }
  }

  return true;
}

function hasOverlappingTimeSpans({
  timeSpans,
}: {
  timeSpans: Array<{ startTime: number; duration: number }>;
}): boolean {
  const sortedSpans = [...timeSpans].sort(
    (leftSpan, rightSpan) => leftSpan.startTime - rightSpan.startTime,
  );

  for (let spanIndex = 1; spanIndex < sortedSpans.length; spanIndex += 1) {
    const previousSpan = sortedSpans[spanIndex - 1]!;
    const currentSpan = sortedSpans[spanIndex]!;
    if (
      previousSpan.startTime + previousSpan.duration >
      currentSpan.startTime
    ) {
      return true;
    }
  }

  return false;
}
