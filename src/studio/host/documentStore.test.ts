import { describe, expect, it } from "vitest";
import { canvasFromStudioDocument, newStudioSession } from "./documentStore.ts";

describe("new Studio session", () => {
  it("starts with one empty, selected paint layer, so a first stroke lands in the document", () => {
    const { document } = newStudioSession("Board");
    const canvas = canvasFromStudioDocument(document);
    const raster = canvas.document.stacks.raster;
    expect(raster).toHaveLength(1);
    const layer = raster[0] as {
      id: string;
      type: string;
      source: { type: string; bitmap: unknown };
    };
    expect(layer.type).toBe("raster");
    expect(layer.source).toEqual({ type: "paint", bitmap: null });
    expect(canvas.document.selectedLayerId).toBe(layer.id);
  });
});
