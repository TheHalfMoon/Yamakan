// What Yamakan hands its Blender worker (Blender integration, first slice): a bounded scene
// description, never Python. A fixed script in scripts/blender/yamakan_render.py, owned by
// Yamakan, builds the scene from it and renders it; the worker runs no other code.
//
// Coordinates are the Cinema scene's own (three.js: metres, Y up, Euler XYZ in radians). The
// script converts them to Blender's Z-up world with whole matrices.
import { z } from "zod";
import type { Scene3D } from "../scene3d.ts";

export const BLENDER_SCENE_FORMAT = "yamakan.blender-scene/1";

/**
 * What one render may ask for. Cycles on the CPU takes seconds a frame at these sizes; the
 * worker's own wall budget (30 minutes) ends anything that runs longer.
 */
export const BLENDER_SCENE_LIMITS = Object.freeze({
  maxWidth: 1280,
  maxHeight: 720,
  minSide: 64,
  maxFrames: 120,
  maxSamples: 32,
  maxObjects: 200,
  maxMetres: 1000,
  maxScale: 100,
  fps: [24, 25, 30] as const,
});

const L = BLENDER_SCENE_LIMITS;
const Finite = z.number().finite();
const Metres = Finite.min(-L.maxMetres).max(L.maxMetres);
const Vec3 = z.object({ x: Metres, y: Metres, z: Metres }).strict();
const Angles = z
  .object({
    x: Finite.min(-4 * Math.PI).max(4 * Math.PI),
    y: Finite.min(-4 * Math.PI).max(4 * Math.PI),
    z: Finite.min(-4 * Math.PI).max(4 * Math.PI),
  })
  .strict();
const Scale = z
  .object({
    x: Finite.min(0.001).max(L.maxScale),
    y: Finite.min(0.001).max(L.maxScale),
    z: Finite.min(0.001).max(L.maxScale),
  })
  .strict();
const Colour = z.string().regex(/^#[0-9a-f]{6}$/);
const Even = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .refine((n) => n % 2 === 0, "Sizes are even, as the video encoder needs.");

const Finish = z
  .object({
    // A soft bloom around the brightest parts of the picture.
    glow: Finite.min(0).max(1).default(0),
    // Corners darkened toward the middle.
    vignette: Finite.min(0).max(1).default(0),
    // A slight colour fringe at the edges, as a lens makes.
    dispersion: Finite.min(0).max(0.1).default(0),
  })
  .strict();

export const BlenderSceneSchema = z
  .object({
    format: z.literal(BLENDER_SCENE_FORMAT),
    width: Even(L.minSide, L.maxWidth),
    height: Even(L.minSide, L.maxHeight),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30)]),
    frames: z.number().int().min(1).max(L.maxFrames),
    samples: z.number().int().min(1).max(L.maxSamples),
    background: Colour,
    camera: z
      .object({
        // Where the camera starts and what it looks at.
        position: Vec3,
        target: Vec3,
        focalLengthMm: Finite.min(1).max(10_000),
        sensorWidthMm: Finite.min(1).max(1000),
        // Around the target over the shot, in degrees (0: the camera stays still).
        orbitDegrees: Finite.min(-360).max(360),
        // Toward the target over the shot, as a share of its distance (a push in); below 0, away
        // from it (a pull back).
        dolly: Finite.min(-0.9).max(0.9).default(0),
        // The camera turns where it stands, sweeping its view across the target, in degrees.
        panDegrees: Finite.min(-90).max(90).default(0),
        // A small, steady handheld sway, as a share of the distance (always the same for a scene).
        shake: Finite.min(0).max(0.1).default(0),
      })
      .strict(),
    light: z
      .object({
        // A sun: its direction is its rotation; strength in Blender's sun units; its colour.
        rotation: Angles,
        strength: Finite.min(0).max(20),
        colour: Colour.default("#ffffff"),
      })
      .strict(),
    // The compositor's finish on every frame; all 0 (the default) is none at all.
    finish: Finish.default({ glow: 0, vignette: 0, dispersion: 0 }),
    objects: z
      .array(
        z
          .object({
            shape: z.literal("box"),
            position: Vec3,
            rotation: Angles,
            scale: Scale,
            colour: Colour,
          })
          .strict(),
      )
      .max(L.maxObjects),
  })
  .strict();
export type BlenderScene = z.infer<typeof BlenderSceneSchema>;

/** What the person chooses for a render; the rest comes from the project's Cinema scene. */
export const BlenderRenderSettingsSchema = z
  .object({
    width: Even(L.minSide, L.maxWidth),
    height: Even(L.minSide, L.maxHeight),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30)]),
    frames: z.number().int().min(1).max(L.maxFrames),
    samples: z.number().int().min(1).max(L.maxSamples),
    orbitDegrees: Finite.min(-360).max(360),
    // Camera moves beside the orbit (see BlenderSceneSchema's camera); absent is none.
    dolly: Finite.min(-0.9).max(0.9).optional(),
    panDegrees: Finite.min(-90).max(90).optional(),
    shake: Finite.min(0).max(0.1).optional(),
    // The light of the shot (LIGHTING); absent is the neutral light every render had before.
    lighting: z.enum(["morning", "golden", "night", "studio"]).optional(),
    // A finish (FINISHES); absent is none, as every render had before.
    finish: z.enum(["glow", "vignette", "film"]).optional(),
  })
  .strict();
