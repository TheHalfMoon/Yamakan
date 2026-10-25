// YU-016: waveform peak tiles. A deterministic PCM fixture is written here,
// so the reference peaks are computed exactly from its samples and compared
// with what the owned FFmpeg worker produced, at every level and tile.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { mediaTools } from "../core/process/workers.ts";
import { CommandError } from "../core/command/errors.ts";
import {
  MAX_PEAK_LEVEL,
  PEAK_TILE,
  PEAKS_PER_SECOND,
  assetPeakTile,
  peakAccumulator,
  peakTile,
  peaksWaiting,
} from "../core/audio/peaks.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const handle of handles.reverse()) await handle.close();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

const RATE = 48_000;
const PER_PEAK = RATE / PEAKS_PER_SECOND;

// Stereo 16-bit PCM at 48 kHz, so the decode neither resamples nor mixes
// channels and the peaks are exact: 440 Hz on the left and 660 Hz on the
// right, each with an amplitude that changes every bucket, silent stretches,
// and a full-scale negative click on the right at a known frame.
function fixture(seconds: number) {
  const n = seconds * RATE;
  const samples = new Int16Array(n * 2);
  let seed = 12345;
  let left = 0;
  let right = 0;
  for (let i = 0; i < n; i++) {
    if (i % PER_PEAK === 0) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      // Every seventh bucket is silent.
      const silent = (i / PER_PEAK) % 7 === 3;
      left = silent ? 0 : (seed >>> 8) % 32767;
      right = silent ? 0 : (seed >>> 4) % 16384;
    }
    samples[2 * i] = Math.round(
      Math.sin((i * 2 * Math.PI * 440) / RATE) * left,
    );
    samples[2 * i + 1] = Math.round(
      Math.sin((i * 2 * Math.PI * 660) / RATE) * right,
    );
  }
  samples[2 * Math.floor(n * 0.61) + 1] = -32768;
  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return { wav: Buffer.concat([header, data]), samples, frames: n };
}

// What the peaks must be: per 10 ms, the loudest |sample| of either channel
// as FFmpeg's float (s / 32768), quantized up to 0..255.
function reference(samples: Int16Array) {
  const frames = samples.length / 2;
  const peaks = new Uint8Array(Math.ceil(frames / PER_PEAK));
  for (let b = 0; b < peaks.length; b++) {
    let m = 0;
    const end = Math.min(frames, (b + 1) * PER_PEAK) * 2;
    for (let i = b * PER_PEAK * 2; i < end; i++)
      m = Math.max(m, Math.abs(samples[i]! / 32768));
    peaks[b] = Math.min(255, Math.ceil(Math.fround(m) * 255));
  }
  return peaks;
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-peaks-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Peaks");
  return { root, store, project };
}

async function withAudio(seconds: number) {
  const ws = await workspace();
  const { wav, samples } = fixture(seconds);
  const { asset } = await ws.store.importAsset(ws.project.id, "tone.wav", wav);
  return { ...ws, asset, samples };
}

const cacheDir = (store: ProjectStore, projectId: string) =>
  store.file(projectId, "cache", "peaks");

async function refused(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => {
    assert.ok(e instanceof CommandError, String(e));
    assert.equal(e.code, code);
    return true;
  });
}

