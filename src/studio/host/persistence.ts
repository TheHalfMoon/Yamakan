// Project-bound Studio persistence (YU-011). The canvas is one creative
// document of the open project; its layer bitmaps are PNGs in the project's
// object store, named on the canvas by their SHA-256 (the engine's
// imageName), so reopening resolves every layer from the project itself.
// Session intermediates (generation inputs) stay in memory and are never
// part of a saved canvas.
import { assertStudioImageLimits } from "../../../core/studio.ts";
import type { StudioDocument } from "../../../core/studio.ts";
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";
import type { StudioAssetStore, StudioUploadedImage } from "./assetStore.ts";
import { sha256Hex } from "../platform/browser/sha256.ts";

// The part of the SDK client the Studio host uses (sdk/client.ts).
export type StudioClient = {
  uploadStudioBitmap(
    projectId: string,
    png: Uint8Array,
  ): Promise<{ digest: string; width: number; height: number }>;
  studioBitmap(projectId: string, digest: string): Promise<Blob>;
  call(operation: string, parameters: unknown): Promise<unknown>;
  saveDocument(input: {
    projectId: string;
    expectedRevision: number;
    documentId: string;
    kind: "studio";
    schemaVersion: number;
    expectedContentHash: string | null;
    content: unknown;
    requestId: string;
  }): Promise<unknown>;
};

const toPng = async (blob: Blob): Promise<Blob> => {
  if (blob.type === "image/png") return blob;
  // Other formats (an imported JPEG) are stored as PNG, like engine layers.
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
};

/** Studio bitmaps backed by the project's object store. */
export function createProjectStudioAssetStore(
  client: StudioClient,
  projectId: string,
): StudioAssetStore {
  const blobs = new Map<string, Blob>();
  // Bitmaps this session already stored, by digest: never uploaded twice.
  const stored = new Map<string, StudioUploadedImage>();
  const dimensions = async (blob: Blob) => {
    const bmp = await createImageBitmap(blob);
    try {
      assertStudioImageLimits(bmp.width, bmp.height);
      return { width: bmp.width, height: bmp.height };
    } finally {
      bmp.close();
    }
  };
  return {
    uploadImage: async (blob): Promise<StudioUploadedImage> => {
      if (!(blob instanceof Blob) || blob.size <= 0)
        throw new Error("Studio upload requires a non-empty Blob.");
      const png = await toPng(blob);
      const bytes = new Uint8Array(await png.arrayBuffer());
      const known = stored.get(await sha256Hex(bytes));
      if (known) return known;
      await dimensions(png);
      const saved = await client.uploadStudioBitmap(projectId, bytes);
      blobs.set(saved.digest, png);
      const image = {
        imageName: saved.digest,
        width: saved.width,
        height: saved.height,
      };
      stored.set(saved.digest, image);
      return image;
    },
    uploadIntermediateImage: async (blob): Promise<StudioUploadedImage> => {
      const { width, height } = await dimensions(blob);
      const digest = await sha256Hex(new Uint8Array(await blob.arrayBuffer()));
      // Never a bare digest: a saved canvas cannot name an intermediate.
      const imageName = `session-${digest.slice(0, 32)}`;
      blobs.set(imageName, blob);
      return { imageName, width, height };
    },
    imageResolver: async (imageName, signal) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const cached = blobs.get(imageName);
      if (cached) return cached;
      if (!/^[a-f0-9]{64}$/.test(imageName))
        throw new Error(`Studio image not found: ${imageName}`);
      const blob = await client.studioBitmap(projectId, imageName);
      blobs.set(imageName, blob);
      return blob;
    },
    has: (imageName) => blobs.has(imageName),
    // Only this session's caches: stored bitmaps stay in the project.
    dispose: () => {
      blobs.clear();
      stored.clear();
    },
  };
}

export type StudioSaveState =
  | { state: "loading" }
  | { state: "new" }
  | { state: "saved"; contentHash: string }
  | { state: "saving" }
  | { state: "conflict"; message: string }
  | { state: "error"; message: string };

type DocumentRef = { id: string; kind: string; contentHash: string };

/** The project's Studio document, if it has one. */
export async function loadStudioDocument(
  client: StudioClient,
  projectId: string,
): Promise<{ ref: DocumentRef; document: StudioDocument } | null> {
  const refs = (await client.call("yamakan.document.list", {
    projectId,
  })) as DocumentRef[];
  const ref = refs.find((d) => d.kind === "studio");
  if (!ref) return null;
  const got = (await client.call("yamakan.document.get", {
    projectId,
    documentId: ref.id,
  })) as DocumentRef & { content: StudioDocument };
  return { ref, document: got.content };
}

/**
 * Saves the canvas as the project's Studio document: flushes pending layer
 * bitmaps, then commits with compare-and-swap on the project revision and
 * the document's last saved hash. Returns the new project revision and
 * hash; a conflict surfaces as the service's REVISION_CONFLICT.
 */
export async function saveStudioCanvas(input: {
  client: StudioClient;
  projectId: string;
  expectedRevision: number;
  documentId: string;
  name: string;
  expectedContentHash: string | null;
  flush: () => Promise<void>;
  canvas: () => CanvasStateContractV3 | null;
  toDocument: (canvas: CanvasStateContractV3) => StudioDocument;
}): Promise<{ project: { revision: number }; contentHash: string }> {
  await input.flush();
  const canvas = input.canvas();
  if (!canvas) throw new Error("There is no Studio canvas to save.");
  // Generated candidates live only in this session: commit or discard them
  // first (the service would refuse a canvas that names them).
  if (/"image_?[nN]ame":"session-/.test(JSON.stringify(canvas)))
    throw new Error(
      "This canvas still uses a generated image that is not saved; keep or discard it before saving.",
    );
  const result = (await input.client.saveDocument({
    projectId: input.projectId,
    expectedRevision: input.expectedRevision,
    documentId: input.documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: input.expectedContentHash,
    content: input.toDocument(canvas),
    requestId: crypto.randomUUID(),
  })) as {
    project: { revision: number };
    document: { contentHash: string };
  };
  return { project: result.project, contentHash: result.document.contentHash };
}
