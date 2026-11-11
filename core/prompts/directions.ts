// A shot's direction, as words: shot size, camera movement, lens and light. The Create page
// adds them to a generation's prompt; the Director's Cinema planner (core/director/cinema-shot.ts)
// builds a Blender scene from the same choices. Pure: the browser bundle reads it too.

// Neither model takes camera settings. A direction is only words in the prompt, so
// each choice here is the words it adds, and the model may not follow them.
export const DIRECTIONS = Object.freeze({
  shot: {
    wide: "wide shot",
    medium: "medium shot",
    close: "close-up",
    aerial: "aerial view",
  },
  movement: {
    still: "static camera",
    pan: "slow pan",
    push: "slow push in",
    pull: "slow pull back",
    handheld: "handheld camera",
    orbit: "camera orbits the subject",
  },
  lens: {
    wide: "wide-angle lens",
    normal: "50mm lens",
    tele: "telephoto lens",
    macro: "macro lens",
  },
  light: {
    morning: "soft morning light",
    golden: "golden hour light",
    night: "night, low light",
    studio: "soft studio lighting",
  },
});
export type DirectionKind = keyof typeof DIRECTIONS;
export const DIRECTION_KINDS = Object.keys(DIRECTIONS) as DirectionKind[];
