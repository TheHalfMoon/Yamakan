// YU-019: rational project frame rates. 30 fps projects keep their view and
// bytes exactly; 24000/1001 projects edit, round-trip, import and render in
// their own frames, with BigInt rational time and no silent rounding.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EDIT_RATE_23976,
  EDIT_RATE_30,
  ProjectSchema,
  createProject,
  frameRateOf,
  type Project,
} from "../core/project.ts";
import {
  fromEditView,
  serializeCanonical,
  toEditView,
} from "../core/canonical.ts";
import { compilePlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import {
  decimalSecondsToTicks,
  durationFramesAt,
  probe,
} from "../core/media.ts";
import { setClipSound } from "../src/edit-ops.ts";
import {
  FLICKS_PER_SECOND,
  framesToTicks,
  ticksToFrames,
} from "../core/time.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { renderRevision } from "../core/render.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { CommandError, toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";

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
const FRAME_23976 = 29_429_400; // 705,600,000 × 1001 / 24000
const HASH = "a".repeat(64);
const id = () => crypto.randomUUID();

// A 23.976 project with one video clip and a title, in its own frames.
function project23976(
  frames = { start: 24, duration: 48, source: 12 },
): Project {
  const p = createProject("NTSC film", EDIT_RATE_23976);
  const video = {
    id: id(),
    name: "v.mp4",
    kind: "video" as const,
    hash: HASH,
    extension: "mp4" as const,
    bytes: 10,
    durationFrames: 240,
    width: 1280,
    height: 720,
    hasAudio: false,
  };
  return ProjectSchema.parse({
    ...p,
    assets: [video],
    clips: [
      {
        id: id(),
        trackId: p.tracks[0].id,
        assetId: video.id,
        startFrame: frames.start,
        durationFrames: frames.duration,
        sourceFrame: frames.source,
        title: null,
      },
      {
        id: id(),
        trackId: p.tracks[0].id,
        assetId: null,
        startFrame: 0,
        durationFrames: 24,
        sourceFrame: 0,
        title: "Opening",
      },
    ],
  });
}

test("30 fps projects keep the schema 2 view and their canonical bytes exactly", () => {
  const p = createProject("Thirty");
  assert.equal(p.schemaVersion, 2);
  assert.equal(p.fps, 30);
  assert.equal("frameRate" in p, false);
  const canonical = fromEditView(p);
  assert.deepEqual(canonical.output.fps, { num: 30, den: 1 });
  // Round trip: the same view and the same bytes.
  assert.deepEqual(toEditView(canonical), p);
  assert.equal(
    serializeCanonical(fromEditView(toEditView(canonical))),
    serializeCanonical(canonical),
  );
  assert.deepEqual(frameRateOf(p), EDIT_RATE_30);
});

test("a 24000/1001 project uses schema 3 and round-trips frame for frame", () => {
  const p = project23976();
  assert.equal(p.schemaVersion, 3);
  assert.deepEqual(p.frameRate, { num: 24000, den: 1001 });
  const canonical = fromEditView(p);
  assert.deepEqual(canonical.output.fps, { num: 24000, den: 1001 });
  const clip = canonical.clips.find((c) => c.title === null)!;
  assert.equal(clip.startTicks, 24 * FRAME_23976);
  assert.equal(clip.durationTicks, 48 * FRAME_23976);
  assert.equal(clip.sourceStartTicks, 12 * FRAME_23976);
  assert.equal(canonical.assets[0].durationTicks, 240 * FRAME_23976);
  // The view the service returns (video clips carry their sound switch)
  // round-trips exactly, and keeps every frame of the original.
  const view = toEditView(canonical);
  assert.deepEqual(toEditView(fromEditView(view)), view);
  for (const c of p.clips) {
    const back = view.clips.find((x) => x.id === c.id)!;
    assert.deepEqual(
      [back.startFrame, back.durationFrames, back.sourceFrame],
      [c.startFrame, c.durationFrames, c.title === null ? c.sourceFrame : 0],
    );
  }
});

test("boundary frames at long timestamps round-trip; ten minutes is the limit at any rate", () => {
  // The last frames before ten minutes at 23.976: frame 14385 starts at
  // 599.97 s; one more frame passes 600 s.
  const last = 14385;
  assert.ok(framesToTicks(last, EDIT_RATE_23976) < 600 * FLICKS_PER_SECOND);
  assert.ok(framesToTicks(last + 1, EDIT_RATE_23976) > 600 * FLICKS_PER_SECOND);
  const p = createProject("Long", EDIT_RATE_23976);
  const audio = {
    id: id(),
    name: "a.wav",
    kind: "audio" as const,
    hash: HASH,
    extension: "wav" as const,
    bytes: 10,
    durationFrames: last,
    width: 0,
    height: 0,
    hasAudio: true,
  };
  const at = (start: number, duration: number) =>
    ProjectSchema.safeParse({
      ...p,
      assets: [audio],
      clips: [
        {
          id: id(),
          trackId: p.tracks[1].id,
          assetId: audio.id,
          startFrame: start,
          durationFrames: duration,
          sourceFrame: 0,
          title: null,
        },
      ],
    });
  const fits = at(1, last - 1);
  assert.equal(fits.success, true);
  const canonical = fromEditView(fits.data!);
  assert.equal(
    canonical.clips[0].startTicks + canonical.clips[0].durationTicks,
    last * FRAME_23976,
  );
  assert.deepEqual(toEditView(canonical).clips[0], fits.data!.clips[0]);
  assert.equal(at(2, last).success, false, "past ten minutes");
});

test("unsupported rates, mixed fields and lossy views are refused, never rounded", () => {
  const p = project23976();
  for (const bad of [
    { ...p, frameRate: { num: 25, den: 1 } },
    { ...p, frameRate: { num: 30, den: 1 } },
    { ...p, frameRate: { num: 48000, den: 2002 } },
    { ...p, frameRate: { num: 24000, den: 1001 }, fps: 30 },
    { ...p, schemaVersion: 2 },
    { ...createProject("x"), frameRate: { num: 24000, den: 1001 } },
    { ...p, frameRate: { num: Number.MAX_SAFE_INTEGER + 1, den: 1 } },
  ])
    assert.equal(
      ProjectSchema.safeParse(bad).success,
      false,
      JSON.stringify(bad.frameRate),
    );
  // A canonical project at a rate the editor is not qualified for.
  const canonical = fromEditView(p);
  assert.throws(
    () =>
      toEditView({
        ...canonical,
        output: { ...canonical.output, fps: { num: 25, den: 1 } },
      }),
    (e: unknown) =>
      e instanceof CommandError && e.code === "CAPABILITY_UNAVAILABLE",
  );
  // A time off the 23.976 frame grid: one tick after the title ends (24
  // frames), clear of it.
  const off = {
    ...canonical,
    clips: canonical.clips.map((c) =>
      c.title === null ? { ...c, startTicks: 24 * FRAME_23976 + 1 } : c,
    ),
  };
  assert.throws(
    () => toEditView(off),
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === "CAPABILITY_UNAVAILABLE" &&
      /not frame-aligned at 24000\/1001 fps/.test(e.message),
  );
});

test("durations are exact: decimal seconds become ticks with BigInt, not floating products", () => {
  // 4.004 s and 2.1 s exactly (a floating product is off by a fraction).
  assert.equal(decimalSecondsToTicks("4.004"), 2_825_222_400);
  assert.equal(decimalSecondsToTicks("2.100000"), 1_481_760_000);
  // Floating point would land 2.1 × 30 just below 63; the exact value is 63.
  assert.equal(
    ticksToFrames(decimalSecondsToTicks("2.1"), EDIT_RATE_30, "floor"),
    63,
  );
  assert.equal(decimalSecondsToTicks("1e9"), 0);
  assert.equal(decimalSecondsToTicks("-1"), 0);
  assert.equal(decimalSecondsToTicks("N/A"), 0);
});

test("the plan's timing at 23.976 matches rational goldens (video, title cue, total)", async () => {
  const p = project23976({ start: 24, duration: 48, source: 12 });
  const { plan } = compilePlan(fromEditView(p), HASH, await titleFonts());
  assert.deepEqual(plan.profile.fps, { num: 24000, den: 1001 });
  const layer = plan.layers[0];
  assert.equal(layer.startTicks, 24 * FRAME_23976);
  assert.equal(layer.durationTicks, 48 * FRAME_23976);
  assert.equal(layer.sourceStartTicks, 12 * FRAME_23976);
  const cue = plan.titles!.cues[0];
  assert.equal(cue.startTicks, 0);
  assert.equal(cue.endTicks, 24 * FRAME_23976);
  assert.equal(plan.durationTicks, 72 * FRAME_23976);
});

test("a 23.976 project is created, imports 23.976 footage in its own frames, and exports at its rate", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-ntsc-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: { id: "local-client" as const, scopes: new Set(Scopes) },
  };
  // The command takes the rate; an unqualified one is refused.
  await assert.rejects(
    execute(ctx, "yamakan.project.create", {
      name: "PAL",
      frameRate: { num: 25, den: 1 },
    }),
    (e: unknown) =>
      e instanceof Error && toCommandError(e).code === "VALIDATION",
  );
  const thirty = (
    await execute(ctx, "yamakan.project.create", { name: "Thirty" })
  ).result as Project;
  assert.equal(thirty.schemaVersion, 2);
  const created = (
    await execute(ctx, "yamakan.project.create", {
      name: "NTSC",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result as Project;
  assert.equal(created.schemaVersion, 3);
  // 4.004 s of 24000/1001 footage with a tone: 96 frames.
  const source = path.join(root, "ntsc.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=640x360:rate=24000/1001:duration=4.004",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4.004",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      source,
    ],
    { windowsHide: true },
  );
  const probed = await probe(source);
  const { asset } = await store.importAsset(
    created.id,
    "ntsc.mp4",
    await readFile(source),
  );
  assert.equal(
    asset.durationFrames,
    ticksToFrames(probed.durationTicks, EDIT_RATE_23976, "floor"),
    "frames at the project's rate",
  );
  assert.ok(
    asset.durationFrames >= 95 && asset.durationFrames <= 97,
    String(asset.durationFrames),
  );
  // Mixed source rates: 2 s of 30 fps footage counts 47 frames of the
  // 23.976 project (floor of 2 × 24000/1001 = 47.95).
  const thirtyFps = path.join(root, "thirty.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=640x360:rate=30:duration=2",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      thirtyFps,
    ],
    { windowsHide: true },
  );
  const mixed = await store.importAsset(
    created.id,
    "thirty.mp4",
    await readFile(thirtyFps),
  );
  assert.equal(mixed.asset.durationFrames, 47);
  const track = mixed.project.tracks.find((t) => t.kind === "video")!;
  const saved = await store.save(
    {
      ...mixed.project,
      clips: [
        {
          id: id(),
          trackId: track.id,
          assetId: asset.id,
          startFrame: 0,
          durationFrames: 48,
          sourceFrame: 24,
          title: null,
          sound: { enabled: true },
        },
      ],
    },
    mixed.project.revision,
  );
  assert.equal(saved.schemaVersion, 3);
  const exported = await renderRevision(
    store,
    saved.id,
    saved.revision,
    ["exports", "ntsc"],
    new AbortController().signal,
    () => {},
  );
  const out = JSON.parse(
    execFileSync(
      mediaTools().ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-count_frames",
        "-show_entries",
        "stream=r_frame_rate,nb_read_frames",
        "-of",
        "json",
        exported.output,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  ).streams[0];
  assert.equal(out.r_frame_rate, "24000/1001");
  assert.equal(Number(out.nb_read_frames), 48, "two seconds of 23.976 frames");
  assert.equal(exported.receipt.hasAudio, true);
  // Reopened: the same rate and the same frames.
  const reopened = await store.load(saved.id);
  assert.deepEqual(reopened.frameRate, { num: 24000, den: 1001 });
  assert.equal(reopened.clips[0].sourceFrame, 24);
  await queue.close();
});

test("hostile frame counts are refused by validation, never thrown past it", () => {
  for (const startFrame of [1e15, 1e300, 18_001, 1.5, -1]) {
    const p = project23976() as any;
    p.clips[0].startFrame = startFrame;
    const parsed = ProjectSchema.safeParse(p);
    assert.equal(parsed.success, false, String(startFrame));
  }
});

test("a save cannot change the project's frame rate", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-rate-save-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  for (const [from, to] of [
    [EDIT_RATE_23976, EDIT_RATE_30],
    [EDIT_RATE_30, EDIT_RATE_23976],
  ] as const) {
    const created = await store.create("Rate", undefined, from);
    const head = await store.load(created.id);
    const { fps: _fps, frameRate: _rate, ...rest } = head as any;
    const swapped =
      to === EDIT_RATE_30
        ? { ...rest, schemaVersion: 2, fps: 30 }
        : { ...rest, schemaVersion: 3, frameRate: to };
    await assert.rejects(
      store.save(swapped, head.revision),
      (e: unknown) =>
        e instanceof CommandError &&
        e.code === "VALIDATION" &&
        /frame rate cannot change/.test(e.message),
    );
    assert.deepEqual(frameRateOf(await store.load(created.id)), from);
  }
});

test("on-grid durations keep their last frame despite ffprobe's six decimals", () => {
  // 100 frames at 24000/1001 is 4.1708333… s, printed 4.170833.
  assert.equal(
    durationFramesAt(decimalSecondsToTicks("4.170833"), EDIT_RATE_23976),
    100,
  );
  // 100 frames at 30 fps prints 3.333333.
  assert.equal(
    durationFramesAt(decimalSecondsToTicks("3.333333"), EDIT_RATE_30),
    100,
  );
  // Still floored: a partial final frame is not counted.
  assert.equal(
    durationFramesAt(decimalSecondsToTicks("4.16"), EDIT_RATE_23976),
    99,
  );
  assert.equal(
    durationFramesAt(decimalSecondsToTicks("600.000000"), EDIT_RATE_30),
    18_000,
  );
});

test("clip fades from the editor are counted in the project's frames", () => {
  const p = project23976();
  const clip = p.clips.find((c) => c.assetId !== null)!;
  const next = setClipSound(p, clip.id, { fadeInFrames: 5, fadeOutFrames: 7 });
  const sound = next.clips.find((c) => c.id === clip.id)!.sound!;
  assert.deepEqual([sound.fadeInFrames, sound.fadeOutFrames], [5, 7]);
  assert.equal(
    fromEditView(next).clips.find((c) => c.id === clip.id)!.sound!.fadeInTicks,
    5 * FRAME_23976,
  );
});
