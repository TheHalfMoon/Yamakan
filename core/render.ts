import { writeFile, mkdir, unlink, lstat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { ProjectStore } from "./store.ts";
import { MEDIA_FORMATS, probe } from "./media.ts";
import { RESOURCE_POLICY } from "./command/policy.ts";
import { CommandError } from "./command/errors.ts";
import { FLICKS_PER_SECOND, framesToTicks } from "./time.ts";
import { mediaTools, workers } from "./process/workers.ts";
import { compilePlan } from "./render/plan.ts";
import { burnedInCaptions } from "./captions.ts";
import type { RenderPlan } from "./render/plan.ts";
import { titleFonts } from "./render/fonts.ts";
import type { PinnedFont } from "./render/fonts.ts";
import { fontconfigEnv, stageTitleFonts } from "./render/fontconfig.ts";
import { compileTitles } from "./render/ass.ts";
import { titleCapability } from "./render/capability.ts";
import {
  getClipTimeAtSourceTime,
  getSourceTimeAtClipTime,
} from "./retime/resolve.ts";
import { atempoChain } from "./retime/atempo.ts";
import { rateAsFloat } from "./retime/rate.ts";
import {
  applyPassFilter,
  measurePassFilter,
  parseLoudnormJson,
} from "./audio/loudnorm.ts";
import { withMeasuredLoudnorm } from "./render/plan.ts";
import { ANIMATION_ENABLED } from "./animation/flags.ts";
import { transformFilters } from "./effects/registry.ts";
import {
  LutDocumentSchema,
  PROBED_FIELD_LENGTH,
  PROBED_KEYS,
  cubeText,
  type ProbedColor,
} from "./effects/color.ts";
import {
  ANIMATION_COMPILER_V1,
  opacityFilterChain,
  renderableAnimationChannels,
  volumeFilterChain,
} from "./render/animation-filters.ts";
export type RenderJob = {
  id: string;
  projectId: string;
  revision: number;
  state: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  error: string | null;
  artifact: string | null;
  // The render plan a completed export drew (contract: async results carry
  // their planHash); null for other jobs and before completion.
  planHash: string | null;
};

// Seconds as an exact-enough decimal string from integer flicks (truncated
// to the nanosecond): the only way time enters the filtergraph.
export function seconds(ticks: number): string {
  if (!Number.isSafeInteger(ticks) || ticks < 0)
    throw new CommandError("VALIDATION", "Render time is out of range.");
  const ns = (BigInt(ticks) * 1_000_000_000n) / BigInt(FLICKS_PER_SECOND);
  const whole = ns / 1_000_000_000n;
  const frac = (ns % 1_000_000_000n).toString().padStart(9, "0");
  return `${whole}.${frac}`;
}

// Fit check sampling: titles are measured on a quarter-size frame.
export const FIT_SCALE = 4;
const INK = 24;

// Whether a measured (quarter-size, grayscale) title frame has ink in the
// bands outside the title area: the left and right style margins (a twentieth
// of the width) or the top twentieth. Wrapped titles stay inside the margins
// and grow upwards from the bottom, so ink there means the title overflows:
// an unbreakable run wider than the frame, or more lines than fit.
export function overflows(gray: Buffer, width: number, height: number) {
  const side = Math.max(1, Math.round(width / 20));
  const top = Math.max(1, Math.round(height / 20));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const band = y < top || x < side || x >= width - side;
      if (band && gray[y * width + x] > INK) return true;
    }
  return false;
}

