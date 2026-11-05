// M16 / W13 / Q12: OTIO JSON interchange at flick rate 705_600_000.
import test from "node:test";
import assert from "node:assert/strict";
import {
  OTIO_LIMITS,
  OTIO_RATE,
  fromOtio,
  otioJson,
  otioLossReport,
  toOtio,
} from "../core/interchange/otio.ts";
import { FORMAT_VERSION, type CanonicalProject } from "../core/canonical.ts";
import { rational } from "../core/time.ts";
import { CommandError } from "../core/command/errors.ts";

const F = 23_520_000; // 1 frame @ 30 fps in flicks
const FORMAT = "yamakan.project" as const;

function sampleProject(): CanonicalProject {
  const video = crypto.randomUUID();
  const audio = crypto.randomUUID();
  const assetV = crypto.randomUUID();
  const assetA = crypto.randomUUID();
  const hashV = "a".repeat(64);
  const hashA = "b".repeat(64);
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    documents: [],
    id: crypto.randomUUID(),
    name: "otio-fixture",
    revision: 1,
    language: "en",
    output: {
      width: 640,
      height: 360,
      fps: rational(30, 1),
    },
    assets: [
      {
        id: assetV,
        name: "pic.mp4",
        kind: "video",
        hash: hashV,
        extension: "mp4",
        bytes: 1000,
        durationTicks: 300 * F,
        width: 640,
        height: 360,
        hasAudio: true,
        timebase: null,
      },
      {
        id: assetA,
        name: "tone.wav",
        kind: "audio",
        hash: hashA,
        extension: "wav",
        bytes: 500,
        durationTicks: 300 * F,
        width: 0,
        height: 0,
        hasAudio: true,
        timebase: null,
      },
    ],
    scenes: [],
    tracks: [
      {
        id: video,
        name: "Picture",
        kind: "video",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
      {
        id: audio,
        name: "Sound",
        kind: "audio",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
    ],
    clips: [
      {
        id: crypto.randomUUID(),
        trackId: video,
        assetId: assetV,
        startTicks: 10 * F,
        durationTicks: 60 * F,
        sourceStartTicks: 5 * F,
        title: null,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
        sound: {
          enabled: false,
          gainDb: 0,
          fadeInTicks: 0,
          fadeOutTicks: 0,
        },
      },
      {
        id: crypto.randomUUID(),
        trackId: audio,
        assetId: assetA,
        startTicks: 0,
        durationTicks: 90 * F,
        sourceStartTicks: 0,
        title: null,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
        sound: null,
      },
    ],
  };
}

test("toOtio uses flick rate 705600000 and preserves clip ranges", () => {
  const p = sampleProject();
  const doc = toOtio(p);
  assert.equal(doc.OTIO_SCHEMA, "Timeline.1");
  const videoTrack = doc.tracks.children.find((t) => t.kind === "Video")!;
  const gap = videoTrack.children.find((c) => c.OTIO_SCHEMA === "Gap.1");
  assert.ok(gap);
  assert.equal(gap!.source_range.duration.rate, OTIO_RATE);
  assert.equal(gap!.source_range.duration.value, 10 * F);
  const clip = videoTrack.children.find((c) => c.OTIO_SCHEMA === "Clip.1")!;
  assert.equal(clip.source_range.start_time.value, 5 * F);
  assert.equal(clip.source_range.duration.value, 60 * F);
  assert.equal(clip.source_range.duration.rate, OTIO_RATE);
});

test("fromOtio round-trips ranges and matches assets by id/hash", () => {
  const p = sampleProject();
  const json = otioJson(p);
  const proposal = fromOtio(
    json,
    p.assets.map((a) => ({ id: a.id, hash: a.hash })),
  );
  assert.equal(proposal.unresolved, 0);
  const video = proposal.clips.find((c) => c.trackKind === "video")!;
  assert.equal(video.startTicks, 10 * F);
  assert.equal(video.durationTicks, 60 * F);
  assert.equal(video.sourceStartTicks, 5 * F);
  assert.equal(video.assetId, p.assets[0]!.id);
});

test("remote target_url is never opened and stays unresolved", () => {
  const doc = {
    OTIO_SCHEMA: "Timeline.1",
    name: "hostile",
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      children: [
        {
          OTIO_SCHEMA: "Track.1",
          name: "V",
          kind: "Video",
          children: [
            {
              OTIO_SCHEMA: "Clip.1",
              name: "remote",
              source_range: {
                OTIO_SCHEMA: "TimeRange.1",
                start_time: {
                  OTIO_SCHEMA: "RationalTime.1",
                  rate: OTIO_RATE,
                  value: 0,
                },
                duration: {
                  OTIO_SCHEMA: "RationalTime.1",
                  rate: OTIO_RATE,
                  value: F,
                },
              },
              media_reference: {
                OTIO_SCHEMA: "ExternalReference.1",
                target_url: "https://evil.example/media.mp4",
              },
            },
          ],
        },
      ],
    },
  };
  const proposal = fromOtio(JSON.stringify(doc), []);
  assert.equal(proposal.unresolved, 1);
  assert.equal(proposal.clips[0]!.assetId, null);
  assert.equal(proposal.clips[0]!.remoteUrlIgnored, true);
});

