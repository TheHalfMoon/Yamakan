// 3D models on the Cinema page (3D asset import): a person's .glb is checked here first with
// the same check the service runs (core/cinema/glb.ts), uploaded to the project, and named by
// a scene item by its digest. The preview loads it from the project, never from a URL the
// person gives, and fits it to a 1 m box at its middle exactly as the Blender render does, so
// the preview and the render agree.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BLENDER_SCENE_LIMITS } from "../../core/blender/scene.ts";
import { GLB_LIMITS, GlbError, checkGlb } from "../../core/cinema/glb.ts";
import type { MessageKey } from "../i18n.ts";
import type { CinemaSceneLocal } from "./CinemaViewport.tsx";
import { CINEMA_PAGE_MAX_ITEMS } from "./cinemaObjects.ts";

type Item = CinemaSceneLocal["items"][number];

/** A render takes at most this many models, so the page adds no more. */
export const CINEMA_PAGE_MAX_MODELS = BLENDER_SCENE_LIMITS.maxModels;

export const cinemaModelCount = (scene: CinemaSceneLocal) =>
  scene.items.filter((item) => item.model).length;

/**
 * Why a chosen file cannot be a model, in the page's words, with the check's own reason as the
 * detail; null when it can be uploaded.
 */
export function cinemaModelProblem(
  file: Uint8Array,
): { key: MessageKey; detail?: string } | null {
  if (file.byteLength > GLB_LIMITS.bytes)
    return { key: "cinema.model.tooLarge" };
  try {
    checkGlb(file);
    return null;
  } catch (e) {
    if (e instanceof GlbError)
      return { key: "cinema.model.refused", detail: e.message };
    throw e;
  }
}

/**
 * A new item naming a stored model, placed where the next box would go and standing on the
 * floor (a 1 m box at height 0.5), named after the file.
 */
export function addCinemaModel(
  scene: CinemaSceneLocal,
  name: string,
  digest: string,
  id: string = crypto.randomUUID(),
): CinemaSceneLocal {
  if (!/^[a-f0-9]{64}$/.test(digest))
    throw new Error(
      "A model is named by the digest the project stored it under.",
    );
  if (scene.items.length >= CINEMA_PAGE_MAX_ITEMS)
    throw new Error(
      `This scene holds the most objects the page edits (${CINEMA_PAGE_MAX_ITEMS}).`,
    );
  if (cinemaModelCount(scene) >= CINEMA_PAGE_MAX_MODELS)
    throw new Error(
      `A scene renders at most ${CINEMA_PAGE_MAX_MODELS} 3D models.`,
    );
  const n = scene.items.length;
  const item: Item = {
    id,
    name: name.slice(0, 120),
    position: {
      x: Math.round(((n % 5) - 2) * 1.25 * 1000) / 1000,
      y: 0.5,
      z: -2,
    },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    assetId: null,
    model: digest,
  };
  return { ...scene, items: [...scene.items, item] };
}

/**
 * A file's name without its extension, as a model's name: invisible format characters (such as
 * a right-to-left override) left out, at most 120 characters, never cut inside one.
 */
export const cinemaModelName = (fileName: string) =>
  Array.from(
    fileName
      .replace(/\p{Cf}/gu, "")
      .replace(/\.glb$/i, "")
      .trim(),
  )
    .slice(0, 120)
    .join("")
    .trim() || "Model";

/** How long an uploaded, not yet saved model is left before a save stores it again. */
export const CINEMA_MODEL_REFRESH_MS = 20 * 60 * 1000;

/**
 * The loader plugin that makes embedded images load as <img> elements from blob: URLs, which
 * the page's image policy allows; three's default bitmap loader fetches them, which the page's
 * connect policy refuses.
 */
export function imageTextures(parser: {
  textureLoader: unknown;
  options: { manager: THREE.LoadingManager };
}) {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: "yamakan_image_textures" };
}

/**
 * Loaded models shared by the items that show them: each key is loaded once while anything
 * uses it, and freed when the last user lets go. A load that fails is forgotten, so the next
 * user tries again.
 */
export function createModelCache<T>(
  load: (key: string) => Promise<T>,
  dispose: (value: T) => void,
) {
  const entries = new Map<string, { value: Promise<T>; users: number }>();
  return {
    acquire(key: string): Promise<T> {
      let entry = entries.get(key);
      if (!entry) {
        const value = load(key);
        const made = { value, users: 0 };
        entry = made;
        entries.set(key, made);
        value.catch(() => {
          if (entries.get(key) === made) entries.delete(key);
        });
      }
      entry.users++;
      return entry.value;
    },
    release(key: string) {
      const entry = entries.get(key);
      if (!entry || --entry.users > 0) return;
      entries.delete(key);
      entry.value.then(dispose, () => {});
    },
    clear() {
      for (const entry of entries.values()) entry.value.then(dispose, () => {});
      entries.clear();
    },
    size: () => entries.size,
  };
}

/**
 * Fits an object to a 1 m box centred at the origin: its bounds' middle at 0, its largest side
 * 1 m. The Blender script fits imported models the same way (scripts/blender/yamakan_render.py).
 */
export function fitToMetre(object: THREE.Object3D): THREE.Group {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!(extent > 0) || !Number.isFinite(extent))
    throw new Error("The model has no size.");
  const centre = bounds.getCenter(new THREE.Vector3());
  const inner = new THREE.Group();
  inner.add(object);
  inner.scale.setScalar(1 / extent);
  inner.position.copy(centre.multiplyScalar(-1 / extent));
  const holder = new THREE.Group();
  holder.add(inner);
  return holder;
}

/**
 * Loads a checked .glb (the project's stored copy) into a fitted group. Embedded images load
 * as <img> elements from blob: URLs, which the page's image policy allows; no decoder for
 * compressed meshes or textures is set, and the check has refused files that would need one.
 */
export async function parseCinemaModel(
  bytes: ArrayBuffer,
): Promise<THREE.Group> {
  checkGlb(new Uint8Array(bytes));
  const loader = new GLTFLoader();
  loader.register((parser) => imageTextures(parser) as never);
  const gltf = await loader.parseAsync(bytes, "");
  const root = gltf.scene;
  // Only meshes and the groups that hold them are shown, as in the render.
  const extra: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Camera).isCamera || (o as THREE.Light).isLight)
      extra.push(o);
  });
  for (const o of extra) o.removeFromParent();
  return fitToMetre(root);
}

/** Frees what a loaded model holds on the graphics card. */
export function disposeCinemaModel(object: THREE.Object3D) {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}
