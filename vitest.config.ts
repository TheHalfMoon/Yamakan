import { defineConfig } from "vitest/config";
import { studioAliases } from "./scripts/studio-aliases.mjs";
import exclusions from "./docs/evidence/qualification/q9-exclusions.json" with {
  type: "json",
};

const q9FileExcludes = [
  ...exclusions.nodeModeDenominatorExclusions.files,
  ...exclusions.remainingKnownFailuresExcludedFromDefaultCi.files,
].map((f) => `src/studio/canvas-engine/${f}`);

export default defineConfig({
  resolve: { alias: studioAliases() },
  test: {
    include: ["src/studio/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/*.browser.test.ts",
      ...q9FileExcludes,
    ],
    environment: "node",
  },
});
