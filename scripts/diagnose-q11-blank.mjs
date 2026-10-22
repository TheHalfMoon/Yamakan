/**
 * Diagnose Q11 blank punctuation: isolate cues, count non-black pixels, log times.
 * Qualify-only harness; does not change production CSP or enable JASSUB.
 */
import {
  writeFileSync,
  readFileSync,
  existsSync,
  createReadStream,
  rmSync,
  cpSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { resolve, join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium } from "playwright-core";
import {
  JASSUB_LIBASS_GLYPH_LIMIT,
  JASSUB_LIBASS_MEMORY_LIMIT_MIB,
  JASSUB_PINNED_FONT_KEY,
} from "../src/preview/titles.ts";
import { TITLE_FONT, titleFonts } from "../core/render/fonts.ts";
import { compileTitles } from "../core/render/ass.ts";
import { FLICKS_PER_SECOND } from "../core/time.ts";
import { TYPOGRAPHY_FIXTURES } from "./typography-fixtures.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(
  REPO,
  "docs/evidence/qualification/q11-jassub-investigation/diagnose",
);
const JASSUB_PKG = join(REPO, "node_modules/jassub");
const MEASURE_W = 1280;
const MEASURE_H = 720;
const NAMES = [
  "punctuation",
  "bidi-isolates",
  "diacritics",
  "mixed-lines",
  "latin-only",
];

mkdirSync(OUT, { recursive: true });
const workDir = await mkdtemp(join(tmpdir(), "yamakan-q11d-"));

writeFileSync(
  join(workDir, "throughput-shim.js"),
  `export default function throughput(){return ()=>0}`,
);
const bareToUrl = {
  abslink: "/nm/abslink/src/abslink.js",
  "abslink/w3c": "/nm/abslink/adapters/w3c.js",
  "lfa-ponyfill": "/nm/lfa-ponyfill/index.js",
  "rvfc-polyfill": "/nm/rvfc-polyfill/index.js",
  throughput: "/throughput-shim.js",
};
const rewrite = (source) =>
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
const walk = (dir) => {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".js"))
      writeFileSync(p, rewrite(readFileSync(p, "utf8")));
  }
};
walk(jassubDist);

const fonts = await titleFonts();
const fontRegular = join(REPO, TITLE_FONT.files[0].file);

/** @type {Record<string, unknown>} */
const report = { modes: {}, checkedAt: new Date().toISOString() };

