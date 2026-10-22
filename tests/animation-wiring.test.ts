// P10-02: clip animation ops → plan → sampler parity (preview vs export).
import test from "node:test";
import assert from "node:assert/strict";
import { applyBatch } from "../core/timeline/operations.ts";
import { fromEditView, toEditView } from "../core/canonical.ts";
import { compilePlan } from "../core/render/plan.ts";
import { ANIMATION_ENABLED } from "../core/donors/opencut/animation/flags.ts";
import {
  opacityConstantAtLocalTime,
  opacityFilterChain,
  sampleAnimationPathAtLocalTime,
  volumeFilterChain,
} from "../core/render/animation-filters.ts";
import {
  setClipAnimation,
  upsertClipAnimationKeyframe,
} from "../src/edit-ops.ts";
import type { Project } from "../core/project.ts";
import { FLICKS_PER_SECOND, rational } from "../core/time.ts";
import { CommandError } from "../core/command/errors.ts";
import type { Channel } from "../core/donors/opencut/animation/types.ts";
import { mediaTime } from "../core/donors/opencut/animation/media-time.ts";

const F = 23_520_000; // one frame @ 30 fps

function baseProject(): Project {
  const video = crypto.randomUUID();
  const asset = crypto.randomUUID();
  const clip = crypto.randomUUID();
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: "animation",
    revision: 1,
    fps: 30,
    width: 640,
    height: 360,
    assets: [
      {
        id: asset,
        name: "a.mp4",
        kind: "video",
        hash: "a".repeat(64),
        extension: "mp4",
        bytes: 1000,
        durationFrames: 300,
        width: 640,
        height: 360,
        hasAudio: true,
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
      },
    ],
    clips: [
      {
        id: clip,
        trackId: video,
        assetId: asset,
        startFrame: 0,
        durationFrames: 90,
        sourceFrame: 0,
        title: null,
        sound: { enabled: true },
      },
    ],
  };
}

const opacityFade = {
  opacity: {
    keys: [
      {
        id: "k0",
        time: 0,
        value: 0,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
      {
        id: "k1",
        time: FLICKS_PER_SECOND,
        value: 1,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
    ],
  },
};

test("ANIMATION_ENABLED is true after P10-02 wiring", () => {
  assert.equal(ANIMATION_ENABLED, true);
});

test("clip.setAnimation stores channels and round-trips edit view", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const next = toEditView(
    applyBatch(fromEditView(p), [
      { type: "clip.setAnimation", clipId, animation: opacityFade },
    ]),
  );
  assert.equal(next.clips[0]!.animation?.opacity?.keys.length, 2);
  const cleared = toEditView(
    applyBatch(fromEditView(next), [
      { type: "clip.setAnimation", clipId, animation: null },
    ]),
  );
  assert.equal(cleared.clips[0]!.animation, undefined);
});

test("clip.upsertAnimationKeyframe inserts and updates", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const via = upsertClipAnimationKeyframe(p, {
    clipId,
    channel: "opacity",
    timeTicks: 0,
    value: 0.25,
  });
  assert.equal(via.clips[0]!.animation?.opacity?.keys[0]?.value, 0.25);
  const updated = upsertClipAnimationKeyframe(via, {
    clipId,
    channel: "opacity",
    timeTicks: 0,
    value: 0.75,
    keyId: via.clips[0]!.animation!.opacity!.keys[0]!.id,
  });
  assert.equal(updated.clips[0]!.animation?.opacity?.keys.length, 1);
  assert.equal(updated.clips[0]!.animation?.opacity?.keys[0]?.value, 0.75);
});

test("compilePlan attaches animation when enabled", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const canonical = applyBatch(fromEditView(p), [
    { type: "clip.setAnimation", clipId, animation: opacityFade },
  ]);
  const { plan } = compilePlan(canonical, "b".repeat(64), []);
  assert.ok(plan.layers[0]!.animation?.opacity);
  assert.ok(plan.audio[0]!.animation?.opacity);
});

test("preview and export sample the same opacity at one frame center", () => {
  const channel = opacityFade.opacity as Channel<number>;
  const mid = Math.round(FLICKS_PER_SECOND / 2);
  const preview = sampleAnimationPathAtLocalTime(channel, "opacity", mid, 0);
  const exportSample = sampleAnimationPathAtLocalTime(
    channel,
    "opacity",
    mid,
    0,
  );
  assert.equal(preview, exportSample);
  assert.ok(Math.abs(preview - 0.5) < 0.05);
  const constant = opacityConstantAtLocalTime(channel, mid);
  assert.match(constant, /colorchannelmixer=aa=0\.5/);
});

