/**
 * Q10 measurement fixture: 4096×4096 document with 20 paint raster layers.
 * Used only via forceMount measurement handles — does not enable STUDIO_ENABLED.
 */
import type {
  CanvasLayerContract,
  CanvasStateContractV3,
} from "../canvas-engine/contracts";
import { createEmptyStacks } from "../canvas-engine/document/documentTree";
import { createEmptyCanvasState } from "../workbench/canvasMigration";

function paintLayer(id: string, name: string): CanvasLayerContract {
  return {
    blendMode: "normal",
    id,
    isEnabled: true,
    isLocked: false,
    name,
    opacity: 1,
    source: { bitmap: null, type: "paint" },
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type: "raster",
  };
}

/** Build the frozen Q10 Studio latency fixture (4096² × 20 raster paint layers). */
export function createQ10StudioCanvasState(
  width = 4096,
  height = 4096,
  layerCount = 20,
): CanvasStateContractV3 {
  const base = createEmptyCanvasState(width, height);
  const layers = Array.from({ length: layerCount }, (_, i) =>
    paintLayer(`q10-layer-${i}`, `Q10 Layer ${i + 1}`),
  );
  const stacks = createEmptyStacks();
  stacks.raster = layers;
  const selectedLayerId = layers[layers.length - 1]!.id;
  return {
    ...base,
    document: {
      ...base.document,
      selectedLayerId,
      stacks,
      width,
      height,
      bbox: { x: 0, y: 0, width, height },
    },
  };
}
