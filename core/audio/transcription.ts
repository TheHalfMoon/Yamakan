// Transcription contract (YU-070), qualified before any weights exist.
// - PCM: one project asset's sound, extracted by a bounded, owned FFmpeg
//   worker to 16 kHz mono 16-bit WAV (what whisper.cpp reads), into a
//   private cache folder that is removed afterwards.
// - Transcript: `yamakan.transcript` v1, segments and words in ticks from
//   the source's start, with the recognizer, its version, its model (by
//   hash) and the language as provenance, and whether anything was
//   recognized at all.
// - whisper.cpp: its CLI's full JSON output (`-ojf`, v1.9.5, inspected at
//   the pinned commit) is parsed strictly; no whisper.cpp is bundled and no
//   model is pinned, so transcription itself refuses (WEIGHTS_ABSENT, or
//   ENGINE_DISABLED while engines are off).
// - Stand-in: FFmpeg's silencedetect on the same PCM finds where sound is,
//   deterministically and without a model. It recognizes nothing: its
//   transcript says so, and the captions it proposes carry placeholder text
//   for a person to write. A proposal is reviewed, never saved by itself.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CommandError } from "../command/errors.ts";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { MEDIA_FORMATS } from "../media.ts";
import { mediaTools, workers } from "../process/workers.ts";
import { canonicalJson, sha256Hex } from "../hash/canonical.ts";
import { FLICKS_PER_SECOND, framesToTicks, type Rational } from "../time.ts";
import {
  CAPTION_LIMITS,
  CaptionDocumentSchema,
  type CaptionDocument,
} from "../captions.ts";
import type { ProjectStore } from "../store.ts";

export const TRANSCRIPT_FORMAT = "yamakan.transcript";
export const STAND_IN_VERSION = "yamakan.stand-in/v1:silencedetect";

// What was inspected (YU-070): whisper.cpp v1.9.5, MIT, at this commit.
// examples/cli/cli.cpp writes `-ojf` JSON: "result.language", and per
// segment "offsets" {from, to} in milliseconds (segment t0/t1 are 10 ms
// units, written ×10), "text", and "tokens" [{text, offsets?, id, p,
// t_dtw}]. Strings escape only `"` and `\` (escape_double_quotes_and_
// backslashes), so a control character in recognized text makes the file
// invalid JSON: it is refused, never repaired.
export const WHISPER_CPP = Object.freeze({
  version: "1.9.5",
  repo: "ggml-org/whisper.cpp",
  commit: "d1be6fde11ac6e0407606b4e42fe72d34add8037",
  license: "MIT",
  output: "-ojf",
});
// whisper.cpp's g_lang table (src/whisper.cpp at that commit), in order.
export const WHISPER_LANGUAGES: readonly string[] = Object.freeze(
  "en zh de es ru ko fr ja pt tr pl ca nl ar sv it id hi fi vi he uk el ms cs ro da hu ta no th ur hr bg lt la mi ml cy sk te fa lv bn sr az sl kn et mk br eu is hy ne mn bs kk sq sw gl mr pa si km sn yo so af oc ka be tg sd gu am yi lo uz fo ht ps tk nn mt sa lb my bo tl mg as tt haw ln ha ba jw su yue".split(
    " ",
  ),
);

export const TRANSCRIPTION_LIMITS = Object.freeze({
  // The longest source accepted: an hour of 16 kHz mono 16-bit PCM is
  // about 115 MB in the cache while it is used.
  maxSourceSeconds: 3600,
  sampleRate: 16000,
  outputBytes: 8 * 1024 * 1024,
  segments: 5000,
  wordsPerSegment: 400,
  segmentText: 2000,
  wallSeconds: 600,
  queueDepth: 2,
  // silencedetect: quieter than this for at least this long is silence.
  silenceDb: -35,
  silenceSeconds: 0.4,
});

