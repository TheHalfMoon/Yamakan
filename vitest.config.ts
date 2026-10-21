import { defineConfig } from "vitest/config";
import { studioAliases } from "./scripts/studio-aliases.mjs";

export default defineConfig({
  resolve: { alias: studioAliases() },
  test: {
    include: ["src/studio/**/*.test.ts"],
    environment: "node",
  },
});
