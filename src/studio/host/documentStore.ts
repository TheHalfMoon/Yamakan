import type { StudioDocument } from "../../../core/studio.ts";
import {
  createEmptyStudioDocument,
  hashStudioDocument,
  saveStudioDocument,
} from "../../../core/studio.ts";
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";

/** Maps StudioDocument ↔ engine canvas state without a second DB. */
export function canvasFromStudioDocument(
  doc: StudioDocument,
): CanvasStateContractV3 {
  return JSON.parse(doc.canvasJson) as CanvasStateContractV3;
}

export function studioDocumentFromCanvas(input: {
  id: string;
  name: string;
  canvas: CanvasStateContractV3;
  bitmapAssetIds?: string[];
}): StudioDocument {
  const version = input.canvas.version === 4 ? 4 : 3;
  return saveStudioDocument({
    format: "yamakan.studio-document",
    formatVersion: 1,
    id: input.id,
    name: input.name,
    canvasSchemaVersion: version,
    canvasJson: JSON.stringify(input.canvas),
    bitmapAssetIds: input.bitmapAssetIds ?? [],
    updatedAt: new Date().toISOString(),
  }).document;
}

export function newStudioSession(name = "Untitled studio"): {
  document: StudioDocument;
  contentHash: string;
} {
  const id = crypto.randomUUID();
  const document = createEmptyStudioDocument({ id, name });
  return { document, contentHash: hashStudioDocument(document) };
}
