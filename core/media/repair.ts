// Deterministic media analysis (YU-071). The first qualified operation is
// scene-cut detection with the bundled FFmpeg's `scdet` filter (luma mean
// absolute frame difference; no model, no randomness): it reads the stored
// original in a bounded, owned worker and returns the frames where a new
// scene starts. It writes no media and changes nothing, so the source, its
// timing and its sound are untouched by construction. Other filters the
// build carries (deshake, hqdn3d, nlmeans, atadenoise, blackdetect,
// freezedetect) are not qualified here; vid.stab is not in the build.
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { MEDIA_FORMATS } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { FLICKS_PER_SECOND, ticksToFrames, type Rational } from "../time.ts";
import type { ProjectStore } from "../store.ts";

export const SCENE_CUTS_VERSION = "yamakan.scene-cuts/v1:scdet";
export const SCENE_CUT_LIMITS = Object.freeze({
  // scdet's threshold, a percentage of the largest frame difference.
  minThreshold: 1,
  maxThreshold: 100,
  defaultThreshold: 10,
  marks: 1000,
  outputBytes: 1024 * 1024,
  // One analysis runs at a time; at most this many wait.
  queueDepth: 2,
  // A ten-minute source decodes well within this.
  wallSeconds: 300,
});

export type SceneCut = {
  // The frame a scene starts on, counted at the project's rate (as the
  // asset's frames are in the editor), its time in ticks from the source's
  // first frame (to the nearest tick), and scdet's score (0–100).
  frame: number;
  sourceTicks: number;
  score: number;
};

// The graph puts timestamps in ticks from the first frame (settb to flicks,
// then PTS-STARTPTS), so each printed pts is the cut's time in ticks.
const TIME = /^frame:\d+\s+pts:(\S+)\s+pts_time:\S+\s*$/;
const SCORE = /^lavfi\.scd\.score=(\d+(?:\.\d+)?)\s*$/;

/** Parses scdet's metadata print: one time and one score per cut. */
export function parseSceneCuts(text: string, fps: Rational) {
  const cuts: SceneCut[] = [];
  let pending: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const time = TIME.exec(line);
    if (time) {
      // Every time line starts a new cut; one that does not read as a
      // tick count is a stream this build cannot report on.
      const ticks = /^\d+$/.test(time[1]!) ? Number(time[1]) : NaN;
      if (!Number.isSafeInteger(ticks))
        throw new CommandError(
          "MEDIA_INVALID",
          "Scene analysis read a frame time it cannot use.",
        );
      pending = ticks;
      continue;
    }
    const score = SCORE.exec(line);
    if (!score || pending === null) continue;
    if (cuts.length >= SCENE_CUT_LIMITS.marks)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `More than ${SCENE_CUT_LIMITS.marks} scene cuts; raise the threshold.`,
      );
    cuts.push({
      frame: ticksToFrames(pending, fps, "nearest"),
      sourceTicks: pending,
      score: Number(score[1]),
    });
    pending = null;
  }
  return cuts;
}

// One analysis at a time (each decodes a whole source); a few may wait.
let queue: Promise<unknown> = Promise.resolve();
let waiting = 0;

/**
 * The scene cuts of one of the project's video assets, at a threshold of
 * 1–100 (default 10). Bounded in time, memory, output and concurrency;
 * cancellable.
 */
export async function detectSceneCuts(
  store: ProjectStore,
  projectId: string,
  assetId: string,
  threshold: number = SCENE_CUT_LIMITS.defaultThreshold,
  signal?: AbortSignal,
) {
  if (
    !Number.isInteger(threshold) ||
    threshold < SCENE_CUT_LIMITS.minThreshold ||
    threshold > SCENE_CUT_LIMITS.maxThreshold
  )
    throw new CommandError(
      "VALIDATION",
      "The threshold is a whole number from 1 to 100.",
    );
  if (signal?.aborted) throw new CommandError("UNAVAILABLE", "Cancelled.");
  const { file, asset, frameRate } = await store.assetFile(projectId, assetId);
  if (asset.kind !== "video")
    throw new CommandError(
      "VALIDATION",
      "Scene cuts are found in footage only.",
    );
  if (waiting >= SCENE_CUT_LIMITS.queueDepth)
    throw new CommandError(
      "BUSY",
      "Other scene analyses are waiting; retry shortly.",
    );
  waiting++;
  const turn = queue.then(async () => {
    waiting--;
    return analyse(file, threshold, frameRate, signal);
  });
  queue = turn.catch(() => {});
  const cuts = await turn;
  return {
    version: SCENE_CUTS_VERSION,
    assetId: asset.id,
    assetHash: asset.hash,
    threshold,
    frameRate,
    cuts,
  };
}

async function analyse(
  file: string,
  threshold: number,
  frameRate: Rational,
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw new CommandError("UNAVAILABLE", "Cancelled.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SCENE_CUT_LIMITS.wallSeconds * 1000);
  const chunks: Buffer[] = [];
  let size = 0;
  let overflow = false;
  const memoryBytes = RESOURCE_POLICY.enforced.workerMemoryBytes;
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
        "-an",
        "-sn",
        "-dn",
        "-vf",
        `settb=1/${FLICKS_PER_SECOND},setpts=PTS-STARTPTS,scdet=threshold=${threshold}:sc_pass=1,metadata=print:file=-`,
        "-f",
        "null",
        "-",
      ],
      cwd: path.dirname(file),
      // The analysis may read only the file it analyses, and writes nothing.
      readable: [file],
      memoryBytes,
      signal: controller.signal,
      onStdout: (b) => {
        size += b.length;
        if (size > SCENE_CUT_LIMITS.outputBytes) {
          overflow = true;
          controller.abort();
        } else chunks.push(b);
      },
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  if (overflow)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Too many scene cuts to report; raise the threshold.",
    );
  if (signal?.aborted) throw new CommandError("UNAVAILABLE", "Cancelled.");
  if (timedOut || result.wallExceeded)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Scene analysis time limit exceeded.",
    );
  if (result.code !== 0) {
    // A worker that used (nearly) all its memory was stopped by the limit.
    if ((result.peakMemoryBytes ?? 0) >= memoryBytes * 0.95)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Scene analysis ran out of its memory limit.",
      );
    throw new CommandError(
      "MEDIA_INVALID",
      "Scene analysis failed; the footage is unreadable or unsupported.",
    );
  }
  return parseSceneCuts(Buffer.concat(chunks).toString("utf8"), frameRate);
}
