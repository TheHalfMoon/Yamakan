/** Shared path aliases for Vite and documentation of M7 import layout. */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function studioAliases() {
  return {
    "@workbench/canvas-engine": path.join(root, "src/studio/canvas-engine"),
    "@workbench/canvasProjectMutations": path.join(
      root,
      "src/studio/workbench/canvasProjectMutations.ts",
    ),
    "@workbench/canvasMigration": path.join(
      root,
      "src/studio/workbench/canvasMigration.ts",
    ),
    "@workbench/canvasLoadContracts": path.join(
      root,
      "src/studio/workbench/canvasLoadContracts.ts",
    ),
    "@workbench/canvasSchemaVersion": path.join(
      root,
      "src/studio/workbench/canvasSchemaVersion.ts",
    ),
    "@workbench/mediaReferences": path.join(
      root,
      "src/studio/workbench/mediaReferences.ts",
    ),
    "@workbench/panZoom": path.join(root, "src/studio/workbench/panZoom.ts"),
    "@workbench/projectEventContracts": path.join(
      root,
      "src/studio/workbench/projectEventContracts.ts",
    ),
    "@workbench/canvasProjectMutationPort": path.join(
      root,
      "src/studio/host/workbench/canvasProjectMutationPort.ts",
    ),
    "@workbench/controlAdapters": path.join(
      root,
      "src/studio/host/workbench/controlAdapters.ts",
    ),
    "@workbench/projectContracts": path.join(
      root,
      "src/studio/host/workbench/projectContracts.ts",
    ),
    "@workbench/projectEvents": path.join(
      root,
      "src/studio/host/workbench/projectEvents.ts",
    ),
    "@workbench/canvasStagingView": path.join(
      root,
      "src/studio/host/workbench/canvasStagingView.ts",
    ),
    "@workbench/workbenchState": path.join(
      root,
      "src/studio/host/workbench/workbenchState.ts",
    ),
    "@workbench/workbenchState.testing": path.join(
      root,
      "src/studio/host/workbench/workbenchState.testing.ts",
    ),
    "@workbench/workbenchStore": path.join(
      root,
      "src/studio/host/workbench/workbenchStore.ts",
    ),
    "@platform/browser/sha256": path.join(
      root,
      "src/studio/platform/browser/sha256.ts",
    ),
    "@platform/core/json": path.join(root, "src/studio/platform/core/json.ts"),
    "@platform/ui/modalPresence": path.join(
      root,
      "src/studio/platform/ui/modalPresence.ts",
    ),
    "@platform/browser/downloadBlob": path.join(
      root,
      "src/studio/host/platform/browser/downloadBlob.ts",
    ),
    "@features/gallery": path.join(root, "src/studio/host/features/gallery.ts"),
  };
}