test("hostile size and nesting limits fail closed", () => {
  assert.throws(
    () => fromOtio("x".repeat(OTIO_LIMITS.maxBytes + 1), []),
    /16 MiB/,
  );
  let nest: unknown = { OTIO_SCHEMA: "Timeline.1", name: "n", tracks: null };
  for (let i = 0; i < OTIO_LIMITS.maxDepth + 2; i++) nest = { child: nest };
  assert.throws(() => fromOtio(JSON.stringify(nest), []), /deeply/);
});

test("a 24000/1001 project's ranges round-trip through OTIO on its own frames (YU-019)", async () => {
  const { createProject, EDIT_RATE_23976, ProjectSchema } =
    await import("../core/project.ts");
  const { fromEditView } = await import("../core/canonical.ts");
  const frame = 29_429_400; // flicks per 24000/1001 frame
  const base = createProject("NTSC", EDIT_RATE_23976);
  const asset = {
    id: crypto.randomUUID(),
    name: "v.mp4",
    kind: "video" as const,
    hash: "c".repeat(64),
    extension: "mp4" as const,
    bytes: 10,
    durationFrames: 14_000,
    width: 1280,
    height: 720,
    hasAudio: false,
  };
  // Long timestamps: a clip ending just before ten minutes.
  const view = ProjectSchema.parse({
    ...base,
    assets: [asset],
    clips: [
      {
        id: crypto.randomUUID(),
        trackId: base.tracks[0].id,
        assetId: asset.id,
        startFrame: 13_000,
        durationFrames: 1_385,
        sourceFrame: 12_001,
        title: null,
      },
    ],
  });
  const canonical = fromEditView(view);
  const proposal = fromOtio(otioJson(canonical), [
    { id: asset.id, hash: asset.hash },
  ]);
  const clip = proposal.clips[0]!;
  assert.equal(clip.startTicks, 13_000 * frame);
  assert.equal(clip.durationTicks, 1_385 * frame);
  assert.equal(clip.sourceStartTicks, 12_001 * frame);
  assert.equal(clip.assetId, asset.id);
});

const timeline = (children: unknown) => ({
  OTIO_SCHEMA: "Timeline.1",
  name: "t",
  tracks: {
    OTIO_SCHEMA: "Stack.1",
    children: [{ OTIO_SCHEMA: "Track.1", name: "V", kind: "Video", children }],
  },
});
const time = (value: unknown) => ({
  OTIO_SCHEMA: "RationalTime.1",
  rate: OTIO_RATE,
  value,
});
const clipOf = (target_url: string) => ({
  OTIO_SCHEMA: "Clip.1",
  name: "c",
  source_range: {
    OTIO_SCHEMA: "TimeRange.1",
    start_time: time(0),
    duration: time(F),
  },
  media_reference: { OTIO_SCHEMA: "ExternalReference.1", target_url },
});

test("a project with nothing beyond the supported subset loses only what OTIO has no place for", () => {
  const p = sampleProject();
  p.clips[0]!.sound = {
    enabled: true,
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
  };
  const report = otioLossReport(p);
  assert.deepEqual(
    report.losses.map((l) => l.field),
    ["language", "output"],
  );
  assert.deepEqual(report.carried, { tracks: 2, clips: 2 });
  assert.deepEqual(report.media.map((m) => m.hash).sort(), [
    "a".repeat(64),
    "b".repeat(64),
  ]);
});

