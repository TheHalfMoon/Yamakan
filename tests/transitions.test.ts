// YU-021: one frame-exact dissolve between adjacent clips. The export and
// the reference preview draw the same frames (golden colours at the cut's
// boundaries), the equal-power sound crossfade keeps the level and the
// audio's length, clip times never change, and a transition persists,
// undoes, redoes and reopens. Missing handles, locked tracks, odd or too
// long durations, gaps, titles, retimed or animated clips and edits that
// would break a transition are refused.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import { compilePlan, withMeasuredLoudnorm } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import {
  fromEditView,
  inspectFormat,
  parseCanonical,
  serializeCanonical,
} from "../core/canonical.ts";
import { fromOtio, otioJson } from "../core/interchange/otio.ts";
import { previewParity } from "../core/render/parity.ts";
import { operationsBetween } from "../src/edit-diff.ts";
import type { Project } from "../core/project.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  await closePreviews();
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});
const FRAME = 23_520_000; // flicks per 30 fps frame
const W = 1280; // the default 1280x720 output
const id = () => crypto.randomUUID();
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
  );

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-transitions-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Transitions" })
  ).result as Project;
  // Three seconds of red with a 440 Hz tone, and of blue with 880 Hz.
  const media: Record<string, Project["assets"][number]> = {};
  for (const [name, colour, hz] of [
    ["red", "red", 440],
    ["blue", "blue", 880],
  ] as const) {
    const file = path.join(root, `${name}.mp4`);
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      `color=c=${colour}:s=320x180:r=30:d=3`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${hz}:sample_rate=48000:duration=3`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "pcm_s16le",
      "-shortest",
      file.replace(".mp4", ".mov"),
    ]);
    media[name] = (
      await store.importAsset(
        project.id,
        `${name}.mov`,
        await readFile(file.replace(".mp4", ".mov")),
      )
    ).asset;
  }
  const head = await store.load(project.id);
  const track = head.tracks.find((t) => t.kind === "video")!;
  const a = id(),
    b = id();
  // A: red 0–1 s from the source's start; B: blue 1–2 s from 1 s in.
  await execute(browser, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: head.revision,
    operations: [
      {
        type: "clip.add",
        clipId: a,
        trackId: track.id,
        assetId: media.red.id,
        title: null,
        startTicks: 0,
        durationTicks: 30 * FRAME,
        sourceStartTicks: 0,
      },
      {
        type: "clip.add",
        clipId: b,
        trackId: track.id,
        assetId: media.blue.id,
        title: null,
        startTicks: 30 * FRAME,
        durationTicks: 30 * FRAME,
        sourceStartTicks: 30 * FRAME,
      },
    ],
  });
  return {
    root,
    store,
    queue,
    browser,
    projectId: project.id,
    a,
    b,
    track: track.id,
    media,
  };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = (c: Ctx) => c.store.load(c.projectId);
const run = async <T = Project>(c: Ctx, operation: string, args: object) =>
  (
    await execute(c.browser, operation, {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      ...args,
    })
  ).result as T;
const batch = (c: Ctx, operations: object[]) =>
  run(c, "yamakan.project.applyBatch", { operations });

// The n-th frame of a rendered file, as RGB.
function frameAt(file: string, n: number): Buffer {
  return ffmpeg([
    "-i",
    file,
    "-vf",
    `select=eq(n\\,${n})`,
    "-fps_mode",
    "passthrough",
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
}
const centre = (frame: Buffer) => {
  const i = (360 * W + 640) * 3;
  return [frame[i]!, frame[i + 1]!, frame[i + 2]!];
};
// Mono 48 kHz samples of a rendered file's sound.
function samples(file: string): Float32Array {
  const raw = ffmpeg([
    "-i",
    file,
    "-map",
    "0:a",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-f",
    "f32le",
    "pipe:1",
  ]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
const rms = (s: Float32Array, from: number, to: number) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += s[i]! * s[i]!;
  return Math.sqrt(sum / (to - from));
};
// The amplitude of one frequency over a span (Goertzel).
const tone = (s: Float32Array, from: number, to: number, hz: number) => {
  const w = (2 * Math.PI * hz) / 48000;
  let re = 0,
    im = 0;
  for (let i = from; i < to; i++) {
    re += s[i]! * Math.cos(w * i);
    im += s[i]! * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / (to - from);
};

async function exported(c: Ctx) {
  const p = await head(c);
  return renderRevision(
    c.store,
    c.projectId,
    p.revision,
    ["exports", `r${p.revision}-${id()}`],
    new AbortController().signal,
    () => {},
  );
}

test("a ten-frame dissolve draws the same golden frames in export and reference preview, and the clips keep their times", async () => {
  const c = await workspace();
  const before = fromEditView(await head(c));
  const set = await run(c, "yamakan.transition.set", {
    clipId: c.b,
    durationFrames: 10,
  });
  const after = fromEditView(set);
  // Clip times, the cut and the timeline's length are unchanged.
  assert.deepEqual(
    after.clips.map((x) => [x.startTicks, x.durationTicks, x.sourceStartTicks]),
    before.clips.map((x) => [
      x.startTicks,
      x.durationTicks,
      x.sourceStartTicks,
    ]),
  );
  assert.equal(after.formatVersion, 7);
  const { output, plan } = await exported(c);
  assert.equal(plan.transitionPolicy, "centeredDissolve/v1");
  assert.equal(plan.durationTicks, 60 * FRAME);
  const layer = (clipId: string) =>
    plan.layers.find((x) => x.clipId === clipId)!;
  assert.deepEqual(
    [layer(c.a).startTicks, layer(c.a).durationTicks],
    [0, 35 * FRAME],
  );
  assert.deepEqual(
    [
      layer(c.b).startTicks,
      layer(c.b).durationTicks,
      layer(c.b).sourceStartTicks,
      layer(c.b).dissolveInTicks,
    ],
    [25 * FRAME, 35 * FRAME, 25 * FRAME, 10 * FRAME],
  );
  // Frames 0–25 are red, frame 25 + k is blue over red at k/10, and from
  // frame 35 on it is blue.
  const expected = (n: number) => {
    const k = Math.min(10, Math.max(0, n - 25)) / 10;
    return [255 * (1 - k), 0, 255 * k];
  };
  const p = await head(c);
  for (const n of [0, 24, 25, 26, 28, 30, 32, 34, 35, 36, 59]) {
    const got = centre(frameAt(output, n));
    const want = expected(n);
    // The dissolve's first frame is exactly A and its last-plus-one
    // exactly B; frames in between are within a few levels of k/D.
    const tolerance = n <= 25 || n >= 35 ? 4 : 14;
    for (let ch = 0; ch < 3; ch += 2)
      assert.ok(
        Math.abs(got[ch]! - want[ch]!) <= tolerance,
        `frame ${n}: ${got} vs ${want}`,
      );
    // The reference preview is drawn by the same compiler.
    const shown = centre(
      ffmpeg([
        "-i",
        (await preview(c.store, c.projectId, p.revision, "frame", n)).file,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ]),
    );
    for (let ch = 0; ch < 3; ch++)
      assert.ok(
        Math.abs(shown[ch]! - got[ch]!) <= 6,
        `preview frame ${n}: ${shown} vs export ${got}`,
      );
  }
  // The canvas preview says it shows the dissolve as a cut.
  assert.deepEqual(
    previewParity(p).approximations.find((x) => x.kind === "transition"),
    { kind: "transition", clipIds: [c.b] },
  );
});

test("the equal-power crossfade keeps the level and the sound's length; a sound cut does not crossfade", async () => {
  const c = await workspace();
  await run(c, "yamakan.transition.set", {
    clipId: c.b,
    durationFrames: 20,
    audio: "equalPower",
  });
  const mixed = samples((await exported(c)).output);
  // Two seconds of sound, as long as the timeline (within one AAC frame).
  assert.ok(Math.abs(mixed.length - 96_000) <= 1024, `${mixed.length}`);
  const at = (frame: number) => Math.round((frame / 30) * 48000);
  // Steady before, through and after the 20-frame crossfade (20–40).
  const level = rms(mixed, at(5), at(15));
  for (const [from, to] of [
    [20, 24],
    [24, 28],
    [28, 32],
    [32, 36],
    [36, 40],
    [45, 55],
  ])
    assert.ok(
      Math.abs(20 * Math.log10(rms(mixed, at(from), at(to)) / level)) < 1.5,
      `level at frames ${from}-${to}`,
    );
  // Both tones sound in the crossfade's middle; before the cut, only A's.
  const alone = tone(mixed, at(5), at(15), 440);
  assert.ok(tone(mixed, at(28), at(32), 880) > 0.5 * alone);
  assert.ok(tone(mixed, at(28), at(32), 440) > 0.5 * alone);

  await run(c, "yamakan.transition.set", {
    clipId: c.b,
    durationFrames: 20,
    audio: "cut",
  });
  const cut = samples((await exported(c)).output);
  assert.ok(tone(cut, at(22), at(29), 880) < 0.05 * alone);
  assert.ok(tone(cut, at(31), at(38), 440) < 0.05 * alone);
});

test("a transition persists, undoes, redoes and reopens; a project without one keeps its version and plan", async () => {
  const c = await workspace();
  const plain = await head(c);
  const fonts = await titleFonts();
  const hash = "0".repeat(64);
  const plainPlan = compilePlan(fromEditView(plain), hash, fonts).plan;
  assert.equal(fromEditView(plain).formatVersion, 4);
  assert.equal("transitionPolicy" in plainPlan, false);
  assert.equal(
    plainPlan.layers.some((x) => "dissolveInTicks" in x),
    false,
  );
  const set = await run(c, "yamakan.transition.set", {
    clipId: c.b,
    durationFrames: 6,
  });
  const stored = fromEditView(set).clips.find((x) => x.id === c.b)!.transition;
  assert.deepEqual(stored, {
    kind: "dissolve",
    fromClipId: c.a,
    durationTicks: 6 * FRAME,
    audio: "equalPower",
  });
  // Canonical bytes round-trip; a newer version than this build is refused.
  const bytes = serializeCanonical(fromEditView(set));
  assert.deepEqual(parseCanonical(JSON.parse(bytes)), fromEditView(set));
  assert.equal(
    inspectFormat({ format: "yamakan.project", formatVersion: 7 }).supported,
    true,
  );
  assert.equal(
    inspectFormat({ format: "yamakan.project", formatVersion: 8 }).supported,
    false,
  );
  const undone = await run(c, "yamakan.project.undo", {});
  assert.equal(undone.clips.find((x) => x.id === c.b)!.transition, undefined);
  const redone = await run(c, "yamakan.project.redo", {});
  assert.deepEqual(redone.clips.find((x) => x.id === c.b)!.transition, {
    kind: "dissolve",
    fromClipId: c.a,
    durationFrames: 6,
    audio: "equalPower",
  });
  await c.queue.close();
  c.store.close();
  const reopened = new ProjectStore(c.root);
  handles.push(reopened);
  await reopened.initialize();
  const back = await reopened.load(c.projectId);
  assert.deepEqual(back.clips, redone.clips);
  // The editor's diff carries the transition both ways.
  const removed = structuredClone(back);
  delete removed.clips.find((x) => x.id === c.b)!.transition;
  assert.deepEqual(operationsBetween(back, removed), [
    { type: "clip.setTransition", clipId: c.b, transition: null },
  ]);
  assert.deepEqual(operationsBetween(removed, back), [
    {
      type: "clip.setTransition",
      clipId: c.b,
      transition: {
        kind: "dissolve",
        fromClipId: c.a,
        durationTicks: 6 * FRAME,
        audio: "equalPower",
      },
    },
  ]);
  // OTIO keeps it as Yamakan metadata.
  const otio = fromOtio(
    otioJson(fromEditView(back)),
    fromEditView(back).assets,
  );
  assert.deepEqual(
    otio.clips.find((x) => x.startTicks === 30 * FRAME)?.transition,
    stored,
  );
});

test("missing handles, locked tracks, odd or too long durations, gaps, titles, retimed and animated clips are refused", async () => {
  const c = await workspace();
  const set = (args: object) =>
    failure(run(c, "yamakan.transition.set", { clipId: c.b, ...args }));
  assert.match(await set({ durationFrames: 7 }), /even number of frames/);
  assert.match(await set({ durationFrames: 62 }), /^VALIDATION/);
  // Zero or negative durations never reach the timeline.
  assert.match(await set({ durationFrames: 0 }), /^VALIDATION/);
  assert.match(await set({ durationFrames: -4 }), /^VALIDATION/);
  // B starts its source at 1 s: a dissolve longer than 2 s of handle is
  // beyond the clip, and an in-point at 0 leaves no handle.
  await batch(c, [{ type: "clip.trim", clipId: c.b, startTicks: 30 * FRAME }]);
  const p = fromEditView(await head(c));
  const bClip = p.clips.find((x) => x.id === c.b)!;
  await batch(c, [
    { type: "clip.remove", clipId: c.b },
    {
      type: "clip.add",
      clipId: c.b,
      trackId: c.track,
      assetId: c.media.blue.id,
      title: null,
      startTicks: bClip.startTicks,
      durationTicks: bClip.durationTicks,
      sourceStartTicks: 0,
    },
  ]);
  assert.match(
    await set({ durationFrames: 10 }),
    /incoming clip has too little source media/,
  );
  // The outgoing clip ending at its source's end has no handle either.
  await batch(c, [
    { type: "clip.remove", clipId: c.a },
    {
      type: "clip.add",
      clipId: c.a,
      trackId: c.track,
      assetId: c.media.red.id,
      title: null,
      startTicks: 0,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 60 * FRAME,
    },
    { type: "clip.remove", clipId: c.b },
    {
      type: "clip.add",
      clipId: c.b,
      trackId: c.track,
      assetId: c.media.blue.id,
      title: null,
      startTicks: 30 * FRAME,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 30 * FRAME,
    },
  ]);
  assert.match(
    await set({ durationFrames: 10 }),
    /outgoing clip has too little source media/,
  );
  await batch(c, [
    { type: "clip.remove", clipId: c.a },
    {
      type: "clip.add",
      clipId: c.a,
      trackId: c.track,
      assetId: c.media.red.id,
      title: null,
      startTicks: 0,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 0,
    },
  ]);
  // Longer than a clip.
  await batch(c, [{ type: "clip.trim", clipId: c.b, endTicks: 38 * FRAME }]);
  assert.match(
    await set({ durationFrames: 10 }),
    /longer than a clip it joins/,
  );
  await batch(c, [{ type: "clip.trim", clipId: c.b, endTicks: 60 * FRAME }]);
  // A gap before the clip: no adjacency.
  await batch(c, [{ type: "clip.trim", clipId: c.a, endTicks: 29 * FRAME }]);
  assert.match(
    await set({ durationFrames: 10 }),
    /start where (the previous|its outgoing) clip/,
  );
  await batch(c, [{ type: "clip.trim", clipId: c.a, endTicks: 30 * FRAME }]);
  // Retimed and animated clips.
  await batch(c, [
    { type: "clip.setSpeed", clipId: c.a, speed: { num: 1, den: 2 } },
  ]);
  assert.match(await set({ durationFrames: 10 }), /normal speed/);
  await batch(c, [
    { type: "clip.setSpeed", clipId: c.a, speed: { num: 1, den: 1 } },
    {
      type: "clip.upsertAnimationKeyframe",
      clipId: c.b,
      channel: "opacity",
      timeTicks: 0,
      value: 0.5,
    },
  ]);
  assert.match(await set({ durationFrames: 10 }), /without animation/);
  await batch(c, [{ type: "clip.setAnimation", clipId: c.b, animation: null }]);
  // A sound fade at the cut, for an equal-power crossfade only.
  await batch(c, [
    { type: "clip.setSound", clipId: c.a, fadeOutTicks: 5 * FRAME },
  ]);
  assert.match(await set({ durationFrames: 10 }), /sound fade at the cut/);
  assert.equal(await set({ durationFrames: 10, audio: "cut" }), "ok");
  await run(c, "yamakan.transition.remove", { clipId: c.b });
  await batch(c, [{ type: "clip.setSound", clipId: c.a, fadeOutTicks: 0 }]);
  // A title on either side.
  const title = id();
  await batch(c, [
    {
      type: "clip.add",
      clipId: title,
      trackId: c.track,
      assetId: null,
      title: "End",
      startTicks: 60 * FRAME,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 0,
    },
  ]);
  assert.match(
    await failure(
      run(c, "yamakan.transition.set", { clipId: title, durationFrames: 10 }),
    ),
    /not titles/,
  );
  // A locked track.
  await batch(c, [{ type: "track.update", trackId: c.track, locked: true }]);
  assert.match(await set({ durationFrames: 10 }), /locked/);
  await batch(c, [{ type: "track.update", trackId: c.track, locked: false }]);
  // Unknown clip.
  assert.match(
    await failure(
      run(c, "yamakan.transition.set", { clipId: id(), durationFrames: 10 }),
    ),
    /not found/i,
  );
});

test("edits that would break a transition are refused; a split keeps it on the first part only; the switch refuses new ones", async () => {
  const c = await workspace();
  await run(c, "yamakan.transition.set", { clipId: c.b, durationFrames: 10 });
  // Moving or trimming either side away from the cut is refused, naming it.
  assert.match(
    await failure(
      batch(c, [{ type: "clip.move", clipId: c.b, startTicks: 40 * FRAME }]),
    ),
    /start where (the previous|its outgoing) clip/,
  );
  assert.match(
    await failure(
      batch(c, [{ type: "clip.trim", clipId: c.a, endTicks: 28 * FRAME }]),
    ),
    /start where (the previous|its outgoing) clip/,
  );
  // Overlapping transitions on one clip.
  const third = id();
  await batch(c, [
    {
      type: "clip.add",
      clipId: third,
      trackId: c.track,
      assetId: c.media.red.id,
      title: null,
      startTicks: 60 * FRAME,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 30 * FRAME,
    },
  ]);
  assert.match(
    await failure(
      run(c, "yamakan.transition.set", { clipId: third, durationFrames: 52 }),
    ),
    /longer than a clip it joins|cannot overlap/,
  );
  assert.equal(
    await failure(
      run(c, "yamakan.transition.set", { clipId: third, durationFrames: 10 }),
    ),
    "ok",
  );
  // Splitting B: its dissolve stays at its start, the new cut is a cut.
  const second = id();
  const split = await batch(c, [
    { type: "clip.split", clipId: c.b, atTicks: 45 * FRAME, newClipId: second },
  ]);
  assert.ok(split.clips.find((x) => x.id === c.b)!.transition);
  assert.equal(split.clips.find((x) => x.id === second)!.transition, undefined);
  // The switch refuses a new transition, not a removal.
  process.env.YAMAKAN_TRANSITIONS_OFF = "1";
  try {
    assert.match(
      await failure(
        run(c, "yamakan.transition.set", { clipId: second, durationFrames: 4 }),
      ),
      /^CAPABILITY_UNAVAILABLE/,
    );
    const p = await head(c);
    const saved = structuredClone(p);
    saved.clips.find((x) => x.id === second)!.transition = {
      kind: "dissolve",
      fromClipId: c.b,
      durationFrames: 4,
      audio: "cut",
    };
    assert.match(
      await failure(
        execute(c.browser, "yamakan.project.save", {
          expectedRevision: p.revision,
          project: saved,
        }),
      ),
      /^CAPABILITY_UNAVAILABLE/,
    );
    await run(c, "yamakan.transition.remove", { clipId: c.b });
  } finally {
    delete process.env.YAMAKAN_TRANSITIONS_OFF;
  }
  assert.equal(
    (await head(c)).clips.find((x) => x.id === c.b)!.transition,
    undefined,
  );
});

test("a dissolve at 24000/1001 counts in that rate's frames", async () => {
  const c = await workspace();
  const p = fromEditView(await head(c));
  const rate = { num: 24000, den: 1001 };
  const f = (n: number) => Math.round((n * 705_600_000 * 1001) / 24000);
  const at24 = structuredClone(p);
  at24.output.fps = rate;
  // Whole frames at 23.976: 24 frames per clip.
  for (const [i, x] of at24.clips.entries()) {
    x.startTicks = f(24 * i);
    x.durationTicks = f(24);
    x.sourceStartTicks = i ? f(24) : 0;
  }
  for (const a of at24.assets) a.durationTicks = f(71);
  at24.clips[1]!.transition = {
    kind: "dissolve",
    fromClipId: at24.clips[0]!.id,
    durationTicks: f(12),
    audio: "equalPower",
  };
  const plan = compilePlan(at24, "0".repeat(64), await titleFonts()).plan;
  const layer = plan.layers.find((x) => x.clipId === at24.clips[1]!.id)!;
  assert.equal(layer.startTicks, f(18));
  assert.equal(layer.dissolveInTicks, f(12));
  // 50 frames (more than two seconds) is refused at this rate.
  const long = structuredClone(at24);
  long.clips[1]!.transition!.durationTicks = f(50);
  assert.throws(() => parseCanonical(JSON.parse(serializeCanonical(long))));
});

test("a transition stays bound to its outgoing clip: ripple and insert never re-target it, and splitting the outgoing clip follows it", async () => {
  const c = await workspace();
  const third = id();
  await batch(c, [
    {
      type: "clip.add",
      clipId: third,
      trackId: c.track,
      assetId: c.media.red.id,
      title: null,
      startTicks: 60 * FRAME,
      durationTicks: 30 * FRAME,
      sourceStartTicks: 30 * FRAME,
    },
  ]);
  await run(c, "yamakan.transition.set", { clipId: third, durationFrames: 10 });
  // Ripple-deleting B would pull the third clip against A: refused.
  assert.match(
    await failure(batch(c, [{ type: "timeline.rippleDelete", clipId: c.b }])),
    /outgoing clip ends/,
  );
  // Splitting B (the outgoing clip) moves the dissolve's source to B's
  // second part, which now ends at the cut.
  const tail = id();
  const split = await batch(c, [
    { type: "clip.split", clipId: c.b, atTicks: 45 * FRAME, newClipId: tail },
  ]);
  assert.equal(
    split.clips.find((x) => x.id === third)!.transition?.fromClipId,
    tail,
  );
  // With the switch off, a batch may restate an unchanged transition (an
  // editor save that recreates a clip) but not change one.
  const kept = fromEditView(split).clips.find(
    (x) => x.id === third,
  )!.transition!;
  process.env.YAMAKAN_TRANSITIONS_OFF = "1";
  try {
    assert.equal(
      await failure(
        batch(c, [
          { type: "clip.setTransition", clipId: third, transition: kept },
        ]),
      ),
      "ok",
    );
    assert.match(
      await failure(
        batch(c, [
          {
            type: "clip.setTransition",
            clipId: third,
            transition: { ...kept, audio: "cut" },
          },
        ]),
      ),
      /^CAPABILITY_UNAVAILABLE/,
    );
  } finally {
    delete process.env.YAMAKAN_TRANSITIONS_OFF;
  }
});

test("a loudness-normalised plan keeps the transition policy", async () => {
  const c = await workspace();
  const p = await run(c, "yamakan.transition.set", {
    clipId: c.b,
    durationFrames: 10,
  });
  const { plan } = compilePlan(
    fromEditView(p),
    "0".repeat(64),
    await titleFonts(),
    {
      normalizeLoudness: true,
    },
  );
  assert.ok(plan.loudnorm);
  const measured = withMeasuredLoudnorm(plan, {
    inputI: -20,
    inputTp: -3,
    inputLra: 4,
    inputThresh: -30,
    targetOffset: 0,
  } as never);
  assert.equal(measured.transitionPolicy, "centeredDissolve/v1");
  assert.notEqual(measured.planHash, plan.planHash);
});

test("at 24000/1001 a dissolve from footage into a still renders frame-exact with the sound's full length", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-transitions-24-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", {
      name: "Film rate",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result as Project;
  const film = path.join(root, "red.mov");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=320x180:r=24000/1001:d=3",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000:duration=3",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "pcm_s16le",
    "-shortest",
    film,
  ]);
  const still = path.join(root, "blue.png");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=320x180",
    "-frames:v",
    "1",
    still,
  ]);
  const red = (
    await store.importAsset(project.id, "red.mov", await readFile(film))
  ).asset;
  const blue = (
    await store.importAsset(project.id, "blue.png", await readFile(still))
  ).asset;
  const F = 29_429_400; // flicks per 24000/1001 frame
  const h = await store.load(project.id);
  const track = h.tracks.find((t) => t.kind === "video")!.id;
  const a = id(),
    b = id();
  await execute(browser, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: h.revision,
    operations: [
      {
        type: "clip.add",
        clipId: a,
        trackId: track,
        assetId: red.id,
        title: null,
        startTicks: 0,
        durationTicks: 24 * F,
        sourceStartTicks: 0,
      },
      {
        type: "clip.add",
        clipId: b,
        trackId: track,
        assetId: blue.id,
        title: null,
        startTicks: 24 * F,
        durationTicks: 24 * F,
        sourceStartTicks: 0,
      },
    ],
  });
  const set = (
    await execute(browser, "yamakan.transition.set", {
      projectId: project.id,
      expectedRevision: (await store.load(project.id)).revision,
      clipId: b,
      durationFrames: 12,
    })
  ).result as Project;
  const out = await renderRevision(
    store,
    project.id,
    set.revision,
    ["exports", "film"],
    new AbortController().signal,
    () => {},
  );
  // The dissolve runs over frames 18–30: 18 is red, 24 halfway, 30 blue.
  const [r18, , b18] = centre(frameAt(out.output, 18));
  const [r24, , b24] = centre(frameAt(out.output, 24));
  const [r30, , b30] = centre(frameAt(out.output, 30));
  assert.ok(r18! > 245 && b18! < 10, `frame 18: ${r18},${b18}`);
  assert.ok(
    Math.abs(r24! - 128) < 20 && Math.abs(b24! - 128) < 20,
    `frame 24: ${r24},${b24}`,
  );
  assert.ok(r30! < 10 && b30! > 245, `frame 30: ${r30},${b30}`);
  // The still has no sound: A's sound plays on for half the dissolve and
  // fades out there, so it lasts exactly 30 frames at 24000/1001.
  const sound = samples(out.output);
  const expected = Math.round((30 * 1001 * 48000) / 24000);
  assert.ok(
    Math.abs(sound.length - expected) <= 1024,
    `${sound.length} vs ${expected}`,
  );
});
