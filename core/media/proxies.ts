// Edit proxies and indexed thumbnails (YU-017). A proxy is a small,
// frequently keyed H.264 copy of a video asset for smooth interactive
// preview on an ordinary Windows host. It is a rebuildable cache entry keyed
// by the asset's content hash, the proxy profile and the FFmpeg build, kept
// per project beside the other caches: it never replaces the original, and
// export and reference preview always read the original (or its qualified
// constant-rate derivative). A proxy keeps the source's timestamps; its
// recorded mapping (start times and frame count) is checked before it is
// published, so a proxy that would show a different frame at the same time
// is refused, not shown.
//
// A build runs in an owned, bounded FFmpeg worker, one at a time, and can
// be cancelled. It is written to a private folder, verified, then published
// by renaming the video and, last, its record; a restart that interrupted a
// build leaves only a private folder or a video without a record, and both
// are removed (quarantined) on the next look. The cache is bounded in bytes
// and keeps a free-space reserve.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { MEDIA_FORMATS, probe } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { engineId, evictPreviews } from "../render/preview.ts";
import type { Asset } from "../project.ts";
import type { ProjectStore } from "../store.ts";

// The proxy profile. Changing any of it is a new version (a new cache key).
export const PROXY_PROFILE = Object.freeze({
  maxHeight: 540,
  // A keyframe every half second at 30 fps, so scrubbing seeks cheaply.
  keyframeInterval: 15,
  crf: 28,
  audioBitrate: "128k",
});
const PROXY_VERSION = `yamakan.proxy/v1:h264-crf${PROXY_PROFILE.crf}-veryfast-h${PROXY_PROFILE.maxHeight}-g${PROXY_PROFILE.keyframeInterval}-passthrough-aac${PROXY_PROFILE.audioBitrate}`;
// Per-project proxy cache (several S/M assets at once).
export const PROXY_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
// One build at a time; at most this many wait.
const QUEUE_DEPTH = 4;
const BUILD_WALL_SECONDS = 15 * 60;
// A start-time difference at or above half a frame (30 fps) would show a
// neighbouring frame.
const MAX_START_SKEW = 1 / 60;

// Thumbnails: one small JPEG per second of a video, by index.
export const THUMBNAIL_HEIGHT = 90;
const THUMBNAIL_VERSION = `yamakan.thumbnail/v1:mjpeg-q5-h${THUMBNAIL_HEIGHT}`;
const THUMBNAIL_CACHE_BYTES = 64 * 1024 * 1024;
const THUMBNAIL_MAX_BYTES = 256 * 1024;
const THUMBNAIL_QUEUE_DEPTH = 16;

export type ProxyState =
  "absent" | "queued" | "building" | "ready" | "failed" | "unsupported";
export type ProxyStatus = {
  state: ProxyState;
  profile: string;
  // 0..1 while building.
  progress?: number;
  // Why a proxy is not available, in plain words.
  reason?: string;
  width?: number;
  height?: number;
  durationFrames?: number;
  // Source and proxy presentation start times (seconds) and frame count:
  // the proxy shows the source's frame at the same timeline time.
  mapping?: {
    sourceStartSeconds: number;
    proxyStartSeconds: number;
    frames: number;
  };
};

const RecordSchema = z
  .object({
    format: z.literal(PROXY_VERSION),
    key: z.string().regex(/^[a-f0-9]{64}$/),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationFrames: z.number().int().nonnegative(),
    sourceStartSeconds: z.number().finite(),
    proxyStartSeconds: z.number().finite(),
    frames: z.number().int().nonnegative(),
  })
  .strict();
type ProxyRecord = z.infer<typeof RecordSchema>;

const proxyKey = async (dir: string, asset: Asset) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        asset.hash,
        asset.durationFrames,
        PROXY_VERSION,
        await engineId(dir),
      ]),
    )
    .digest("hex");

const unsupported = (reason: string): ProxyStatus => ({
  state: "unsupported",
  profile: PROXY_VERSION,
  reason,
});

async function proxyDir(store: ProjectStore, projectId: string) {
  const dir = await store.file(projectId, "cache", "proxies");
  await mkdir(dir, { recursive: true });
  return dir;
}