test("a long file's tiles match the reference peaks at every zoom level", async () => {
  const { store, project, asset, samples } = await withAudio(120);
  const base = reference(samples);
  assert.equal(base.length, 120 * PEAKS_PER_SECOND);
  for (let level = 0; level <= MAX_PEAK_LEVEL; level++) {
    const span = 2 ** level;
    const total = Math.ceil(base.length / span);
    const got: number[] = [];
    for (let index = 0; index * PEAK_TILE < total; index++) {
      const tile = await assetPeakTile(
        store,
        project.id,
        asset.id,
        level,
        index,
      );
      assert.equal(tile.total, total);
      assert.ok(tile.peaks.length <= PEAK_TILE);
      got.push(...tile.peaks);
    }
    const want = Array.from({ length: total }, (_, i) =>
      Math.max(...base.subarray(i * span, (i + 1) * span)),
    );
    assert.deepEqual(got, want, `level ${level}`);
  }
  // The click is full scale wherever it lands, at every level.
  const click = Math.floor(Math.floor((samples.length / 2) * 0.61) / PER_PEAK);
  assert.equal(base[click], 255);
  const coarse = await assetPeakTile(
    store,
    project.id,
    asset.id,
    MAX_PEAK_LEVEL,
    0,
  );
  assert.equal(coarse.peaks[click >> MAX_PEAK_LEVEL], 255);
  assert.equal(coarse.cached, true, "decoded once, then served from the cache");
});

test("peaks are the same whichever way the decoder's output is split", () => {
  const frames = 3 * PER_PEAK + 17;
  const pcm = Buffer.alloc(frames * 8);
  for (let f = 0; f < frames; f++) {
    pcm.writeFloatLE(Math.sin(f) * 0.5, f * 8);
    pcm.writeFloatLE(f === 700 ? -0.9 : 0.1, f * 8 + 4);
  }
  pcm.writeFloatLE(Number.NaN, 8 * 5);
  const want: number[] = [];
  for (let f = 0; f < frames; f++) {
    const b = Math.floor(f / PER_PEAK);
    const l = Math.abs(pcm.readFloatLE(f * 8));
    const r = Math.abs(pcm.readFloatLE(f * 8 + 4));
    const m = Math.max(Number.isFinite(l) ? l : 0, r);
    want[b] = Math.max(want[b] ?? 0, Math.min(255, Math.ceil(m * 255)));
  }
  const whole = peakAccumulator(2);
  whole.push(pcm);
  const expected = whole.finish();
  assert.deepEqual([...expected], want);
  assert.equal(expected.length, 4, "a partial last bucket still counts");
  assert.equal(expected[1], Math.ceil(Math.fround(0.9) * 255));
  for (const step of [1, 3, 5, 7, 13, 4096]) {
    const split = peakAccumulator(2);
    for (let at = 0; at < pcm.length; at += step)
      split.push(pcm.subarray(at, at + step));
    assert.deepEqual(split.finish(), expected, `chunks of ${step}`);
  }
  // A decoder that produces more than an asset may hold is stopped.
  const small = peakAccumulator(2, 2);
  assert.throws(() => small.push(pcm), /longer than an asset/);
});

test("a mono source keeps its full level (channels are never mixed)", async () => {
  const { store, project } = await workspace();
  const pcm = new Int16Array(RATE);
  pcm[RATE / 2] = 32767;
  const data = Buffer.from(pcm.buffer);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  const { asset } = await store.importAsset(
    project.id,
    "mono.wav",
    Buffer.concat([header, data]),
  );
  const tile = await assetPeakTile(store, project.id, asset.id, 0, 0);
  assert.equal(tile.total, 100);
  assert.equal(tile.peaks[50], Math.ceil(Math.fround(32767 / 32768) * 255));
  assert.equal(Math.max(...tile.peaks.filter((_, i) => i !== 50)), 0);
});

test("tiles past the end and levels out of range are refused", async () => {
  const { store, project, asset } = await withAudio(3);
  assert.equal(peakTile(new Uint8Array(300), 0, 0).peaks.length, 300);
  await refused(assetPeakTile(store, project.id, asset.id, 0, 1), "NOT_FOUND");
  await refused(
    assetPeakTile(store, project.id, asset.id, MAX_PEAK_LEVEL + 1, 0),
    "VALIDATION",
  );
  await refused(
    assetPeakTile(store, project.id, asset.id, 0.5, 0),
    "VALIDATION",
  );
  await refused(
    assetPeakTile(store, project.id, asset.id, 0, -1),
    "VALIDATION",
  );
});

