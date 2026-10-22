/**
 * Durable Cinema scene3d files under <workspace>/cinema/.
 * Only used from the command registry (Node). Browser UI talks via commands.
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProjectStore } from "./store.ts";
import { Id } from "./project.ts";
import { CommandError } from "./command/errors.ts";
import {
  CINEMA_ENABLED,
  parseScene3D,
  scene3dContentHash,
  type Scene3D,
} from "./scene3d.ts";

async function cinemaDir(store: ProjectStore): Promise<string> {
  const dir = join(store.root, "cinema");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** UUID-only filenames under cinema/; rejects path segments. */
function scenePath(dir: string, sceneId: string): string {
  const id = Id.parse(sceneId);
  const root = resolve(dir);
  const expected = join(root, `${id}.json`);
  const path = resolve(root, `${id}.json`);
  if (path !== expected) {
    throw new CommandError("VALIDATION", "Cinema scene path escaped store.");
  }
  return path;
}

export async function persistCinemaScene(
  store: ProjectStore,
  scene: Scene3D,
): Promise<{ path: string; contentHash: string }> {
  if (!CINEMA_ENABLED) {
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      "Cinema persist is disabled.",
    );
  }
  const dir = await cinemaDir(store);
  const contentHash = scene3dContentHash(scene);
  const path = scenePath(dir, scene.id);
  await writeFile(path, `${JSON.stringify(scene, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { path, contentHash };
}

export async function loadCinemaScene(
  store: ProjectStore,
  sceneId: string,
): Promise<{ scene: Scene3D; contentHash: string }> {
  if (!CINEMA_ENABLED) {
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      "Cinema load is disabled.",
    );
  }
  const path = scenePath(await cinemaDir(store), sceneId);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CommandError("NOT_FOUND", `Cinema scene ${sceneId} not found.`);
    }
    throw error;
  }
  const scene = parseScene3D(JSON.parse(raw));
  if (scene.id !== Id.parse(sceneId)) {
    throw new CommandError(
      "VALIDATION",
      "Persisted scene id does not match requested id.",
    );
  }
  return { scene, contentHash: scene3dContentHash(scene) };
}

export async function listCinemaScenes(
  store: ProjectStore,
): Promise<readonly { id: string; contentHash: string }[]> {
  if (!CINEMA_ENABLED) return [];
  const dir = await cinemaDir(store);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const out: { id: string; contentHash: string }[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    const parsed = Id.safeParse(id);
    if (!parsed.success) continue;
    const loaded = await loadCinemaScene(store, parsed.data);
    out.push({ id: parsed.data, contentHash: loaded.contentHash });
  }
  return out;
}
