// Which adapters run the conformance kit (MPR-206), by the file under core/engines that makes
// each, and the test file that calls it. A card that adds an adapter adds it here.
export const ADAPTER_SUITES: Readonly<Record<string, string>> = {
  "fake.ts": "engine-conformance.test.ts",
};
// Not yet: part b of this card.
export const PENDING: readonly string[] = [
  "v1-bridge.ts",
  "comfyui.ts",
  "kaggle.ts",
];
