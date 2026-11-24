// Which adapters run the conformance kit (MPR-206), by the file under core/engines that makes
// each: what makes it, the test files that call the kit for it, and the names it is called by.
// Every check is run once under each name. A card that adds an adapter adds it here.
export const ADAPTER_SUITES: Readonly<
  Record<
    string,
    { makes: string; tests: readonly string[]; names: readonly string[] }
  >
> = {
  "fake.ts": {
    makes: "createFakeEngineV2",
    tests: ["engine-conformance.test.ts"],
    names: ["fake", "fake, stopped elsewhere", "fake, going on elsewhere"],
  },
  "comfyui.ts": {
    makes: "createComfyEngine",
    tests: ["comfyui-engine.test.ts"],
    names: ["comfyui"],
  },
};
// Not yet: Kaggle's is the rest of part b of this card, and the bridge fails two checks, by name in
// tests/engines.test.ts.
export const PENDING: readonly string[] = ["v1-bridge.ts", "kaggle.ts"];
// What names the contract and makes no adapter, and why it does.
export const NOT_ADAPTERS: Readonly<Record<string, string>> = {
  "contract-v2.ts": "The contract itself, and what an adapter is made of.",
  "generation.ts": "The service over an adapter that it is given.",
};