export type BlenderRenderSettings = z.infer<typeof BlenderRenderSettingsSchema>;

/**
 * Each light as a sun (its angle, strength and colour) and the sky behind the boxes. Neutral is
 * the light every render had before lighting could be chosen.
 */
export const LIGHTING = Object.freeze({
  neutral: {
    rotation: { x: -0.9, y: 0.4, z: 0 },
    strength: 3,
    colour: "#ffffff",
    background: "#1a1d21",
  },
  // Soft and pale: a lower sun, a little less of it, a cool morning sky.
  morning: {
    rotation: { x: -1.15, y: 0.3, z: 0.8 },
    strength: 2.4,
    colour: "#fff2e0",
    background: "#3c4c60",
  },
  // Low and warm: a sun near the horizon, orange, and a dusky sky.
  golden: {
    rotation: { x: -1.35, y: 0.2, z: -0.9 },
    strength: 3.5,
    colour: "#ffa850",
    background: "#4a2c18",
  },
  // Dim and cool: a faint blue light and a near-black sky.
  night: {
    rotation: { x: -0.7, y: 0.5, z: 0.3 },
    strength: 0.5,
    colour: "#8fa6ff",
    background: "#05070d",
  },
  // Even and bright: a high white light and a plain grey backdrop.
  studio: {
    rotation: { x: -0.5, y: 0.3, z: 0.4 },
    strength: 4.5,
    colour: "#ffffff",
    background: "#2c2c2c",
  },
});

/** Each finish as the compositor makes it. */
export const FINISHES = Object.freeze({
  none: Object.freeze({ glow: 0, vignette: 0, dispersion: 0 }),
  glow: Object.freeze({ glow: 0.9, vignette: 0, dispersion: 0 }),
  vignette: Object.freeze({ glow: 0, vignette: 0.7, dispersion: 0 }),
  // A light touch of each, as a film camera might give.
  film: Object.freeze({ glow: 0.4, vignette: 0.5, dispersion: 0.015 }),
});

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const colourOf = (value: string | undefined) =>
  value && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#888888";

/**
 * The scene a project's Cinema scene renders as: its boxes and its lens, seen from the Cinema
 * preview's direction (2.5, 2, 4) at the middle of the boxes, far enough back to take them in,
 * lit by one sun. Values the render cannot take are brought within its bounds, never passed on.
 */
export function blenderSceneFromCinema(
  scene: Scene3D,
  settings: BlenderRenderSettings,
): BlenderScene {
  const s = BlenderRenderSettingsSchema.parse(settings);
  const metres = (n: number) => clamp(n, -L.maxMetres, L.maxMetres);
  // Aimed at the middle of what is shown, from the preview's own direction (2.5, 2, 4), and
  // pulled back to take in how far the boxes spread.
  const shown = scene.items.filter((item) => item.visible !== false);
  const centre = { x: 0, y: 0, z: 0 };
  for (const item of shown) {
    centre.x += item.position.x / shown.length;
    centre.y += item.position.y / shown.length;
    centre.z += item.position.z / shown.length;
  }
  let reach = 1;
  for (const item of shown)
    reach = Math.max(
      reach,
      Math.hypot(
        item.position.x - centre.x,
        item.position.y - centre.y,
        item.position.z - centre.z,
      ) +
        Math.max(
          Math.abs(item.scale.x),
          Math.abs(item.scale.y),
          Math.abs(item.scale.z),
        ),
    );
  const back = Math.min(L.maxMetres / 10, reach);
  const angle = (n: number) => clamp(n, -4 * Math.PI, 4 * Math.PI);
  const size = (n: number) => clamp(Math.abs(n), 0.001, L.maxScale);
  return BlenderSceneSchema.parse({
    format: BLENDER_SCENE_FORMAT,
    width: s.width,
    height: s.height,
    fps: s.fps,
    frames: s.frames,
    samples: s.samples,
    background: LIGHTING[s.lighting ?? "neutral"].background,
    camera: {
      position: {
        x: metres(centre.x + 2.5 * back),
        y: metres(centre.y + 2 * back),
        z: metres(centre.z + 4 * back),
      },
      target: {
        x: metres(centre.x),
        y: metres(centre.y),
        z: metres(centre.z),
      },
      focalLengthMm: scene.camera.focalLengthMm,
      sensorWidthMm: scene.camera.sensorWidthMm,
      orbitDegrees: s.orbitDegrees,
      dolly: s.dolly ?? 0,
      panDegrees: s.panDegrees ?? 0,
      shake: s.shake ?? 0,
    },
    finish: { ...FINISHES[s.finish ?? "none"] },
    light: {
      rotation: { ...LIGHTING[s.lighting ?? "neutral"].rotation },
      strength: LIGHTING[s.lighting ?? "neutral"].strength,
      colour: LIGHTING[s.lighting ?? "neutral"].colour,
    },
    objects: scene.items
      .filter((item) => item.visible !== false)
      .slice(0, L.maxObjects)
      .map((item) => ({
        shape: "box" as const,
        position: {
          x: metres(item.position.x),
          y: metres(item.position.y),
          z: metres(item.position.z),
        },
        rotation: {
          x: angle(item.rotation.x),
          y: angle(item.rotation.y),
          z: angle(item.rotation.z),
        },
        scale: {
          x: size(item.scale.x),
          y: size(item.scale.y),
          z: size(item.scale.z),
        },
        colour: colourOf(item.color),
      })),
  });
}