test("everything a conversion would not carry is reported, the same way each time", () => {
  const p = sampleProject();
  const [video, audio] = p.clips;
  p.tracks[0]!.locked = true;
  p.tracks[1]!.muted = true;
  Object.assign(audio!, {
    gainDb: -6,
    fadeInTicks: F,
    speed: rational(2, 1),
  });
  video!.effects = {
    schemaVersion: 1,
    stack: [],
  } as unknown as typeof video.effects;
  video!.transition = {
    kind: "dissolve",
  } as unknown as typeof video.transition;
  p.clips.push({
    ...audio!,
    id: crypto.randomUUID(),
    assetId: null,
    title: "A title",
    gainDb: 0,
    fadeInTicks: 0,
    speed: undefined,
  });
  const report = otioLossReport(p);
  const of = (id: string) =>
    report.losses.filter((l) => l.id === id).map((l) => l.field);
  assert.deepEqual(of(p.tracks[0]!.id), ["locked"]);
  assert.deepEqual(of(p.tracks[1]!.id), ["muted"]);
  assert.deepEqual(of(audio!.id), ["fades", "gain", "speed"]);
  assert.ok(of(video!.id).includes("sound"));
  assert.deepEqual(
    report.losses.filter((l) => l.effect === "yamakanOnly").map((l) => l.field),
    ["effects", "transition"],
  );
  assert.deepEqual(of(p.clips[2]!.id), ["title"]);
  assert.equal(report.carried.clips, 2);
  // Reordering the project's own lists does not change the report.
  const shuffled = {
    ...p,
    clips: [...p.clips].reverse(),
    tracks: [...p.tracks].reverse(),
    assets: [...p.assets].reverse(),
  };
  assert.deepEqual(otioLossReport(shuffled), report);
  // A report does not alter the project, and is what the export leaves out.
  assert.ok(!JSON.stringify(toOtio(p)).includes("A title"));
});

test("a clip the file cannot name is reported and marked missing", () => {
  const p = sampleProject();
  p.clips[0]!.assetId = crypto.randomUUID();
  const report = otioLossReport(p);
  assert.ok(
    report.losses.some((l) => l.id === p.clips[0]!.id && l.field === "media"),
  );
  assert.equal(report.media.length, 1);
});

test("malformed shapes are refused as validation errors, not crashes", () => {
  const refused = (doc: unknown) =>
    assert.throws(
      () => fromOtio(JSON.stringify(doc), []),
      (e: Error) => e instanceof CommandError,
      JSON.stringify(doc).slice(0, 120),
    );
  refused({ OTIO_SCHEMA: "Timeline.2", name: "future" });
  refused(null);
  refused(7);
  refused({ OTIO_SCHEMA: "Timeline.1", tracks: { children: 7 } });
  refused(timeline(7));
  refused(timeline([{ OTIO_SCHEMA: "Stack.1" }]));
  refused(timeline([5, clipOf("")]));
  refused({
    OTIO_SCHEMA: "Timeline.1",
    tracks: {
      children: [{ OTIO_SCHEMA: "Track.1", kind: "Data", children: [] }],
    },
  });
  for (const target_url of [5, {}, true, ["x"]])
    refused(
      timeline([
        {
          ...clipOf(""),
          media_reference: {
            OTIO_SCHEMA: "ExternalReference.1",
            target_url,
          },
        },
      ]),
    );
  for (const yamakan_timeline_start of [
    { toString: 1 },
    7,
    true,
    [5],
    "",
    "1e3",
    "0x10",
    "12345678901234567",
  ])
    refused(
      timeline([{ ...clipOf(""), metadata: { yamakan_timeline_start } }]),
    );
  refused(
    timeline([
      {
        ...clipOf(""),
        metadata: { yamakan_timeline_start: "9007199254740990" },
        source_range: { start_time: time(0), duration: time(F) },
      },
    ]),
  );
  refused(timeline([{ OTIO_SCHEMA: "Gap.1", name: "g" }]));
  refused(timeline([{ OTIO_SCHEMA: "Gap.1", source_range: 3 }]));
  refused(timeline([{ OTIO_SCHEMA: "Clip.1", name: "c" }]));
  const withTime = (value: unknown, rate = OTIO_RATE) => ({
    OTIO_SCHEMA: "Clip.1",
    source_range: {
      start_time: time(0),
      duration: { OTIO_SCHEMA: "RationalTime.1", rate, value },
    },
  });
  refused(timeline([withTime(-1)]));
  refused(timeline([withTime(1.5)]));
  refused(timeline([withTime(Number.MAX_SAFE_INTEGER + 2)]));
  refused(timeline([withTime(F, 24)]));
  refused(
    timeline([
      {
        ...clipOf(""),
        metadata: { yamakan_timeline_start: "-5" },
      },
    ]),
  );
  refused(
    timeline([{ ...clipOf(""), metadata: { yamakan_effects: "not json" } }]),
  );
  const big = Number.MAX_SAFE_INTEGER - 1;
  const gap = {
    OTIO_SCHEMA: "Gap.1",
    source_range: { start_time: time(0), duration: time(big) },
  };
  refused(timeline([gap, gap, clipOf("")]));
});

