import type { StudioDocument } from "../../../core/studio.ts";
import {
  createEmptyStudioDocument,
  saveStudioDocument,
} from "../../../core/studio.ts";
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";
import { createEmptyCanvasState } from "../workbench/canvasMigration.ts";

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
  // Prefer the engine's empty canvas factory so stack keys and required fields match.
  const canvas = createEmptyCanvasState(1024, 1024);
  const document = createEmptyStudioDocument({ id, name, width: 1024, height: 1024 });
  document.canvasJson = JSON.stringify(canvas);
  // Do not call hashStudioDocument here: core/donors/ninerr uses node:crypto,
  // which Vite externalizes and is not available in the browser bundle.
  // Durable hashes are computed on the service when committing studio.* commands.
  return { document, contentHash: "session-unhashed" };
}