// libass breaks lines only at spaces, so an unbreakable run wider than the
// frame, or more lines than the frame holds, would be cut off. Each title
// is drawn alone for one second by the same libass and fonts and sampled at
// the start of its second; ink in the margin bands refuses the render
// instead of silently clipping.
async function assertTitlesFit(
  dir: string,
  plan: RenderPlan,
  fonts: PinnedFont[],
  signal: AbortSignal,
) {
  const { width, height } = plan.profile;
  const cues = plan.titles!.cues.map((cue, i) => ({
    ...cue,
    startTicks: i * FLICKS_PER_SECOND,
    endTicks: (i + 1) * FLICKS_PER_SECOND,
  }));
  await writeFile(
    path.join(dir, "measure.ass"),
    compileTitles(cues, width, height, fonts).ass,
    { flag: "wx" },
  );
  const w = Math.ceil(width / FIT_SCALE);
  const h = Math.ceil(height / FIT_SCALE);
  const chunks: Buffer[] = [];
  const confPath = path.join(dir, "fonts.conf");
  const result = await workers().run({
    executable: mediaTools().ffmpeg,
    args: [
      "-hide_banner",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${width}x${height}:r=1:d=${cues.length}`,
      "-vf",
      `ass=measure.ass:fontsdir=fonts,scale=${w}:${h}:flags=area,format=gray`,
      "-frames:v",
      String(cues.length),
      "-f",
      "rawvideo",
      "-",
    ],
    cwd: dir,
    readable: [
      path.join(dir, "measure.ass"),
      path.join(dir, "fonts"),
      confPath,
    ],
    workerEnv: fontconfigEnv(confPath),
    memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
    signal,
    stderrLimit: 8000,
    onStdout: (chunk) => chunks.push(chunk),
  });
  if (signal.aborted) throw new Error("Cancelled.");
  const frames = Buffer.concat(chunks);
  if (result.code !== 0 || frames.length !== w * h * cues.length)
    throw new Error("Title layout could not be checked.", {
      cause: result.stderr,
    });
  for (let i = 0; i < cues.length; i++)
    if (overflows(frames.subarray(i * w * h, (i + 1) * w * h), w, h))
      throw new CommandError(
        "VALIDATION",
        `Title ${i + 1} does not fit the frame; shorten long words, add spaces so it can wrap, or use fewer lines.`,
      );
}

// A timestamp offset of `ticks` in a stream's own time base, from exact
// flicks and rounded to the nearest tick: setpts truncates its result, so a
// truncated decimal could land a frame one tick (a whole frame at 30 fps)
// early.
export function ptsOffset(ticks: number) {
  if (!Number.isSafeInteger(ticks) || ticks < 0)
    throw new CommandError("VALIDATION", "Render time is out of range.");
  return `floor(${ticks}/${FLICKS_PER_SECOND}/TB+0.5)`;
}

// Version of how this module draws a plan. Bump it whenever the drawing
// changes, so cached previews of unchanged plans are not reused (4:
// YU-023 color conversion and tags).
export const RENDERER_VERSION = 4;

// A read margin of one frame: of the profile, and never less than 1/30 s
// (so a 30 fps profile reads exactly as before; YU-019).
const frameMargin = (fps: { num: number; den: number }) =>
  Math.max(FLICKS_PER_SECOND / 30, framesToTicks(1, fps, "ceil"));

export type RenderReceipt = {
  planHash: string;
  width: number;
  height: number;
  durationFrames: number;
  hasAudio: boolean;
  // The libass API version that drew the titles; null without titles.
  libassApi: number | null;
};

// Settles when `signal` aborts, so a wait can be abandoned on cancel.
const aborted = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new Error("Cancelled."));
    signal.addEventListener("abort", () => reject(new Error("Cancelled.")), {
      once: true,
    });
  });

// Adapted from the donor's buildTimelineCommand: ordered overlays, source trimming,
// normalized timestamps, scale-to-fit, and a deterministic black canvas. Yamakan adds
// explicit audio mixing, cancellation and verified atomic output. T7: the
// filtergraph is compiled only from a render plan (core/render/plan.ts):
// numbers formatted from integer ticks; each clip its own seeked input,
// resolved by the plan's asset hash and size (a ready object of that size);
// titles drawn by one ASS script, matching the plan's hash, with the pinned
// fonts. Renders into a project-relative staging folder through an owned
// FFmpeg worker under one wall-clock limit and returns the verified,
// unpublished output and its receipt. Publication and the terminal job
// state belong to the job supervisor.
// What to render from a plan: a time window of it (the whole plan for an
// export, one frame or a short segment for reference preview) as MP4 or as
// a single PNG frame.
export type RenderWindow = {
  startTicks: number;
  durationTicks: number;
  output: "mp4" | "png";
  // Wall-clock limit; exports use renderWallSeconds.
  wallSeconds?: number;
};

export async function renderPlan(
  store: ProjectStore,
  plan: RenderPlan,
  ass: string | null,
  staging: string[],
  signal: AbortSignal,
  onProgress: (value: number) => void,
  onCreated?: (pid: number) => void | Promise<void>,
  window: RenderWindow = {
    startTicks: 0,
    durationTicks: plan.durationTicks,
    output: "mp4",
  },
): Promise<{ output: string; receipt: RenderReceipt; plan: RenderPlan }> {
  let activePlan = plan;
  const { profile } = activePlan;
  const rate = `${profile.fps.num}/${profile.fps.den}`;
  const FRAME = frameMargin(profile.fps);
  const wStart = window.startTicks;
  const wEnd = wStart + window.durationTicks;
  if (
    !Number.isSafeInteger(wStart) ||
    !Number.isSafeInteger(window.durationTicks) ||
    wStart < 0 ||
    window.durationTicks < 1 ||
    wEnd > plan.durationTicks
  )
    throw new CommandError(
      "VALIDATION",
      "The render window is outside the timeline.",
    );
  const total = seconds(window.durationTicks);
  const dir = await store.file(plan.projectId, ...staging);
  // The worker may write only its own subfolder (it could change that
  // folder's permissions); the service keeps its copy one level up, in a
  // folder the worker could never write.
  const work = path.join(dir, "worker");
  const written = path.join(
    work,
    window.output === "png" ? "frame.partial.png" : "render.partial.mp4",
  );
  const output = path.join(
    dir,
    window.output === "png" ? "frame.png" : "render.mp4",
  );
  // One limit covers the capability probe, the fit check and the render.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    (window.wallSeconds ?? RESOURCE_POLICY.enforced.renderWallSeconds) * 1000,
  );
  const stopped = () =>
    new Error(timedOut ? "Render time limit exceeded." : "Cancelled.");
  try {
    if (signal.aborted) throw new Error("Cancelled.");
    await mkdir(work, { recursive: true });
    let libassApi: number | null = null;
    let titleFontconfig: Record<string, string> | undefined;
    if (plan.titles) {
      if (
        ass === null ||
        createHash("sha256").update(ass).digest("hex") !== plan.titles.sha256
      )
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "The title script does not match the render plan.",
        );
      libassApi = (
        await Promise.race([titleCapability(), aborted(controller.signal)])
      ).libassApi;
      // The pinned font files, verified, are the only fonts libass is given.
      const fonts = await titleFonts();
      if (
        plan.fonts.length !== fonts.length ||
        plan.fonts.some((f, i) => f.sha256 !== fonts[i].sha256)
      )
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "The plan was compiled with different title fonts.",
        );
      const { confPath } = await stageTitleFonts(dir, fonts);
      await writeFile(path.join(dir, "titles.ass"), ass, { flag: "wx" });
      titleFontconfig = fontconfigEnv(confPath);
      await assertTitlesFit(dir, plan, fonts, controller.signal);
    }
    const args = [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-filter_complex_threads",
      "1",
    ];
    // Each clip reads its own input, seeked to its source range, so no
    // input's frames wait in a filter queue for another clip. The worker may
    // read only these inputs and the title files.
    let inputs = 0;
    const readable: string[] = [];
    const input = async (
      a: { assetSha256: string; assetBytes: number; assetExtension: string },
      options: string[],
    ) => {
      const file = await store.readyObjectFile(plan.projectId, {
        hash: a.assetSha256,
        bytes: a.assetBytes,
        extension: a.assetExtension,
      });
      if (!readable.includes(file)) readable.push(file);
      args.push(
        // `-threads` is an option of each input: every decoder gets the
        // policy's thread count, so memory does not grow with the host's
        // cores or the number of clips' decoders.
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        MEDIA_FORMATS,
        ...options,
        "-i",
        file,
      );
      return inputs++;
    };
    // YU-023: each LUT the plan names is read from its stored document
    // (verified against its hash), written once in canonical .cube form
    // into this render's folder, and given to the worker to read.
    const luts = new Map<string, string>();
    const lutFile = async (ref: {
      documentId: string;
      contentHash: string;
    }) => {
      if (!/^[a-f0-9]{64}$/.test(ref.contentHash))
        throw new CommandError("VALIDATION", "A LUT reference is invalid.");
      const known = luts.get(ref.contentHash);
      if (known) return known;
      const bytes = store.documentBytes({
        id: ref.documentId,
        kind: "lut",
        schemaVersion: 1,
        contentHash: ref.contentHash,
      });
      let value: unknown = null;
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch {
        // Reported below as damage.
      }
      const parsed = LutDocumentSchema.safeParse(value);
      if (!parsed.success)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "A stored LUT is damaged; restore a verified backup.",
        );
      const name = `${ref.contentHash}.cube`;
      await mkdir(path.join(dir, "luts"), { recursive: true });
      const file = path.join(dir, "luts", name);
      await writeFile(file, cubeText(parsed.data), { flag: "wx" });
      readable.push(file);
      luts.set(ref.contentHash, name);
      return name;
    };
    // Timestamps stay absolute (timeline time) through the graph, so the
    // plan's title script times titles in any window; the output is reset
    // to start at zero at the end.
    const filters = [
      `color=c=black:s=${profile.width}x${profile.height}:r=${rate}:d=${total},setpts=PTS+${ptsOffset(wStart)},format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[base]`,
    ];
    let visual = "base";
    let n = 0;
    for (const layer of plan.layers) {
      // The part of the clip inside the window.
      const from = Math.max(layer.startTicks, wStart);
      const to = Math.min(layer.startTicks + layer.durationTicks, wEnd);
      if (to <= from) continue;
      const start = seconds(from);
      const end = seconds(to);
      const clip = `c${n}`,
        next = `v${n++}`;
      // Clips are placed in a time base of one tick per flick, so the
      // offset is exact whatever the source's own time base (a looped still
      // counts in 1/25 s; a rounded offset there could skip a frame).
      const flicks = `settb=1/${FLICKS_PER_SECOND}`;
      let timed: string;
      if (layer.kind === "image") {
        // A still: one frame looped for the clip's part of the window, cut
        // one frame long and ended by the overlay's enable window.
        const cut = seconds(to - from + FRAME);
        const index = await input(layer, ["-loop", "1", "-t", cut]);
        timed = `[${index}:v]trim=duration=${cut},${flicks},setpts=PTS-STARTPTS+(${from})`;
      } else {
        // Every source frame keeps its own timeline time, clip start plus
        // its distance from the clip's source start, in export and in any
        // window alike, so the frame-rate filter picks the same source frame
        // for each output frame at any source rate. Reading starts up to two
        // frames early (never before the source's first frame), so the frame
        // covering the clip's or window's first instant is always read, even
        // when that instant falls inside a source frame; frames before the
        // clip or window get earlier (even negative) times and the overlay's
        // enable window hides them.
        const clipElapsed = from - layer.startTicks;
        const sourceElapsed = getSourceTimeAtClipTime({
          clipTime: clipElapsed,
          retime: { rate: layer.speed },
        });
        const offset = layer.sourceStartTicks + sourceElapsed;
        const lead = Math.min(offset, 2 * FRAME);
        const windowTicks = to - from;
        const sourceWindow = getSourceTimeAtClipTime({
          clipTime: windowTicks,
          retime: { rate: layer.speed },
        });
        const span = seconds(sourceWindow + lead + FRAME);
        const index = await input(layer, [
          "-ss",
          seconds(offset - lead),
          "-t",
          span,
        ]);
        // setpts maps source (after -ss offset-lead) into timeline time.
        // Speed 1 keeps the qualified PTS+(from-lead) form (export/preview
        // goldens). Other rates reset STARTPTS and subtract lead in clip time
        // so preroll stays before `from` (same enable window as audio).
        const speed = rateAsFloat(layer.speed);
        const leadClip = getClipTimeAtSourceTime({
          sourceTime: lead,
          retime: { rate: layer.speed },
        });
        const setpts =
          speed === 1
            ? `setpts=PTS+(${from - lead})`
            : `setpts=(PTS-STARTPTS)/${speed}+(${from - leadClip})`;
        timed = `[${index}:v]trim=duration=${span},${flicks},${setpts}`;
      }
      // The contain fit, as before; a transform (YU-020) crops before it
      // and scales after it, and moves the overlay from the centre.
      // YU-023: one explicit conversion from the source's matrix and range
      // to the policy's BT.709 limited range (alpha kept for overlays). A
      // LUT is applied first, in full-range RGB read the same way.
      const reading = layer.color
        ? `in_color_matrix=${layer.color.matrix}:in_range=${layer.color.range}`
        : null;
      let graded = "";
      if (layer.lut) {
        const name = await lutFile(layer.lut);
        graded = `${reading ? `scale=${reading}:out_range=pc,` : ""}format=gbrap,lut3d=file=luts/${name}:interp=tetrahedral,`;
      }
      const sourceReading = !layer.lut && reading ? `:${reading}` : "";
      const fit = `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease${sourceReading}:out_color_matrix=bt709:out_range=tv,setsar=1,format=yuva420p`;
      const shaped = layer.transform
        ? transformFilters(layer.transform, fit)
        : null;
      filters.push(
        `${timed},fps=${rate},${graded}${shaped?.picture ?? fit}[${clip}]`,
      );
      let picture = clip;
      if (ANIMATION_ENABLED && layer.animation) {
        const channels = renderableAnimationChannels(layer.animation);
        if (channels.opacity) {
          const faded = `${clip}a`;
          filters.push(
            ...opacityFilterChain(clip, faded, channels.opacity, {
              clipStartTicks: layer.startTicks,
              rangeStartTicks: from,
              rangeEndTicks: to,
              fps: profile.fps,
              compiler: plan.animationCompiler ?? ANIMATION_COMPILER_V1,
            }),
          );
          picture = faded;
        }
      }
      // A dissolve in (YU-021): the layer's alpha rises from 0 at its
      // first frame to 1 after the dissolve, in timeline time.
      if (layer.dissolveInTicks) {
        const dissolved = `${clip}x`;
        filters.push(
          `[${picture}]format=yuva420p,fade=t=in:st=${seconds(layer.startTicks)}:d=${seconds(layer.dissolveInTicks)}:alpha=1[${dissolved}]`,
        );
        picture = dissolved;
      }
      filters.push(
        `[${visual}][${picture}]overlay=x=${shaped?.overlay.x ?? "(W-w)/2"}:y=${shaped?.overlay.y ?? "(H-h)/2"}:enable='gte(t,${start})*lt(t,${end})':eof_action=pass[${next}]`,
      );
      visual = next;
    }
    const audio: string[] = [];
    if (window.output === "mp4")
      for (const a of plan.audio) {
        const from = Math.max(a.startTicks, wStart);
        const to = Math.min(a.startTicks + a.durationTicks, wEnd);
        if (to <= from) continue;
        // The whole clip is read and shaped in its own time (gain and linear
        // fades are plan numbers), then cut to the window, made 48 kHz
        // stereo and placed by an exact sample delay.
        const sourceDur = getSourceTimeAtClipTime({
          clipTime: a.durationTicks,
          retime: { rate: a.speed },
        });
        const index = await input(a, [
          "-ss",
          seconds(a.sourceStartTicks),
          "-t",
          seconds(sourceDur),
        ]);
        const label = `a${n++}`;
        const tempo =
          a.speed.num === 1 && a.speed.den === 1 ? [] : atempoChain(a.speed);
        const animVol =
          ANIMATION_ENABLED && a.animation
            ? renderableAnimationChannels(a.animation).volume
            : undefined;
        const volumeAnim = animVol
          ? volumeFilterChain(
              animVol,
              a.durationTicks,
              profile.fps,
              plan.animationCompiler ?? ANIMATION_COMPILER_V1,
            )
          : [];
        const shaping = [
          ...tempo,
          a.gainDb ? `volume=${a.gainDb}dB` : null,
          ...volumeAnim,
          a.fadeInTicks ? `afade=t=in:st=0:d=${seconds(a.fadeInTicks)}` : null,
          a.fadeOutTicks
            ? `afade=t=out:st=${seconds(a.durationTicks - a.fadeOutTicks)}:d=${seconds(a.fadeOutTicks)}`
            : null,
          a.crossfadeInTicks
            ? `afade=t=in:st=0:d=${seconds(a.crossfadeInTicks)}:curve=qsin`
            : null,
          a.crossfadeOutTicks
            ? `afade=t=out:st=${seconds(a.durationTicks - a.crossfadeOutTicks)}:d=${seconds(a.crossfadeOutTicks)}:curve=qsin`
            : null,
        ].filter(Boolean);
        const delay =
          (BigInt(from - wStart) * BigInt(profile.sampleRate)) /
          BigInt(FLICKS_PER_SECOND);
        filters.push(
          `[${index}:a]atrim=duration=${seconds(sourceDur)},asetpts=PTS-STARTPTS,${shaping.map((f) => `${f},`).join("")}atrim=start=${seconds(from - a.startTicks)}:duration=${seconds(to - from)},asetpts=PTS-STARTPTS,aresample=${profile.sampleRate},aformat=channel_layouts=stereo,adelay=${delay}S:all=1[${label}]`,
        );
        audio.push(label);
      }
    if (plan.titles) {
      filters.push(`[${visual}]ass=titles.ass:fontsdir=fonts[titled]`);
      visual = "titled";
    }
    filters.push(`[${visual}]setpts=PTS-STARTPTS[picture]`);
    if (audio.length) {
      // W18: optional two-pass loudnorm on the mixed bus before the limiter.
      let loudTail = "alimiter=limit=0.95";
      if (
        window.output === "mp4" &&
        activePlan.loudnorm &&
        !activePlan.loudnorm.measured
      ) {
        const measureFilters = [
          ...filters,
          `${audio.map((a) => `[${a}]`).join("")}amix=inputs=${audio.length}:normalize=0,atrim=duration=${total},${measurePassFilter(activePlan.loudnorm.target)}[audio]`,
        ];
        // The graph goes in a file the worker may read, not on the
        // command line: an animated timeline's graph can exceed it (YU-022).
        await writeFile(
          path.join(dir, "graph-measure.txt"),
          measureFilters.join(";\n"),
          { flag: "wx" },
        );
        readable.push(path.join(dir, "graph-measure.txt"));
        const measureArgs = [
          ...args,
          "-filter_complex_script",
          path.join(dir, "graph-measure.txt"),
          "-map",
          "[audio]",
          "-f",
          "null",
          "-",
        ];
        if (controller.signal.aborted) throw stopped();
        const measured = await workers().run({
          executable: mediaTools().ffmpeg,
          args: measureArgs,
          cwd: dir,
          writable: [work],
          readable: activePlan.titles
            ? [
                ...readable,
                path.join(dir, "titles.ass"),
                path.join(dir, "fonts"),
                path.join(dir, "fonts.conf"),
              ]
            : readable,
          workerEnv: titleFontconfig,
          memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
          signal: controller.signal,
          stderrLimit: 32_000,
        });
        if (controller.signal.aborted) throw stopped();
        if (measured.code !== 0)
          throw new Error(
            `FFmpeg failed loudnorm measure (exit ${measured.code}).`,
            { cause: measured.stderr },
          );
        activePlan = withMeasuredLoudnorm(
          activePlan,
          parseLoudnormJson(measured.stderr),
        );
      }
      if (activePlan.loudnorm?.measured)
        loudTail = `${applyPassFilter(activePlan.loudnorm)},alimiter=limit=0.95`;
      filters.push(
        `${audio.map((a) => `[${a}]`).join("")}amix=inputs=${audio.length}:normalize=0,atrim=duration=${total},${loudTail}[audio]`,
      );
    }
    // As above: the graph is a file the worker may read (YU-022).
    await writeFile(path.join(dir, "graph.txt"), filters.join(";\n"), {
      flag: "wx",
    });
    readable.push(path.join(dir, "graph.txt"));
    args.push(
      "-filter_complex_script",
      path.join(dir, "graph.txt"),
      "-map",
      "[picture]",
    );
    if (window.output === "png")
      args.push(
        "-frames:v",
        "1",
        "-c:v",
        "png",
        "-f",
        "image2",
        "-update",
        "1",
        "-progress",
        "pipe:1",
        "worker/frame.partial.png",
      );
    else {
      if (audio.length)
        args.push(
          "-map",
          "[audio]",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ar",
          String(profile.sampleRate),
        );
      args.push(
        "-c:v",
        "libx264",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        profile.pixelFormat,
        // YU-023: tagged as the policy's SDR Rec.709 limited range.
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        "-color_range",
        "tv",
        "-r",
        rate,
        "-t",
        total,
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        "worker/render.partial.mp4",
      );
    }
    const duration = Number(total);
    let progress = "";
    if (controller.signal.aborted) throw stopped();
    const result = await workers().run({
      executable: mediaTools().ffmpeg,
      args,
      cwd: dir,
      // The render's own folder is the only place it may write.
      writable: [work],
      // The title files exist exactly when the plan has titles.
      readable: activePlan.titles
        ? [
            ...readable,
            path.join(dir, "titles.ass"),
            path.join(dir, "fonts"),
            path.join(dir, "fonts.conf"),
          ]
        : readable,
      workerEnv: titleFontconfig,
      memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
      signal: controller.signal,
      onCreated,
      stderrLimit: 8000,
      onStdout: (chunk) => {
        progress += chunk.toString("utf8");
        const lines = progress.split("\n");
        progress = lines.pop() || "";
        for (const line of lines) {
          const match = /^out_time_us=(\d+)/.exec(line);
          if (match)
            onProgress(Math.min(0.99, Number(match[1]) / 1e6 / duration));
        }
      },
    });
    if (controller.signal.aborted) throw stopped();
    // Public messages never carry FFmpeg stderr, which contains host paths;
    // the bounded stderr tail stays server-side as the error cause.
    if (result.code !== 0)
      throw new Error(
        `FFmpeg failed to render the timeline (exit ${result.code}).`,
        { cause: result.stderr },
      );
    // The worker owned the file it wrote and could have given it its own
    // permissions or alternate data streams. Only its main stream is kept,
    // copied into a file this service creates, which inherits the
    // workspace's owner-only access; the worker's file is removed.
    await keepMainStream(written, output);
    const probed = await probe(output);
    // The probe counts thirtieths of a second, at any profile rate.
    const expectedFrames = Math.round(duration * 30);
    if (
      !probed.hasVideo ||
      probed.width !== profile.width ||
      probed.height !== profile.height ||
      (window.output === "mp4" &&
        (Math.abs(probed.durationFrames - expectedFrames) > 2 ||
          (audio.length > 0 && !probed.hasAudio)))
    )
      throw new Error("Rendered output failed verification.");
    onProgress(1);
    return {
      output,
      plan: activePlan,
      receipt: {
        planHash: activePlan.planHash,
        width: probed.width,
        height: probed.height,
        durationFrames: window.output === "png" ? 1 : probed.durationFrames,
        hasAudio: probed.hasAudio,
        libassApi,
      },
    };
  } catch (e) {
    await unlink(written).catch(() => {});
    await unlink(output).catch(() => {});
    // A wait abandoned by the deadline or a cancel reports why it stopped.
    if (controller.signal.aborted && !(e instanceof CommandError))
      throw stopped();
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

/**
 * YU-023: the color tags each asset's probe recorded at import, when they
 * have the probe's shape (assets imported before YU-023 have none).
 */
export function recordedColors(store: ProjectStore) {
  return (assetId: string): ProbedColor | null => {
    const probe = store.assetVersion(assetId)?.probe as {
      color?: Record<string, unknown> | null;
    } | null;
    const c = probe?.color;
    if (!c) return null;
    const valid = PROBED_KEYS.every(
      (k) =>
        typeof c[k] === "string" &&
        (c[k] as string).length <= PROBED_FIELD_LENGTH,
    );
    return valid
      ? (Object.fromEntries(PROBED_KEYS.map((k) => [k, c[k]])) as ProbedColor)
      : null;
  };
}

// Keeps only the main data stream of a file a worker wrote, in a new file
// this service creates (it inherits the folder's access, not the
// worker's), and removes the worker's file.
export async function keepMainStream(written: string, kept: string) {
  if (!(await lstat(written)).isFile())
    throw new Error("Rendered output is not a regular file.");
  await pipeline(
    createReadStream(written),
    createWriteStream(kept, { flags: "wx", mode: 0o600 }),
  );
  await unlink(written);
}

// Compiles the render plan of a stored revision and renders it: the one
// export path (jobs) and, in T8, reference preview.
export async function renderRevision(
  store: ProjectStore,
  projectId: string,
  revision: number,
  staging: string[],
  signal: AbortSignal,
  onProgress: (value: number) => void,
  onCreated?: (pid: number) => void | Promise<void>,
  options: { normalizeLoudness?: boolean } = {},
) {
  const { project, snapshotHash } = store.revisionCanonical(
    projectId,
    revision,
  );
  const { plan, ass } = compilePlan(project, snapshotHash, await titleFonts(), {
    normalizeLoudness: options.normalizeLoudness,
    captions: burnedInCaptions(project, (ref) => store.documentBytes(ref)),
    colors: recordedColors(store),
  });
  const rendered = await renderPlan(
    store,
    plan,
    ass,
    staging,
    signal,
    onProgress,
    onCreated,
  );
  return { ...rendered, plan: rendered.plan };
}
