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

test("muted or soloed-out tracks are not counted; video on an audio track and extreme retimes are", () => {
  const p = project();
  const [video, audio] = p.clips;
  audio.fadeInFrames = 15;
  // The export drops a muted track, so its fade is no approximation.
  p.tracks[1].muted = true;
  assert.equal(previewParity(p).exact, true);
  p.tracks[1].muted = false;
  // Solo on the video kind keeps only soloed video tracks; audio unaffected.
  p.tracks[0].solo = true;
  assert.deepEqual(
    previewParity(p).approximations.map((a) => a.kind),
    ["audioFade"],
  );
  p.tracks[0].solo = false;
  audio.fadeInFrames = 0;
  video.speed = { num: 1, den: 5 };
  const extreme = previewParity(p).approximations.find(
    (a) => a.kind === "extremeRetime",
  );
  assert.deepEqual(extreme?.clipIds, [video.id]);
  video.speed = undefined;
  // The video asset placed on the audio track.
  audio.assetId = p.assets[0].id;
  const onAudio = previewParity(p).approximations.find(
    (a) => a.kind === "videoOnAudioTrack",
  );
  assert.deepEqual(onAudio?.clipIds, [audio.id]);
});

test("every approximation kind has its words in both languages", async () => {
  const { MESSAGES } = await import("../src/i18n.ts");
  for (const kind of [
    "titleFont",
    "audioFade",
    "gainAboveUnity",
    "animation",
    "videoOnAudioTrack",
    "extremeRetime",
  ]) {
    const key = `parity.${kind}` as keyof typeof MESSAGES.en;
    assert.ok(MESSAGES.en[key] && MESSAGES.ar[key], kind);
  }
});

test("yamakan.preview.parity answers readers for the current revision, with a strict input", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { ProjectStore } = await import("../core/store.ts");
  const { JobSupervisor } = await import("../core/jobs.ts");
  const { execute } = await import("../core/command/registry.ts");
  const { CommandError, toCommandError } =
    await import("../core/command/errors.ts");
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-parity-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  try {
    const project = await store.create("Parity command");
    const reader = {
      store,
      queue,
      principal: {
        id: "local-client" as const,
        scopes: new Set(["project:read" as const]),
      },
    };
    const { result } = await execute(reader, "yamakan.preview.parity", {
      projectId: project.id,
    });
    assert.deepEqual(result, {
      version: PREVIEW_PARITY_VERSION,
      exact: true,
      approximations: [],
    });
    await assert.rejects(
      execute(reader, "yamakan.preview.parity", {
        projectId: project.id,
        revision: 1,
      }),
      (e: unknown) =>
        e instanceof Error && toCommandError(e).code === "VALIDATION",
    );
    const none = {
      ...reader,
      principal: { id: "local-client" as const, scopes: new Set<never>() },
    };
    await assert.rejects(
      execute(none, "yamakan.preview.parity", { projectId: project.id }),
      (e: unknown) => e instanceof CommandError && e.code === "SCOPE_DENIED",
    );
  } finally {
    await queue.close();
    store.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
