// Waveform peak tiles (YU-016). An asset's audio is decoded once by an owned,
// bounded FFmpeg worker into base peaks (the largest absolute sample of both
// channels in each 10 ms), cached per project as a rebuildable derivative
// keyed by the asset's content hash, the peak format and the FFmpeg build.
// Clients read bounded tiles at power-of-two zoom levels (each peak the
// largest of the base peaks it covers), so the browser never fetches the
// original to draw a waveform. The cache holds only what can be rebuilt:
// evicting or losing it never touches the asset.
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  statfs,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { MEDIA_FORMATS } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { engineId, evictPreviews } from "../render/preview.ts";
import type { Asset } from "../project.ts";
import type { ProjectStore } from "../store.ts";

/** Base peaks per second; level L has BASE_RATE / 2^L peaks per second. */
export const PEAKS_PER_SECOND = 100;
/** Peaks in one tile (one response). */
export const PEAK_TILE = 2048;
/** Coarsest level: one peak per 2^12 base peaks (about 41 s). */
export const MAX_PEAK_LEVEL = 12;
// The decode profile: float at 48 kHz in the source's own channels (never
// mixed, which would lower peaks), 480 frames per base peak. Changing any
// of it is a new version (a different cache key).
const PEAKS_VERSION = "yamakan.peaks/v1:f32le-native-48000-480-maxabs-u8ceil";
const RATE = 48_000;
const FRAMES_PER_PEAK = RATE / PEAKS_PER_SECOND;
// More channels than this are mixed down to it.
const MAX_CHANNELS = 8;
// Assets are at most ten minutes long (core/media.ts); one extra second of
// slack for container rounding.
const MAX_SECONDS = 601;
const MAX_PEAKS = MAX_SECONDS * PEAKS_PER_SECOND;
const WALL_SECONDS = 120;
// Per-project peak cache: at most ~60 KB per asset, so this holds hundreds.
export const PEAK_CACHE_BYTES = 32 * 1024 * 1024;
const QUEUE_DEPTH = 8;

export type PeakTile = {
  peaks: Uint8Array;
  level: number;
  index: number;
  // Peaks at this level for the whole asset.
  total: number;
  cached: boolean;
};

/**
 * Base peaks from raw interleaved f32le samples of `channels` channels, in
 * order; chunks may split a frame anywhere. Values are the bucket's largest
 * |sample| on any channel (non-finite samples count as silence), quantized
 * up to 0..255 so a peak never shows below the loudest sample it covers.
 */
export function peakAccumulator(channels: number, limit = MAX_PEAKS) {
  const frameBytes = 4 * channels;
  const peaks = new Uint8Array(limit);
  let count = 0;
  let inBucket = 0;
  let loudest = 0;
  let carry = Buffer.alloc(0);
  const close = () => {
    if (count >= limit)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "The audio is longer than an asset may be.",
      );
    peaks[count++] = Math.min(255, Math.ceil(loudest * 255));
    inBucket = 0;
    loudest = 0;
  };
  return {
    push(chunk: Buffer) {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      // Whole frames only; a split frame waits for the rest.
      const done = data.length - (data.length % frameBytes);
      for (let at = 0; at < done; at += frameBytes) {
        for (let c = 0; c < frameBytes; c += 4) {
          const v = Math.abs(data.readFloatLE(at + c));
          if (v > loudest && Number.isFinite(v)) loudest = v;
        }
        if (++inBucket === FRAMES_PER_PEAK) close();
      }
      carry = Buffer.from(data.subarray(done));
    },
    finish() {
      if (inBucket > 0) close();
      return peaks.slice(0, count);
    },
  };
}

/** Tile `index` of `level` from base peaks: each peak covers 2^level base peaks. */
export function peakTile(base: Uint8Array, level: number, index: number) {
  const span = 2 ** level;
  const total = Math.ceil(base.length / span);
  const start = index * PEAK_TILE;
  if (start >= Math.max(total, 1))
    throw new CommandError(
      "NOT_FOUND",
      "That waveform tile is past the end of the audio.",
    );
  const peaks = new Uint8Array(Math.min(PEAK_TILE, total - start));
  for (let i = 0; i < peaks.length; i++) {
    const from = (start + i) * span;
    const to = Math.min(base.length, from + span);
    let m = 0;
    for (let j = from; j < to; j++) if (base[j]! > m) m = base[j]!;
    peaks[i] = m;
  }
  return { peaks, total };
}

// The cache file: the payload's SHA-256, then the base peaks.
const encode = (peaks: Uint8Array) =>
  Buffer.concat([createHash("sha256").update(peaks).digest(), peaks]);
