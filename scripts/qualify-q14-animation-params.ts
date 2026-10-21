// Q14: OpenCut animation param closure maps onto Yamakan property registry.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  YAMAKAN_ANIMATION_PROPERTIES,
  parseColorToLinearRgba,
  formatLinearRgba,
} from "../core/timeline/properties.ts";
import { ANIMATION_ENABLED } from "../core/donors/opencut/animation/flags.ts";

execFileSync(process.execPath, ["--test", "tests/animation-params.test.ts"], {
  stdio: "inherit",
});

const color = parseColorToLinearRgba("#ff0000");
if (!color) throw new Error("color parse failed");
const roundTrip = formatLinearRgba(color);

const receipt = {
  qualification: "q14-animation-params",
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  animationEnabled: ANIMATION_ENABLED,
  propertyRegistryIds: YAMAKAN_ANIMATION_PROPERTIES.map((p) => p.id),
  colorRoundTrip: roundTrip,
  inheritedTests: "tests/animation-params.test.ts",
  verdict: "pass",
  method: "yamakan-property-registry",
  note: "Culori not pulled; hex linear-RGBA helpers in core/timeline/properties.ts.",
};

const path = "docs/evidence/qualification/q14-animation-params.json";
writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify({
    wrote: path,
    sha256: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    verdict: receipt.verdict,
  }),
);
