// YU-070: the transcription contract before any weights. Sound is
// extracted by a bounded worker to 16 kHz mono PCM (deterministic bytes);
// the model-free stand-in locates sound and claims no words; whisper.cpp's
// -ojf JSON (shape from the pinned v1.9.5 source) is parsed strictly; both
// become reviewable caption proposals whose cue times round-trip through
// the caption commands. Missing weights, an unsupported language,
// malformed segments, no speech and an over-long source are refused safely.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { engineReasonMessage } from "../core/engines/reasons.ts";
import { exportCaptions, parseCaptions } from "../core/captions.ts";
import type { Project } from "../core/project.ts";
import {
  PLACEHOLDER,
  TRANSCRIPTION_LIMITS,
  TranscriptSchema,
  WHISPER_LANGUAGES,
  assertLanguage,
  assertTranscribable,
  captionProposal,
  extractPcm,
  parseWhisperJson,
  releasePcm,
  standInTranscript,
  type Transcript,
} from "../core/audio/transcription.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});
const MS = 705_600; // flicks per millisecond
const failure = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === "function" ? p() : p);
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const browser = {
  id: "browser-ui" as const,
  scopes: new Set(Scopes) as ReadonlySet<Scope>,
};

function ffmpeg(args: string[]) {
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-transcribe-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = { store, queue, principal: browser };
  const call = async <T>(operation: string, args: object) =>
    (await execute(ctx, operation, args)).result as T;
  const project = await call<Project>("yamakan.project.create", {
    name: "Transcription",
  });
  const make = async (name: string, args: string[]) => {
    const file = path.join(root, name);
    ffmpeg([...args, file]);
    return (await store.importAsset(project.id, name, await readFile(file)))
      .asset;
  };
  // Sound 0–1 s, silence 1–2 s, sound 2–2.6 s.
  const speech = await make("speech.wav", [
    "-filter_complex",
    "sine=f=440:d=1[a];anullsrc=r=44100:cl=mono,atrim=0:1[b];sine=f=660:d=0.6[c];[a][b][c]concat=n=3:v=0:a=1",
  ]);
  const silence = await make("silence.wav", [
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=mono",
    "-t",
    "2",
  ]);
  const mute = await make("mute.mp4", [
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=160x90:rate=30:duration=1",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
  ]);
  return { root, store, call, projectId: project.id, speech, silence, mute };
}

// Exactly the shape examples/cli/cli.cpp writes with -ojf (v1.9.5):
// timestamps and offsets per segment and per token, control tokens among
// the words, the language in result.language.
const whisperJson = (segments: string) => `{
  "systeminfo": "AVX = 1 | AVX2 = 1",
  "model": {
    "type": "base",
    "multilingual": true,
    "vocab": 51865,
    "audio": { "ctx": 1500, "state": 512, "head": 8, "layer": 6 },
    "text": { "ctx": 448, "state": 512, "head": 8, "layer": 6 },
    "mels": 80,
    "ftype": 1
  },
  "params": { "model": "models/ggml-base.bin", "language": "ar", "translate": false },
  "result": { "language": "ar" },
  "transcription": [${segments}]
}`;
const segment = (from: number, to: number, text: string, tokens = "") => `{
    "timestamps": { "from": "00:00:00,000", "to": "00:00:00,000" },
    "offsets": { "from": ${from}, "to": ${to} },
    "text": ${JSON.stringify(text)}${tokens ? `,\n    "tokens": [${tokens}]` : ""}
  }`;
const token = (text: string, from: number, to: number, p = 0.9) =>
  `{ "text": ${JSON.stringify(text)}, "timestamps": { "from": "", "to": "" }, "offsets": { "from": ${from}, "to": ${to} }, "id": 1, "p": ${p}, "t_dtw": -1 }`;
const MODEL = { id: "ggml-base", sha256: "a".repeat(64) };
const sourceOf = (durationMs: number) => ({
  assetId: "asset-1",
  assetHash: "b".repeat(64),
  durationTicks: durationMs * MS,
  pcmSha256: "c".repeat(64),
});

