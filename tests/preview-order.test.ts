// SS-009: the reference preview's sharing and order behaviour on real renders.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { preview } from "../core/render/preview.ts";
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

// Moving footage, so that every frame differs and order mistakes show.
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-preview-order-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const created = await store.create("Order");
  const mp4 = path.join(root, "src.mp4");
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
      "testsrc2=size=320x180:rate=30:duration=3",
      "-pix_fmt",
      "yuv420p",
      mp4,
    ],
    { windowsHide: true },
  );
  const { project, asset } = await store.importAsset(
    created.id,
    "src.mp4",
    await readFile(mp4),
  );
  const saved = await store.save(
    {
      ...project,
      width: 320,
      height: 180,
      clips: [
        {
          id: crypto.randomUUID(),
          trackId: project.tracks[0].id,
          assetId: asset.id,
          startFrame: 0,
          durationFrames: 90,
          sourceFrame: 0,
          title: null,
        },
      ],
    },
    project.revision,
  );
  return { store, project: saved };
}

const frame = (
  w: Awaited<ReturnType<typeof workspace>>,
  n: number,
  signal?: AbortSignal,
) => preview(w.store, w.project.id, w.project.revision, "frame", n, 1, signal);

test("seeking in any order gives each frame its own identical picture", async () => {
  const forward = await workspace();
  const shuffled = await workspace();
  const frames = [0, 15, 45, 60, 89];
  const expected = new Map<number, Buffer>();
  for (const n of frames)
    expected.set(n, await readFile((await frame(forward, n)).file));
  assert.equal(new Set([...expected.values()].map(String)).size, frames.length);
  // Reverse and random, then back over cached frames.
  for (const n of [89, 0, 60, 15, 45, 0, 89, 45]) {
    const shown = await frame(shuffled, n);
    assert.equal(shown.startFrame, n);
    assert.deepEqual(await readFile(shown.file), expected.get(n), `frame ${n}`);
  }
});

test("a waiter that leaves does not stop a render another still waits for", async () => {
  const w = await workspace();
  const leaving = new AbortController();
  const first = frame(w, 30, leaving.signal).then(
    () => "finished",
    () => "left",
  );
  const second = frame(w, 30);
  leaving.abort();
  assert.equal(await first, "left");
  const shown = await second;
  assert.equal(shown.cached, false);
  assert.ok((await stat(shown.file)).isFile());
});

test("when the last waiter leaves the render stops, and asking again starts afresh", async () => {
  const w = await workspace();
  const a = new AbortController();
  const b = new AbortController();
  const outcome = (p: Promise<unknown>) =>
    p.then(
      () => "finished",
      () => "left",
    );
  const both = [
    outcome(frame(w, 40, a.signal)),
    outcome(frame(w, 40, b.signal)),
  ];
  a.abort();
  b.abort();
  assert.deepEqual(await Promise.all(both), ["left", "left"]);
  const again = await frame(w, 40);
  assert.equal(again.startFrame, 40);
  assert.ok((await stat(again.file)).isFile());
  assert.equal((await frame(w, 40)).cached, true);
});

test("an already cancelled request neither renders nor stays counted", async () => {
  const w = await workspace();
  const gone = new AbortController();
  gone.abort();
  await assert.rejects(frame(w, 50, gone.signal));
  const shown = await frame(w, 50);
  assert.equal(shown.cached, false);
});
