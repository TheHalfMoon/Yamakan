// M9 / W14: canonical Cinema scene3d entity (ArtCraft Object3DJSON / SceneStateJson
// adapted to zod). Feature flag stays off until M8–M10 acceptance is on main.
import { z } from "zod";
import { createHash } from "node:crypto";
import { canonicalJson, sha256Hex } from "./donors/ninerr/canonical.ts";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";

export const SCENE3D_FORMAT = "yamakan.scene3d";
export const SCENE3D_FORMAT_VERSION = 1 as const;

/** Cinema runtime stays off until M8–M10 pass on main; schema/commands still qualify. */
export const CINEMA_ENABLED = false;

export const SCENE3D_LIMITS = Object.freeze({
  maxBytes: 4 * 1024 * 1024,
  maxItems: 10_000,
  maxDepth: 16,
  maxString: 1_024,
});

const Finite = z.number().finite();
const OptionalName = z.string().max(SCENE3D_LIMITS.maxString);

const Vec3Schema = z
  .object({
    x: Finite,
    y: Finite,
    z: Finite,
  })
  .strict();

export const EulerOrderSchema = z.enum([
  "XYZ",
  "YXZ",
  "ZXY",
  "ZYX",
  "YZX",
  "XZY",
]);
export type EulerOrder = z.infer<typeof EulerOrderSchema>;

export const CameraIntrinsicsSchema = z
  .object({
    /** Focal length in millimetres. */
    focalLengthMm: Finite.positive().max(10_000),
    /** Sensor width in millimetres (horizontal). */
    sensorWidthMm: Finite.positive().max(1_000),
    near: Finite.positive().max(1e6),
    far: Finite.positive().max(1e9),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!(v.far > v.near)) {
      ctx.addIssue({
        code: "custom",
        message: "Camera far plane must be greater than near.",
        path: ["far"],
      });
    }
  });
export type CameraIntrinsics = z.infer<typeof CameraIntrinsicsSchema>;

export const Scene3DItemSchema = z
  .object({
    id: Id,
    name: OptionalName,
    position: Vec3Schema,
    rotation: Vec3Schema,
    scale: Vec3Schema,
    /** Yamakan asset id (replaces ArtCraft media_file_token). */
    assetId: Id.nullable(),
    color: z.string().max(64).optional(),
    metalness: Finite.min(0).max(1).optional(),
    shininess: Finite.min(0).max(1_000).optional(),
    specular: Finite.min(0).max(1).optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type Scene3DItem = z.infer<typeof Scene3DItemSchema>;

const Scene3DObjectSchema = z
  .object({
    format: z.literal(SCENE3D_FORMAT),
    formatVersion: z.literal(SCENE3D_FORMAT_VERSION),
    id: Id,
    /** World units: metres only for v1. */
    units: z.literal("metres"),
    eulerOrder: EulerOrderSchema,
    camera: CameraIntrinsicsSchema,
    items: z.array(Scene3DItemSchema).max(SCENE3D_LIMITS.maxItems),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const bytes = Buffer.byteLength(JSON.stringify(scene), "utf8");
    if (bytes > SCENE3D_LIMITS.maxBytes) {
      ctx.addIssue({
        code: "custom",
        message: `Scene JSON exceeds ${SCENE3D_LIMITS.maxBytes} bytes.`,
      });
    }
  });

/**
 * Depth and plain-object checks run before Zod field parsing so hostile
 * nesting cannot inflate receipt hashing or stringify work first.
 */
export function assertSceneRawBounds(raw: unknown): void {
  walkSceneJson(raw, 0);
  const bytes = Buffer.byteLength(JSON.stringify(raw), "utf8");
  if (bytes > SCENE3D_LIMITS.maxBytes)
    throw new CommandError(
      "VALIDATION",
      `Scene JSON exceeds ${SCENE3D_LIMITS.maxBytes} bytes.`,
    );
}

function walkSceneJson(value: unknown, depth: number): void {
  if (depth > SCENE3D_LIMITS.maxDepth)
    throw new CommandError(
      "VALIDATION",
      `Scene JSON exceeds nesting depth ${SCENE3D_LIMITS.maxDepth}.`,
    );
  if (value === null || typeof value !== "object") return;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null)
    throw new CommandError(
      "VALIDATION",
      "Scene JSON must use plain objects or arrays.",
    );
  if (Array.isArray(value)) {
    for (const child of value) walkSceneJson(child, depth + 1);
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>))
    walkSceneJson(child, depth + 1);
}

/** Zod schema used by `yamakan.scene.save` (bounds before field parse). */
export const Scene3DSchema = z.preprocess((raw, ctx) => {
  try {
    assertSceneRawBounds(raw);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message:
        error instanceof CommandError
          ? error.message
          : "Scene JSON bounds check failed.",
    });
    return z.NEVER;
  }
  return raw;
}, Scene3DObjectSchema);
export type Scene3D = z.infer<typeof Scene3DObjectSchema>;

/** ArtCraft-format object row (donor shape; media_file_token excluded on import). */
export type ArtCraftObject3DJson = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  object_name: string;
  object_uuid: string;
  object_user_data_name: string;
  media_file_token?: string;
  color: string;
  metalness: number;
  shininess: number;
  specular: number;
  locked: boolean;
  visible?: boolean;
};

