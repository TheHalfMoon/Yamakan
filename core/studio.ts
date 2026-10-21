// M7 / W11: Studio document entity. Canvas contract versions 3 and 4 only.
// Persistent authority is Yamakan SQLite revisions; the InvokeAI engine owns
// pixels and session history only. Feature flag stays off until Q10 targets.
import { z } from "zod";
import { canonicalJson, sha256Hex } from "./donors/ninerr/canonical.ts";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";

export const STUDIO_FORMAT = "yamakan.studio-document";
export const STUDIO_FORMAT_VERSION = 1 as const;

/** Studio UI/runtime stays off until Q8–Q10 pass on this head. */
export const STUDIO_ENABLED = false;

export const STUDIO_LIMITS = Object.freeze({
  maxDocumentBytes: 8 * 1024 * 1024,
  maxNodes: 10_000,
  maxSidePx: 16_384,
  maxMegapixels: 64,
});

/** Opaque canvas contract bytes as stored by the donor (version 3 or 4). */
export const StudioCanvasContractSchema = z
  .object({
    version: z.union([z.literal(3), z.literal(4)]),
  })
  .passthrough();

export const StudioDocumentSchema = z
  .object({
    format: z.literal(STUDIO_FORMAT),
    formatVersion: z.literal(STUDIO_FORMAT_VERSION),
    id: Id,
    name: z.string().min(1).max(120),
    /** Donor canvas schema version as written (3 or 4). */
    canvasSchemaVersion: z.union([z.literal(3), z.literal(4)]),
    /** Full canvas state JSON (document + staging), validated loosely then hashed. */
    canvas: StudioCanvasContractSchema,
    /** Content-addressed bitmap asset ids referenced by the canvas. */
    bitmapAssetIds: z.array(Id).max(STUDIO_LIMITS.maxNodes),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const bytes = Buffer.byteLength(JSON.stringify(doc.canvas), "utf8");
    if (bytes > STUDIO_LIMITS.maxDocumentBytes) {
      ctx.addIssue({
        code: "custom",
        message: `Studio canvas exceeds ${STUDIO_LIMITS.maxDocumentBytes} bytes.`,
        path: ["canvas"],
      });
    }
  });

export type StudioDocument = z.infer<typeof StudioDocumentSchema>;

export function hashStudioDocument(doc: StudioDocument): string {
  return sha256Hex(canonicalJson(doc));
}

export function createEmptyStudioDocument(input: {
  id: string;
  name: string;
  width?: number;
  height?: number;
}): StudioDocument {
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;
  if (width > STUDIO_LIMITS.maxSidePx || height > STUDIO_LIMITS.maxSidePx) {
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Studio dimensions exceed ${STUDIO_LIMITS.maxSidePx}px.`,
    );
  }
  if ((width * height) / 1_000_000 > STUDIO_LIMITS.maxMegapixels) {
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Studio megapixels exceed ${STUDIO_LIMITS.maxMegapixels}.`,
    );
  }
  const canvas = {
    version: 3 as const,
    document: {
      width,
      height,
      selectedLayerId: null,
      stacks: {
        raster: [],
        control: [],
        regionalGuidance: [],
        inpaintMask: [],
      },
      bbox: { x: 0, y: 0, width, height },
    },
    stagingArea: {
      pendingImageIds: [],
      pendingImages: [],
      selectedImageIndex: 0,
      isVisible: false,
      areThumbnailsVisible: false,
      autoSwitchMode: "off" as const,
    },
  };
  return StudioDocumentSchema.parse({
    format: STUDIO_FORMAT,
    formatVersion: STUDIO_FORMAT_VERSION,
    id: input.id,
    name: input.name,
    canvasSchemaVersion: 3,
    canvas,
    bitmapAssetIds: [],
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Validate and content-hash a Studio document. Durable project attach stays
 * behind STUDIO_ENABLED; the command still qualifies the schema.
 */
export function saveStudioDocument(raw: unknown): {
  document: StudioDocument;
  contentHash: string;
  studioEnabled: boolean;
} {
  const parsed = StudioDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues.map((i) => i.message).join("; ") ||
        "Invalid studio document.",
    );
  }
  const document = parsed.data;
  return {
    document,
    contentHash: hashStudioDocument(document),
    studioEnabled: STUDIO_ENABLED,
  };
}

export function studioCapability(): {
  id: string;
  available: boolean;
  reason?: string;
} {
  if (!STUDIO_ENABLED) {
    return {
      id: "studio",
      available: false,
      reason:
        "Studio canvas is imported but disabled until Q8–Q10 targets are met on this head.",
    };
  }
  return { id: "studio", available: true };
}

/** Dimension gate before decode (M7 field 10). */
export function assertStudioImageLimits(width: number, height: number): void {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new CommandError("VALIDATION", "Invalid image dimensions.");
  }
  if (width > STUDIO_LIMITS.maxSidePx || height > STUDIO_LIMITS.maxSidePx) {
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Image side exceeds ${STUDIO_LIMITS.maxSidePx}px.`,
    );
  }
  if ((width * height) / 1_000_000 > STUDIO_LIMITS.maxMegapixels) {
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Image exceeds ${STUDIO_LIMITS.maxMegapixels} megapixels.`,
    );
  }
}
