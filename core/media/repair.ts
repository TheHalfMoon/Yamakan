// Deterministic media analysis (YU-071). The first qualified operation is
// scene-cut detection with the bundled FFmpeg's `scdet` filter (luma mean
// absolute frame difference; no model, no randomness): it reads the stored
// original in a bounded, owned worker and returns the source frames where a
// new scene starts. It writes no media and changes nothing, so the source,
// its timing and its sound are untouched by construction. Other filters
// the build carries (deshake, hqdn3d, nlmeans, atadenoise, blackdetect,
// freezedetect) are not qualified here; vid.stab is not in the build.
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { MEDIA_FORMATS, decimalSecondsToTicks } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { FLICKS_PER_SECOND } from "../time.ts";
import type { ProjectStore } from "../store.ts";

export const SCENE_CUTS_VERSION = "yamakan.scene-cuts/v1:scdet";
export const SCENE_CUT_LIMITS = Object.freeze({
  // scdet's threshold, a percentage of the largest frame difference.
  minThreshold: 1,
  maxThreshold: 100,
  defaultThreshold: 10,
  marks: 1000,
  outputBytes: 1024 * 1024,
});

export type SceneCut = {
  // The frame a scene starts on, counted at the project's rate (as the
  // asset's frames are in the editor), its exact time in ticks from the
  // source's start, and scdet's score (0–100).
  frame: number;
  sourceTicks: number;
  score: number;
};

const LINE = /^frame:\d+\s+pts:-?\d+\s+pts_time:(\d+(?:\.\d+)?)\s*$/;
const SCORE = /^lavfi\.scd\.score=(\d+(?:\.\d+)?)\s*$/;

/** Parses scdet's metadata print: one time and one score per cut. */
export function parseSceneCuts(
  text: string,
  fps: { num: number; den: number },
) {
  const cuts: SceneCut[] = [];
  let pending: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const time = LINE.exec(line);
    if (time) {
      pending = decimalSecondsToTicks(time[1]);
      continue;
    }
    const score = SCORE.exec(line);
    if (score && pending !== null) {
      const frame = Math.round(
        (pending * fps.num) / (fps.den * FLICKS_PER_SECOND),
      );
      cuts.push({ frame, sourceTicks: pending, score: Number(score[1]) });
      pending = null;
      if (cuts.length > SCENE_CUT_LIMITS.marks)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          `More than ${SCENE_CUT_LIMITS.marks} scene cuts; raise the threshold.`,
        );
    }
  }
  return cuts;
}

/**
 * The scene cuts of one of the project's video assets, at a threshold of
 * 1–100 (default 10). Bounded in time, memory and output; cancellable.
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
  const { file, asset, frameRate } = await store.assetFile(projectId, assetId);
  if (asset.kind !== "video")
    throw new CommandError(
      "VALIDATION",
      "Scene cuts are found in footage only.",
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RESOURCE_POLICY.enforced.conversionWallSeconds * 1000);
  const chunks: Buffer[] = [];
  let size = 0;
  let overflow = false;
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
        `scdet=threshold=${threshold}:sc_pass=1,metadata=print:file=-`,
        "-f",
        "null",
        "-",
      ],
      cwd: path.dirname(file),
      // The analysis may read only the file it analyses, and writes nothing.
      readable: [file],
      memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
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
  if (timedOut)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Scene analysis time limit exceeded.",
    );
  if (controller.signal.aborted || result.code !== 0)
    throw new CommandError(
      "MEDIA_INVALID",
      "Scene analysis failed; the footage is unreadable or unsupported.",
    );
  return {
    version: SCENE_CUTS_VERSION,
    assetId: asset.id,
    assetHash: asset.hash,
    threshold,
    frameRate,
    cuts: parseSceneCuts(Buffer.concat(chunks).toString("utf8"), frameRate),
  };
}