function decode(bytes: Buffer): Uint8Array | null {
  if (bytes.length < 32 || bytes.length > 32 + MAX_PEAKS) return null;
  const payload = bytes.subarray(32);
  const sum = createHash("sha256").update(payload).digest();
  return sum.equals(bytes.subarray(0, 32)) ? new Uint8Array(payload) : null;
}

const noAudio = () =>
  new CommandError(
    "MEDIA_INVALID",
    "The asset's audio could not be decoded for a waveform.",
  );

// Channels of the first audio stream, by an owned, bounded ffprobe.
async function audioChannels(file: string, signal: AbortSignal) {
  let out = "";
  const result = await workers().run({
    executable: mediaTools().ffprobe,
    args: [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      MEDIA_FORMATS,
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=channels",
      "-of",
      "csv=p=0",
      `file:${path.basename(file)}`,
    ],
    cwd: path.dirname(file),
    readable: [file],
    memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(RESOURCE_POLICY.enforced.probeWallSeconds * 1000),
    ]),
    onStdout: (b) => {
      if (out.length < 64) out += b.toString("ascii");
    },
  });
  if (signal.aborted) throw new Error("Cancelled.");
  const channels = Number(out.trim());
  if (result.code !== 0 || !Number.isInteger(channels) || channels < 1)
    throw noAudio();
  return Math.min(channels, MAX_CHANNELS);
}

async function decodePeaks(file: string, seconds: number, signal: AbortSignal) {
  const channels = await audioChannels(file, signal);
  const acc = peakAccumulator(channels);
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, WALL_SECONDS * 1000);
  let size = 0;
  let failed: unknown = null;
  let result;
  try {
    result = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-v",
        "error",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        MEDIA_FORMATS,
        "-i",
        `file:${path.basename(file)}`,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-t",
        String(Math.min(seconds + 1, MAX_SECONDS)),
        "-ac",
        String(channels),
        "-ar",
        String(RATE),
        "-f",
        "f32le",
        "pipe:1",
      ],
      cwd: path.dirname(file),
      // The decoder may read only the asset it decodes.
      readable: [file],
      memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
      signal: controller.signal,
      onStdout: (chunk) => {
        if (failed) return;
        size += chunk.length;
        try {
          if (size > MAX_SECONDS * RATE * 4 * channels)
            throw new CommandError(
              "LIMIT_EXCEEDED",
              "The audio is longer than an asset may be.",
            );
          acc.push(chunk);
        } catch (e) {
          failed = e;
          controller.abort();
        }
      },
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
  if (failed) throw failed;
  if (signal.aborted) throw new Error("Cancelled.");
  if (controller.signal.aborted || result.code !== 0) throw noAudio();
  return acc.finish();
}

// Partial entries a crashed service left behind (writes take milliseconds).
async function removeStaleTemps(dir: string) {
  for (const name of await readdir(dir).catch(() => [])) {
    if (!/^[a-f0-9]{64}\.[0-9a-f-]{36}\.tmp$/.test(name)) continue;
    const file = path.join(dir, name);
    const info = await stat(file).catch(() => null);
    if (info?.isFile() && Date.now() - info.mtimeMs > 60_000)
      await unlink(file).catch(() => {});
  }
}

type Flight = {
  promise: Promise<Uint8Array>;
  controller: AbortController;
  waiters: number;
};
const inFlight = new Map<string, Flight>();
let queue: Promise<unknown> = Promise.resolve();
let waiting = 0;
// Recently used base peaks (about 60 KB each), so tiles stay cheap even
// when the disk cache cannot be written; keyed by content, like the cache.
const RECENT = 16;
const recent = new Map<string, Uint8Array>();
// Assets whose audio failed to decode are refused for a minute instead of
// taking the decode slot again on every request.
const FAILURE_MS = 60_000;
const failures = new Map<string, { error: CommandError; until: number }>();
const remember = <V>(
  map: Map<string, V>,
  key: string,
  value: V,
  bound: number,
) => {
  map.delete(key);
  map.set(key, value);
  while (map.size > bound) map.delete(map.keys().next().value!);
};