const TICKS_PER_MS = FLICKS_PER_SECOND / 1000;
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const Tick = z.number().int().nonnegative();
// Recognized text: no control characters (tab and newline aside) and no
// bidirectional overrides.
const Text = z
  .string()
  .max(TRANSCRIPTION_LIMITS.segmentText)
  .refine(
    (t) =>
      // oxlint-disable-next-line no-control-regex
      !/[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/.test(t),
    "Transcript text has no control characters.",
  );

const Word = z
  .object({
    startTicks: Tick,
    endTicks: Tick,
    text: Text,
    probability: z.number().min(0).max(1).nullable(),
  })
  .strict()
  .refine((w) => w.endTicks >= w.startTicks, "A word ends after it starts.");
const Segment = z
  .object({
    startTicks: Tick,
    endTicks: Tick,
    text: Text,
    words: z.array(Word).max(TRANSCRIPTION_LIMITS.wordsPerSegment),
  })
  .strict()
  .refine((s) => s.endTicks > s.startTicks, "A segment ends after it starts.");

export const TranscriptSchema = z
  .object({
    format: z.literal(TRANSCRIPT_FORMAT),
    formatVersion: z.literal(1),
    source: z
      .object({
        assetId: z.string().min(1).max(80),
        assetHash: Sha256,
        durationTicks: Tick,
        // The exact PCM the recognizer read.
        pcmSha256: Sha256,
      })
      .strict(),
    recognizer: z
      .object({
        kind: z.enum(["whisper.cpp", "stand-in"]),
        version: z.string().min(1).max(80),
        // The weights by hash; none for the stand-in.
        model: z
          .object({ id: z.string().min(1).max(80), sha256: Sha256 })
          .strict()
          .nullable(),
      })
      .strict(),
    language: z.enum(WHISPER_LANGUAGES as [string, ...string[]]),
    // "none": the transcript locates sound but claims no words.
    recognition: z.enum(["model", "none"]),
    segments: z.array(Segment).max(TRANSCRIPTION_LIMITS.segments),
  })
  .strict()
  .superRefine((t, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((t.recognizer.kind === "stand-in") !== (t.recognition === "none"))
      fail("Only the stand-in reports no recognition, and it always does.");
    if ((t.recognizer.model === null) !== (t.recognizer.kind === "stand-in"))
      fail("A model recognizer names its weights; the stand-in has none.");
    let previous = 0;
    for (const s of t.segments) {
      if (s.startTicks < previous) fail("Segments are in time order.");
      if (s.endTicks > t.source.durationTicks)
        fail("A segment ends after the source does.");
      if (t.recognition === "none" && (s.text !== "" || s.words.length))
        fail("A transcript with no recognition has no text.");
      for (const w of s.words)
        if (w.startTicks < s.startTicks || w.endTicks > s.endTicks)
          fail("A word lies inside its segment.");
      previous = s.startTicks;
    }
  });
export type Transcript = z.infer<typeof TranscriptSchema>;

const invalid = (message: string) => new CommandError("VALIDATION", message);

/** A language whisper.cpp knows, or a refusal before any work. */
export function assertLanguage(language: string) {
  if (!WHISPER_LANGUAGES.includes(language))
    throw invalid(
      `Transcription does not support the language "${language.slice(0, 16)}".`,
    );
  return language;
}

type Asset = Awaited<ReturnType<ProjectStore["assetFile"]>>["asset"];

/** The source's sound, bounded before anything is decoded. */
export function assertTranscribable(asset: Asset, frameRate: Rational) {
  if (asset.kind === "image" || (asset.kind === "video" && !asset.hasAudio))
    throw invalid("Only project audio or footage with sound is transcribed.");
  const durationTicks = framesToTicks(asset.durationFrames, frameRate);
  if (durationTicks > TRANSCRIPTION_LIMITS.maxSourceSeconds * FLICKS_PER_SECOND)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Sources longer than ${TRANSCRIPTION_LIMITS.maxSourceSeconds / 60} minutes are not transcribed; split it first.`,
    );
  return durationTicks;
}

// One extraction or analysis at a time (each decodes a whole source).
let queue: Promise<unknown> = Promise.resolve();
let waiting = 0;
async function inTurn<T>(fn: () => Promise<T>) {
  if (waiting >= TRANSCRIPTION_LIMITS.queueDepth)
    throw new CommandError(
      "BUSY",
      "Other audio analyses are waiting; retry shortly.",
    );
  waiting++;
  const turn = queue.then(async () => {
    waiting--;
    return fn();
  });
  queue = turn.catch(() => {});
  return turn;
}

// Runs FFmpeg in a bounded worker; returns its stdout.
async function ffmpeg(
  args: string[],
  opts: { cwd: string; readable: string[]; writable?: string[] },
  signal: AbortSignal | undefined,
  what: string,
) {
  if (signal?.aborted) throw new CommandError("UNAVAILABLE", "Cancelled.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TRANSCRIPTION_LIMITS.wallSeconds * 1000);
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
        ...args,
      ],
      cwd: opts.cwd,
      readable: opts.readable,
      ...(opts.writable ? { writable: opts.writable } : {}),
      memoryBytes,
      signal: controller.signal,
      onStdout: (b) => {
        size += b.length;
        if (size > TRANSCRIPTION_LIMITS.outputBytes) {
          overflow = true;
          controller.abort();
        } else chunks.push(b);
      },
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  if (signal?.aborted) throw new CommandError("UNAVAILABLE", "Cancelled.");
  if (overflow)
    throw new CommandError("LIMIT_EXCEEDED", `${what} printed too much.`);
  if (timedOut || result.wallExceeded)
    throw new CommandError("LIMIT_EXCEEDED", `${what} time limit exceeded.`);
  if (result.code !== 0) {
    if ((result.peakMemoryBytes ?? 0) >= memoryBytes * 0.95)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `${what} ran out of its memory limit.`,
      );
    throw new CommandError(
      "MEDIA_INVALID",
      `${what} failed; the sound is unreadable or unsupported.`,
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type Pcm = {
  dir: string;
  file: string;
  samples: number;
  sha256: string;
  durationTicks: number;
  asset: Asset;
};

/**
 * Extracts one asset's sound as 16 kHz mono 16-bit WAV into a private
 * cache folder. The caller removes `dir` (releasePcm) when done.
 */
export async function extractPcm(
  store: ProjectStore,
  projectId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<Pcm> {
  const { file, asset, frameRate } = await store.assetFile(projectId, assetId);
  assertTranscribable(asset, frameRate);
  const root = await store.file(projectId, "cache", "transcription");
  await mkdir(root, { recursive: true });
  await sweepStale(root);
  const dir = path.join(root, `${randomUUID()}.partial`);
  await mkdir(dir);
  try {
    await inTurn(() =>
      ffmpeg(
        [
          "-format_whitelist",
          MEDIA_FORMATS,
          "-i",
          `file:${file}`,
          "-vn",
          "-sn",
          "-dn",
          "-map",
          "0:a:0",
          "-ac",
          "1",
          "-ar",
          String(TRANSCRIPTION_LIMITS.sampleRate),
          "-c:a",
          "pcm_s16le",
          "-t",
          String(TRANSCRIPTION_LIMITS.maxSourceSeconds),
          // A canonical 44-byte header and no encoder tag: the same sound
          // gives the same bytes, so its hash names it.
          "-map_metadata",
          "-1",
          "-fflags",
          "+bitexact",
          "-flags:a",
          "+bitexact",
          "-f",
          "wav",
          "file:pcm.wav",
        ],
        { cwd: dir, readable: [file], writable: [dir] },
        signal,
        "Sound extraction",
      ),
    );
    const out = path.join(dir, "pcm.wav");
    const { size } = await stat(out);
    const samples = await checkedSamples(out, size);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(out)) hash.update(chunk);
    return {
      dir,
      file: out,
      samples,
      sha256: hash.digest("hex"),
      // The sound's own length (exact: 44100 ticks per sample at 16 kHz),
      // which segments are bounded by.
      durationTicks:
        samples * (FLICKS_PER_SECOND / TRANSCRIPTION_LIMITS.sampleRate),
      asset,
    };
  } catch (e) {
    await remove(dir);
    throw e;
  }
}

// A worker just stopped may still hold the folder briefly (Windows).
const remove = (dir: string) =>
  rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });

export const releasePcm = (pcm: Pcm) => remove(pcm.dir);

// Folders left by a crash (older than any extraction can run) are removed.
async function sweepStale(root: string) {
  const cutoff = Date.now() - 2 * TRANSCRIPTION_LIMITS.wallSeconds * 1000;
  for (const name of await readdir(root).catch(() => [])) {
    if (!name.endsWith(".partial")) continue;
    const at = path.join(root, name);
    const info = await stat(at).catch(() => null);
    if (info && info.mtimeMs < cutoff) await remove(at);
  }
}

// The canonical 44-byte header FFmpeg writes with +bitexact (RIFF, WAVE,
// fmt for 16 kHz mono 16-bit, then data): anything else is refused rather
// than counted wrongly.
async function checkedSamples(file: string, size: number) {
  const handle = await open(file, "r");
  const head = Buffer.alloc(44);
  try {
    await handle.read(head, 0, 44, 0);
  } finally {
    await handle.close();
  }
  const ok =
    size >= 44 &&
    head.toString("ascii", 0, 4) === "RIFF" &&
    head.toString("ascii", 8, 16) === "WAVEfmt " &&
    head.readUInt16LE(20) === 1 &&
    head.readUInt16LE(22) === 1 &&
    head.readUInt32LE(24) === TRANSCRIPTION_LIMITS.sampleRate &&
    head.readUInt16LE(34) === 16 &&
    head.toString("ascii", 36, 40) === "data" &&
    head.readUInt32LE(40) === size - 44;
  if (!ok)
    throw new CommandError(
      "MEDIA_INVALID",
      "Sound extraction wrote PCM that is not 16 kHz mono 16-bit WAV.",
    );
  return (size - 44) / 2;
}

const toTicks = (seconds: number) => Math.round(seconds * 1000) * TICKS_PER_MS;

/** silencedetect's metadata print → the intervals that are not silence. */
export function soundRegions(text: string, durationTicks: number) {
  const regions: { startTicks: number; endTicks: number }[] = [];
  let soundFrom = 0;
  for (const line of text.split(/\r?\n/)) {
    const start =
      /^lavfi\.silence_start=(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*$/.exec(line);
    const end = /^lavfi\.silence_end=(\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*$/.exec(
      line,
    );
    if (start) {
      const at = Math.min(
        durationTicks,
        toTicks(Math.max(0, Number(start[1]))),
      );
      if (at > soundFrom) regions.push({ startTicks: soundFrom, endTicks: at });
      soundFrom = Number.POSITIVE_INFINITY;
    } else if (end)
      soundFrom = Math.min(durationTicks, toTicks(Number(end[1])));
  }
  if (soundFrom < durationTicks)
    regions.push({ startTicks: soundFrom, endTicks: durationTicks });
  if (regions.length > TRANSCRIPTION_LIMITS.segments)
    throw new CommandError("LIMIT_EXCEEDED", "Too many sound regions.");
  return regions;
}

/**
 * The stand-in: where there is sound in the extracted PCM, with no words.
 * Deterministic and model-free; its transcript reports no recognition.
 */
export async function standInTranscript(
  pcm: Pcm,
  language: string,
  signal?: AbortSignal,
): Promise<Transcript> {
  assertLanguage(language);
  const printed = await inTurn(() =>
    ffmpeg(
      [
        "-f",
        "wav",
        "-i",
        "file:pcm.wav",
        "-af",
        `silencedetect=n=${TRANSCRIPTION_LIMITS.silenceDb}dB:d=${TRANSCRIPTION_LIMITS.silenceSeconds},ametadata=mode=print:file=-`,
        "-f",
        "null",
        "-",
      ],
      { cwd: pcm.dir, readable: [pcm.dir] },
      signal,
      "Sound analysis",
    ),
  );
  return TranscriptSchema.parse({
    format: TRANSCRIPT_FORMAT,
    formatVersion: 1,
    source: {
      assetId: pcm.asset.id,
      assetHash: pcm.asset.hash,
      durationTicks: pcm.durationTicks,
      pcmSha256: pcm.sha256,
    },
    recognizer: { kind: "stand-in", version: STAND_IN_VERSION, model: null },
    language,
    recognition: "none",
    segments: soundRegions(printed, pcm.durationTicks).map((r) => ({
      ...r,
      text: "",
      words: [],
    })),
  });
}

const WhisperOffsets = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  })
  .passthrough();
const WhisperOutput = z
  .object({
    result: z.object({ language: z.string() }).passthrough(),
    transcription: z.array(
      z
        .object({
          offsets: WhisperOffsets,
          text: z.string(),
          tokens: z
            .array(
              z
                .object({
                  text: z.string(),
                  offsets: WhisperOffsets.optional(),
                  p: z.number().optional(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

// Control tokens whisper.cpp writes among the words: [_BEG_], [_TT_150],
// [_SOT_] and the like.
const CONTROL_TOKEN = /^\[_[A-Z0-9_]+\]$/;

/**
 * whisper.cpp's `-ojf` JSON as a transcript, refused if anything is off:
 * invalid JSON, a missing field, times backwards or beyond the source, a
 * language it was not asked for, or more than the limits.
 */
export function parseWhisperJson(
  text: string,
  context: {
    source: Transcript["source"];
    language: string;
    model: { id: string; sha256: string };
  },
): Transcript {
  assertLanguage(context.language);
  if (Buffer.byteLength(text, "utf8") > TRANSCRIPTION_LIMITS.outputBytes)
    throw new CommandError("LIMIT_EXCEEDED", "The transcript is too large.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CommandError(
      "MEDIA_INVALID",
      "The recognizer wrote a transcript that is not valid JSON.",
    );
  }
  const parsed = WhisperOutput.safeParse(raw);
  if (!parsed.success)
    throw new CommandError(
      "MEDIA_INVALID",
      "The recognizer's transcript is missing required fields.",
    );
  const out = parsed.data;
  if (out.result.language !== context.language)
    throw new CommandError(
      "MEDIA_INVALID",
      `The recognizer answered in "${out.result.language.slice(0, 16)}", not "${context.language}".`,
    );
  if (out.transcription.length > TRANSCRIPTION_LIMITS.segments)
    throw new CommandError("LIMIT_EXCEEDED", "Too many transcript segments.");
  const ms = (n: number) => n * TICKS_PER_MS;
  if (
    out.transcription.some((s) =>
      (s.tokens ?? []).some((t) => t.p !== undefined && (t.p < 0 || t.p > 1)),
    )
  )
    throw new CommandError(
      "MEDIA_INVALID",
      "The recognizer reported a token probability outside 0 to 1.",
    );
  // A zero-length segment (t0 = t1, which whisper.cpp can emit) holds no
  // time and is dropped; a timed word may overrun its segment by a token's
  // rounding, so it is clamped into it. Anything grosser is refused below.
  const SLACK = 200 * TICKS_PER_MS;
  const segments = out.transcription
    .filter((s) => s.offsets.to !== s.offsets.from)
    .map((s) => {
      const startTicks = ms(s.offsets.from);
      const endTicks = ms(s.offsets.to);
      return {
        startTicks,
        endTicks,
        text: s.text.trim(),
        words: (s.tokens ?? [])
          .filter((t) => !CONTROL_TOKEN.test(t.text.trim()) && t.offsets)
          .map((t) => {
            const from = ms(t.offsets!.from);
            const to = ms(t.offsets!.to);
            const near = from >= startTicks - SLACK && to <= endTicks + SLACK;
            return {
              startTicks: near
                ? Math.max(startTicks, Math.min(from, endTicks))
                : from,
              endTicks: near
                ? Math.min(endTicks, Math.max(to, startTicks))
                : to,
              text: t.text.trim(),
              probability: t.p ?? null,
            };
          })
          .filter((w) => w.text !== ""),
      };
    });
  const transcript = TranscriptSchema.safeParse({
    format: TRANSCRIPT_FORMAT,
    formatVersion: 1,
    source: context.source,
    recognizer: {
      kind: "whisper.cpp",
      version: WHISPER_CPP.version,
      model: context.model,
    },
    language: context.language,
    recognition: "model",
    segments,
  });
  if (!transcript.success)
    throw new CommandError(
      "MEDIA_INVALID",
      `The recognizer's transcript is malformed: ${transcript.error.issues[0]?.message ?? "invalid"}`,
    );
  return transcript.data;
}

