// What Yamakan hands its Blender worker (Blender integration, first slice): a bounded scene
// description, never Python. A fixed script in scripts/blender/yamakan_render.py, owned by
// Yamakan, builds the scene from it and renders it; the worker runs no other code.
//
// Coordinates are the Cinema scene's own (three.js: metres, Y up, Euler XYZ in radians). The
// script converts them to Blender's Z-up world with whole matrices.
import { z } from "zod";
import type { Scene3D } from "../scene3d.ts";
import type { CameraTrack } from "./track.ts";

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
  // 3D models in one render: each is imported, so they are few; and their textures' decoded
  // pixels over the whole render, each import counted (the worker's memory is bounded).
  maxModels: 8,
  maxModelPixels: 128 * 1024 * 1024,
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
    // "detail": a ground under the boxes, and fine, non-repeating detail on the ground and on
    // every box (its colour kept). "plain" (the default) is the flat boxes every render had.
    surface: z.enum(["plain", "detail"]).default("plain"),
    // Tracked footage behind the objects (match-move): the solved camera for every frame and
    // the lens it was solved with. With a plate, object positions are in the first tracked
    // camera's own frame (right, up, toward the viewer; metres), the camera follows these
    // matrices instead of moving by itself, and the footage is composited behind the render.
    plate: z
      .object({
        focalLengthMm: Finite.min(1).max(1000),
        sensorWidthMm: Finite.min(1).max(100),
        // The footage's own size, checked against the clip the worker hands Blender.
        width: z.number().int().min(16).max(8192),
        height: z.number().int().min(16).max(8192),
        // Camera-to-world, row-major, in metres: frame i + 1 is cameras[i].
        cameras: z
          .array(z.array(Finite.min(-1e6).max(1e6)).length(16))
          .min(1)
          .max(L.maxFrames),
      })
      .strict()
      .optional(),
    objects: z
      .array(
        z.discriminatedUnion("shape", [
          z
            .object({
              shape: z.literal("box"),
              position: Vec3,
              rotation: Angles,
              scale: Scale,
              colour: Colour,
            })
            .strict(),
          // A project's stored 3D model (core/cinema/glb.ts) by its digest, fitted to a 1 m box
          // and placed like a box. The worker hands it to Blender as a checked, read-only copy.
          z
            .object({
              shape: z.literal("model"),
              model: z.string().regex(/^[a-f0-9]{64}$/),
              position: Vec3,
              rotation: Angles,
              scale: Scale,
            })
            .strict(),
        ]),
      )
      .max(L.maxObjects)
      .refine(
        (objects) =>
          objects.filter((o) => o.shape === "model").length <= L.maxModels,
        `A render holds at most ${L.maxModels} 3D models.`,
      ),
  })
  .strict()
  .refine(
    (scene) =>
      !scene.plate ||
      (scene.plate.cameras.length === scene.frames &&
        scene.plate.focalLengthMm === scene.camera.focalLengthMm &&
        scene.plate.sensorWidthMm === scene.camera.sensorWidthMm &&
        scene.camera.orbitDegrees === 0 &&
        scene.camera.dolly === 0 &&
        scene.camera.panDegrees === 0 &&
        scene.camera.shake === 0 &&
        scene.surface === "plain" &&
        scene.finish.glow === 0 &&
        scene.finish.vignette === 0 &&
        scene.finish.dispersion === 0),
    "With tracked footage, every frame has its solved camera, the camera makes no moves of its own, and there is no ground or finish.",
  );
/** The stored models a render reads, each once. */
export const blenderSceneModels = (scene: BlenderScene) => [
  ...new Set(
    scene.objects.flatMap((o) => (o.shape === "model" ? [o.model] : [])),
  ),
];
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
    // A ground and fine surface detail (BlenderSceneSchema's surface); absent is plain.
    surface: z.enum(["detail"]).optional(),
    // Where the camera looks from: absent is the preview's own direction, about 23 degrees above
    // the subject; "aerial" is high above, about 70 degrees, looking down (AERIAL_DIRECTION).
    view: z.enum(["aerial"]).optional(),
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