// Base peaks for an asset: from the cache when intact, else decoded once
// (one decode at a time; concurrent requests for the same asset share it,
// and it stops when every requester has gone).
async function basePeaks(
  store: ProjectStore,
  projectId: string,
  asset: Asset,
  file: string,
  signal?: AbortSignal,
) {
  const dir = await store.file(projectId, "cache", "peaks");
  await mkdir(dir, { recursive: true });
  const key = createHash("sha256")
    .update(JSON.stringify([asset.hash, PEAKS_VERSION, await engineId(dir)]))
    .digest("hex");
  const cacheFile = path.join(dir, `${key}.peaks`);
  const known = recent.get(key);
  if (known) {
    remember(recent, key, known, RECENT);
    return { peaks: known, cached: true };
  }
  const failed = failures.get(key);
  if (failed && failed.until > Date.now()) throw failed.error;
  const hit = await readFile(cacheFile).catch(() => null);
  if (hit) {
    const peaks = decode(hit);
    if (peaks) {
      remember(recent, key, peaks, RECENT);
      const now = new Date();
      await utimes(cacheFile, now, now).catch(() => {});
      return { peaks, cached: true };
    }
    // A damaged entry is only a cache miss.
    await unlink(cacheFile).catch(() => {});
  }
  let flight = inFlight.get(key);
  if (!flight || flight.controller.signal.aborted) {
    if (waiting >= QUEUE_DEPTH)
      throw new CommandError(
        "BUSY",
        "Too many waveforms are being prepared; retry shortly.",
      );
    const controller = new AbortController();
    waiting++;
    const turn = queue.then(async () => {
      waiting--;
      if (controller.signal.aborted) throw new Error("Cancelled.");
      let peaks: Uint8Array;
      try {
        peaks = await decodePeaks(
          file,
          asset.durationFrames / 30,
          controller.signal,
        );
      } catch (e) {
        if (e instanceof CommandError)
          remember(
            failures,
            key,
            { error: e, until: Date.now() + FAILURE_MS },
            64,
          );
        throw e;
      }
      remember(recent, key, peaks, RECENT);
      // A full disk leaves no entry (and no partial one) behind: the
      // waveform is still served, just not kept.
      const free = peakCacheSeams.freeBytes
        ? peakCacheSeams.freeBytes()
        : await statfs(dir).then(
            (space) => Number(space.bavail) * Number(space.bsize),
            () => 0,
          );
      if (free >= RESOURCE_POLICY.enforced.diskReserveBytes) {
        const temp = path.join(dir, `${key}.${randomUUID()}.tmp`);
        await removeStaleTemps(dir);
        try {
          await writeFile(temp, encode(peaks));
          await rename(temp, cacheFile);
          await evictPreviews(
            dir,
            cacheFile,
            PEAK_CACHE_BYTES,
            60_000,
            /^[a-f0-9]{64}\.peaks$/,
          );
        } catch {
          await unlink(temp).catch(() => {});
        }
      }
      return peaks;
    });
    queue = turn.catch(() => {});
    const entry: Flight = { promise: turn, controller, waiters: 0 };
    flight = entry;
    inFlight.set(key, entry);
    turn
      .finally(() => {
        if (inFlight.get(key) === entry) inFlight.delete(key);
      })
      .catch(() => {});
  }
  const entry = flight;
  entry.waiters++;
  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    if (--entry.waiters === 0) entry.controller.abort();
  };
  if (signal?.aborted) {
    leave();
    throw new Error("Cancelled.");
  }
  signal?.addEventListener("abort", leave, { once: true });
  try {
    return { peaks: await entry.promise, cached: false };
  } finally {
    signal?.removeEventListener("abort", leave);
    if (!left) {
      left = true;
      entry.waiters--;
    }
  }
}

/** One bounded waveform tile of a project asset (server-selected file). */
export async function assetPeakTile(
  store: ProjectStore,
  projectId: string,
  assetId: string,
  level: number,
  index: number,
  signal?: AbortSignal,
): Promise<PeakTile> {
  if (!Number.isInteger(level) || level < 0 || level > MAX_PEAK_LEVEL)
    throw new CommandError(
      "VALIDATION",
      `level must be a whole number from 0 to ${MAX_PEAK_LEVEL}.`,
    );
  if (!Number.isInteger(index) || index < 0 || index > MAX_PEAKS)
    throw new CommandError("VALIDATION", "index must be a whole number.");
  const { file, asset } = await store.assetFile(projectId, assetId);
  if (asset.kind === "image" || asset.hasAudio === false)
    throw new CommandError("VALIDATION", "The asset has no audio.");
  const { peaks: base, cached } = await basePeaks(
    store,
    projectId,
    asset,
    file,
    signal,
  );
  const { peaks, total } = peakTile(base, level, index);
  return { peaks, level, index, total, cached };
}

/** Waveform decodes waiting for their turn (tests). */
export function peaksWaiting() {
  return waiting;
}

/** Test seam: the free bytes a cache write sees (default: the volume's). */
export const peakCacheSeams: { freeBytes?: () => number } = {};

/** Forgets in-memory peaks and failures (tests: forces the disk path). */
export function forgetRecentPeaks() {
  recent.clear();
  failures.clear();
}
