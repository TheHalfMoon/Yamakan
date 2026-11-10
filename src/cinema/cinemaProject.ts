// The open project's Cinema scene (#203): one cinemaScene creative document,
// saved only when the person chooses to, with compare-and-swap on the project
// revision and the scene's last saved hash, as the Studio canvas is.
import { DOCUMENT_SCHEMA_VERSIONS } from "../../core/document-ref.ts";
import type { CinemaSceneLocal } from "./CinemaViewport.tsx";

// The part of the SDK client this uses (sdk/client.ts).
export type CinemaProjectClient = {
  call(operation: string, parameters: unknown): Promise<unknown>;
  saveDocument(input: {
    projectId: string;
    expectedRevision: number;
    documentId: string;
    kind: "cinemaScene";
    schemaVersion: number;
    expectedContentHash: string | null;
    content: unknown;
    requestId: string;
  }): Promise<unknown>;
};

export type CinemaSaveState =
  | { state: "loading" }
  | { state: "new" }
  | { state: "saved"; contentHash: string }
  | { state: "changed"; contentHash: string | null }
  | { state: "saving" }
  | { state: "conflict"; message: string }
  | { state: "error"; message: string; contentHash: string | null }
  | { state: "loadError"; message: string };

/** Save is offered for a scene not yet saved, a change, or after a failed save. */
export const cinemaCanSave = (s: CinemaSaveState | null) =>
  s?.state === "new" || s?.state === "changed" || s?.state === "error";

/** Reopen is offered only when there is a saved scene to go back to, or after a conflict. */
export const cinemaCanReopen = (s: CinemaSaveState | null) =>
  ((s?.state === "changed" || s?.state === "error") &&
    s.contentHash !== null) ||
  s?.state === "conflict" ||
  s?.state === "loadError";

/**
 * The scene can be changed except while the project's scene is opening, and after a conflict
 * or a failed open, where a change could never be saved (only Reopen leads on).
 */
export const cinemaCanEdit = (s: CinemaSaveState | null) =>
  s?.state !== "loading" && s?.state !== "conflict" && s?.state !== "loadError";

/**
 * The state after a change. A save in flight keeps its state: it reports the change itself
 * when it ends. A conflict or a failed open stays until the person reopens.
 */
export const cinemaChangedState = (
  s: CinemaSaveState | null,
  savedHash: string | null,
): CinemaSaveState | null =>
  !s ||
  s.state === "saving" ||
  s.state === "conflict" ||
  s.state === "loadError" ||
  s.state === "loading"
    ? s
    : { state: "changed", contentHash: savedHash };

export const CINEMA_SAMPLE_SCENE: CinemaSceneLocal = Object.freeze({
  format: "yamakan.scene3d",
  formatVersion: 1,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  units: "metres",
  eulerOrder: "XYZ",
  camera: {
    focalLengthMm: 35,
    sensorWidthMm: 36,
    near: 0.1,
    far: 1000,
  },
  items: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "cube",
      position: { x: 0, y: 0.5, z: -2 },
      rotation: { x: 0, y: 0.4, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      // A placeholder box, not a project asset: a project refuses a scene
      // naming an asset it does not hold.
      assetId: null,
      color: "#6b8cae",
    },
  ],
});

// A project without a scene starts from the sample, under an id of its own.
export const freshCinemaScene = (): CinemaSceneLocal => ({
  ...CINEMA_SAMPLE_SCENE,
  id: crypto.randomUUID(),
});

type DocumentRef = { id: string; kind: string; contentHash: string };

const pickScene = (refs: DocumentRef[]) =>
  refs
    .filter((d) => d.kind === "cinemaScene")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];

/** The stored hash of the scene the page opens, or null when the project has none. */
export async function storedSceneHash(
  client: Pick<CinemaProjectClient, "call">,
  projectId: string,
): Promise<string | null> {
  const refs = (await client.call("yamakan.document.list", {
    projectId,
  })) as DocumentRef[];
  return pickScene(refs)?.contentHash ?? null;
}

/**
 * The project's Cinema scene, if it has one. A project normally holds one; if an agent
 * committed more, the lowest id is taken, so every window opens the same one.
 */
export async function loadProjectScene(
  client: Pick<CinemaProjectClient, "call">,
  projectId: string,
): Promise<{ documentId: string; contentHash: string; scene: unknown } | null> {
  const refs = (await client.call("yamakan.document.list", {
    projectId,
  })) as DocumentRef[];
  const ref = pickScene(refs);
  if (!ref) return null;
  const got = (await client.call("yamakan.document.get", {
    projectId,
    documentId: ref.id,
  })) as DocumentRef & { content: unknown };
  return {
    documentId: ref.id,
    contentHash: got.contentHash,
    scene: got.content,
  };
}

/**
 * Saves the scene as the project's Cinema scene document. A conflict surfaces as the
 * service's REVISION_CONFLICT; nothing is retried or merged here.
 */
export async function saveProjectScene(input: {
  client: CinemaProjectClient;
  projectId: string;
  expectedRevision: number;
  documentId: string;
  expectedContentHash: string | null;
  scene: unknown;
}): Promise<{ revision: number; contentHash: string }> {
  const result = (await input.client.saveDocument({
    projectId: input.projectId,
    expectedRevision: input.expectedRevision,
    documentId: input.documentId,
    kind: "cinemaScene",
    schemaVersion: DOCUMENT_SCHEMA_VERSIONS.cinemaScene,
    expectedContentHash: input.expectedContentHash,
    content: input.scene,
    requestId: crypto.randomUUID(),
  })) as { project: { revision: number }; document: { contentHash: string } };
  return {
    revision: result.project.revision,
    contentHash: result.document.contentHash,
  };
}
