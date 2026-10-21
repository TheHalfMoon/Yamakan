// Local timeline types for OpenCut Classic ports (ripple, group-move).
// Mirrors the donor `@/timeline/types` fields these modules read, with
 // Yamakan integer flick ticks instead of wasm MediaTime.
//
// SceneTracks keeps the donor overlay/main/audio shape so group-move track
// placement stays close to the pin; Yamakan projects project into it via
 // `adapters.ts` (videos: first → main, rest → overlay; audios → audio).

export type TrackKind = "video" | "audio";

export type ElementType = "video" | "audio" | "image" | "text";

export interface TimelineElement {
  id: string;
  startTime: number;
  duration: number;
  type: ElementType;
}

export interface TimelineTrack {
  id: string;
  type: TrackKind;
  elements: TimelineElement[];
}

export interface SceneTracks {
  overlay: TimelineTrack[];
  main: TimelineTrack;
  audio: TimelineTrack[];
}

export interface ElementRef {
  trackId: string;
  elementId: string;
}