async function runMode(mode, buildAss, seekTimes) {
  const { ass } = buildAss();
  writeFileSync(join(OUT, `ass-${mode}.txt`), ass);
  const harnessJs = `import JASSUB from "/jassub/jassub.js";
const canvas = document.getElementById("c");
window.__jassub = new JASSUB({
  canvas,
  subContent: ${JSON.stringify(ass)},
  queryFonts: false,
  defaultFont: ${JSON.stringify(JASSUB_PINNED_FONT_KEY)},
  availableFonts: { ${JSON.stringify(JASSUB_PINNED_FONT_KEY)}: "/font.ttf" },
  libassMemoryLimit: ${JASSUB_LIBASS_MEMORY_LIMIT_MIB},
  libassGlyphLimit: ${JASSUB_LIBASS_GLYPH_LIMIT},
  workerUrl: "/jassub/worker/worker.js",
  wasmUrl: "/jassub/wasm/jassub-worker.wasm",
  modernWasmUrl: "/jassub/wasm/jassub-worker-modern.wasm",
});
await window.__jassub.ready;
window.__ready = true;
`;
  writeFileSync(join(workDir, "harness.js"), harnessJs);
  const html = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${MEASURE_W}" height="${MEASURE_H}"></canvas>
<script type="module" src="/harness.js"></script></body></html>`;

  const safeJoin = (root, urlPath) => {
    const full = resolve(root, decodeURIComponent(urlPath).replace(/^\/+/, ""));
    return full.startsWith(resolve(root)) ? full : null;
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, {
        "content-type": "text/html",
        "content-security-policy":
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'",
      });
      res.end(html);
      return;
    }
    if (url.pathname === "/harness.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      createReadStream(join(workDir, "harness.js")).pipe(res);
      return;
    }
    if (url.pathname === "/throughput-shim.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      createReadStream(join(workDir, "throughput-shim.js")).pipe(res);
      return;
    }
    if (url.pathname === "/font.ttf") {
      res.writeHead(200, { "content-type": "font/ttf" });
      createReadStream(fontRegular).pipe(res);
      return;
    }
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    let file = null;
    if (url.pathname.startsWith("/jassub/"))
      file = safeJoin(jassubDist, url.pathname.slice("/jassub/".length));
    else if (url.pathname.startsWith("/nm/"))
      file = safeJoin(
        join(REPO, "node_modules"),
        url.pathname.slice("/nm/".length),
      );
    if (!file || !existsSync(file)) {
      res.writeHead(404);
      res.end(url.pathname);
      return;
    }
    res.writeHead(200, {
      "content-type":
        {
          ".js": "text/javascript",
          ".wasm": "application/wasm",
        }[extname(file)] || "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: MEASURE_W, height: MEASURE_H },
    });
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForFunction(() => window.__ready === true, null, {
      timeout: 120_000,
    });
    // Warmup
    await page.evaluate(async () => {
      await window.__jassub.manualRender(
        {
          expectedDisplayTime: performance.now(),
          mediaTime: 0.05,
          width: 1280,
          height: 720,
        },
        true,
      );
    });
    const results = [];
    for (const { name, t } of seekTimes) {
      const ms = await page.evaluate(async (mediaTime) => {
        const t0 = performance.now();
        await window.__jassub.manualRender(
          {
            expectedDisplayTime: performance.now(),
            mediaTime,
            width: 1280,
            height: 720,
          },
          true,
        );
        return performance.now() - t0;
      }, t);
      // Wait a frame for compositor
      await page.waitForTimeout(50);
      const shot = join(OUT, `${mode}-${name}.png`);
      await page.locator("#c").screenshot({ path: shot });
      const pixels = await page.evaluate(() => {
        const c = document.getElementById("c");
        // OffscreenCanvas transferred — read via createImageBitmap path if needed
        try {
          const ctx = c.getContext("2d");
          if (!ctx) return { readable: false, nonBlack: -1 };
          const { data } = ctx.getImageData(0, 0, c.width, c.height);
          let nonBlack = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] | data[i + 1] | data[i + 2]) nonBlack++;
          }
          return { readable: true, nonBlack };
        } catch (e) {
          return { readable: false, nonBlack: -1, error: String(e) };
        }
      });
      results.push({ name, mediaTime: t, ms: Number(ms.toFixed(2)), ...pixels, shot });
    }
    report.modes[mode] = results;
  } finally {
    await browser.close();
    server.close();
  }
}

// Mode A: all cues in one track (current Q11)
await runMode(
  "all-cues",
  () => {
    const cues = NAMES.map((name, i) => {
      const f = TYPOGRAPHY_FIXTURES.find((x) => x.name === name);
      return {
        layer: 0,
        startTicks: i * FLICKS_PER_SECOND,
        endTicks: (i + 1) * FLICKS_PER_SECOND,
        text: f.text,
      };
    });
    return compileTitles(cues, MEASURE_W, MEASURE_H, fonts);
  },
  NAMES.map((name, i) => ({ name, t: i + 0.5 })),
);

// Mode B: punctuation alone
await runMode(
  "punct-alone",
  () => {
    const f = TYPOGRAPHY_FIXTURES.find((x) => x.name === "punctuation");
    return compileTitles(
      [
        {
          layer: 0,
          startTicks: 0,
          endTicks: 5 * FLICKS_PER_SECOND,
          text: f.text,
        },
      ],
      MEASURE_W,
      MEASURE_H,
      fonts,
    );
  },
  [{ name: "punctuation", t: 0.5 }],
);

// Mode C: latin alone (control)
await runMode(
  "latin-alone",
  () => {
    const f = TYPOGRAPHY_FIXTURES.find((x) => x.name === "latin-only");
    return compileTitles(
      [
        {
          layer: 0,
          startTicks: 0,
          endTicks: 5 * FLICKS_PER_SECOND,
          text: f.text,
        },
      ],
      MEASURE_W,
      MEASURE_H,
      fonts,
    );
  },
  [{ name: "latin-only", t: 0.5 }],
);

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
rmSync(workDir, { recursive: true, force: true });
