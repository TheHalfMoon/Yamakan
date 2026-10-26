// Edit proxies and indexed thumbnails (YU-017). A proxy is a small,
// frequently keyed H.264 copy of a video asset for smooth interactive
// preview on an ordinary Windows host. It is a rebuildable cache entry keyed
// by the asset's content hash, the proxy profile and the FFmpeg build, kept
// per project beside the other caches: it never replaces the original, and
// export and reference preview always read the original (or its qualified
// constant-rate derivative). A proxy keeps the source's timestamps: before
// it is published, every video frame's presentation time is compared with
// the source's, and the audio start too, so a proxy that would show a
// different frame (or sound) at the same time is refused, not shown.
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
  lstat,
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
  // A keyframe every 15 frames (half a second at 30 fps), so scrubbing
  // seeks cheaply.
  keyframeInterval: 15,
  crf: 28,
  audioBitrate: "128k",
});
const PROXY_VERSION = `yamakan.proxy/v2:h264-crf${PROXY_PROFILE.crf}-veryfast-h${PROXY_PROFILE.maxHeight}-g${PROXY_PROFILE.keyframeInterval}-passthrough-aac${PROXY_PROFILE.audioBitrate}-nometa`;
// Per-project proxy cache (several S/M assets at once).
export const PROXY_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
// One proxy is at most twice its source (a smaller copy; the bound only
// stops a runaway encode), within these limits.
const PROXY_MIN_CAP = 64 * 1024 * 1024;
const PROXY_MAX_CAP = 1024 * 1024 * 1024;
// One build at a time; at most this many wait.
const QUEUE_DEPTH = 4;
const BUILD_WALL_SECONDS = 15 * 60;
// Times further apart than this would show (or sound) a neighbouring frame.
const MAX_SKEW = 1 / 120;

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
  // Source and proxy presentation start times (seconds), and the number of
  // video frames whose presentation times were matched one for one.
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
    frames: z.number().int().positive(),
    // The matched presentation times (ms), hashed.
    timesSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
// A build belongs to one project's cache folder: the same bytes in two
// projects are two builds.
const slotOf = (dir: string, key: string) => `${dir}|${key}`;

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