// Interrupted builds: private folders and videos without a record. Removed
// once they are older than any live build could be (or at once when no
// build is running in this service).
async function quarantine(dir: string) {
  const live = new Set([...builds.values()].map((b) => b.work));
  for (const name of await readdir(dir).catch(() => [])) {
    const file = path.join(dir, name);
    if (/^[a-f0-9]{64}\.[0-9a-f-]{36}\.partial$/.test(name)) {
      if (!live.has(file))
        await rm(file, { recursive: true, force: true }).catch(() => {});
    } else if (/^[a-f0-9]{64}\.mp4$/.test(name)) {
      const record = path.join(dir, name.replace(/\.mp4$/, ".json"));
      const has = await stat(record).catch(() => null);
      if (!has) await unlink(file).catch(() => {});
    } else if (/^[a-f0-9]{64}\.json$/.test(name)) {
      const video = path.join(dir, name.replace(/\.json$/, ".mp4"));
      const has = await stat(video).catch(() => null);
      // A record whose video was evicted describes nothing.
      if (!has) await unlink(file).catch(() => {});
    }
  }
}

// The published record and video, if intact (size matches the record).
async function readPublished(dir: string, key: string) {
  const recordFile = path.join(dir, `${key}.json`);
  const videoFile = path.join(dir, `${key}.mp4`);
  const raw = await readFile(recordFile, "utf8").catch(() => null);
  if (raw === null) return null;
  let record: ProxyRecord | null = null;
  try {
    record = RecordSchema.parse(JSON.parse(raw));
  } catch {
    record = null;
  }
  const info = await stat(videoFile).catch(() => null);
  if (
    !record ||
    record.key !== key ||
    !info?.isFile() ||
    info.size !== record.bytes
  ) {
    // Damaged: an absent proxy, never a misleading one.
    await unlink(videoFile).catch(() => {});
    await unlink(recordFile).catch(() => {});
    return null;
  }
  return { record, videoFile };
}

const readyStatus = (record: ProxyRecord): ProxyStatus => ({
  state: "ready",
  profile: PROXY_VERSION,
  width: record.width,
  height: record.height,
  durationFrames: record.durationFrames,
  mapping: {
    sourceStartSeconds: record.sourceStartSeconds,
    proxyStartSeconds: record.proxyStartSeconds,
    frames: record.frames,
  },
});

type Build = {
  key: string;
  controller: AbortController;
  state: "queued" | "building";
  progress: number;
  work: string;
  promise: Promise<void>;
};
const builds = new Map<string, Build>();
let queue: Promise<unknown> = Promise.resolve();
let closed = false;
// Failures the same bytes always produce are remembered for a while, so a
// broken source does not take the build slot on every look.
const FAILURE_MS = 10 * 60_000;
const failures = new Map<string, { status: ProxyStatus; until: number }>();

const videoAsset = async (
  store: ProjectStore,
  projectId: string,
  assetId: string,
) => {
  const { file, asset } = await store.assetFile(projectId, assetId);
  return { file, asset };
};

function unsupportedReason(asset: Asset) {
  if (asset.kind !== "video") return "Only video clips have proxies.";
  if (asset.durationFrames < 1) return "The video has no frames.";
  return null;
}

/** The proxy state of an asset (never starts a build). */
export async function proxyStatus(
  store: ProjectStore,
  projectId: string,
  assetId: string,
): Promise<ProxyStatus> {
  const { asset } = await videoAsset(store, projectId, assetId);
  const why = unsupportedReason(asset);
  if (why) return unsupported(why);
  const dir = await proxyDir(store, projectId);
  const key = await proxyKey(dir, asset);
  const build = builds.get(key);
  if (build)
    return {
      state: build.state,
      profile: PROXY_VERSION,
      progress: build.progress,
    };
  const failed = failures.get(key);
  if (failed && failed.until > Date.now()) return failed.status;
  await quarantine(dir);
  const published = await readPublished(dir, key);
  if (published) return readyStatus(published.record);
  return { state: "absent", profile: PROXY_VERSION };
}

