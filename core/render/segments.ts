// Segmented export (YU-026c, resource policy v3). One FFmpeg pass holds a
// live filter chain, with decoded frames, for every clip of the timeline,
// so a 200-clip 1080p timeline ran out of the render's memory. A timeline
// whose single pass would composite more than `exportSegmentChains` clip
// chains is rendered instead in time windows cut on frame boundaries:
// - each window renders the picture alone, opening only the clips it
//   shows; timestamps stay absolute in every window, so a window draws the
//   same frames the whole render would (the reference preview relies on
//   the same property);
// - the sound is rendered once over the whole timeline (its fades,
//   crossfades and two-pass loudness need the whole mix; AAC seams would
//   click), as M4A;
// - the windows are joined with the concat demuxer and the sound muxed in,
//   by stream copy: no second encode, so nothing changes in the pixels.
// All passes share the export's one wall-clock limit (policy v3).
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY, exportWallSeconds } from "../command/policy.ts";
import { probe } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { framesToTicks, ticksToFrames } from "../time.ts";
import type { ProjectStore } from "../store.ts";
import type { RenderPlan } from "./plan.ts";
import { keepMainStream, renderPlan } from "../render.ts";

export type Segment = { startTicks: number; durationTicks: number };

/** How many clip chains a pass over [from, to) composites. */
export function chainsIn(plan: RenderPlan, from: number, to: number) {
  return plan.layers.filter(
    (l) => l.startTicks < to && l.startTicks + l.durationTicks > from,
  ).length;
}

/**
 * The export's windows: the whole timeline when one pass stays within the
 * chain budget, else halves (on frame boundaries) until each does, or is a
 * single second long.
 */
export function planSegments(
  plan: RenderPlan,
  maxChains: number = RESOURCE_POLICY.enforced.exportSegmentChains,
): Segment[] {
  const fps = plan.profile.fps;
  const frames = ticksToFrames(plan.durationTicks, fps, "nearest");
  const second = Math.max(1, Math.round(fps.num / fps.den));
  const at = (frame: number) =>
    frame >= frames ? plan.durationTicks : framesToTicks(frame, fps, "nearest");
  const out: Segment[] = [];
  const split = (a: number, b: number) => {
    const from = at(a);
    const to = at(b);
    if (b - a <= second || chainsIn(plan, from, to) <= maxChains) {
      out.push({ startTicks: from, durationTicks: to - from });
      return;
    }
    const mid = a + Math.floor((b - a) / 2);
    split(a, mid);
    split(mid, b);
  };
  split(0, frames);
  return out;
}

/** Renders a plan in its segments and joins them (see the file header). */
export async function renderSegmented(
  store: ProjectStore,
  plan: RenderPlan,
  ass: string | null,
  staging: string[],
  segments: Segment[],
  signal: AbortSignal,
  onProgress: (value: number) => void,
  onCreated?: (pid: number) => void | Promise<void>,
) {
  const deadline = Date.now() + exportWallSeconds(plan.durationTicks) * 1000;
  const remaining = () => {
    const s = Math.floor((deadline - Date.now()) / 1000);
    if (s < 1) throw new Error("Render time limit exceeded.");
    return s;
  };
  const dir = await store.file(plan.projectId, ...staging);
  await mkdir(dir, { recursive: true });
  const total = plan.durationTicks;
  // Progress: sound first, then each window by its length.
  const soundShare = plan.audio.length ? 0.1 : 0;
  let activePlan = plan;
  let soundFile: string | null = null;
  if (plan.audio.length) {
    const sound = await renderPlan(
      store,
      plan,
      ass,
      [...staging, "sound"],
      signal,
      (p) => onProgress(p * soundShare),
      onCreated,
      {
        startTicks: 0,
        durationTicks: total,
        output: "mp4",
        streams: "audio",
        wallSeconds: remaining(),
      },
    );
    // A measured loudness pass names the plan the export drew.
    activePlan = sound.plan;
    soundFile = sound.output;
  }
  const files: string[] = [];
  let libassApi: number | null = null;
  let done = 0;
  for (const [i, segment] of segments.entries()) {
    const part = await renderPlan(
      store,
      activePlan,
      ass,
      [...staging, "seg", String(i)],
      signal,
      (p) =>
        onProgress(
          soundShare +
            ((done + p * segment.durationTicks) / total) * (0.99 - soundShare),
        ),
      onCreated,
      {
        ...segment,
        output: "mp4",
        streams: "video",
        wallSeconds: remaining(),
      },
    );
    files.push(part.output);
    libassApi = part.receipt.libassApi ?? libassApi;
    done += segment.durationTicks;
  }
  // The join: the concat demuxer reads the windows' pictures in order and
  // the sound is muxed beside them, both by stream copy.
  const work = path.join(dir, "worker");
  await mkdir(work, { recursive: true });
  const list = path.join(dir, "segments.txt");
  await writeFile(
    list,
    files
      .map((f) => `file '${path.relative(dir, f).split(path.sep).join("/")}'`)
      .join("\n") + "\n",
    { flag: "wx" },
  );
  const written = path.join(work, "render.partial.mp4");
  const output = path.join(dir, "render.mp4");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), remaining() * 1000);
  try {
    const result = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        "concat,mov",
        "-f",
        "concat",
        "-i",
        "segments.txt",
        ...(soundFile
          ? [
              "-protocol_whitelist",
              "file",
              "-format_whitelist",
              "mov",
              "-i",
              path.relative(dir, soundFile).split(path.sep).join("/"),
            ]
          : []),
        "-map",
        "0:v:0",
        ...(soundFile ? ["-map", "1:a:0"] : []),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "worker/render.partial.mp4",
      ],
      cwd: dir,
      writable: [work],
      readable: [list, ...files, ...(soundFile ? [soundFile] : [])],
      memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
      signal: controller.signal,
      onCreated,
      stderrLimit: 8000,
    });
    if (signal.aborted) throw new Error("Cancelled.");
    if (controller.signal.aborted)
      throw new Error("Render time limit exceeded.");
    if (result.code !== 0)
      throw new Error(
        `FFmpeg failed to join the export's segments (exit ${result.code}).`,
        { cause: result.stderr },
      );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
  await keepMainStream(written, output);
  // The parts are no longer needed: a ten-minute 1080p export's windows
  // would otherwise double its disk use until the job is cleaned up.
  await rm(path.join(dir, "seg"), { recursive: true, force: true });
  if (soundFile)
    await rm(path.join(dir, "sound"), { recursive: true, force: true });
  const probed = await probe(output);
  const { profile } = activePlan;
  // As the single pass checks it (the probe counts thirtieths of a second).
  const expectedFrames = Math.round((total / 705_600_000) * 30);
  if (
    !probed.hasVideo ||
    probed.width !== profile.width ||
    probed.height !== profile.height ||
    Math.abs(probed.durationFrames - expectedFrames) > 2 ||
    (plan.audio.length > 0 && !probed.hasAudio)
  )
    throw new CommandError(
      "INTERNAL",
      "The joined export failed verification.",
    );
  onProgress(1);
  return {
    output,
    plan: activePlan,
    receipt: {
      planHash: activePlan.planHash,
      width: probed.width,
      height: probed.height,
      durationFrames: probed.durationFrames,
      hasAudio: probed.hasAudio,
      libassApi,
    },
    segments: segments.length,
  };
}