/** The preview's own direction to the camera from what it looks at (about 23 degrees up). */
export const PREVIEW_DIRECTION = Object.freeze({ x: 2.5, y: 2, z: 4 });
/**
 * The aerial view's: the same compass direction and distance as the preview's, raised to 70
 * degrees above the subject, so it frames the same set from high above.
 */
export const AERIAL_DIRECTION = Object.freeze(
  (() => {
    const length = Math.hypot(2.5, 2, 4);
    const across = Math.hypot(2.5, 4);
    const up = (70 * Math.PI) / 180;
    return {
      x: (2.5 / across) * length * Math.cos(up),
      y: length * Math.sin(up),
      z: (4 / across) * length * Math.cos(up),
    };
  })(),
);

/**
 * The scene a project's Cinema scene renders as: its boxes and its lens, seen from the Cinema
 * preview's direction (2.5, 2, 4) at the middle of the boxes, far enough back to take them in,
 * lit by one sun. Values the render cannot take are brought within its bounds, never passed on.
 */
export function blenderSceneFromCinema(
  scene: Scene3D,
  settings: BlenderRenderSettings,
  // Tracked footage behind the objects (plateFromTrack); the camera then follows the solve.
  plate?: BlenderScene["plate"],
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
  // Over tracked footage the camera is the solve's: a view of its own would be ignored, so it
  // is refused rather than dropped.
  if (plate && s.view)
    throw new Error(
      "Over tracked footage the camera is the solve's; it takes no view.",
    );
  const from = s.view === "aerial" ? AERIAL_DIRECTION : PREVIEW_DIRECTION;
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
        x: metres(centre.x + from.x * back),
        y: metres(centre.y + from.y * back),
        z: metres(centre.z + from.z * back),
      },
      target: {
        x: metres(centre.x),
        y: metres(centre.y),
        z: metres(centre.z),
      },
      focalLengthMm: plate?.focalLengthMm ?? scene.camera.focalLengthMm,
      sensorWidthMm: plate?.sensorWidthMm ?? scene.camera.sensorWidthMm,
      orbitDegrees: s.orbitDegrees,
      dolly: s.dolly ?? 0,
      panDegrees: s.panDegrees ?? 0,
      shake: s.shake ?? 0,
    },
    finish: { ...FINISHES[s.finish ?? "none"] },
    surface: s.surface ?? "plain",
    ...(plate ? { plate } : {}),
    light: {
      rotation: { ...LIGHTING[s.lighting ?? "neutral"].rotation },
      strength: LIGHTING[s.lighting ?? "neutral"].strength,
      colour: LIGHTING[s.lighting ?? "neutral"].colour,
    },
    objects: scene.items
      .filter((item) => item.visible !== false)
      .slice(0, L.maxObjects)
      .map((item) => {
        const placed = {
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
        };
        return item.model
          ? { shape: "model" as const, model: item.model, ...placed }
          : { shape: "box" as const, ...placed, colour: colourOf(item.color) };
      }),
  });
}

/**
 * The plate for a render of a track's first `frames` frames: a solved camera for every frame (a
 * frame the solve could not place takes the nearest solved one before it, or after it at the
 * start), its translation turned from the solve's units into metres.
 */
export function plateFromTrack(
  track: CameraTrack,
  frames: number,
  metresPerUnit: number,
): NonNullable<BlenderScene["plate"]> {
  if (!(metresPerUnit > 0) || !Number.isFinite(metresPerUnit))
    throw new Error(
      "The plate's scale is a positive number of metres per unit.",
    );
  if (frames > track.frames)
    throw new Error(
      "A render over footage is no longer than the tracked clip.",
    );
  const solved = new Map(track.cameras.map((c) => [c.frame, c.matrix]));
  const first = track.cameras[0].matrix;
  let held = first;
  const cameras: number[][] = [];
  for (let frame = 1; frame <= frames; frame++) {
    held = solved.get(frame) ?? held;
    cameras.push(
      held.map((v, i) =>
        i === 3 || i === 7 || i === 11 ? v * metresPerUnit : v,
      ),
    );
  }
  return {
    focalLengthMm: track.lens.focalLengthMm,
    sensorWidthMm: track.lens.sensorWidthMm,
    width: track.width,
    height: track.height,
    cameras,
  };
}