/** Starts building an asset's proxy unless it is ready or underway. */
export async function buildProxy(
  store: ProjectStore,
  projectId: string,
  assetId: string,
): Promise<ProxyStatus> {
  if (closed) throw new CommandError("UNAVAILABLE", "The service is closing.");
  const current = await proxyStatus(store, projectId, assetId);
  if (current.state !== "absent" && current.state !== "failed") return current;
  const { file, asset } = await videoAsset(store, projectId, assetId);
  const dir = await proxyDir(store, projectId);
  const key = await proxyKey(dir, asset);
  if (builds.has(key)) return proxyStatus(store, projectId, assetId);
  const waiting = [...builds.values()].filter((b) => b.state === "queued");
  if (waiting.length >= QUEUE_DEPTH)
    throw new CommandError(
      "BUSY",
      "Too many proxies are being prepared; retry shortly.",
    );
  failures.delete(key);
  const controller = new AbortController();
  const work = path.join(dir, `${key}.${randomUUID()}.partial`);
  const build: Build = {
    key,
    controller,
    state: "queued",
    progress: 0,
    work,
    promise: Promise.resolve(),
  };
  builds.set(key, build);
  const turn = queue.then(async () => {
    if (controller.signal.aborted) return;
    build.state = "building";
    try {
      await runBuild(dir, key, file, asset, build);
    } catch (e) {
      if (!controller.signal.aborted) {
        const status: ProxyStatus =
          e instanceof ProxyUnsupported
            ? unsupported(e.message)
            : {
                state: "failed",
                profile: PROXY_VERSION,
                reason:
                  e instanceof CommandError
                    ? e.message
                    : "The proxy could not be made from this video.",
              };
        failures.set(key, { status, until: Date.now() + FAILURE_MS });
      }
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => {});
      if (builds.get(key) === build) builds.delete(key);
    }
  });
  build.promise = turn;
  queue = turn.catch(() => {});
  return { state: "queued", profile: PROXY_VERSION, progress: 0 };
}

/** Stops an asset's proxy build (queued or running); a ready proxy stays. */
export async function cancelProxy(
  store: ProjectStore,
  projectId: string,
  assetId: string,
): Promise<ProxyStatus> {
  const { asset } = await videoAsset(store, projectId, assetId);
  if (!unsupportedReason(asset)) {
    const dir = await proxyDir(store, projectId);
    const build = builds.get(await proxyKey(dir, asset));
    if (build) {
      build.controller.abort();
      await build.promise.catch(() => {});
    }
  }
  return proxyStatus(store, projectId, assetId);
}

class ProxyUnsupported extends Error {}

// The presentation start time of a file's first video stream (seconds).
async function startSeconds(file: string, signal: AbortSignal) {
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
      "v:0",
      "-show_entries",
      "stream=start_time",
      // JSON: a display matrix adds side-data lines to plain formats.
      "-of",
      "json",
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
      if (out.length < 4096) out += b.toString("utf8");
    },
  });
  if (signal.aborted) throw new Error("Cancelled.");
  let value = Number.NaN;
  try {
    const raw = JSON.parse(out)?.streams?.[0]?.start_time;
    value = raw === undefined || raw === "N/A" ? 0 : Number(raw);
  } catch {
    value = Number.NaN;
  }
  if (result.code !== 0 || !Number.isFinite(value))
    throw new CommandError(
      "MEDIA_INVALID",
      "The video's timing could not be read.",
    );
  return value;
}

