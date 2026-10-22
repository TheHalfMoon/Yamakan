import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("active UI uses the Yamakan Y mark, not the legacy D glyph", () => {
  const main = readFileSync("src/main.tsx", "utf8");
  assert.match(main, /className="mark"[^>]*>\s*Y\s*</);
  assert.match(main, /className="large-mark"[^>]*>\s*Y\s*</);
  assert.doesNotMatch(main, /className="mark"[^>]*>\s*D\s*</);
  assert.doesNotMatch(main, /className="large-mark"[^>]*>\s*D\s*</);
});

test("preview status string is owned by i18n, not a hard-coded English label", () => {
  const player = readFileSync(
    "src/editor/components/PreviewPlayer.tsx",
    "utf8",
  );
  const i18n = readFileSync("src/i18n.ts", "utf8");
  assert.match(player, /clipStatusLabel/);
  assert.match(i18n, /"preview\.clipStatus"/);
  assert.match(i18n, /مقاطع/);
});
