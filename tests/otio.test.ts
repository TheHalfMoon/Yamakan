// M16 / W13 / Q12: OTIO JSON interchange at flick rate 705_600_000.
import test from "node:test";
import assert from "node:assert/strict";
import {
  OTIO_LIMITS,
  OTIO_RATE,
  fromOtio,
  otioJson,
  toOtio,
} from "../core/interchange/otio.ts";
import { FORMAT_VERSION, type CanonicalProject } from "../core/canonical.ts";
import { rational } from "../core/time.ts";

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