async function runBuild(
  dir: string,
  key: string,
  source: string,
  asset: Asset,
  build: Build,
) {
  const signal = build.controller.signal;
  const sourceInfo = await probe(source);
  // A variable-rate source would not map frame for frame (it gets a
  // constant-rate derivative at import; this one never did).
  if (!sourceInfo.hasVideo || sourceInfo.variableFrameRate)
    throw new ProxyUnsupported(
      "This video's frame rate varies, so a proxy would not show the right frames.",
    );
  const space = await statfs(dir);
  const free = Number(space.bavail) * Number(space.bsize);
  const cap = Math.min(
    PROXY_CACHE_BYTES,
    Math.floor(free - RESOURCE_POLICY.enforced.diskReserveBytes),
  );
  if (cap < 16 * 1024 * 1024)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Not enough free disk space for a proxy.",
    );
  await mkdir(build.work, { recursive: true });
  const seconds = asset.durationFrames / 30;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, BUILD_WALL_SECONDS * 1000);
  let progress = "";
  let result;
  try {
    result = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        MEDIA_FORMATS,
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-sn",
        "-dn",
        // Upright (FFmpeg applies display rotation), at most 540 lines,
        // even dimensions for 4:2:0.
        "-vf",
        `scale=-2:'min(${PROXY_PROFILE.maxHeight},trunc(ih/2)*2)'`,
        // The source's own timestamps: frame for frame, no rate change.
        "-fps_mode",
        "passthrough",
        "-t",
        String(seconds),
        "-c:v",
        "libx264",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-preset",
        "veryfast",
        "-crf",
        String(PROXY_PROFILE.crf),
        "-g",
        String(PROXY_PROFILE.keyframeInterval),
        "-keyint_min",
        String(PROXY_PROFILE.keyframeInterval),
        "-sc_threshold",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        PROXY_PROFILE.audioBitrate,
        "-movflags",
        "+faststart",
        "-fs",
        String(cap),
        "-progress",
        "pipe:1",
        "proxy.mp4",
      ],
      cwd: build.work,
      writable: [build.work],
      readable: [source],
      memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
      signal: controller.signal,
      stderrLimit: 4000,
      onStdout: (chunk) => {
        progress += chunk.toString("utf8");
        const lines = progress.split("\n");
        progress = lines.pop() || "";
        for (const line of lines) {
          const match = /^out_time_us=(\d+)/.exec(line);
          if (match)
            build.progress = Math.min(0.99, Number(match[1]) / 1e6 / seconds);
        }
      },
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
  if (signal.aborted) throw new Error("Cancelled.");
  if (controller.signal.aborted)
    throw new CommandError("LIMIT_EXCEEDED", "The proxy took too long.");
  if (result.code !== 0)
    throw new CommandError(
      "MEDIA_INVALID",
      "The proxy could not be made from this video.",
    );
  const made = path.join(build.work, "proxy.mp4");
  const info = await probe(made);
  const sourceStart = await startSeconds(source, signal);
  const proxyStart = await startSeconds(made, signal);
  // Verified before anyone sees it: same frames at the same times, the
  // same audio presence, the upright shape.
  if (
    !info.hasVideo ||
    info.variableFrameRate ||
    Math.abs(info.durationFrames - asset.durationFrames) > 2 ||
    (asset.hasAudio !== null && info.hasAudio !== asset.hasAudio) ||
    Math.abs(sourceStart - proxyStart) >= MAX_START_SKEW ||
    Math.abs(info.width / info.height - asset.width / asset.height) > 0.02
  )
    throw new CommandError(
      "MEDIA_INVALID",
      "The proxy did not match its video, so it is not used.",
    );
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(made) as AsyncIterable<Buffer>) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  const record: ProxyRecord = {
    format: PROXY_VERSION,
    key,
    sourceHash: asset.hash,
    bytes,
    sha256: hash.digest("hex"),
    width: info.width,
    height: info.height,
    durationFrames: info.durationFrames,
    sourceStartSeconds: sourceStart,
    proxyStartSeconds: proxyStart,
    frames: info.durationFrames,
  };
  if (signal.aborted) throw new Error("Cancelled.");
  // Published: the video, then its record (the record is the commit).
  const videoFile = path.join(dir, `${key}.mp4`);
  const recordTemp = path.join(build.work, "record.json");
  await writeFile(recordTemp, JSON.stringify(record));
  await rename(made, videoFile);
  await rename(recordTemp, path.join(dir, `${key}.json`));
  await evictPreviews(
    dir,
    videoFile,
    PROXY_CACHE_BYTES,
    60_000,
    /^[a-f0-9]{64}\.mp4$/,
  );
}

/** A ready proxy's video, for the media route; NOT_FOUND otherwise. */
export async function proxyFile(
  store: ProjectStore,
  projectId: string,
  assetId: string,
) {
  const { asset } = await videoAsset(store, projectId, assetId);
  if (unsupportedReason(asset))
    throw new CommandError("NOT_FOUND", "This asset has no proxy.");
  const dir = await proxyDir(store, projectId);
  const published = await readPublished(dir, await proxyKey(dir, asset));
  if (!published)
    throw new CommandError("NOT_FOUND", "This asset has no proxy yet.");
  // Recently used: eviction keeps it while it is being played.
  const now = new Date();
  await utimes(published.videoFile, now, now).catch(() => {});
  return published.videoFile;
}

type ThumbnailFlight = { promise: Promise<Buffer> };
const thumbnailFlights = new Map<string, ThumbnailFlight>();
let thumbnailQueue: Promise<unknown> = Promise.resolve();
let thumbnailsWaiting = 0;

/**
 * A small JPEG of the video at whole second `index`, cached. It is drawn
 * from the ready proxy when there is one (cheap), else from the original.
 */