test("no address in a file is opened or treated as media", () => {
  const hash = "c".repeat(64);
  for (const url of [
    "https://evil.example/a.mp4",
    "HTTP://evil.example/a.mp4",
    "FILE:///etc/passwd",
    "file:///C:/Windows/win.ini",
    "C:\\Windows\\win.ini",
    "\\\\server\\share\\a.mp4",
    "/etc/passwd",
    "../../secret.mp4",
    "ftp://evil.example/a.mp4",
  ]) {
    const { clips, unresolved } = fromOtio(
      JSON.stringify(timeline([clipOf(url)])),
      [{ id: crypto.randomUUID(), hash }],
    );
    assert.equal(clips[0]!.assetId, null, url);
    assert.equal(clips[0]!.remoteUrlIgnored, true, url);
    assert.equal(unresolved, 1);
  }
});

test("what a file holds that the proposal leaves out is counted, not dropped silently", () => {
  const proposal = fromOtio(
    JSON.stringify({
      ...timeline([
        { OTIO_SCHEMA: "Transition.1" },
        { OTIO_SCHEMA: "Transition.1" },
        {
          ...clipOf(""),
          effects: [{ OTIO_SCHEMA: "LinearTimeWarp.1" }],
          markers: [{ OTIO_SCHEMA: "Marker.2" }],
          enabled: false,
        },
        {
          ...clipOf(""),
          effects: [],
          media_reference: {
            OTIO_SCHEMA: "ImageSequenceReference.1",
            target_url_base: "https://evil.example/",
          },
        },
        {
          ...clipOf(""),
          media_reference: { OTIO_SCHEMA: "MissingReference.1" },
        },
      ]),
      global_start_time: time(F),
    }),
    [],
  );
  assert.equal(proposal.clips.length, 3);
  assert.equal(proposal.unresolved, 3);
  assert.deepEqual(proposal.ignored, [
    { schema: "Clip.effects", count: 1 },
    { schema: "Clip.enabled", count: 1 },
    { schema: "Clip.markers", count: 1 },
    { schema: "ImageSequenceReference.1", count: 1 },
    { schema: "Timeline.global_start_time", count: 1 },
    { schema: "Transition.1", count: 2 },
  ]);
});

test("a clip's start and an address are matched without coercion, and a known asset still resolves", () => {
  const asset = { id: crypto.randomUUID(), hash: "c".repeat(64) };
  const { clips, unresolved, ignored } = fromOtio(
    JSON.stringify(
      timeline([
        {
          ...clipOf(`yamakan:asset:${asset.id}`),
          metadata: { yamakan_timeline_start: String(3 * F) },
        },
      ]),
    ),
    [asset],
  );
  assert.equal(clips[0]!.assetId, asset.id);
  assert.equal(clips[0]!.startTicks, 3 * F);
  assert.equal(unresolved, 0);
  assert.deepEqual(ignored, []);
});

test("the report also names unused media, scenes, documents, animation and every track state", () => {
  const p = sampleProject();
  const unused = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  p.assets.push({ ...p.assets[0]!, id: unused, hash: "d".repeat(64) });
  p.scenes = [{ id: crypto.randomUUID() }] as unknown as typeof p.scenes;
  p.documents = [{ id: documentId }] as unknown as typeof p.documents;
  Object.assign(p.tracks[0]!, { solo: true, targeted: true });
  p.clips[1]!.animation = {
    channels: {},
  } as unknown as (typeof p.clips)[1]["animation"];
  const fields = otioLossReport(p).losses.map((l) => l.field);
  for (const field of [
    `asset:${unused}`,
    "scenes",
    `document:${documentId}`,
    "solo",
    "targeted",
    "animation",
  ])
    assert.ok(fields.includes(field), field);
  assert.ok(!otioLossReport(p).media.some((m) => m.assetId === unused));
});
