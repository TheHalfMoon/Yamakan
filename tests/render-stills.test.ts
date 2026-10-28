// YU-026b: stills are read once and repeated on demand. A still shows on
// exactly its clip's frames (first and last included) at 30 and
// 24000/1001 fps, a reference frame inside a clip matches the export, and
// one still used by two clips (one transformed) is decoded once.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import { IDENTITY_TRANSFORM } from "../core/effects/registry.ts";
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
const W = 1280;
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );
// The red channel at the frame's centre, frame n of a rendered file.
const red = (file: string, n?: number) => {
  const frame = ffmpeg([
    "-i",
    file,
    ...(n === undefined ? [] : ["-vf", `select=eq(n\\,${n})`]),
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
  return frame[(360 * W + 640) * 3]!;
};

for (const [label, frameRate, tick] of [
  ["30", undefined, 23_520_000],
  ["24000/1001", { num: 24000, den: 1001 }, 29_429_400],
] as const)
  test(`a still shows on exactly its clip's frames at ${label} fps, and a shared still is decoded once`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-stills-"));
    bases.push(root);
    const store = new ProjectStore(root);
    handles.push(store);
    await store.initialize();
    const queue = new JobSupervisor(store);
    handles.push(queue);
    const ctx = {
      store,
      queue,
      principal: {
        id: "browser-ui" as const,
        scopes: new Set(Scopes) as ReadonlySet<Scope>,
      },
    };
    const project = (
      await execute(ctx, "yamakan.project.create", {
        name: "Stills",
        ...(frameRate ? { frameRate } : {}),
      })
    ).result as Project;
    const png = path.join(root, "red.png");
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=320x180",
      "-frames:v",
      "1",
      png,
    ]);
    const { asset } = await store.importAsset(
      project.id,
      "red.png",
      await readFile(png),
    );
    const head = await store.load(project.id);
    const video = head.tracks.find((t) => t.kind === "video")!.id;
    const upper = crypto.randomUUID();
    const a = crypto.randomUUID(),
      b = crypto.randomUUID(),
      c = crypto.randomUUID();
    await execute(ctx, "yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: head.revision,
      operations: [
        { type: "track.add", trackId: upper, name: "Upper", kind: "video" },
        // Frames 3–12 on the lower track; frames 20–24 on the upper one,
        // scaled (the same still, decoded once).
        {
          type: "clip.add",
          clipId: a,
          trackId: video,
          assetId: asset.id,
          title: null,
          startTicks: 3 * tick,
          durationTicks: 10 * tick,
          sourceStartTicks: 0,
        },
        {
          type: "clip.add",
          clipId: b,
          trackId: upper,
          assetId: asset.id,
          title: null,
          startTicks: 20 * tick,
          durationTicks: 5 * tick,
          sourceStartTicks: 0,
        },
        {
          type: "clip.setEffects",
          clipId: b,
          effects: [{ ...IDENTITY_TRANSFORM, scale: 500 }],
        },
        // Frames 28–31 on the upper track, scaled up (YU-026e: its chain
        // stays after the loop, so the loop never holds an enlarged frame).
        {
          type: "clip.add",
          clipId: c,
          trackId: upper,
          assetId: asset.id,
          title: null,
          startTicks: 28 * tick,
          durationTicks: 4 * tick,
          sourceStartTicks: 0,
        },
        {
          type: "clip.setEffects",
          clipId: c,
          effects: [{ ...IDENTITY_TRANSFORM, scale: 1500 }],
        },
      ],
    });
    const p = await store.load(project.id);
    const out = await renderRevision(
      store,
      project.id,
      p.revision,
      ["exports", "stills"],
      new AbortController().signal,
      () => {},
    );
    // Black before, red on every clip frame, black after.
    for (const [n, want] of [
      [2, false],
      [3, true],
      [12, true],
      [13, false],
      [19, false],
      [20, true],
      [24, true],
      [27, false],
      [28, true],
      [31, true],
      [32, false],
    ] as const)
      assert.equal(red(out.output, n) > 200, want, `frame ${n}`);
    // The graph reads the still once and splits it to both clips.
    const graph = await readFile(
      path.join(await store.file(project.id, "exports", "stills"), "graph.txt"),
      "utf8",
    );
    assert.equal(graph.match(/split=3/g)?.length, 1);
    assert.doesNotMatch(graph, /-loop/);
    // YU-026e: each still's fit (and transform) runs once on its one frame,
    // before the loop repeats it, never on every repeated copy.
    const all = graph.split(/;\s*/).filter((l) => /loop=loop=/.test(l));
    assert.equal(all.length, 3);
    // The scaled-up still: its loop comes first, its fit and scale after.
    const up = all.filter((l) => /^\[s\d+_\d+\]loop=loop=/.test(l));
    assert.equal(up.length, 1, graph);
    assert.match(
      up[0]!,
      /fps=\d+\/\d+,.*force_original_aspect_ratio=decrease.*,scale=w=/,
    );
    const chains = all.filter((l) => !up.includes(l));
    assert.equal(chains.length, 2);
    for (const chain of chains) {
      // From its split branch: fit (and the transform's crop/scale), then
      // the loop, its exact timing, and the output rate, in that order.
      const order = [
        /^\[s\d+_\d+\]/,
        /scale=\d+:\d+:force_original_aspect_ratio=decrease/,
        /,loop=loop=\d+:size=1:start=0,/,
        /settb=1\/705600000/,
        /setpts=N\*\d+\+\d+/,
        /fps=\d+\/\d+\[c\d+\]$/,
      ].map((re) => chain.search(re));
      assert.ok(
        order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!)),
        chain,
      );
    }
    // Per-frame work (an opacity fade, a dissolve) never sits before a loop.
    for (const chain of chains)
      assert.doesNotMatch(
        chain.slice(0, chain.indexOf("loop=")),
        /fade=|geq=|colorchannelmixer/,
      );
    // A reference frame inside a clip is the export's frame.
    const shown = await preview(store, project.id, p.revision, "frame", 12);
    assert.ok(red(shown.file) > 200, "reference frame 12");
    const gap = await preview(store, project.id, p.revision, "frame", 13);
    assert.ok(red(gap.file) < 40, "reference frame 13");
  });
