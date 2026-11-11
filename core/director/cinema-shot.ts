// The Creative Director's Cinema planner (Blender integration): a shot's direction, as the
// Create page's words name it (core/prompts/directions.ts), becomes a structured Cinema scene and
// the settings to render it with Blender. Deterministic and pure: the same shot always plans the
// same scene, with no model and no network. It says which choices the render follows and which
// it cannot, rather than pretending.
import type { Scene3D } from "../scene3d.ts";
import type { BlenderRenderSettings } from "../blender/scene.ts";
import { DIRECTIONS, type DirectionKind } from "../prompts/directions.ts";

export type ShotDirection = Partial<Record<DirectionKind, string>>;

export type CinemaShotInput = {
  // The story shot's id: the scene's ids are made from it.
  shotId: string;
  direction: ShotDirection;
  // How long the shot is; the render keeps within 120 frames.
  seconds: number;
  fps: 24 | 30;
  size?: { width: number; height: number };
  samples?: number;
};

export type CinemaShotPlan = {
  scene: Scene3D;
  settings: BlenderRenderSettings;
  // Choices the render shows, and choices it cannot (each as "kind:choice").
  followed: string[];
  notFollowed: string[];
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// A lens choice as a focal length on a full-frame sensor.
const LENS_MM: Record<string, number> = {
  wide: 24,
  normal: 50,
  tele: 85,
  macro: 100,
};

type Box = {
  name: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotationY: number;
  color: string;
};

// The subject: one box at the middle of the set.
const SUBJECT: Box = {
  name: "subject",
  position: { x: 0, y: 0.5, z: 0 },
  scale: { x: 0.8, y: 1, z: 0.8 },
  rotationY: 0.4,
  color: "#3366cc",
};
// The set around it, nearest first. The render frames all that is shown, so the more of the set
// a shot keeps, the smaller the subject is in the picture: that is how shot size is made.
const SET: Box[] = [
  {
    name: "set: near block",
    position: { x: 1.6, y: 0.4, z: -0.6 },
    scale: { x: 0.8, y: 0.8, z: 0.8 },
    rotationY: 0.2,
    color: "#e07020",
  },
  {
    name: "set: back wall",
    position: { x: -0.5, y: 1.2, z: -3 },
    scale: { x: 3, y: 2.4, z: 0.2 },
    rotationY: 0,
    color: "#8a8f99",
  },
  {
    name: "set: far block",
    position: { x: -4, y: 0.8, z: -2 },
    scale: { x: 1.6, y: 1.6, z: 1.6 },
    rotationY: 0.6,
    color: "#5a8f4a",
  },
  {
    name: "set: far tower",
    position: { x: 5, y: 2, z: -6 },
    scale: { x: 1.2, y: 4, z: 1.2 },
    rotationY: 0.1,
    color: "#a05a8a",
  },
];
const SET_FOR_SIZE: Record<string, number> = {
  close: 0,
  medium: 1,
  wide: SET.length,
  aerial: SET.length,
};

const ORBIT: Record<string, number> = { still: 0, orbit: 90 };

const known = (kind: DirectionKind, choice: string | undefined) =>
  choice !== undefined &&
  Object.hasOwn(DIRECTIONS[kind] as Record<string, string>, choice);

/** An id made from the shot's: the same shot, the same ids. */
const derivedId = (shotId: string, n: number) =>
  `${shotId.slice(0, 24)}${n.toString(16).padStart(12, "0")}`;

/**
 * The Cinema scene and Blender settings for one shot. Shot size sets how much of the set is
 * shown; the lens sets the focal length; "still" and "orbit" set the camera's movement. Pan,
 * push, pull, handheld, an aerial view and the light choices are not something this render can
 * make yet, so they are listed in notFollowed (and the shot is planned without them).
 */
export function planCinemaShot(input: CinemaShotInput): CinemaShotPlan {
  if (!UUID.test(input.shotId))
    throw new Error("A shot is planned from its story id (a UUID).");
  if (!Number.isFinite(input.seconds) || input.seconds <= 0)
    throw new Error("A shot lasts a positive number of seconds.");
  const followed: string[] = [];
  const notFollowed: string[] = [];
  const direction = input.direction;
  for (const kind of Object.keys(direction) as DirectionKind[])
    if (!known(kind, direction[kind]))
      throw new Error(`There is no ${kind} choice ${direction[kind]}.`);

  const size = direction.shot ?? "medium";
  if (direction.shot) followed.push(`shot:${size}`);
  if (size === "aerial") notFollowed.push("shot:aerial");
  const boxes = [SUBJECT, ...SET.slice(0, SET_FOR_SIZE[size])];

  let focalLengthMm = 35;
  if (direction.lens) {
    focalLengthMm = LENS_MM[direction.lens];
    followed.push(`lens:${direction.lens}`);
  }

  let orbitDegrees = 0;
  if (direction.movement) {
    if (Object.hasOwn(ORBIT, direction.movement)) {
      orbitDegrees = ORBIT[direction.movement];
      followed.push(`movement:${direction.movement}`);
    } else notFollowed.push(`movement:${direction.movement}`);
  }
  if (direction.light) notFollowed.push(`light:${direction.light}`);

  const scene: Scene3D = {
    format: "yamakan.scene3d",
    formatVersion: 1,
    id: derivedId(input.shotId, 0),
    units: "metres",
    eulerOrder: "XYZ",
    camera: { focalLengthMm, sensorWidthMm: 36, near: 0.1, far: 1000 },
    items: boxes.map((b, i) => ({
      id: derivedId(input.shotId, i + 1),
      name: b.name,
      position: { ...b.position },
      rotation: { x: 0, y: b.rotationY, z: 0 },
      scale: { ...b.scale },
      assetId: null,
      color: b.color,
    })),
  };
  const frames = Math.max(
    1,
    Math.min(120, Math.round(input.seconds * input.fps)),
  );
  return {
    scene,
    settings: {
      width: input.size?.width ?? 320,
      height: input.size?.height ?? 180,
      fps: input.fps,
      frames,
      samples: input.samples ?? 8,
      orbitDegrees,
    },
    followed,
    notFollowed,
  };
}