test("opacity and volume filter chains are deterministic", () => {
  const channel = opacityFade.opacity as Channel<number>;
  const fps = rational(30, 1);
  const opacity = opacityFilterChain("in", "out", channel, {
    clipStartTicks: 0,
    rangeStartTicks: 0,
    rangeEndTicks: F,
    fps,
  });
  assert.equal(opacity.length, 1);
  assert.match(opacity[0]!, /colorchannelmixer=aa=/);
  const volChannel: Channel<number> = {
    keys: [
      {
        id: "v0",
        time: mediaTime({ ticks: 0 }),
        value: 0,
        segmentToNext: "linear",
        tangentMode: "auto",
      },
      {
        id: "v1",
        time: mediaTime({ ticks: FLICKS_PER_SECOND }),
        value: 1,
        segmentToNext: "linear",
        tangentMode: "auto",
      },
    ],
  };
  const volume = volumeFilterChain(volChannel, FLICKS_PER_SECOND, fps);
  assert.ok(volume.length >= 1);
  assert.match(volume[0]!, /^volume=/);
});

test("setClipAnimation helper and clear round-trip", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const withAnim = setClipAnimation(p, clipId, opacityFade);
  assert.ok(withAnim.clips[0]!.animation);
  const cleared = setClipAnimation(withAnim, clipId, null);
  assert.equal(cleared.clips[0]!.animation, undefined);
});

test("titles refuse animation", () => {
  const p = baseProject();
  const titleTrack = crypto.randomUUID();
  const titleClip = crypto.randomUUID();
  const withTitle = {
    ...p,
    tracks: [
      ...p.tracks,
      {
        id: titleTrack,
        name: "Titles",
        kind: "video" as const,
        muted: false,
        locked: false,
      },
    ],
    clips: [
      ...p.clips,
      {
        id: titleClip,
        trackId: titleTrack,
        assetId: null,
        startFrame: 0,
        durationFrames: 30,
        sourceFrame: 0,
        title: "Hello",
      },
    ],
  };
  assert.throws(
    () =>
      applyBatch(fromEditView(withTitle), [
        {
          type: "clip.setAnimation",
          clipId: titleClip,
          animation: opacityFade,
        },
      ]),
    (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
  );
});

test("setAnimation undo/redo via project history restores animation bytes", async () => {
  const { mkdtemp, rm, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { ProjectStore } = await import("../core/store.ts");
  const { JobSupervisor } = await import("../core/jobs.ts");
  const { execute, Scopes } = await import("../core/command/registry.ts");
  const { mediaTools } = await import("../core/process/workers.ts");

  const root = await mkdtemp(path.join(tmpdir(), "yamakan-anim-undo-"));
  const store = new ProjectStore(root);
  try {
    await store.initialize();
    const project = await store.create("AnimUndo");
    const png = path.join(root, "still.png");
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
        "color=c=red:s=64x36",
        "-frames:v",
        "1",
        png,
      ],
      { windowsHide: true },
    );
    const imported = await store.importAsset(
      project.id,
      "still.png",
      await readFile(png),
    );
    const queue = new JobSupervisor(store);
    const ctx = {
      store,
      queue,
      principal: { id: "local-client" as const, scopes: new Set(Scopes) },
    };
    const call = (operation: string, parameters: unknown) =>
      execute(ctx, operation, parameters).then((r) => r.result as any);

    const picture = imported.project.tracks.find((t) => t.kind === "video")!.id;
    const clipId = crypto.randomUUID();
    const added = await call("yamakan.project.applyBatch", {
      projectId: imported.project.id,
      expectedRevision: imported.project.revision,
      operations: [
        {
          type: "clip.add",
          clipId,
          trackId: picture,
          assetId: imported.asset.id,
          title: null,
          startTicks: 0,
          durationTicks: 30 * F,
          sourceStartTicks: 0,
        },
      ],
    });
    const animated = await call("yamakan.clip.setAnimation", {
      projectId: imported.project.id,
      expectedRevision: added.revision,
      clipId,
      animation: opacityFade,
    });
    assert.equal(
      animated.clips.find((c: any) => c.id === clipId)?.animation?.opacity?.keys
        .length,
      2,
    );

    const undone = await call("yamakan.project.undo", {
      projectId: imported.project.id,
      expectedRevision: animated.revision,
    });
    assert.equal(
      undone.clips.find((c: any) => c.id === clipId)?.animation,
      undefined,
    );

    const redone = await call("yamakan.project.redo", {
      projectId: imported.project.id,
      expectedRevision: undone.revision,
    });
    assert.equal(
      redone.clips.find((c: any) => c.id === clipId)?.animation?.opacity?.keys
        .length,
      2,
    );

    await queue.close();
  } finally {
    await store.close();
    await rm(root, { recursive: true, force: true });
  }
});
