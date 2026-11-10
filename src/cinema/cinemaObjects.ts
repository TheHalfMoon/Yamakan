// Blocking out a Cinema shot with placeholder boxes (#203): add, remove, move,
// turn and resize the scene's objects. Every edit returns a new scene, so the
// page can tell a change by reference, and keeps the values core/scene3d.ts
// accepts, so a saved scene is never refused for them.
import type { CinemaSceneLocal } from "./CinemaViewport.tsx";

type Item = CinemaSceneLocal["items"][number];
export type CinemaAxis = "x" | "y" | "z";

/** How far one press moves, turns or resizes. */
export const CINEMA_NUDGE = Object.freeze({
  metres: 0.25,
  degrees: 15,
  factor: 1.25,
});

/** Far fewer than core allows (10,000): the page's preview draws each one every frame. */
export const CINEMA_PAGE_MAX_ITEMS = 200;
const MAX_METRES = 1000;
const MIN_SCALE = 0.05;
const MAX_SCALE = 100;
const PALETTE = ["#6b8cae", "#ae8b6b", "#7fae6b", "#a46bae", "#aea36b"];

const round = (n: number, places = 4) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function update(
  scene: CinemaSceneLocal,
  id: string,
  edit: (item: Item) => Item,
): CinemaSceneLocal {
  const at = scene.items.findIndex((i) => i.id === id);
  if (at < 0) throw new Error("That object is not in this scene.");
  const items = scene.items.slice();
  items[at] = edit(items[at]);
  return { ...scene, items };
}

/** The next box number: one more than the largest number ending an object's name. */
export function nextCinemaBoxNumber(scene: CinemaSceneLocal) {
  let largest = scene.items.length;
  for (const item of scene.items) {
    const n = Number(/(\d+)\s*$/.exec(item.name ?? "")?.[1]);
    if (Number.isSafeInteger(n) && n > largest) largest = n;
  }
  return largest + 1;
}

/**
 * A new placeholder box in front of the camera's start, named and placed by its number, so
 * names don't repeat and boxes added one after another don't stack.
 */
export function addCinemaBox(
  scene: CinemaSceneLocal,
  nameFor: (n: number) => string,
  id: string = crypto.randomUUID(),
): CinemaSceneLocal {
  if (scene.items.length >= CINEMA_PAGE_MAX_ITEMS)
    throw new Error(
      `This scene holds the most objects the page edits (${CINEMA_PAGE_MAX_ITEMS}).`,
    );
  const number = nextCinemaBoxNumber(scene);
  const n = number - 1;
  const item: Item = {
    id,
    name: nameFor(number),
    position: { x: round(((n % 5) - 2) * 1.25), y: 0.5, z: -2 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    // A placeholder, not a project asset.
    assetId: null,
    color: PALETTE[n % PALETTE.length],
  };
  return { ...scene, items: [...scene.items, item] };
}

export function removeCinemaItem(
  scene: CinemaSceneLocal,
  id: string,
): CinemaSceneLocal {
  if (!scene.items.some((i) => i.id === id))
    throw new Error("That object is not in this scene.");
  return { ...scene, items: scene.items.filter((i) => i.id !== id) };
}

export function moveCinemaItem(
  scene: CinemaSceneLocal,
  id: string,
  axis: CinemaAxis,
  metres: number,
): CinemaSceneLocal {
  return update(scene, id, (item) => ({
    ...item,
    position: {
      ...item.position,
      [axis]: round(
        clamp(item.position[axis] + metres, -MAX_METRES, MAX_METRES),
      ),
    },
  }));
}

/**
 * Turns about the scene's y axis, kept within -180° to 180°. Moves and turns follow the scene's
 * own axes, not the preview camera, so after orbiting behind the scene "left" is on the right.
 */
export function turnCinemaItem(
  scene: CinemaSceneLocal,
  id: string,
  degrees: number,
): CinemaSceneLocal {
  return update(scene, id, (item) => {
    let y = item.rotation.y + (degrees * Math.PI) / 180;
    y = Math.atan2(Math.sin(y), Math.cos(y));
    return { ...item, rotation: { ...item.rotation, y: round(y, 6) } };
  });
}

/** Resizes on every axis by one factor, each kept within 0.05 to 100 times. */
export function scaleCinemaItem(
  scene: CinemaSceneLocal,
  id: string,
  factor: number,
): CinemaSceneLocal {
  if (!(factor > 0) || !Number.isFinite(factor))
    throw new Error("A size factor must be a positive number.");
  const at = (n: number) => round(clamp(n * factor, MIN_SCALE, MAX_SCALE));
  return update(scene, id, (item) => ({
    ...item,
    scale: { x: at(item.scale.x), y: at(item.scale.y), z: at(item.scale.z) },
  }));
}

/**
 * What the page shows for an object: metres, degrees and size, rounded. Numbers stay numbers,
 * so the page writes them in its language's digits; a size that differs by axis is text.
 */
export function cinemaItemReadout(item: Item) {
  return {
    x: round(item.position.x, 2),
    y: round(item.position.y, 2),
    z: round(item.position.z, 2),
    turn: Math.round((item.rotation.y * 180) / Math.PI),
    scale:
      item.scale.x === item.scale.y && item.scale.y === item.scale.z
        ? round(item.scale.x, 2)
        : [item.scale.x, item.scale.y, item.scale.z]
            .map((v) => round(v, 2))
            .join(" × "),
  };
}
