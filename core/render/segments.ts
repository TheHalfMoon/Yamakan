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

// At most this many windows: the join worker reads each by name, and a
// worker is granted at most 64 readable paths (native/procd).
export const MAX_SEGMENTS = 48;

/** How many clip chains a pass over [from, to) composites. */
export function chainsIn(plan: RenderPlan, from: number, to: number) {
  return plan.layers.filter(
    (l) => l.startTicks < to && l.startTicks + l.durationTicks > from,
  ).length;
}

/**
 * The export's windows: the whole timeline when one pass stays within the
 * chain budget, else halves (on frame boundaries) until each does.
 */
export function planSegments(
  plan: RenderPlan,
  maxChains: number = RESOURCE_POLICY.enforced.exportSegmentChains,
): Segment[] {
  const fps = plan.profile.fps;
  const frames = ticksToFrames(plan.durationTicks, fps, "nearest");
  const at = (frame: number) =>
    frame >= frames ? plan.durationTicks : framesToTicks(frame, fps, "nearest");
  const out: Segment[] = [];
  const split = (a: number, b: number) => {
    const from = at(a);
    const to = at(b);
    // Down to one frame if need be: one instant holds at most a layer per
    // track (and a dissolve's overlap), well within the budget.
    if (b - a <= 1 || chainsIn(plan, from, to) <= maxChains) {
      out.push({ startTicks: from, durationTicks: to - from });
      return;
    }
    const mid = a + Math.floor((b - a) / 2);
    split(a, mid);
    split(mid, b);
  };
  split(0, frames);
  if (out.length > MAX_SEGMENTS)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "This timeline has too many clips at once to export; spread them over fewer tracks.",
    );
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
    if (s < 1)
      throw new CommandError("LIMIT_EXCEEDED", "Render time limit exceeded.");
    return s;
  };
  const cancelled = () => {
    if (signal.aborted) throw new Error("Cancelled.");
  };
  const dir = await store.file(plan.projectId, ...staging);
  await mkdir(dir, { recursive: true });
  const total = plan.durationTicks;
  // Progress: sound first, then each window by its length.
  const soundShare = plan.audio.length ? 0.1 : 0;
  let activePlan = plan;
  let soundFile: string | null = null;
  // The parts are removed whatever happens: on success a ten-minute 1080p
  // export's windows would otherwise double its disk use until the job is
  // cleaned up, and callers other than jobs have no cleanup of their own.
  try {
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
      cancelled();
      const part = await renderPlan(
        store,
        activePlan,
        ass,
        [...staging, "seg", String(i)],
        signal,
        (p) =>
          onProgress(
            soundShare +
              ((done + p * segment.durationTicks) / total) *
                (0.99 - soundShare),
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
    cancelled();
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
    await run(
      [
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
      {
        executable: mediaTools().ffmpeg,
        cwd: dir,
        writable: [work],
        // Each part by name (the service wrote them owner-only, so a folder
        // grant would not reach them); MAX_SEGMENTS keeps this within the
        // worker's bounded readable list.
        readable: [list, ...files, ...(soundFile ? [soundFile] : [])],
      },
      signal,
      remaining(),
      onCreated,
      "join the export's segments",
    );
    await keepMainStream(written, output);
    const probed = await probe(output);
    const { profile } = activePlan;
    // Exact: the joined picture has exactly the timeline's frames (a seam
    // that dropped or doubled one is refused, at any rate).
    const counted = await run(
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        "mov",
        "-count_packets",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_read_packets",
        "-of",
        "csv=p=0",
        "render.mp4",
      ],
      {
        executable: mediaTools().ffprobe,
        cwd: dir,
        readable: [output],
      },
      signal,
      remaining(),
      undefined,
      "count the joined export's frames",
    );
    const expectedFrames = ticksToFrames(total, profile.fps, "nearest");
    if (
      !probed.hasVideo ||
      probed.width !== profile.width ||
      probed.height !== profile.height ||
      Number(counted.trim()) !== expectedFrames ||
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
  } finally {
    // A file a scanner still holds is left for the job's own cleanup; it
    // never replaces the export's own error.
    for (const part of ["seg", "sound", "worker", "segments.txt"])
      await rm(path.join(dir, part), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }).catch(() => {});
  }
}

// A bounded media worker for the join and the count; returns its stdout.
async function run(
  args: string[],
  opts: {
    executable: string;
    cwd: string;
    readable: string[];
    writable?: string[];
  },
  signal: AbortSignal,
  wallSeconds: number,
  onCreated: ((pid: number) => void | Promise<void>) | undefined,
  what: string,
) {
  if (signal.aborted) throw new Error("Cancelled.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), wallSeconds * 1000);
  let out = "";
  try {
    const result = await workers().run({
      executable: opts.executable,
      args,
      cwd: opts.cwd,
      readable: opts.readable,
      ...(opts.writable ? { writable: opts.writable } : {}),
      memoryBytes: RESOURCE_POLICY.enforced.workerMemoryBytes,
      signal: controller.signal,
      onCreated,
      stderrLimit: 8000,
      onStdout: (b) => {
        if (out.length < 4096) out += b.toString("utf8");
      },
    });
    if (signal.aborted) throw new Error("Cancelled.");
    if (controller.signal.aborted)
      throw new CommandError("LIMIT_EXCEEDED", "Render time limit exceeded.");
    if (result.code !== 0)
      throw new Error(`FFmpeg failed to ${what} (exit ${result.code}).`, {
        cause: result.stderr,
      });
    return out;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