test("sound is extracted to bounded, deterministic 16 kHz mono PCM", async () => {
  const c = await workspace();
  const a = await extractPcm(c.store, c.projectId, c.speech.id);
  const b = await extractPcm(c.store, c.projectId, c.speech.id);
  try {
    const bytes = await readFile(a.file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.readUInt16LE(22), 1, "mono");
    assert.equal(bytes.readUInt32LE(24), 16000, "16 kHz");
    assert.equal(bytes.readUInt16LE(34), 16, "16-bit");
    assert.equal(bytes.toString("ascii", 36, 40), "data", "44-byte header");
    // 2.6 s of sound, within one 20 ms resampling frame.
    assert.ok(Math.abs(a.samples - 2.6 * 16000) <= 320, String(a.samples));
    assert.equal(a.sha256, b.sha256, "the same sound gives the same bytes");
  } finally {
    await releasePcm(a);
    await releasePcm(b);
  }
  await assert.rejects(access(a.dir));
  // Footage without sound and stills are refused before decoding.
  assert.match(
    await failure(extractPcm(c.store, c.projectId, c.mute.id)),
    /^VALIDATION: Only project audio or footage with sound/,
  );
  // A cancel before it starts runs nothing and leaves no folder.
  const cancelled = new AbortController();
  cancelled.abort();
  assert.match(
    await failure(
      extractPcm(c.store, c.projectId, c.speech.id, cancelled.signal),
    ),
    /^UNAVAILABLE: Cancelled/,
  );
  const cache = await c.store.file(c.projectId, "cache", "transcription");
  assert.deepEqual(await readdir(cache), []);
  // Over an hour is refused from the asset's length alone.
  assert.match(
    await failure(() =>
      assertTranscribable(
        { ...c.speech, durationFrames: 30 * 3601 },
        { num: 30, den: 1 },
      ),
    ),
    /^LIMIT_EXCEEDED: Sources longer than 60 minutes/,
  );
});

test("the stand-in locates sound, claims no words, and its proposal round-trips through the caption commands", async () => {
  const c = await workspace();
  const pcm = await extractPcm(c.store, c.projectId, c.speech.id);
  let t: Transcript;
  try {
    t = await standInTranscript(pcm, "en");
  } finally {
    await releasePcm(pcm);
  }
  assert.equal(t.recognition, "none");
  assert.equal(t.recognizer.kind, "stand-in");
  assert.equal(t.recognizer.model, null);
  assert.equal(t.segments.length, 2);
  const near = (ticks: number, ms: number) => Math.abs(ticks / MS - ms) <= 60;
  assert.ok(near(t.segments[0]!.startTicks, 0));
  assert.ok(
    near(t.segments[0]!.endTicks, 1000),
    String(t.segments[0]!.endTicks / MS),
  );
  assert.ok(
    near(t.segments[1]!.startTicks, 2000),
    String(t.segments[1]!.startTicks / MS),
  );
  assert.ok(
    near(t.segments[1]!.endTicks, 2600),
    String(t.segments[1]!.endTicks / MS),
  );
  assert.ok(t.segments.every((s) => s.text === "" && s.words.length === 0));
  // The stand-in cannot be dressed up as recognition.
  assert.equal(
    TranscriptSchema.safeParse({ ...t, recognition: "model" }).success,
    false,
  );
  const p = captionProposal(t, { name: "Draft" });
  assert.equal(p.recognition, "none");
  assert.equal(p.placeholders, 2);
  assert.ok(p.document.cues.every((cue) => cue.text === PLACEHOLDER));
  assert.equal(PLACEHOLDER, "[sound]");
  // The same transcript names the same proposal, whatever the cue ids.
  assert.equal(
    captionProposal(t, { name: "Draft" }).proposalHash,
    p.proposalHash,
  );
  // Proposed, then applied by a person with the caption commands: the
  // cue times survive SRT export, import and export again.
  const documentId = crypto.randomUUID();
  const srt = exportCaptions(p.document, "srt");
  const head = await c.store.load(c.projectId);
  await c.call("yamakan.captions.import", {
    projectId: c.projectId,
    expectedRevision: head.revision,
    documentId,
    expectedContentHash: null,
    name: "Draft",
    language: "en",
    format: "srt",
    text: srt,
  });
  const back = await c.call<{ text: string }>("yamakan.captions.export", {
    projectId: c.projectId,
    documentId,
    format: "srt",
  });
  const cues = parseCaptions(back.text, "srt", (n) => String(n));
  assert.deepEqual(
    cues.map((x) => [x.startTicks, x.endTicks, x.text]),
    p.document.cues.map((x) => [x.startTicks, x.endTicks, x.text]),
  );
});

test("no speech gives an empty transcript, and nothing to caption", async () => {
  const c = await workspace();
  const pcm = await extractPcm(c.store, c.projectId, c.silence.id);
  try {
    const t = await standInTranscript(pcm, "ar");
    assert.deepEqual(t.segments, []);
    assert.match(
      await failure(() => captionProposal(t, { name: "Draft" })),
      /^VALIDATION: The transcript found no sound/,
    );
  } finally {
    await releasePcm(pcm);
  }
});

