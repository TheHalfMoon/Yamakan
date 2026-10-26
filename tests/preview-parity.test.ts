// YU-018: the canvas preview's parity with the export, said plainly: what
// it shows as the export will, and each clip it only approximates.
import test from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_PARITY_SUBSET,
  PREVIEW_PARITY_VERSION,
  previewParity,
  previewVolume,
} from "../core/render/parity.ts";
import { editorView } from "../src/adapter.ts";
import type { Project } from "../core/project.ts";

const id = () => crypto.randomUUID();
const HASH = "a".repeat(64);
function project(): Project {
  const video = {
    id: id(),
    name: "v.mp4",
    kind: "video" as const,
    hash: HASH,
    extension: "mp4" as const,
    bytes: 10,
    durationFrames: 300,
    width: 1280,
    height: 720,
    hasAudio: true,
  };
  const audio = {
    id: id(),
    name: "a.wav",
    kind: "audio" as const,
    hash: "b".repeat(64),
    extension: "wav" as const,
    bytes: 10,
    durationFrames: 300,
    width: 0,
    height: 0,
    hasAudio: true,
  };
  const vt = {
    id: id(),
    name: "V1",
    kind: "video" as const,
    muted: false,
    locked: false,
  };
  const at = {
    id: id(),
    name: "A1",
    kind: "audio" as const,
    muted: false,
    locked: false,
  };
  return {
    id: id(),
    name: "Parity",
    revision: 1,
    width: 1280,
    height: 720,
    assets: [video, audio],
    tracks: [vt, at],
    clips: [
      {
        id: id(),
        trackId: vt.id,
        assetId: video.id,
        startFrame: 0,
        durationFrames: 90,
        sourceFrame: 15,
        title: null,
        sound: { enabled: true, gainDb: -6 },
      },
      {
        id: id(),
        trackId: at.id,
        assetId: audio.id,
        startFrame: 0,
        durationFrames: 90,
        sourceFrame: 0,
        title: null,
        gainDb: -12,
      },
    ],
  } as unknown as Project;
}

test("a cut, trimmed, retimed timeline with sound at or below 0 dB is shown as the export will", () => {
  const p = project();
  p.clips[0].speed = { num: 2, den: 1 };
  const parity = previewParity(p);
  assert.equal(parity.version, PREVIEW_PARITY_VERSION);
  assert.equal(parity.exact, true);
  assert.deepEqual(parity.approximations, []);
  assert.ok(PREVIEW_PARITY_SUBSET.includes("constantRetime"));
});

test("each approximation is named with the clips it concerns", () => {
  const p = project();
  const [video, audio] = p.clips;
  audio.fadeInFrames = 15;
  video.sound = { enabled: true, gainDb: 3 };
  p.clips.push({
    id: id(),
    trackId: p.tracks[0].id,
    assetId: null,
    startFrame: 90,
    durationFrames: 30,
    sourceFrame: 0,
    title: "Hello",
  } as Project["clips"][number]);
  video.animation = {
    opacity: {
      keys: [
        { frame: 0, value: 0 },
        { frame: 10, value: 1 },
      ],
    },
  } as never;
  const parity = previewParity(p);
  assert.equal(parity.exact, false);
  const kinds = Object.fromEntries(
    parity.approximations.map((a) => [a.kind, a.clipIds]),
  );
  assert.deepEqual(kinds.audioFade, [audio.id]);
  assert.deepEqual(kinds.gainAboveUnity, [video.id]);
  assert.deepEqual(kinds.titleFont, [p.clips[2].id]);
  assert.deepEqual(kinds.animation, [video.id]);
  // A disabled embedded sound is not heard, so its fades do not count.
  video.sound = { enabled: false, fadeInFrames: 10 } as never;
  assert.equal(
    previewParity(p).approximations.find((a) => a.kind === "gainAboveUnity"),
    undefined,
  );
});

test("the canvas plays each clip at the export's gain up to 0 dB, audio clips included", () => {
  const p = project();
  const [video, audio] = p.clips;
  assert.ok(Math.abs(previewVolume(p, video)! - 10 ** (-6 / 20)) < 1e-9);
  // An audio clip's own gain (the canvas ignored it before YU-018).
  assert.ok(Math.abs(previewVolume(p, audio)! - 10 ** (-12 / 20)) < 1e-9);
  video.sound = { enabled: true, gainDb: 6 };
  assert.equal(previewVolume(p, video), 1);
  const view = editorView(p);
  assert.ok(
    Math.abs(
      view.clips.find((c) => c.id === audio.id)!.volume! - 10 ** (-12 / 20),
    ) < 1e-9,
  );
});