export async function assetThumbnail(
  store: ProjectStore,
  projectId: string,
  assetId: string,
  index: number,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; cached: boolean }> {
  const { file, asset } = await videoAsset(store, projectId, assetId);
  if (asset.kind !== "video")
    throw new CommandError("VALIDATION", "Only video has thumbnails.");
  const seconds = Math.max(1, Math.ceil(asset.durationFrames / 30));
  if (!Number.isInteger(index) || index < 0 || index >= seconds)
    throw new CommandError(
      "VALIDATION",
      `index must be a whole second from 0 to ${seconds - 1}.`,
    );
  const dir = await store.file(projectId, "cache", "thumbnails");
  await mkdir(dir, { recursive: true });
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        asset.hash,
        index,
        THUMBNAIL_VERSION,
        await engineId(dir),
      ]),
    )
    .digest("hex");
  const cacheFile = path.join(dir, `${key}.jpg`);
  const hit = await readFile(cacheFile).catch(() => null);
  if (hit && hit.length > 0 && hit[0] === 0xff && hit[1] === 0xd8) {
    const now = new Date();
    await utimes(cacheFile, now, now).catch(() => {});
    return { bytes: hit, cached: true };
  }
  let flight = thumbnailFlights.get(key);
  if (!flight) {
    if (thumbnailsWaiting >= THUMBNAIL_QUEUE_DEPTH)
      throw new CommandError(
        "BUSY",
        "Too many thumbnails are being prepared; retry shortly.",
      );
    thumbnailsWaiting++;
    // The proxy when ready: a smaller decode, the same frame.
    const from = await proxyFile(store, projectId, assetId).catch(() => file);
    const turn = thumbnailQueue.then(async () => {
      thumbnailsWaiting--;
      const bytes = await drawThumbnail(
        from,
        Math.min(index, asset.durationFrames / 30),
      );
      const free = await statfs(dir).then(
        (space) => Number(space.bavail) * Number(space.bsize),
        () => 0,
      );
      if (free >= RESOURCE_POLICY.enforced.diskReserveBytes) {
        const temp = path.join(dir, `${key}.${randomUUID()}.tmp`);
        try {
          await writeFile(temp, bytes);
          await rename(temp, cacheFile);
          await evictPreviews(
            dir,
            cacheFile,
            THUMBNAIL_CACHE_BYTES,
            60_000,
            /^[a-f0-9]{64}\.jpg$/,
          );
        } catch {
          await unlink(temp).catch(() => {});
        }
      }
      return bytes;
    });
    thumbnailQueue = turn.catch(() => {});
    const entry: ThumbnailFlight = { promise: turn };
    flight = entry;
    thumbnailFlights.set(key, entry);
    turn
      .finally(() => {
        if (thumbnailFlights.get(key) === entry) thumbnailFlights.delete(key);
      })
      .catch(() => {});
  }
  if (signal?.aborted) throw new Error("Cancelled.");
  return { bytes: await flight.promise, cached: false };
}

async function drawThumbnail(file: string, at: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  const controller = new AbortController();
  const result = await workers().run({
    executable: mediaTools().ffmpeg,
    args: [
      "-hide_banner",
      "-nostdin",
      "-v",
      "error",
      "-threads",
      "1",
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      MEDIA_FORMATS,
      "-ss",
      String(at),
      "-i",
      `file:${path.basename(file)}`,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      `scale=-2:${THUMBNAIL_HEIGHT}`,
      "-c:v",
      "mjpeg",
      "-q:v",
      "5",
      "-f",
      "image2pipe",
      "pipe:1",
    ],
    cwd: path.dirname(file),
    readable: [file],
    memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
    signal: AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(RESOURCE_POLICY.enforced.probeWallSeconds * 1000),
    ]),
    onStdout: (chunk) => {
      size += chunk.length;
      if (size > THUMBNAIL_MAX_BYTES) controller.abort();
      else chunks.push(chunk);
    },
  });
  const bytes = Buffer.concat(chunks);
  if (
    result.code !== 0 ||
    controller.signal.aborted ||
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  )
    throw new CommandError(
      "MEDIA_INVALID",
      "The thumbnail could not be drawn from this video.",
    );
  return bytes;
}

/** Stops every proxy build (service shutdown). */
export async function closeProxies() {
  closed = true;
  for (const build of builds.values()) build.controller.abort();
  await Promise.all([...builds.values()].map((b) => b.promise.catch(() => {})));
}

/** Test seams: forget remembered failures; reopen after closeProxies. */
export function resetProxiesForTests() {
  failures.clear();
  closed = false;
}
