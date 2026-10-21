// Adapted from OpenCut Classic (MIT) apps/web/src/timeline/group-move/types.ts
 // @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: MediaTime → flick
 // ticks; TrackType → video|audio; ElementRef from local timeline-types.
import type {
  ElementRef,
  ElementType,
  TrackKind,
} from "../timeline-types.ts";

export type GroupTrackSection = "overlay" | "main" | "audio";

export interface GroupMember extends ElementRef {
  elementType: ElementType;
  duration: number;
  timeOffset: number;
  trackSection: GroupTrackSection;
  sectionIndex: number;
  displayIndex: number;
}

export interface MoveGroup {
  anchor: GroupMember;
  members: GroupMember[];
}

export interface PlannedTrackCreation {
  id: string;
  type: TrackKind;
  index: number;
}

export interface PlannedElementMove {
  sourceTrackId: string;
  targetTrackId: string;
  elementId: string;
  newStartTime: number;
}

export interface GroupMoveResult {
  moves: PlannedElementMove[];
  createTracks: PlannedTrackCreation[];
  targetSelection: ElementRef[];
}