test("an asset without audio is refused, and a stream that does not decode fails safely", async () => {
  const { root, store, project } = await workspace();
  const mp4 = path.join(root, "silent.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=64x64:rate=30:duration=1",
      "-pix_fmt",
      "yuv420p",
      mp4,
    ],
    { windowsHide: true },
  );
  const { asset } = await store.importAsset(
    project.id,
    "silent.mp4",
    await readFile(mp4),
  );
  assert.equal(asset.hasAudio, false);
  await refused(assetPeakTile(store, project.id, asset.id, 0, 0), "VALIDATION");
  // The same video when its audio flag is unknown (an older project): the
  // decoder finds no audio stream and the request fails as invalid media.
  await refused(
    assetPeakTile(
      {
        assetFile: async () => ({
          file: await store.assetFile(project.id, asset.id).then((r) => r.file),
          asset: { ...asset, hasAudio: null },
        }),
        file: store.file.bind(store),
      } as unknown as ProjectStore,
      project.id,
      asset.id,
      0,
      0,
    ),
    "MEDIA_INVALID",
  );
  assert.deepEqual(await readdir(await cacheDir(store, project.id)), []);
});

test("a damaged or unwritable cache entry is rebuilt, never served", async () => {
  const { store, project, asset, samples } = await withAudio(5);
  const want = reference(samples);
  const first = await assetPeakTile(store, project.id, asset.id, 0, 0);
  assert.deepEqual([...first.peaks], [...want]);
  const dir = await cacheDir(store, project.id);
  const [name] = await readdir(dir);
  assert.match(name!, /^[a-f0-9]{64}\.peaks$/);
  // Flipped bytes: the checksum fails, the entry is decoded again.
  const bytes = await readFile(path.join(dir, name!));
  bytes[40] ^= 0xff;
  await writeFile(path.join(dir, name!), bytes);
  const again = await assetPeakTile(store, project.id, asset.id, 0, 0);
  assert.equal(again.cached, false);
  assert.deepEqual([...again.peaks], [...want]);
  assert.equal(
    (await assetPeakTile(store, project.id, asset.id, 0, 0)).cached,
    true,
  );
  // Truncated to nothing: also only a miss.
  await writeFile(path.join(dir, name!), Buffer.alloc(3));
  assert.deepEqual(
    [...(await assetPeakTile(store, project.id, asset.id, 0, 0)).peaks],
    [...want],
  );
  // A cache that cannot be written (a folder where the entry goes, as a
  // full disk would refuse it): the tile is still served, nothing is kept,
  // and the asset is untouched.
  await rm(path.join(dir, name!));
  await mkdir(path.join(dir, name!));
  const unkept = await assetPeakTile(store, project.id, asset.id, 0, 0);
  assert.deepEqual([...unkept.peaks], [...want]);
  assert.deepEqual((await readdir(dir)).sort(), [name]);
  const { file } = await store.assetFile(project.id, asset.id);
  assert.ok((await readFile(file)).length > 0);
});

test("a request whose client left stops its decode; concurrent requests share one", async () => {
  const { store, project, asset } = await withAudio(5);
  const gone = new AbortController();
  gone.abort();
  await assert.rejects(
    assetPeakTile(store, project.id, asset.id, 0, 0, gone.signal),
    /Cancelled/,
  );
  const leaving = new AbortController();
  const left = assetPeakTile(store, project.id, asset.id, 0, 0, leaving.signal);
  leaving.abort();
  await assert.rejects(left, /Cancelled/);
  assert.equal(peaksWaiting(), 0);
  const [a, b] = await Promise.all([
    assetPeakTile(store, project.id, asset.id, 0, 0),
    assetPeakTile(store, project.id, asset.id, 1, 0),
  ]);
  assert.equal(a.total, 500);
  assert.equal(b.total, 250);
  assert.equal((await readdir(await cacheDir(store, project.id))).length, 1);
});
