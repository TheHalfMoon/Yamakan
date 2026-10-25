// YU-016: the browser's waveform tiles. A fake fetch records every request,
// so reuse across edits, aborts and bounds are counted exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PEAK_TILE,
  createPeakTiles,
  peakLevel,
} from "../src/media/peak-tiles.ts";

const PATH = "/api/v1/projects/p/assets/a/peaks";
const HASH = "a".repeat(64);

// Tile bytes: each peak is its own index at that level, mod 251.
function server(opts: { fail?: number; hold?: boolean } = {}) {
  const urls: string[] = [];
  const aborted: string[] = [];
  let fail = opts.fail ?? 0;
  const releases: (() => void)[] = [];
  const fetcher = (url: string, signal: AbortSignal) =>
    new Promise<Response>((resolve, reject) => {
      urls.push(url);
      signal.addEventListener("abort", () => {
        aborted.push(url);
        reject(new DOMException("Aborted", "AbortError"));
      });
      const q = new URL(url, "http://x").searchParams;
      const index = Number(q.get("index"));
      const respond = () => {
        if (fail > 0) {
          fail--;
          resolve(new Response(null, { status: 503 }));
          return;
        }
        const bytes = new Uint8Array(PEAK_TILE).map(
          (_, i) => (index * PEAK_TILE + i) % 251,
        );
        resolve(new Response(bytes));
      };
      if (opts.hold) releases.push(respond);
      else respond();
    });
  return { fetcher, urls, aborted, releases };
}

const span = (
  tiles: ReturnType<typeof createPeakTiles>,
  from: number,
  to: number,
  widthPx: number,
  signal = new AbortController().signal,
) =>
  tiles.span({
    path: PATH,
    hash: HASH,
    duration: 600,
    from,
    to,
    widthPx,
    signal,
  });

test("a hundred edits of the same media fetch each tile once and never the original", async () => {
  const s = server();
  const tiles = createPeakTiles(s.fetcher);
  for (let edit = 0; edit < 100; edit++) {
    // Each revision redraws the clip; trims move by a frame each time.
    const got = await span(tiles, 10 + (edit % 3) / 30, 50, 4000);
    assert.equal(got.peaksPerSecond, 100);
    assert.equal(got.peaks[0], Math.floor((10 + (edit % 3) / 30) * 100) % 251);
  }
  assert.ok(s.urls.length <= 3, `fetched ${s.urls.length} tiles`);
  assert.equal(new Set(s.urls).size, s.urls.length, "no tile fetched twice");
  assert.ok(s.urls.every((u) => u.startsWith(`${PATH}?level=`)));
});

test("the zoom level gives at least a peak per pixel, coarser when zoomed out", () => {
  assert.equal(peakLevel(10, 1000), 0);
  assert.equal(peakLevel(10, 500), 1);
  assert.equal(peakLevel(600, 600), 6);
  assert.equal(peakLevel(600, 1), 12);
  for (const [seconds, px] of [
    [1, 3000],
    [7.3, 640],
    [599, 1920],
    [120, 80],
  ] as const) {
    const level = peakLevel(seconds, px);
    assert.ok(level === 0 || (100 / 2 ** level) * seconds >= px);
  }
});

test("a span is the exact slice of its tiles, across a tile boundary", async () => {
  const tiles = createPeakTiles(server().fetcher);
  const got = await span(tiles, 20, 21, 100);
  assert.equal(got.peaks.length, 100);
  assert.deepEqual(
    [...got.peaks],
    Array.from({ length: 100 }, (_, i) => (2000 + i) % 251),
  );
});

test("a request every view left is aborted; one still wanted is not", async () => {
  const s = server({ hold: true });
  const tiles = createPeakTiles(s.fetcher);
  const first = new AbortController();
  const old = span(tiles, 0, 10, 1000, first.signal);
  const shared = span(tiles, 0, 10, 1000);
  first.abort();
  await assert.rejects(old, { name: "AbortError" });
  assert.deepEqual(s.aborted, [], "another view still waits for the tile");
  s.releases.shift()!();
  assert.equal((await shared).peaks.length, 1000);
  // A superseded zoom: its only view leaves, so its fetch is aborted.
  const zoom = new AbortController();
  const superseded = span(tiles, 100, 200, 500, zoom.signal);
  zoom.abort();
  await assert.rejects(superseded, { name: "AbortError" });
  assert.equal(s.aborted.length, 1);
  // Asking again starts a fresh request instead of joining the aborted one.
  const again = span(tiles, 100, 200, 500);
  s.releases.at(-1)!();
  // 100 s at 500 px: level 4, 6.25 peaks per second.
  assert.equal((await again).peaks.length, 625);
});

test("a failed tile is fetched again, and the cache stays bounded", async () => {
  const s = server({ fail: 1 });
  const tiles = createPeakTiles(s.fetcher, 4);
  await assert.rejects(span(tiles, 0, 1, 100), /503/);
  assert.equal((await span(tiles, 0, 1, 100)).peaks.length, 100);
  for (let i = 0; i < 10; i++) await span(tiles, i * 21, i * 21 + 1, 100);
  assert.ok(tiles.size() <= 4);
});

test("the editor no longer fetches whole assets to draw waveforms", async () => {
  const main = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(main, /openAssetPeaks|waveformCache/);
});
