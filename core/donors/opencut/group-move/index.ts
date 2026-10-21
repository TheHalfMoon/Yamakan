// Adapted from OpenCut Classic (MIT) apps/web/src/timeline/group-move/index.ts
 // @ cf5e79e919144200294fb9fed22a222592a0aeea.
export { buildMoveGroup } from "./build-group.ts";
export { resolveGroupMove } from "./resolve-move.ts";
export { snapGroupEdges } from "./snap.ts";

export type {
  GroupMember,
  GroupMoveResult,
  GroupTrackSection,
  MoveGroup,
  PlannedElementMove,
  PlannedTrackCreation,
} from "./types.ts";
