import { describe, it, expect } from "vitest";
import { createStudioAssetStore } from "./assetStore.ts";

describe("createStudioAssetStore (node)", () => {
  it("rejects empty blobs and unknown names without a DOM", async () => {
    const store = createStudioAssetStore();
    await expect(store.uploadImage(new Blob())).rejects.toThrow(/non-empty/i);
    await expect(store.imageResolver("missing")).rejects.toThrow(/not found/i);
    expect(store.has("missing")).toBe(false);
    store.dispose();
  });
});