test("whisper.cpp's -ojf output parses to ticks, drops control tokens, and becomes captions", async () => {
  const c = await workspace();
  const text = whisperJson(
    [
      segment(
        0,
        1230,
        " مرحبا بكم",
        [
          token("[_BEG_]", 0, 0),
          token(" مرحبا", 0, 600, 0.93),
          token(" بكم", 600, 1230, 0.88),
          token("[_TT_61]", 1230, 1230),
        ].join(","),
      ),
      segment(1500, 2400, " في يمكن"),
    ].join(","),
  );
  const t = parseWhisperJson(text, {
    source: sourceOf(2600),
    language: "ar",
    model: MODEL,
  });
  assert.equal(t.recognition, "model");
  assert.deepEqual(t.recognizer, {
    kind: "whisper.cpp",
    version: "1.9.5",
    model: MODEL,
  });
  assert.deepEqual(
    t.segments.map((s) => [s.startTicks, s.endTicks, s.text]),
    [
      [0, 1230 * MS, "مرحبا بكم"],
      [1500 * MS, 2400 * MS, "في يمكن"],
    ],
  );
  assert.deepEqual(
    t.segments[0]!.words.map((w) => [
      w.text,
      w.startTicks,
      w.endTicks,
      w.probability,
    ]),
    [
      ["مرحبا", 0, 600 * MS, 0.93],
      ["بكم", 600 * MS, 1230 * MS, 0.88],
    ],
  );
  const p = captionProposal(t, { name: "Arabic" });
  assert.equal(p.placeholders, 0);
  const documentId = crypto.randomUUID();
  await c.call("yamakan.captions.import", {
    projectId: c.projectId,
    expectedRevision: (await c.store.load(c.projectId)).revision,
    documentId,
    expectedContentHash: null,
    name: "Arabic",
    language: "ar",
    format: "vtt",
    text: exportCaptions(p.document, "vtt"),
  });
  const back = await c.call<{ text: string }>("yamakan.captions.export", {
    projectId: c.projectId,
    documentId,
    format: "vtt",
  });
  assert.deepEqual(
    parseCaptions(back.text, "vtt", (n) => String(n)).map((x) => [
      x.startTicks,
      x.endTicks,
      x.text,
    ]),
    [
      [0, 1230 * MS, "مرحبا بكم"],
      [1500 * MS, 2400 * MS, "في يمكن"],
    ],
  );
});

test("malformed recognizer output is refused, never repaired", () => {
  const parse = (t: string, language = "ar") =>
    failure(() =>
      parseWhisperJson(t, { source: sourceOf(2600), language, model: MODEL }),
    );
  const cases: [string, RegExp][] = [
    // whisper.cpp escapes only quotes and backslashes: a raw newline in
    // recognized text is invalid JSON.
    [
      whisperJson(`{"offsets":{"from":0,"to":10},"text":"a\nb"}`),
      /not valid JSON/,
    ],
    [
      whisperJson(segment(500, 400, "backwards")),
      /malformed: A segment ends after it starts/,
    ],
    [
      whisperJson(segment(0, 2700, "too long")),
      /malformed: A segment ends after the source does/,
    ],
    [
      whisperJson([segment(1000, 1200, "b"), segment(0, 500, "a")].join(",")),
      /malformed: Segments are in time order/,
    ],
    [
      whisperJson(segment(0, 100, "bell\u0007")),
      /malformed: Transcript text has no control/,
    ],
    [whisperJson(`{"text":"no offsets"}`), /missing required fields/],
    [whisperJson(segment(-10, 100, "negative")), /missing required fields/],
    [
      whisperJson(segment(0, 100, "word", token(" w", 0, 900))),
      /malformed: A word lies inside its segment/,
    ],
    ["{}", /missing required fields/],
  ];
  return Promise.all(
    cases.map(async ([t, pattern]) =>
      assert.match(
        await parse(t),
        new RegExp(`^MEDIA_INVALID: .*${pattern.source}`),
        pattern.source,
      ),
    ),
  ).then(async () => {
    // The language it was asked for, or a refusal.
    assert.match(
      await parse(whisperJson(segment(0, 100, "x")), "en"),
      /^MEDIA_INVALID: The recognizer answered in "ar", not "en"/,
    );
    assert.match(
      await parse("x".repeat(TRANSCRIPTION_LIMITS.outputBytes + 1)),
      /^LIMIT_EXCEEDED/,
    );
    // An empty transcription is no speech, not an error.
    const empty = parseWhisperJson(whisperJson(""), {
      source: sourceOf(2600),
      language: "ar",
      model: MODEL,
    });
    assert.deepEqual(empty.segments, []);
    // A model recognizer must name its weights.
    assert.equal(
      TranscriptSchema.safeParse({
        ...empty,
        recognizer: { ...empty.recognizer, model: null },
      }).success,
      false,
    );
  });
});