// Placeholder for a cue whose words a person must write. Neutral: the
// stand-in finds sound, which may be music or noise, not speech.
export const PLACEHOLDER = "[sound]";

/**
 * A reviewable caption track from a transcript: one cue per segment at
 * whole milliseconds, never overlapping. Text the stand-in could not
 * recognize is a placeholder, counted in `placeholders`. Nothing is saved:
 * the proposal is applied with the caption commands.
 */
export function captionProposal(
  transcript: Transcript,
  options: { name: string; language?: string; cueId?: (i: number) => string },
) {
  const t = TranscriptSchema.parse(transcript);
  if (!t.segments.length)
    throw invalid("The transcript found no sound to caption.");
  const id = options.cueId ?? (() => randomUUID());
  let placeholders = 0;
  // Segments that fall wholly inside an earlier cue at millisecond
  // precision: their text is reported, never silently lost.
  const dropped: { segment: number; text: string }[] = [];
  let previousEnd = 0;
  const cues: CaptionDocument["cues"] = [];
  for (const [i, s] of t.segments.entries()) {
    const start = Math.max(
      previousEnd,
      Math.round(s.startTicks / TICKS_PER_MS) * TICKS_PER_MS,
    );
    const end = Math.round(s.endTicks / TICKS_PER_MS) * TICKS_PER_MS;
    if (end <= start) {
      dropped.push({ segment: i + 1, text: s.text });
      continue;
    }
    let text = s.text.replace(/\s+/g, " ").trim();
    if (!text) {
      text = PLACEHOLDER;
      placeholders++;
    }
    if (text.length > CAPTION_LIMITS.cueText)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `Segment ${i + 1} is longer than a caption cue holds; split it in the recognizer (-ml).`,
      );
    cues.push({
      id: id(i),
      startTicks: start,
      endTicks: end,
      text,
      source: null,
    });
    previousEnd = end;
  }
  if (cues.length > CAPTION_LIMITS.cues)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `A caption track holds at most ${CAPTION_LIMITS.cues} cues; this transcript has ${cues.length}.`,
    );
  const document = CaptionDocumentSchema.parse({
    format: "yamakan.captions",
    formatVersion: 1,
    name: options.name,
    language: options.language ?? t.language,
    burnIn: false,
    source: null,
    cues,
  });
  return {
    document,
    placeholders,
    dropped,
    recognition: t.recognition,
    // Names what is proposed (cue times and text, not the fresh cue ids)
    // from which transcript, so the same transcript gives the same hash.
    proposalHash: sha256Hex(
      canonicalJson({
        transcript: sha256Hex(canonicalJson(t)),
        language: document.language,
        cues: document.cues.map((c) => [c.startTicks, c.endTicks, c.text]),
      }),
    ),
  };
}
