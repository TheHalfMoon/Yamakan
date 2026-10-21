// W1: upgrading stored v2 canonical snapshots must not change export audio when
// embedded video sound stays disabled (render intent preserved).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseCanonical } from "../core/canonical.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";

const ffmpeg = mediaTools().ffmpeg;
const F = 23_520_000;

function audioSha256(file: string) {
  const pcm = execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-",
    ],
    { windowsHide: true },
  );
  return createHash("sha256").update(pcm).digest("hex");
}

test("v2 canonical upgrade keeps export audio identical with embedded sound off", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-migrate-audio-"));
  let store: ProjectStore | undefined;
  let supervisor: JobSupervisor | undefined;
  try {
    const tone = path.join(root, "tone.wav");
    execFileSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        tone,
      ],
      { windowsHide: true },
    );
    const video = path.join(root, "silent.mp4");
    execFileSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x180:r=30:d=3",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        video,
      ],
      { windowsHide: true },
    );
    store = new ProjectStore(path.join(root, "ws"));
    await store.initialize();
    supervisor = new JobSupervisor(store);
    await supervisor.start();
    const created = await store.create("Migrate audio");
    const vid = (
      await store.importAsset(created.id, "silent.mp4", await readFile(video))
    ).asset;
    const aud = (
      await store.importAsset(created.id, "tone.wav", await readFile(tone))
    ).asset;
    const videoClipId = crypto.randomUUID();
    const audioClipId = crypto.randomUUID();
    let head = await store.load(created.id);
    head = await store.save(
      {
        ...head,
        width: 320,
        height: 180,
        clips: [
          {
            id: videoClipId,
            trackId: head.tracks[0].id,
            assetId: vid.id,
            startFrame: 0,
            durationFrames: 90,
            sourceFrame: 0,
            title: null,
          },
          {
            id: audioClipId,
            trackId: head.tracks[1].id,
            assetId: aud.id,
            startFrame: 0,
            durationFrames: 90,
            sourceFrame: 0,
            title: null,
          },
        ],
      },
      head.revision,
    );
    const exportOnce = async () => {
      const job = await supervisor!.submit(created.id, crypto.randomUUID());
      for (;;) {
        const s = supervisor!.status(job.id);
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(s.state)) {
          assert.equal(s.state, "COMPLETED", s.error ?? "");
          return audioSha256(await store!.file(created.id, s.artifact!));
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    const before = await exportOnce();

    const canonical = await store.exportProject(created.id);
    const v2 = JSON.parse(JSON.stringify(canonical));
    v2.formatVersion = 2;
    for (const a of v2.assets) delete a.hasAudio;
    for (const c of v2.clips) delete c.sound;
    const upgraded = parseCanonical(v2);
    const videoClip = upgraded.clips.find((c) => c.id === videoClipId)!;
    assert.equal(videoClip.sound?.enabled, false);

    const current = await store.load(created.id);
    const migrated = structuredClone(current);
    for (const c of migrated.clips) {
      const u = upgraded.clips.find((x) => x.id === c.id);
      if (u?.sound)
        c.sound = {
          enabled: u.sound.enabled,
          gainDb: u.sound.gainDb,
          fadeInFrames: Math.round(u.sound.fadeInTicks / F),
          fadeOutFrames: Math.round(u.sound.fadeOutTicks / F),
        };
    }
    await store.save(migrated, current.revision);
    const after = await exportOnce();
    assert.equal(after, before);
    void head;
  } finally {
    closeWorkers();
    await supervisor?.close().catch(() => {});
    try {
      store?.close();
    } catch {}
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
