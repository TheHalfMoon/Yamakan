// M3 / Q4: OpenCut ripple delete, trim and insert on flick ticks.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CanonicalProjectSchema,
  FORMAT,
  FORMAT_VERSION,
  type CanonicalProject,
} from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { framesToTicks, rational } from "../core/time.ts";
import { CommandError } from "../core/command/errors.ts";

const F30 = framesToTicks(1, rational(30, 1));
const fpsRates = [
  rational(24000, 1001),
  rational(25, 1),
  rational(30000, 1001),
  rational(60, 1),
] as const;

const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

function baseProject(clips: CanonicalProject["clips"]): CanonicalProject {
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: id(1),
    name: "Ripple",
    revision: 0,
    language: "en",
    output: { width: 1280, height: 720, fps: rational(30, 1) },
    assets: [],
    scenes: [],
    tracks: [
      {
        id: id(2),
        name: "V1",
        kind: "video",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
      {
        id: id(3),
        name: "A1",
        kind: "audio",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
    ],
    clips,
  });
}

function title(
  clipId: string,
  startFrames: number,
  durationFrames: number,
  track = id(2),
): CanonicalProject["clips"][number] {
  return {
    id: clipId,
    trackId: track,
    assetId: null,
    title: `t-${clipId.slice(-4)}`,
    startTicks: startFrames * F30,
    durationTicks: durationFrames * F30,
    sourceStartTicks: 0,
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    sound: null,
  };
}

test("ripple delete closes the gap and conserves later offsets", () => {
  const a = title(id(10), 0, 30);
  const b = title(id(11), 30, 30);
  const c = title(id(12), 60, 30);
  const before = baseProject([a, b, c]);
  const after = applyBatch(before, [
    { type: "timeline.rippleDelete", clipId: b.id },
  ]);
  assert.equal(after.clips.length, 2);
  const left = after.clips.find((x) => x.id === a.id)!;
  const right = after.clips.find((x) => x.id === c.id)!;
  assert.equal(left.startTicks, 0);
  assert.equal(right.startTicks, 30 * F30, "c slides into b's start");
  assert.equal(right.durationTicks, 30 * F30);
});

test("ripple trim shortens and closes the freed interval", () => {
  const a = title(id(20), 0, 60);
  const b = title(id(21), 60, 30);
  const before = baseProject([a, b]);
  const after = applyBatch(before, [
    {
      type: "timeline.rippleTrim",
      clipId: a.id,
      endTicks: 30 * F30,
    },
  ]);
  assert.equal(after.clips.find((x) => x.id === a.id)!.durationTicks, 30 * F30);
  assert.equal(
    after.clips.find((x) => x.id === b.id)!.startTicks,
    30 * F30,
    "b follows the new end",
  );
});

test("insert opens a gap and places the new clip", () => {
  const a = title(id(30), 0, 30);
  const b = title(id(31), 30, 30);
  const before = baseProject([a, b]);
  const after = applyBatch(before, [
    {
      type: "timeline.insert",
      clipId: id(32),
      trackId: id(2),
      assetId: null,
      title: "inserted",
      startTicks: 30 * F30,
      durationTicks: 15 * F30,
      sourceStartTicks: 0,
    },
  ]);
  assert.equal(after.clips.length, 3);
  assert.equal(after.clips.find((x) => x.id === id(32))!.startTicks, 30 * F30);
  assert.equal(
    after.clips.find((x) => x.id === b.id)!.startTicks,
    45 * F30,
    "b shifts right by the insert duration",
  );
});

test("locked tracks are not shifted by ripple", () => {
  const a = title(id(40), 0, 30);
  const b = title(id(41), 30, 30);
  const before = baseProject([a, b]);
  before.tracks[0]!.locked = true;
  assert.throws(
    () =>
      applyBatch(before, [{ type: "timeline.rippleDelete", clipId: a.id }]),
    (e: unknown) => e instanceof CommandError && /locked/i.test(e.message),
  );
});

test("Q4: ripple delete+insert conserves total duration and stays safe integers", () => {
  for (const fps of fpsRates) {
    const frame = framesToTicks(1, fps);
    assert.ok(Number.isSafeInteger(frame));
    let project = baseProject([
      {
        ...title(id(50), 0, 1),
        startTicks: 0,
        durationTicks: 40 * frame,
      },
      {
        ...title(id(51), 0, 1),
        id: id(51),
        startTicks: 40 * frame,
        durationTicks: 40 * frame,
      },
      {
        ...title(id(52), 0, 1),
        id: id(52),
        startTicks: 80 * frame,
        durationTicks: 40 * frame,
      },
    ]);
    const totalBefore = project.clips.reduce(
      (s, c) => s + c.durationTicks,
      0,
    );
    project = applyBatch(project, [
      { type: "timeline.rippleDelete", clipId: id(51) },
    ]);
    project = applyBatch(project, [
      {
        type: "timeline.insert",
        clipId: id(53),
        trackId: id(2),
        assetId: null,
        title: "back",
        startTicks: 40 * frame,
        durationTicks: 40 * frame,
        sourceStartTicks: 0,
      },
    ]);
    const totalAfter = project.clips.reduce((s, c) => s + c.durationTicks, 0);
    assert.equal(totalAfter, totalBefore);
    for (const c of project.clips) {
      assert.ok(Number.isSafeInteger(c.startTicks));
      assert.ok(Number.isSafeInteger(c.durationTicks));
    }
    // No overlaps on the video track.
    const ordered = project.clips
      .filter((c) => c.trackId === id(2))
      .sort((x, y) => x.startTicks - y.startTicks);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(
        ordered[i - 1]!.startTicks + ordered[i - 1]!.durationTicks <=
          ordered[i]!.startTicks,
      );
    }
  }
});

test("Q4 property: 10_000 random ripple edits stay exact at NTSC and integer rates", () => {
  const rng = (() => {
    let s = 0xc0ffee;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  })();
  for (const fps of fpsRates) {
    const frame = framesToTicks(1, fps);
    let project = baseProject(
      Array.from({ length: 8 }, (_, i) => ({
        ...title(id(100 + i), 0, 1),
        id: id(100 + i),
        startTicks: i * 20 * frame,
        durationTicks: 20 * frame,
      })),
    );
    for (let n = 0; n < 2500; n++) {
      const clips = project.clips.filter((c) => c.trackId === id(2));
      if (clips.length < 2) break;
      const victim = clips[Math.floor(rng() * clips.length)]!;
      const beforeBytes = JSON.stringify(project.clips.map((c) => c.id).sort());
      project = applyBatch(project, [
        { type: "timeline.rippleDelete", clipId: victim.id },
      ]);
      const insertId = id(2000 + (n % 500));
      if (project.clips.some((c) => c.id === insertId)) continue;
      const at =
        project.clips
          .filter((c) => c.trackId === id(2))
          .sort((a, b) => a.startTicks - b.startTicks)[0]?.startTicks ?? 0;
      project = applyBatch(project, [
        {
          type: "timeline.insert",
          clipId: insertId,
          trackId: id(2),
          assetId: null,
          title: "r",
          startTicks: at,
          durationTicks: 10 * frame,
          sourceStartTicks: 0,
        },
      ]);
      for (const c of project.clips) {
        assert.ok(Number.isSafeInteger(c.startTicks), beforeBytes);
        assert.ok(Number.isSafeInteger(c.durationTicks));
      }
    }
  }
});