export type ArtCraftSceneStateJson = {
  version: number;
  sceneItems: ArtCraftObject3DJson[];
};

function assertFiniteVec(
  label: string,
  v: { x: number; y: number; z: number },
) {
  for (const [k, n] of Object.entries(v) as [string, number][]) {
    if (!Number.isFinite(n))
      throw new CommandError(
        "VALIDATION",
        `Scene ${label}.${k} must be a finite number.`,
      );
  }
}

function clampString(s: string, field: string): string {
  if (s.length > SCENE3D_LIMITS.maxString)
    throw new CommandError(
      "VALIDATION",
      `Scene ${field} exceeds ${SCENE3D_LIMITS.maxString} characters.`,
    );
  return s;
}

/**
 * Import ArtCraft SceneStateJson into a Yamakan scene3d.
 * `media_file_token` is dropped; callers map known UUIDs to asset ids.
 */
export function scene3dFromArtCraft(
  raw: unknown,
  opts: {
    id: string;
    assetIdsByObjectUuid?: ReadonlyMap<string, string>;
    camera?: CameraIntrinsics;
    eulerOrder?: EulerOrder;
  },
): Scene3D {
  assertSceneRawBounds(raw);

  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new CommandError("VALIDATION", "Scene must be a JSON object.");

  const doc = raw as ArtCraftSceneStateJson;
  if (!Array.isArray(doc.sceneItems))
    throw new CommandError("VALIDATION", "sceneItems must be an array.");
  if (doc.sceneItems.length > SCENE3D_LIMITS.maxItems)
    throw new CommandError(
      "VALIDATION",
      `Scene has more than ${SCENE3D_LIMITS.maxItems} items.`,
    );

  const map = opts.assetIdsByObjectUuid ?? new Map<string, string>();
  const items: Scene3DItem[] = [];
  for (const row of doc.sceneItems) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new CommandError("VALIDATION", "Invalid scene item.");
    const rowProto = Object.getPrototypeOf(row);
    if (rowProto !== Object.prototype && rowProto !== null)
      throw new CommandError(
        "VALIDATION",
        "Scene items must be plain objects.",
      );
    // media_file_token is ignored; asset mapping is by object_uuid only.
    assertFiniteVec("position", row.position);
    assertFiniteVec("rotation", row.rotation);
    assertFiniteVec("scale", row.scale);
    const uuid = clampString(String(row.object_uuid ?? ""), "object_uuid");
    if (!/^[0-9a-f-]{36}$/i.test(uuid))
      throw new CommandError(
        "VALIDATION",
        "object_uuid must be a UUID for scene items.",
      );
    if (map.size > 0 && !map.has(uuid))
      throw new CommandError(
        "VALIDATION",
        `Unknown asset for scene object ${uuid}.`,
      );
    const assetId = map.size > 0 ? (map.get(uuid) ?? null) : null;

    items.push({
      id: uuid.toLowerCase(),
      name: clampString(
        String(row.object_name || row.object_user_data_name || "object"),
        "name",
      ),
      position: { ...row.position },
      rotation: { ...row.rotation },
      scale: { ...row.scale },
      assetId,
      color:
        row.color !== undefined
          ? clampString(String(row.color), "color")
          : undefined,
      metalness: row.metalness,
      shininess: row.shininess,
      specular: row.specular,
      locked: row.locked,
      visible: row.visible,
    });
  }

  return parseScene3D({
    format: SCENE3D_FORMAT,
    formatVersion: SCENE3D_FORMAT_VERSION,
    id: opts.id,
    units: "metres",
    eulerOrder: opts.eulerOrder ?? "XYZ",
    camera: opts.camera ?? {
      focalLengthMm: 35,
      sensorWidthMm: 36,
      near: 0.1,
      far: 1000,
    },
    items,
  });
}

/** Export Yamakan scene3d items back to ArtCraft-shaped Object3DJSON (no token). */
export function artCraftItemsFromScene3D(
  scene: Scene3D,
): ArtCraftObject3DJson[] {
  return scene.items.map((item) => ({
    position: { ...item.position },
    rotation: { ...item.rotation },
    scale: { ...item.scale },
    object_name: item.name,
    object_uuid: item.id,
    object_user_data_name: item.name,
    color: item.color ?? "#ffffff",
    metalness: item.metalness ?? 0,
    shininess: item.shininess ?? 30,
    specular: item.specular ?? 0,
    locked: item.locked ?? false,
    visible: item.visible,
  }));
}

export function parseScene3D(raw: unknown): Scene3D {
  try {
    assertSceneRawBounds(raw);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError("VALIDATION", "Scene JSON bounds check failed.");
  }
  const parsed = Scene3DObjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid scene";
    throw new CommandError("VALIDATION", `Invalid scene3d: ${msg}`);
  }
  return parsed.data;
}

export function scene3dContentHash(scene: Scene3D): string {
  return sha256Hex(canonicalJson(scene));
}

export function scene3dSha256OfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validate and hash a scene for `yamakan.scene.save`.
 * Durable Cinema attachment to projects stays behind CINEMA_ENABLED.
 */
export function saveScene3D(raw: unknown): {
  scene: Scene3D;
  contentHash: string;
  cinemaEnabled: boolean;
} {
  const scene = parseScene3D(raw);
  return {
    scene,
    contentHash: scene3dContentHash(scene),
    cinemaEnabled: CINEMA_ENABLED,
  };
}