// Interrupted builds: private folders and videos without a record (and
// records without a video). Entries of a build running in this service are
// never touched, including the moment between its two publishing renames.
async function quarantine(dir: string) {
  const live = [...builds.values()].filter((b) => b.dir === dir);
  const works = new Set(live.map((b) => b.work));
  const keys = new Set(live.map((b) => b.key));
  for (const name of await readdir(dir).catch(() => [])) {
    const file = path.join(dir, name);
    const key = name.slice(0, 64);
    if (/^[a-f0-9]{64}\.[0-9a-f-]{36}\.partial$/.test(name)) {
      if (!works.has(file))
        await rm(file, { recursive: true, force: true }).catch(() => {});
    } else if (keys.has(key)) {
      continue;
    } else if (/^[a-f0-9]{64}\.mp4$/.test(name)) {
      const has = await stat(path.join(dir, `${key}.json`)).catch(() => null);
      if (!has) await unlink(file).catch(() => {});
    } else if (/^[a-f0-9]{64}\.json$/.test(name)) {
      const has = await stat(path.join(dir, `${key}.mp4`)).catch(() => null);
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
  const info = await lstat(videoFile).catch(() => null);
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
  dir: string;
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
// Failures are remembered so a broken source does not take the build slot
// on every look: ones the same bytes always produce for a while, others
// (time, disk) briefly. A build request returns a remembered failure.
const SETTLED_FAILURE_MS = 10 * 60_000;
const PASSING_FAILURE_MS = 60_000;
const FAILURES = 256;
const failures = new Map<string, { status: ProxyStatus; until: number }>();
const remembered = (slot: string) => {
  const failed = failures.get(slot);
  if (failed && failed.until > Date.now()) return failed.status;
  failures.delete(slot);
  return null;
};
const remember = (slot: string, status: ProxyStatus, ms: number) => {
  failures.delete(slot);
  failures.set(slot, { status, until: Date.now() + ms });
  while (failures.size > FAILURES)
    failures.delete(failures.keys().next().value!);
};

function unsupportedReason(asset: Asset) {
  if (asset.kind !== "video") return "Only video clips have proxies.";
  if (asset.durationFrames < 1) return "The video has no frames.";
  return null;
}

async function locate(store: ProjectStore, projectId: string, assetId: string) {
  const { file, asset } = await store.assetFile(projectId, assetId);
  const why = unsupportedReason(asset);
  if (why) return { file, asset, why } as const;
  const dir = await proxyDir(store, projectId);
  const key = await proxyKey(dir, asset);
  return { file, asset, why, dir, key, slot: slotOf(dir, key) } as const;
}

/** The proxy state of an asset (never starts a build). */
export async function proxyStatus(
  store: ProjectStore,
  projectId: string,
  assetId: string,
): Promise<ProxyStatus> {
  const at = await locate(store, projectId, assetId);
  if (at.why) return unsupported(at.why);
  const build = builds.get(at.slot);
  if (build)
    return {
      state: build.state,
      profile: PROXY_VERSION,
      progress: build.progress,
    };
  const failed = remembered(at.slot);
  if (failed) return failed;
  await quarantine(at.dir);
  const published = await readPublished(at.dir, at.key);
  if (published) return readyStatus(published.record);
  return { state: "absent", profile: PROXY_VERSION };
}

// Reasons shown for a failed build: this module's own plain messages only
// (a worker's launch error can carry paths).
const OWN_REASONS = new Set(["MEDIA_INVALID", "LIMIT_EXCEEDED"]);

/** Starts building an asset's proxy unless it is ready, underway or failed. */
export async function buildProxy(
  store: ProjectStore,
  projectId: string,
  assetId: string,
): Promise<ProxyStatus> {
  if (closed) throw new CommandError("UNAVAILABLE", "The service is closing.");
  const current = await proxyStatus(store, projectId, assetId);
  if (current.state !== "absent") return current;
  const at = await locate(store, projectId, assetId);
  if (at.why) return unsupported(at.why);
  const { dir, key, slot, file, asset } = at;
  if (builds.has(slot)) return proxyStatus(store, projectId, assetId);
  const waiting = [...builds.values()].filter((b) => b.state === "queued");
  if (waiting.length >= QUEUE_DEPTH)
    throw new CommandError(
      "BUSY",
      "Too many proxies are being prepared; retry shortly.",
    );
  const controller = new AbortController();
  const work = path.join(dir, `${key}.${randomUUID()}.partial`);
  const build: Build = {
    dir,
    key,
    controller,
    state: "queued",
    progress: 0,
    work,
    promise: Promise.resolve(),
  };
  builds.set(slot, build);
  const turn = queue.then(async () => {
    if (controller.signal.aborted) return;
    build.state = "building";
    try {
      await runBuild(dir, key, file, asset, build);
    } catch (e) {
      if (!controller.signal.aborted) {
        if (e instanceof ProxyUnsupported)
          remember(slot, unsupported(e.message), SETTLED_FAILURE_MS);
        else {
          const own = e instanceof CommandError && OWN_REASONS.has(e.code);
          remember(
            slot,
            {
              state: "failed",
              profile: PROXY_VERSION,
              reason: own
                ? e.message
                : "The proxy could not be made from this video.",
            },
            own && e.code === "MEDIA_INVALID"
              ? SETTLED_FAILURE_MS
              : PASSING_FAILURE_MS,
          );
        }
      }
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => {});
      if (builds.get(slot) === build) builds.delete(slot);
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
  const at = await locate(store, projectId, assetId);
  if (!at.why) {
    const build = builds.get(at.slot);
    if (build) {
      build.controller.abort();
      // A queued build leaves at once (its turn finds it cancelled); a
      // running one is waited for, so its worker has stopped.
      if (build.state === "queued") builds.delete(at.slot);
      else await build.promise.catch(() => {});
    }
  }
  return proxyStatus(store, projectId, assetId);
}

class ProxyUnsupported extends Error {}

// An owned, bounded ffprobe of one stream, as JSON.
async function probeStream(
  file: string,
  stream: "v:0" | "a:0",
  entries: string,
  signal: AbortSignal,
  limit: number,
) {
  let out = "";
  let over = false;
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
      stream,
      "-show_entries",
      entries,
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
      if (out.length + b.length > limit) over = true;
      else out += b.toString("utf8");
    },
  });
  if (signal.aborted) throw new Error("Cancelled.");
  try {
    if (result.code !== 0 || over) throw new Error("probe");
    return JSON.parse(out);
  } catch {
    throw new CommandError(
      "MEDIA_INVALID",
      "The video's timing could not be read.",
    );
  }
}

// The presentation start time of a file's first video or audio stream.
async function startSeconds(
  file: string,
  stream: "v:0" | "a:0",
  signal: AbortSignal,
) {
  const raw = (
    await probeStream(file, stream, "stream=start_time", signal, 4096)
  )?.streams?.[0]?.start_time;
  const value = raw === undefined || raw === "N/A" ? 0 : Number(raw);
  if (!Number.isFinite(value))
    throw new CommandError(
      "MEDIA_INVALID",
      "The video's timing could not be read.",
    );
  return value;
}

// Every video frame's presentation time (seconds), in order.
async function frameTimes(file: string, signal: AbortSignal) {
  // About 30 bytes per packet as JSON: 10 minutes at 120 fps fits.
  const packets: { pts_time?: string }[] =
    (await probeStream(file, "v:0", "packet=pts_time", signal, 4 * 1024 * 1024))
      ?.packets ?? [];
  return packets
    .map((p) => Number(p.pts_time))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
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
  const sourceStart = await startSeconds(source, "v:0", signal);
  // The editor plays a video from its first frame at time zero; a source
  // that starts later would be shown shifted by its proxy.
  if (Math.abs(sourceStart) >= MAX_SKEW)
    throw new ProxyUnsupported(
      "This video starts after time zero, so a proxy would not line up with it.",
    );
  // The encode and the cache share the space above the reserve (halved,
  // as for conversions), and one proxy is bounded by its source's size.
  const space = await statfs(dir);
  const free = Number(space.bavail) * Number(space.bsize);
  const sourceBytes = (await stat(source)).size;
  const cap = Math.min(
    Math.max(PROXY_MIN_CAP, 2 * sourceBytes),
    PROXY_MAX_CAP,
    Math.floor((free - RESOURCE_POLICY.enforced.diskReserveBytes) / 2),
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
        // A preview copy carries no tags, locations or chapters.
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
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
  if (!(await lstat(made)).isFile())
    throw new CommandError("MEDIA_INVALID", "The proxy is not a file.");
  const info = await probe(made);
  // Verified before anyone sees it: every frame at the source's time, the
  // audio starting with the source's, the same audio presence and shape.
  const mismatch = () =>
    new CommandError(
      "MEDIA_INVALID",
      "The proxy did not match its video, so it is not used.",
    );
  if (
    !info.hasVideo ||
    info.variableFrameRate ||
    (asset.hasAudio !== null && info.hasAudio !== asset.hasAudio) ||
    Math.abs(info.width / info.height - asset.width / asset.height) > 0.02
  )
    throw mismatch();
  const proxyStart = await startSeconds(made, "v:0", signal);
  if (Math.abs(proxyStart - sourceStart) >= MAX_SKEW) throw mismatch();
  if (info.hasAudio) {
    const a = await startSeconds(source, "a:0", signal);
    const b = await startSeconds(made, "a:0", signal);
    if (Math.abs(a - b) >= MAX_SKEW) throw mismatch();
  }
  // Frame for frame: the source's frames within the asset's length (the
  // last may be cut by a frame boundary) against the proxy's.
  const expected = (await frameTimes(source, signal)).filter(
    (t) => t < seconds - 1e-6,
  );
  const shown = await frameTimes(made, signal);
  if (
    expected.length === 0 ||
    shown.length < expected.length ||
    shown.length > expected.length + 1 ||
    expected.some((t, i) => Math.abs(shown[i] - t) >= MAX_SKEW)
  )
    throw mismatch();
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
    frames: expected.length,
    timesSha256: createHash("sha256")
      .update(expected.map((t) => Math.round(t * 1000)).join(","))
      .digest("hex"),
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

/**
 * A ready proxy's video, for the media route; NOT_FOUND otherwise. Each
 * call (every range request of a playing video) marks it recently used,
 * so eviction keeps it while it plays.
 */
export async function proxyFile(
  store: ProjectStore,
  projectId: string,
  assetId: string,
) {
  const at = await locate(store, projectId, assetId);
  if (at.why) throw new CommandError("NOT_FOUND", "This asset has no proxy.");
  const published = await readPublished(at.dir, at.key);
  if (!published)
    throw new CommandError("NOT_FOUND", "This asset has no proxy yet.");
  const now = new Date();
  await utimes(published.videoFile, now, now).catch(() => {});
  return published.videoFile;
}

type ThumbnailFlight = { promise: Promise<Buffer> };
const thumbnailFlights = new Map<string, ThumbnailFlight>();
let thumbnailQueue: Promise<unknown> = Promise.resolve();
let thumbnailsWaiting = 0;
// Videos whose thumbnail could not be drawn are refused for a minute.
const thumbnailFailures = new Map<string, number>();

// Partial thumbnails a crashed service left behind.
async function removeStaleTemps(dir: string) {
  for (const name of await readdir(dir).catch(() => [])) {
    if (!/^[a-f0-9]{64}\.[0-9a-f-]{36}\.tmp$/.test(name)) continue;
    const file = path.join(dir, name);
    const info = await stat(file).catch(() => null);
    if (info?.isFile() && Date.now() - info.mtimeMs > 60_000)
      await unlink(file).catch(() => {});
  }
}

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
  const { file, asset } = await store.assetFile(projectId, assetId);
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
  // The proxy when ready: a smaller decode of the same frame. Which one
  // drew it is part of the key, so a cached image never changes.
  const proxy = await proxyFile(store, projectId, assetId).catch(() => null);
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        asset.hash,
        index,
        proxy ? "proxy" : "original",
        THUMBNAIL_VERSION,
        await engineId(dir),
      ]),
    )
    .digest("hex");
  const cacheFile = path.join(dir, `${key}.jpg`);
  const known = await lstat(cacheFile).catch(() => null);
  if (known?.isFile() && known.size > 0 && known.size <= THUMBNAIL_MAX_BYTES) {
    const hit = await readFile(cacheFile).catch(() => null);
    if (hit && hit[0] === 0xff && hit[1] === 0xd8) {
      const now = new Date();
      await utimes(cacheFile, now, now).catch(() => {});
      return { bytes: hit, cached: true };
    }
  }
  const failedUntil = thumbnailFailures.get(key);
  if (failedUntil && failedUntil > Date.now())
    throw new CommandError(
      "MEDIA_INVALID",
      "The thumbnail could not be drawn from this video.",
    );
  thumbnailFailures.delete(key);
  let flight = thumbnailFlights.get(key);
  if (!flight) {
    if (thumbnailsWaiting >= THUMBNAIL_QUEUE_DEPTH)
      throw new CommandError(
        "BUSY",
        "Too many thumbnails are being prepared; retry shortly.",
      );
    thumbnailsWaiting++;
    const turn = thumbnailQueue.then(async () => {
      thumbnailsWaiting--;
      let bytes: Buffer;
      try {
        bytes = await drawThumbnail(proxy ?? file, index);
      } catch (e) {
        thumbnailFailures.set(key, Date.now() + 60_000);
        while (thumbnailFailures.size > 256)
          thumbnailFailures.delete(thumbnailFailures.keys().next().value!);
        throw e;
      }
      const free = await statfs(dir).then(
        (space) => Number(space.bavail) * Number(space.bsize),
        () => 0,
      );
      if (free >= RESOURCE_POLICY.enforced.diskReserveBytes) {
        const temp = path.join(dir, `${key}.${randomUUID()}.tmp`);
        await removeStaleTemps(dir);
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
  thumbnailFailures.clear();
  closed = false;
}