test("missing weights and unsupported languages are refused before any work", async () => {
  const c = await workspace();
  assert.equal(WHISPER_LANGUAGES.length, 100);
  for (const language of ["xx", "klingon", "EN", "ar-SA", ""])
    assert.match(
      await failure(() => assertLanguage(language)),
      /^VALIDATION: Transcription does not support the language/,
      language,
    );
  // The command checks the language first, then the source, then says why
  // it cannot run: engines are off and no recognizer ships here.
  assert.match(
    await failure(
      c.call("yamakan.audio.transcribe", {
        projectId: c.projectId,
        assetId: c.speech.id,
        language: "xx",
      }),
    ),
    /^VALIDATION: Transcription does not support the language "xx"/,
  );
  assert.match(
    await failure(
      c.call("yamakan.audio.transcribe", {
        projectId: c.projectId,
        assetId: c.mute.id,
        language: "en",
      }),
    ),
    /^VALIDATION: Only project audio or footage with sound/,
  );
  assert.equal(
    await failure(
      c.call("yamakan.audio.transcribe", {
        projectId: c.projectId,
        assetId: c.speech.id,
        language: "ar",
      }),
    ),
    `CAPABILITY_UNAVAILABLE: ${engineReasonMessage("ENGINE_DISABLED")}`,
  );
  // The stand-in refuses an unsupported language too.
  const pcm = await extractPcm(c.store, c.projectId, c.speech.id);
  try {
    assert.match(
      await failure(standInTranscript(pcm, "xx")),
      /^VALIDATION: Transcription does not support/,
    );
  } finally {
    await releasePcm(pcm);
  }
});

test("rounding-level overruns are clamped, empty segments dropped, and a swallowed segment reported", () => {
  const t = parseWhisperJson(
    whisperJson(
      [
        segment(
          0,
          1000,
          " one",
          [
            // An untimed control token, as whisper.cpp writes most of them.
            `{ "text": "[_BEG_]", "id": 50364, "p": 0.99, "t_dtw": -1 }`,
            token(" one", 0, 1080),
          ].join(","),
        ),
        segment(1000, 1000, " empty"),
        segment(1200, 2000, " two"),
      ].join(","),
    ),
    { source: sourceOf(2600), language: "ar", model: MODEL },
  );
  assert.deepEqual(
    t.segments.map((s) => s.text),
    ["one", "two"],
  );
  assert.deepEqual(
    t.segments[0]!.words.map((w) => [w.text, w.startTicks, w.endTicks]),
    [["one", 0, 1000 * MS]],
  );
  // A probability outside 0..1 is refused, not clamped.
  assert.throws(
    () =>
      parseWhisperJson(
        whisperJson(segment(0, 100, "x", token(" x", 0, 100, 1.5))),
        {
          source: sourceOf(2600),
          language: "ar",
          model: MODEL,
        },
      ),
    /probability outside 0 to 1/,
  );
  // A segment inside an earlier one at millisecond precision is reported.
  const inner = TranscriptSchema.parse({
    ...t,
    segments: [
      { startTicks: 0, endTicks: 1000 * MS, text: "outer", words: [] },
      { startTicks: 100 * MS, endTicks: 900 * MS, text: "inner", words: [] },
    ],
  });
  const p = captionProposal(inner, { name: "Draft" });
  assert.equal(p.document.cues.length, 1);
  assert.deepEqual(p.dropped, [{ segment: 2, text: "inner" }]);
});

test("a crash's old folder is swept; a folder still held is not", async () => {
  const c = await workspace();
  const held = await extractPcm(c.store, c.projectId, c.speech.id);
  const cache = path.dirname(held.dir);
  const stale = path.join(cache, "crashed.partial");
  await mkdir(stale);
  const old = new Date(
    Date.now() - 3 * TRANSCRIPTION_LIMITS.wallSeconds * 1000,
  );
  await utimes(stale, old, old);
  await utimes(held.dir, old, old);
  const next = await extractPcm(c.store, c.projectId, c.speech.id);
  try {
    await assert.rejects(access(stale));
    await access(held.file);
  } finally {
    await releasePcm(held);
    await releasePcm(next);
  }
});
