import { assertStudioImageLimits } from "../../../core/studio.ts";
import { sha256Hex } from "../platform/browser/sha256.ts";

export type StudioUploadedImage = {
  imageName: string;
  width: number;
  height: number;
};

export type StudioAssetStore = {
  /** Persist a blob and return engine image metadata (content-addressed name). */
  uploadImage(blob: Blob): Promise<StudioUploadedImage>;
  /** Same as upload for session intermediates (kept until dispose). */
  uploadIntermediateImage(blob: Blob): Promise<StudioUploadedImage>;
  /** Resolve a previously uploaded imageName to its blob bytes. */
  imageResolver(imageName: string, signal?: AbortSignal): Promise<Blob>;
  /** Whether an imageName is present. */
  has(imageName: string): boolean;
  /** Drop all blobs (session end). */
  dispose(): void;
};

/**
 * Session-scoped Studio bitmap store. Host owns bytes; engine owns pixels and
 * session history. Empty resolvers / metadata-only uploads are forbidden.
 */
export function createStudioAssetStore(): StudioAssetStore {
  const blobs = new Map<string, Blob>();

  const store = async (blob: Blob): Promise<StudioUploadedImage> => {
    if (!(blob instanceof Blob) || blob.size <= 0) {
      throw new Error("Studio upload requires a non-empty Blob.");
    }
    const bmp = await createImageBitmap(blob);
    try {
      assertStudioImageLimits(bmp.width, bmp.height);
      const digest = await sha256Hex(new Uint8Array(await blob.arrayBuffer()));
      const imageName = `studio-${digest.slice(0, 32)}`;
      // Content-addressed: identical bytes reuse the same name.
      if (!blobs.has(imageName)) {
        blobs.set(imageName, blob);
      }
      return { imageName, width: bmp.width, height: bmp.height };
    } finally {
      bmp.close();
    }
  };

  return {
    uploadImage: store,
    uploadIntermediateImage: store,
    imageResolver: async (imageName, signal) => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const blob = blobs.get(imageName);
      if (!blob) {
        throw new Error(`Studio image not found: ${imageName}`);
      }
      return blob;
    },
    has: (imageName) => blobs.has(imageName),
    dispose: () => {
      blobs.clear();
    },
  };
}
