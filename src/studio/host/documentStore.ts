import type { StudioDocument } from "../../../core/studio.ts";
import {
  StudioDocumentSchema,
  createEmptyStudioDocument,
} from "../../../core/studio.ts";
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";
import { createEmptyCanvasState } from "../workbench/canvasMigration.ts";
import { createEmptyStacks } from "../canvas-engine/document/documentTree";

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
  // Validated here; hashed only by the service (node:crypto is not in the
  // browser bundle).
  return StudioDocumentSchema.parse({
    format: "yamakan.studio-document",
    formatVersion: 1,
    id: input.id,
    name: input.name,
    canvasSchemaVersion: version,
    canvasJson: JSON.stringify(input.canvas),
    bitmapAssetIds: input.bitmapAssetIds ?? [],
    updatedAt: new Date().toISOString(),
  });
}

export function newStudioSession(name = "Untitled studio"): {
  document: StudioDocument;
  contentHash: string;
} {
  const id = crypto.randomUUID();
  // Prefer the engine's empty canvas factory so stack keys and required fields match.
  const empty = createEmptyCanvasState(1024, 1024);
  // One empty paint layer, selected: a first brush stroke then lands in the
  // document (and persists as that layer's bitmap) instead of only on screen.
  const layerId = crypto.randomUUID();
  const stacks = createEmptyStacks();
  stacks.raster = [
    {
      blendMode: "normal",
      id: layerId,
      isEnabled: true,
      isLocked: false,
      name: "Layer 1",
      opacity: 1,
      source: { bitmap: null, type: "paint" },
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "raster",
    },
  ];
  const canvas: CanvasStateContractV3 = {
    ...empty,
    document: { ...empty.document, stacks, selectedLayerId: layerId },
  };
  const document = createEmptyStudioDocument({
    id,
    name,
    width: 1024,
    height: 1024,
  });
  document.canvasJson = JSON.stringify(canvas);
  // Do not call hashStudioDocument here: core/hash uses node:crypto,
  // which Vite externalizes and is not available in the browser bundle.
  // Durable hashes are computed on the service when committing studio.* commands.
  return { document, contentHash: "session-unhashed" };
}
