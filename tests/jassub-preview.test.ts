import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JASSUB_ENABLED,
  jassubCapability,
} from "../core/preview/jassub-flags.ts";
import {
  JASSUB_LIBASS_GLYPH_LIMIT,
  JASSUB_LIBASS_MEMORY_LIMIT_MIB,
  JASSUB_PINNED_FONT_KEY,
  buildJassubConstructOptions,
  createTitlePreview,
  forceBuildJassubOptionsForTest,
} from "../src/preview/titles.ts";
import { TITLE_FONT } from "../core/render/fonts.ts";

const pinnedFont = {
  family: TITLE_FONT.family,
  url: "/assets/fonts/IBMPlexSansArabic-Regular.ttf",
};

const baseOptions = {
  canvas: {} as HTMLCanvasElement,
  ass: "[Script Info]\nScriptType: v4.00+\n",
  fonts: [pinnedFont],
  workerUrl: "/vendor/jassub/worker.js",
  wasmUrl: "/vendor/jassub/jassub-worker.wasm",
};

describe("JASSUB preview gate (P10-07)", () => {
  test("JASSUB_ENABLED stays false until H1 + Q11 enablement", () => {
    assert.equal(JASSUB_ENABLED, false);
    const cap = jassubCapability();
    assert.equal(cap.available, false);
    assert.ok(cap.unsupported?.includes("live-jassub-preview"));
    assert.ok(cap.unsupported?.includes("wasm-unsafe-eval-csp"));
  });

  test("createTitlePreview refuses construction while disabled", async () => {
    await assert.rejects(
      () => createTitlePreview(baseOptions),
      /JASSUB|Q11|H1|unavailable/i,
    );
  });

  test("forced helper builds queryFonts:false, pinned fonts, memory/glyph limits", () => {
    const opts = forceBuildJassubOptionsForTest(baseOptions);
    assert.equal(opts.queryFonts, false);
    assert.equal(opts.defaultFont, JASSUB_PINNED_FONT_KEY);
    assert.equal(opts.defaultFont, "ibm plex sans arabic");
    assert.deepEqual(Object.keys(opts.availableFonts).sort(), [
      JASSUB_PINNED_FONT_KEY,
    ]);
    assert.equal(opts.availableFonts[JASSUB_PINNED_FONT_KEY], pinnedFont.url);
    assert.deepEqual(opts.fonts, [pinnedFont.url]);
    assert.equal(opts.libassMemoryLimit, JASSUB_LIBASS_MEMORY_LIMIT_MIB);
    assert.ok(opts.libassMemoryLimit > 0);
    assert.equal(opts.libassGlyphLimit, JASSUB_LIBASS_GLYPH_LIMIT);
    assert.ok(opts.libassGlyphLimit > 0);
    assert.equal(opts.workerUrl, baseOptions.workerUrl);
    assert.equal(opts.wasmUrl, baseOptions.wasmUrl);
    assert.ok(!("liberation sans" in opts.availableFonts));
    // Flag still false after forced option build.
    assert.equal(JASSUB_ENABLED, false);
  });

  test("forced helper refuses non-pinned font families", () => {
    assert.throws(
      () =>
        buildJassubConstructOptions({
          ...baseOptions,
          fonts: [{ family: "Liberation Sans", url: "/x.ttf" }],
        }),
      /non-pinned font family/i,
    );
  });

  test("forced helper refuses remote font URLs", () => {
    assert.throws(
      () =>
        buildJassubConstructOptions({
          ...baseOptions,
          fonts: [
            {
              family: TITLE_FONT.family,
              url: "https://fonts.example/remote.ttf",
            },
          ],
        }),
      /non-local font URL/i,
    );
  });

  test("npm pin jassub@2.5.20 is present with lockfile integrity", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.equal(pkg.dependencies.jassub, "2.5.20");
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const entry = lock.packages["node_modules/jassub"];
    assert.equal(entry.version, "2.5.20");
    assert.equal(
      entry.integrity,
      "sha512-uUE0YoUnw/pdgFVoefRN0leLu5iFS39hfOikouCqHUffLCAU3wqRU5VkpBbY1piV8WWlFcHCz3HEPzvyxbAJTw==",
    );
    const installed = JSON.parse(
      readFileSync("node_modules/jassub/package.json", "utf8"),
    );
    assert.equal(installed.version, "2.5.20");
  });

  test("production CSP header text has no wasm-unsafe-eval", () => {
    const main = readFileSync("server/main.ts", "utf8");
    assert.match(main, /Content-Security-Policy/);
    assert.doesNotMatch(main, /wasm-unsafe-eval/);
  });
});
