/**
 * P10-07 — W12/Q11 engineering + honest perf/SSIM measurement.
 *
 * engComplete: pin + notices + provenance + refuse-when-disabled tests.
 * Perf/SSIM: Playwright harness with a qualify-only CSP that includes
 * 'wasm-unsafe-eval'. Production server/main.ts CSP is left unchanged;
 * enablement still blocked on H1 and a security-reviewed CSP commit.
 *
 * Pass budgets: ≤4 ms/frame and SSIM ≥0.95. Do not claim pass if either fails;
 * keep server libass reference as the fallback path.
 */
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  createReadStream,
  rmSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { resolve, join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import {
  JASSUB_ENABLED,
  jassubCapability,
} from "../core/preview/jassub-flags.ts";
import {
  JASSUB_LIBASS_GLYPH_LIMIT,
  JASSUB_LIBASS_MEMORY_LIMIT_MIB,
  JASSUB_PINNED_FONT_KEY,
  createTitlePreview,
  forceBuildJassubOptionsForTest,
} from "../src/preview/titles.ts";
import { TITLE_FONT, titleFonts } from "../core/render/fonts.ts";
import { compileTitles } from "../core/render/ass.ts";
import { FLICKS_PER_SECOND } from "../core/time.ts";
import { TYPOGRAPHY_FIXTURES } from "./typography-fixtures.ts";
import { decodeStill, ssim, glyphBox } from "../tests/fixtures/golden.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPT = join(REPO, "docs/evidence/qualification/q11-jassub-eng.json");
const TYPO_DIR = join(REPO, "docs/evidence/qualification/typography");
const JASSUB_PKG = join(REPO, "node_modules/jassub");
const LOCK_INTEGRITY =
  "sha512-uUE0YoUnw/pdgFVoefRN0leLu5iFS39hfOikouCqHUffLCAU3wqRU5VkpBbY1piV8WWlFcHCz3HEPzvyxbAJTw==";
const TARGET_MS = 4;
const TARGET_SSIM = 0.95;
const MEASURE_W = 1280;
const MEASURE_H = 720;
const MEASURE_FIXTURES = [
  "punctuation",
  "bidi-isolates",
  "diacritics",
  "mixed-lines",
  "latin-only",
];

const git = (...args) =>
  execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();

assert.equal(JASSUB_ENABLED, false);
const cap = jassubCapability();
assert.equal(cap.available, false);
assert.ok(cap.unsupported?.includes("live-jassub-preview"));

let refused = false;
try {
  await createTitlePreview({
    canvas: /** @type {any} */ ({}),
    ass: "[Script Info]\n",
    fonts: [
      {
        family: TITLE_FONT.family,
        url: "/assets/fonts/IBMPlexSansArabic-Regular.ttf",
      },
    ],
    workerUrl: "/jassub/worker.js",
    wasmUrl: "/jassub/jassub-worker.wasm",
  });
} catch {
  refused = true;
}
assert.equal(refused, true, "createTitlePreview must refuse while disabled");

const forced = forceBuildJassubOptionsForTest({
  canvas: /** @type {any} */ ({}),
  ass: "[Script Info]\n",
  fonts: [
    {
      family: TITLE_FONT.family,
      url: "/assets/fonts/IBMPlexSansArabic-Regular.ttf",
    },
  ],
  workerUrl: "/jassub/worker.bundle.js",
  wasmUrl: "/jassub/jassub-worker.wasm",
});
assert.equal(forced.queryFonts, false);
assert.equal(forced.defaultFont, JASSUB_PINNED_FONT_KEY);
assert.equal(forced.libassMemoryLimit, JASSUB_LIBASS_MEMORY_LIMIT_MIB);
assert.equal(forced.libassGlyphLimit, JASSUB_LIBASS_GLYPH_LIMIT);
assert.deepEqual(forced.fonts, [
  "/assets/fonts/IBMPlexSansArabic-Regular.ttf",
]);
assert.ok(!("liberation sans" in forced.availableFonts));
assert.equal(JASSUB_ENABLED, false);

const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
assert.equal(pkg.dependencies.jassub, "2.5.20");
const lock = JSON.parse(readFileSync(join(REPO, "package-lock.json"), "utf8"));
assert.equal(lock.packages["node_modules/jassub"]?.version, "2.5.20");
assert.equal(lock.packages["node_modules/jassub"]?.integrity, LOCK_INTEGRITY);
assert.ok(existsSync(join(JASSUB_PKG, "package.json")));
assert.ok(existsSync(join(REPO, "notices/jassub-LICENSE")));
assert.ok(existsSync(join(REPO, "notices/jassub-NOTICE")));
const notice = readFileSync(join(REPO, "NOTICE"), "utf8");
assert.match(notice, /JASSUB 2\.5\.20/);
assert.match(notice, /GPL-2\.0-or-later for FreeType/);
const mainTs = readFileSync(join(REPO, "server/main.ts"), "utf8");
assert.doesNotMatch(mainTs, /wasm-unsafe-eval/);

const engComplete = {
  npmPin: "jassub@2.5.20",
  gitPin: "dea3d2d398569a591cf0c767d945d84e9f120484",
  lockfileIntegrity: LOCK_INTEGRITY,
  notices: ["notices/jassub-LICENSE", "notices/jassub-NOTICE"],
  provenanceLedger: "docs/provenance/imports.json (ThaUnknown/jassub)",
  constructionRefusesWhenDisabled: true,
  forcedOptions: {
    queryFonts: false,
    defaultFont: forced.defaultFont,
    availableFontKeys: Object.keys(forced.availableFonts),
    preloadFontUrls: forced.fonts,
    libassMemoryLimit: forced.libassMemoryLimit,
    libassGlyphLimit: forced.libassGlyphLimit,
  },
  productionCspUnchanged: true,
  jassubEnabled: false,
};

/** @type {Record<string, unknown>} */
let perf = {
  measured: false,
  budgetMsPerFrame: TARGET_MS,
  budgetSsim: TARGET_SSIM,
  msPerFrame: null,
  ssimByFixture: {},
  minSsim: null,
  budgetsMet: false,
  method: null,
  error: null,
  detail: null,
};

const workDir = await mkdtemp(join(tmpdir(), "yamakan-q11-"));
try {
  // Workers cannot use import maps; rewrite bare npm imports to absolute /nm/ URLs.
  // throughput is CommonJS; provide a tiny ESM shim for the qualify harness.
  writeFileSync(
    join(workDir, "throughput-shim.js"),
    `const maxTick = 65535;
const resolution = 10;
const timeDiff = 1e3 / resolution;
const now = () => performance.now();
function getTick(start) { return ((now() - start) / timeDiff) & maxTick; }
export default function throughput(seconds) {
  const start = now();
  const size = resolution * (seconds || 5);
  const buffer = [0];
  let pointer = 1;
  let last = (getTick(start) - 1) & maxTick;
  return function (delta) {
    const tick = getTick(start);
    let dist = (tick - last) & maxTick;
    if (dist > size) dist = size;
    last = tick;
    while (dist--) {
      if (pointer === size) pointer = 0;
      buffer[pointer] = buffer[pointer === 0 ? size - 1 : pointer - 1];
      pointer++;
    }
    if (delta) buffer[pointer - 1] += delta;
    let sum = 0;
    for (let i = 0; i < size; i++) sum += buffer[i] || 0;
    return sum * resolution / size;
  };
}
`,
  );

  const bareToUrl = {
    abslink: "/nm/abslink/src/abslink.js",
    "abslink/w3c": "/nm/abslink/adapters/w3c.js",
    "lfa-ponyfill": "/nm/lfa-ponyfill/index.js",
    "rvfc-polyfill": "/nm/rvfc-polyfill/index.js",
    throughput: "/throughput-shim.js",
  };
  const rewriteBareImports = (source) =>
    source
      .replace(/\bfrom\s*['"]([^'"]+)['"]/g, (full, spec) =>
        Object.prototype.hasOwnProperty.call(bareToUrl, spec)
          ? `from '${bareToUrl[spec]}'`
          : full,
      )
      .replace(/^import\s*['"]([^'"]+)['"]\s*;?/gm, (full, spec) =>
        Object.prototype.hasOwnProperty.call(bareToUrl, spec)
          ? `import '${bareToUrl[spec]}';`
          : full,
      );

  const jassubDist = join(workDir, "jassub");
  cpSync(join(JASSUB_PKG, "dist"), jassubDist, { recursive: true });
  const walkJs = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walkJs(p);
      else if (ent.name.endsWith(".js")) {
        writeFileSync(p, rewriteBareImports(readFileSync(p, "utf8")));
      }
    }
  };
  walkJs(jassubDist);

  const fonts = await titleFonts();
  const cues = MEASURE_FIXTURES.map((name, i) => {
    const fixture = TYPOGRAPHY_FIXTURES.find((f) => f.name === name);
    if (!fixture) throw new Error(`Missing typography fixture ${name}`);
    return {
      layer: 0,
      startTicks: i * FLICKS_PER_SECOND,
      endTicks: (i + 1) * FLICKS_PER_SECOND,
      text: fixture.text,
    };
  });
  const { ass } = compileTitles(cues, MEASURE_W, MEASURE_H, fonts);
  const fontRegular = join(REPO, TITLE_FONT.files[0].file);
  const workerUrl = "/jassub/worker/worker.js";
  const mainUrl = "/jassub/jassub.js";
  // Pin both SIMD and non-SIMD wasm URLs. jassub@2.5.20 selects modernWasmUrl when
  // WebAssembly SIMD validates; omitting it left a relative modern URL that could 404
  // depending on import.meta resolution. Still qualify-only; production CSP unchanged.
  const wasmUrl = "/jassub/wasm/jassub-worker.wasm";
  const modernWasmUrl = "/jassub/wasm/jassub-worker-modern.wasm";
  // Qualify-only CSP: allows wasm compile for this harness. Not production.
  // Qualify-only CSP. Includes wasm-unsafe-eval for this harness only.
  // Script is an external module (not inline) so 'unsafe-inline' is unnecessary.
  const qualifyCsp =
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'";

  // Preload pinned font via `fonts` so ready waits for _loadInitialFonts before
  // createTrackMem. Lazy availableFonts alone leave the first cue blank (jassub
  // does not redraw after late _allocFonts).
  const harnessJs = `import JASSUB from "${mainUrl}";
const ass = ${JSON.stringify(ass)};
const canvas = document.getElementById("c");
try {
  window.__jassub = new JASSUB({
    canvas,
    subContent: ass,
    queryFonts: false,
    defaultFont: ${JSON.stringify(JASSUB_PINNED_FONT_KEY)},
    availableFonts: { ${JSON.stringify(JASSUB_PINNED_FONT_KEY)}: "/font.ttf" },
    fonts: ["/font.ttf"],
    libassMemoryLimit: ${JASSUB_LIBASS_MEMORY_LIMIT_MIB},
    libassGlyphLimit: ${JASSUB_LIBASS_GLYPH_LIMIT},
    workerUrl: "${workerUrl}",
    wasmUrl: "${wasmUrl}",
    modernWasmUrl: "${modernWasmUrl}",
  });
  await window.__jassub.ready;
  window.__q11ready = true;
  window.__q11error = null;
  window.__q11simd = !!JASSUB._supportsSIMD;
} catch (e) {
  window.__q11ready = false;
  window.__q11error = String(e && e.stack ? e.stack : e);
}
`;
  writeFileSync(join(workDir, "harness.js"), harnessJs);

  const harness = `<!doctype html>
<html><head><meta charset="utf-8"><title>Q11 JASSUB</title>
<style>
  html,body{margin:0;background:#000;width:${MEASURE_W}px;height:${MEASURE_H}px;overflow:hidden}
  #c{display:block;width:${MEASURE_W}px;height:${MEASURE_H}px;background:#000}
</style></head>
<body>
<canvas id="c" width="${MEASURE_W}" height="${MEASURE_H}"></canvas>
<script type="module" src="/harness.js"></script>
</body></html>`;

  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".wasm": "application/wasm",
    ".ttf": "font/ttf",
    ".png": "image/png",
    ".map": "application/json",
  };

  const safeJoin = (root, urlPath) => {
    const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
    const full = resolve(root, rel);
    if (!full.startsWith(resolve(root))) return null;
    return full;
  };

  /** @type {string[]} */
  const missingPaths = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, {
        "content-type": mime[".html"],
        "content-security-policy": qualifyCsp,
      });
      res.end(harness);
      return;
    }
    if (url.pathname === "/harness.js") {
      res.writeHead(200, { "content-type": mime[".js"] });
      createReadStream(join(workDir, "harness.js")).pipe(res);
      return;
    }
    if (url.pathname === "/throughput-shim.js") {
      res.writeHead(200, { "content-type": mime[".js"] });
      createReadStream(join(workDir, "throughput-shim.js")).pipe(res);
      return;
    }
    if (url.pathname === "/font.ttf") {
      res.writeHead(200, { "content-type": mime[".ttf"] });
      createReadStream(fontRegular).pipe(res);
      return;
    }
    // Browsers request /favicon.ico; serving empty avoids a spurious 404 console error.
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    let file = null;
    if (url.pathname.startsWith("/jassub/")) {
      file = safeJoin(jassubDist, url.pathname.slice("/jassub/".length));
    } else if (url.pathname.startsWith("/nm/")) {
      file = safeJoin(
        join(REPO, "node_modules"),
        url.pathname.slice("/nm/".length),
      );
    }
    if (!file || !existsSync(file)) {
      missingPaths.push(url.pathname);
      res.writeHead(404);
      res.end("missing " + url.pathname);
      return;
    }
    res.writeHead(200, {
      "content-type": mime[extname(file)] || "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = /** @type {import('node:net').AddressInfo} */ (
    server.address()
  );

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: MEASURE_W, height: MEASURE_H },
    });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForFunction(
      () => window.__q11ready === true || window.__q11error,
      null,
      { timeout: 120_000 },
    );
    const boot = await page.evaluate(() => ({
      ready: window.__q11ready,
      error: window.__q11error ?? null,
      simd: window.__q11simd ?? null,
    }));
    if (!boot.ready) {
      throw new Error(
        `JASSUB harness failed to become ready: ${boot.error ?? "unknown"}; pageErrors=${pageErrors.join("; ")}; missingPaths=${missingPaths.join(",")}`,
      );
    }

    const timesMs = [];
    /** @type {Record<string, number>} */
    const ssimByFixture = {};
    const shotDir = join(workDir, "shots");
    mkdirSync(shotDir, { recursive: true });
    const evidenceShotDir = join(
      REPO,
      "docs/evidence/qualification/q11-jassub-investigation/shots",
    );
    mkdirSync(evidenceShotDir, { recursive: true });

    // Warmup: fonts are preloaded, but first wasm/GPU path still spikes.
    // Run several seeks across the track before timed samples.
    for (let w = 0; w < 5; w++) {
      await page.evaluate(async (t) => {
        await window.__jassub.manualRender(
          {
            expectedDisplayTime: performance.now(),
            mediaTime: t,
            width: 1280,
            height: 720,
          },
          true,
        );
      }, (w % MEASURE_FIXTURES.length) + 0.5);
    }

    for (let i = 0; i < MEASURE_FIXTURES.length; i++) {
      const name = MEASURE_FIXTURES[i];
      const mediaTime = i + 0.5;
      // Discard one untimed seek at this cue, then time the second render.
      await page.evaluate(async (t) => {
        await window.__jassub.manualRender(
          {
            expectedDisplayTime: performance.now(),
            mediaTime: t,
            width: 1280,
            height: 720,
          },
          true,
        );
      }, mediaTime);
      const ms = await page.evaluate(async (t) => {
        const t0 = performance.now();
        await window.__jassub.manualRender(
          {
            expectedDisplayTime: performance.now(),
            mediaTime: t,
            width: 1280,
            height: 720,
          },
          true,
        );
        return performance.now() - t0;
      }, mediaTime);
      timesMs.push(ms);

      const shotPath = join(shotDir, `${name}.png`);
      await page.locator("#c").screenshot({ path: shotPath });
      cpSync(shotPath, join(evidenceShotDir, `${name}.png`));

      const fixtureIndex = TYPOGRAPHY_FIXTURES.findIndex(
        (f) => f.name === name,
      );
      const refName = `landscape-${String(fixtureIndex + 1).padStart(2, "0")}-${name}.png`;
      const refPath = join(TYPO_DIR, refName);
      if (!existsSync(refPath)) {
        throw new Error(`Missing T7 reference frame ${refPath}`);
      }
      const rendered = decodeStill(shotPath, MEASURE_W, MEASURE_H);
      const reference = decodeStill(refPath, MEASURE_W, MEASURE_H);
      const box = glyphBox(
        reference,
        { x: 0, y: 0, w: MEASURE_W, h: MEASURE_H },
        [0, 0, 0],
      ) ?? { x: 0, y: 0, w: MEASURE_W, h: MEASURE_H };
      ssimByFixture[name] = Number(ssim(rendered, reference, box).toFixed(4));
    }

    const meanMs =
      timesMs.reduce((a, b) => a + b, 0) / Math.max(timesMs.length, 1);
    const maxMs = Math.max(...timesMs);
    const minSsim = Math.min(...Object.values(ssimByFixture));
    const budgetsMet = meanMs <= TARGET_MS && minSsim >= TARGET_SSIM;
    const uniqueMissing = [...new Set(missingPaths)];

    perf = {
      measured: true,
      budgetMsPerFrame: TARGET_MS,
      budgetSsim: TARGET_SSIM,
      msPerFrame: Number(meanMs.toFixed(3)),
      maxMsPerFrame: Number(maxMs.toFixed(3)),
      timesMs: timesMs.map((t) => Number(t.toFixed(3))),
      ssimByFixture,
      minSsim: Number(minSsim.toFixed(4)),
      budgetsMet,
      method:
        "playwright-msedge + rewritten jassub; fonts[] preload before track; modernWasmUrl+wasmUrl pinned; warmup manualRender; qualify-only CSP with wasm-unsafe-eval; SSIM vs T7 landscape PNGs (glyph box)",
      qualifyOnlyCspIncludesWasmUnsafeEval: true,
      productionCspHasWasmUnsafeEval: false,
      simdEnabled: boot.simd,
      http404Paths: uniqueMissing.length ? uniqueMissing : null,
      consoleErrors: pageErrors.length ? pageErrors : null,
      detail: budgetsMet
        ? "Q11 budgets met in qualify harness (enablement still blocked)."
        : `Q11 budgets NOT met (mean ${meanMs.toFixed(3)} ms/frame, min SSIM ${minSsim.toFixed(4)}); keep server libass reference still.`,
      fixtures: MEASURE_FIXTURES,
      resolution: `${MEASURE_W}x${MEASURE_H}`,
      investigationShots:
        "docs/evidence/qualification/q11-jassub-investigation/shots/",
    };
  } finally {
    await browser?.close();
    server.close();
  }
} catch (e) {
  perf = {
    ...perf,
    measured: false,
    budgetsMet: false,
    error: e instanceof Error ? e.message : String(e),
    detail:
      "Perf/SSIM measurement did not complete; engComplete still recorded. Server reference still remains primary. Production CSP unchanged (no wasm-unsafe-eval).",
    method: "attempted-playwright-rewritten-jassub-harness",
  };
} finally {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const enablementBlockedOn = ["H1-native-arabic-review"];
if (!mainTs.includes("wasm-unsafe-eval")) {
  enablementBlockedOn.push("CSP-wasm-unsafe-eval-security-review");
}
const ssimOk =
  typeof perf.minSsim === "number" && perf.minSsim >= TARGET_SSIM;
const perfOk =
  typeof perf.msPerFrame === "number" && perf.msPerFrame <= TARGET_MS;
if (!ssimOk) enablementBlockedOn.push("Q11-ssim-budget");
if (!perfOk) enablementBlockedOn.push("Q11-perf-budget");
if (!perf.budgetsMet && ssimOk && perfOk) {
  // Defensive: budgetsMet should match both checks.
  enablementBlockedOn.push("Q11-perf-or-ssim-budget");
}

const head = git("rev-parse", "HEAD");
const receipt = {
  qualification: "Q11_JASSUB_ENG",
  task: "P10-07",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  jassubEnabled: false,
  h1Signed: false,
  engComplete: true,
  eng: engComplete,
  performanceClaimed: Boolean(perf.budgetsMet),
  ssimClaimed: Boolean(perf.budgetsMet),
  perf,
  npmPinStatus: "installed-jassub@2.5.20",
  targetPin: "jassub@2.5.20 (dea3d2d3)",
  cspWasmUnsafeEval: "not-applied-in-production",
  enablementBlockedOn,
  fallback: "server-libass-reference-still",
  publicRelease: "NO-GO",
  passed: true,
  detail: perf.budgetsMet
    ? "Engineering complete; Q11 budgets met in qualify-only harness; JASSUB_ENABLED remains false (H1 + production CSP review still block enablement)."
    : `Engineering complete; Q11 budgets not claimed (${perf.detail ?? perf.error}); JASSUB_ENABLED remains false; server reference still primary.`,
};

mkdirSync(dirname(RECEIPT), { recursive: true });
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
console.log(readFileSync(RECEIPT, "utf8"));
console.log(
  `Q11 JASSUB ENG ${perf.budgetsMet ? "budgets-met" : "eng-complete-budgets-open"} — ${RECEIPT}`,
);
