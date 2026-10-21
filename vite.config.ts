import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
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
        "src/studio/workbench/controlAdapters.ts",
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
        "src/studio/workbench/canvasStagingView.ts",
      ),
      "@workbench/workbenchState": path.join(
        root,
        "src/studio/host/workbench/workbenchState.ts",
      ),
      "@workbench/workbenchStore": path.join(
        root,
        "src/studio/host/workbench/workbenchStore.ts",
      ),
      "@platform/browser/sha256": path.join(
        root,
        "src/studio/platform/browser/sha256.ts",
      ),
      "@platform/core/json": path.join(
        root,
        "src/studio/platform/core/json.ts",
      ),
      "@platform/ui/modalPresence": path.join(
        root,
        "src/studio/platform/ui/modalPresence.ts",
      ),
      "@platform/browser/downloadBlob": path.join(
        root,
        "src/studio/host/platform/browser/downloadBlob.ts",
      ),
      "@features/gallery": path.join(
        root,
        "src/studio/host/features/gallery.ts",
      ),
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:4318" } },
});
