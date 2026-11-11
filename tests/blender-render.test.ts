import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  BLENDER_SCENE_LIMITS,
  BlenderSceneSchema,
  blenderSceneFromCinema,
} from "../core/blender/scene.ts";
import { blenderRuntime, blenderTreeDigests } from "../core/blender/runtime.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import type { Scope } from "../core/command/registry.ts";
import {
  existsSync,
  linkSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { closeBlenderWorkers } from "../core/blender/worker.ts";
import type { Scene3D } from "../core/scene3d.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import {
  boxColours,
  changedPercent,
  moved,
} from "../scripts/lib/frame-checks.ts";
import { planCinemaShot } from "../core/director/cinema-shot.ts";

const bases: string[] = [];
after(async () => {
  closeBlenderWorkers();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

const cinema = (items: Partial<Scene3D["items"][number]>[]): Scene3D =>
  ({
    format: "yamakan.scene3d",
    formatVersion: 1,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    units: "metres",
    eulerOrder: "XYZ",
    camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
    items: items.map((item, i) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`,
      name: `box ${i}`,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      assetId: null,
      ...item,
    })),
  }) as Scene3D;
const settings = {
  width: 160,
  height: 90,
  fps: 24 as const,
  frames: 2,
  samples: 2,
  orbitDegrees: 0,
};

test("a Cinema scene becomes a bounded Blender scene aimed at its boxes", () => {
  const scene = blenderSceneFromCinema(
    cinema([
      { position: { x: 2, y: 0, z: 0 }, color: "#AB12CD" },
      { position: { x: 4, y: 0, z: 0 } },
      { position: { x: 100, y: 0, z: 0 }, visible: false },
    ]),
    { ...settings, orbitDegrees: 90 },
  );
  // Hidden boxes are not rendered; the camera looks at the middle of the shown ones.
  assert.equal(scene.objects.length, 2);
  assert.deepEqual(scene.camera.target, { x: 3, y: 0, z: 0 });
  assert.equal(scene.objects[0].colour, "#ab12cd");
  assert.equal(scene.objects[1].colour, "#888888");
  assert.equal(scene.camera.orbitDegrees, 90);
  assert.equal(scene.camera.focalLengthMm, 35);
  BlenderSceneSchema.parse(scene);
});

test("values a render cannot take are brought within its bounds", () => {
  const scene = blenderSceneFromCinema(
    cinema([
      {
        position: { x: 5000, y: -5000, z: 0 },
        rotation: { x: 0, y: 100, z: 0 },
        scale: { x: -3, y: 1000, z: 0 },
      },
    ]),
    settings,
  );
  const box = scene.objects[0];
  assert.equal(box.position.x, BLENDER_SCENE_LIMITS.maxMetres);
  assert.equal(box.position.y, -BLENDER_SCENE_LIMITS.maxMetres);
  assert.ok(Math.abs(box.rotation.y) <= 4 * Math.PI);
  assert.deepEqual(box.scale, { x: 3, y: 100, z: 0.001 });
});

test("settings outside what a render may ask for are refused", () => {
  for (const bad of [
    { ...settings, width: 1921 },
    { ...settings, width: 161 },
    { ...settings, height: 721 },
    { ...settings, frames: 0 },
    { ...settings, frames: 121 },
    { ...settings, samples: 33 },
    { ...settings, fps: 60 },
    { ...settings, orbitDegrees: 400 },
    { ...settings, script: "import os" },
  ])
    assert.throws(() => blenderSceneFromCinema(cinema([]), bad as never));
});

// The rest runs the real pinned Blender, contained, where it is installed (Windows).
const runtime = await blenderRuntime();
const real = runtime.available
  ? {}
  : { skip: `Blender is not available here: ${runtime.message}` };

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-blender-"));
  bases.push(root);
  const store = new ProjectStore(root);
  await store.initialize();
  const project = await store.create("Blender");
  const supervisor = new JobSupervisor(store);
  await supervisor.start();
  return { store, project, supervisor };
}
async function settled(supervisor: JobSupervisor, jobId: string, ms = 240000) {
  for (let t = 0; t < ms; t += 250) {
    const job = supervisor.status(jobId);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`job ${jobId} did not settle`);
}

test(
  "a real Blender render joins the project as a video asset",
  real,
  async () => {
    const { store, project, supervisor } = await workspace();
    const scene = blenderSceneFromCinema(
      cinema([{ position: { x: 0, y: 0.5, z: -2 }, color: "#6b8cae" }]),
      settings,
    );
    const job = await supervisor.submitBlenderRender(
      project.id,
      scene,
      "test render",
    );
    const done = await settled(supervisor, job.id);
    assert.equal(done.state, "COMPLETED", JSON.stringify(done));
    const after = await store.load(project.id);
    const made = after.assets.find((a) => a.name === "test render.mp4");
    assert.ok(made, "the render is a project asset");
    assert.equal(made!.kind, "video");
    assert.equal(made!.width, 160);
    assert.equal(made!.height, 90);
    await supervisor.close();
    store.close();
  },
);

test(
  "a second render while one runs is refused, and a cancelled one leaves nothing",
  real,
  async () => {
    const { store, project, supervisor } = await workspace();
    // Long enough (minutes) that the cancel lands while it renders.
    const scene = blenderSceneFromCinema(cinema([{}]), {
      ...settings,
      width: 320,
      height: 180,
      samples: 16,
      frames: 120,
    });
    const job = await supervisor.submitBlenderRender(project.id, scene, "long");
    await assert.rejects(
      supervisor.submitBlenderRender(
        project.id,
        { ...scene, frames: 3 },
        "another",
      ),
      /already running/,
    );
    // Cancelled while Blender is rendering: once at least one frame is on disk (progress counts
    // the frames written), long before all 120 could be.
    for (let t = 0; t < 120000; t += 100) {
      if (supervisor.status(job.id).progress > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(supervisor.status(job.id).progress > 0, "Blender was rendering");
    assert.ok(supervisor.status(job.id).progress < 0.5, "and far from done");
    const cancelledAt = Date.now();
    supervisor.cancel(job.id);
    const done = await settled(supervisor, job.id);
    assert.equal(done.state, "CANCELLED");
    // Ended promptly after the cancel, not left to finish its 120 frames (however long the
    // first frame took on a busy machine).
    assert.ok(
      Date.now() - cancelledAt < 30000,
      `${Date.now() - cancelledAt} ms after the cancel`,
    );
    const after = await store.load(project.id);
    assert.equal(after.assets.length, 0, "nothing joined the project");
    // Its attempt folder is gone, and no Blender is left running.
    assert.equal(
      existsSync(await store.file(project.id, "exports", job.id)),
      false,
    );
    const running = execFileSync(
      "tasklist",
      ["/FI", "IMAGENAME eq blender.exe"],
      {
        encoding: "utf8",
      },
    );
    assert.doesNotMatch(running, /blender\.exe/i, "no Blender process is left");
    await supervisor.close();
    store.close();
  },
);

test("the install check refuses links and second names in the tree", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-blender-tree-"));
  bases.push(root);
  mkdirSync(path.join(root, "a"));
  writeFileSync(path.join(root, "a", "one.dll"), "x");
  assert.equal((await blenderTreeDigests(root)).files, 1);
  linkSync(path.join(root, "a", "one.dll"), path.join(root, "a", "two.dll"));
  await assert.rejects(blenderTreeDigests(root), /should not/);
  const other = await mkdtemp(path.join(tmpdir(), "yamakan-blender-tree-"));
  bases.push(other);
  symlinkSync(root, path.join(other, "out"), "junction");
  await assert.rejects(blenderTreeDigests(other), /link/);
});

test("the commands say what is available, and refuse a project with no saved scene", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-blender-cmd-"));
  bases.push(root);
  const store = new ProjectStore(root);
  await store.initialize();
  const project = await store.create("No scene");
  const queue = new JobSupervisor(store);
  const ctx = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const capability = (await execute(ctx, "yamakan.blender.capability", {}))
    .result as { available: boolean; version: string; reason?: string };
  assert.equal(capability.version, "5.3.0");
  assert.equal(capability.available, runtime.available);
  await assert.rejects(
    execute(ctx, "yamakan.blender.render", {
      projectId: project.id,
      settings,
    }),
    (e: { code: string; message: string }) =>
      runtime.available
        ? e.code === "VALIDATION" && /no saved Cinema scene/.test(e.message)
        : e.code === "CAPABILITY_UNAVAILABLE",
  );
  await queue.close();
  store.close();
});

test(
  "a named Cinema scene is rendered, not the one the Cinema page opens",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-shot-render-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const queue = new JobSupervisor(store);
    await queue.start();
    try {
      const ctx = {
        store,
        queue,
        principal: {
          id: "browser-ui" as const,
          scopes: new Set(Scopes) as ReadonlySet<Scope>,
        },
      };
      let project = await store.create("Shot");
      // A decoy the Cinema page would open (the lowest id): one grey box, nothing blue or orange.
      const decoy = planCinemaShot({
        shotId: "6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d",
        direction: { shot: "close" },
        seconds: 1,
        fps: 30,
      }).scene;
      decoy.items[0].color = "#777777";
      const commit = async (documentId: string, scene: unknown) => {
        project = await store.commitDocument({
          projectId: project.id,
          expectedRevision: project.revision,
          documentId,
          kind: "cinemaScene",
          schemaVersion: 1,
          expectedContentHash: null,
          source: { bytes: Buffer.from(JSON.stringify(scene), "utf8") },
        });
      };
      await commit("00000000-0000-4000-8000-000000000001", decoy);
      // The shot: a medium shot (the blue subject and the orange block), orbiting.
      const shot = planCinemaShot({
        shotId: "5f0d3c2a-8b1e-4c7d-9a6f-1e2d3c4b5a60",
        direction: { shot: "medium", movement: "orbit" },
        seconds: 1,
        fps: 30,
      });
      const shotDocument = "ffffffff-ffff-4fff-8fff-000000000001";
      await commit(shotDocument, shot.scene);

      assert.equal(
        toCommandError(
          await execute(ctx, "yamakan.blender.render", {
            projectId: project.id,
            documentId: "ffffffff-ffff-4fff-8fff-000000000002",
            settings: shot.settings,
          }).catch((e) => e),
        ).code,
        "NOT_FOUND",
      );
      const job = (
        await execute(ctx, "yamakan.blender.render", {
          projectId: project.id,
          documentId: shotDocument,
          settings: shot.settings,
          name: "Planned shot",
        })
      ).result as { id: string };
      let done = queue.status(job.id);
      for (
        let t = 0;
        t < 300000 &&
        !["COMPLETED", "FAILED", "CANCELLED"].includes(done.state);
        t += 250
      ) {
        await new Promise((r) => setTimeout(r, 250));
        done = queue.status(job.id);
      }
      assert.equal(done.state, "COMPLETED", JSON.stringify(done));
      const asset = (await store.load(project.id)).assets.find(
        (a) => a.name === "Planned shot.mp4",
      );
      assert.ok(asset);
      const { file } = await store.assetFile(project.id, asset!.id);
      const raw = execFileSync(
        mediaTools().ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          file,
          "-vf",
          "scale=64:36",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgb24",
          "-",
        ],
        { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
      );
      const size = 64 * 36 * 3;
      const frames = Array.from({ length: raw.length / size }, (_, i) =>
        raw.subarray(i * size, (i + 1) * size),
      );
      assert.equal(frames.length, 30);
      // The shot's own scene: its blue subject and orange block are there, which the decoy has not.
      assert.deepEqual(boxColours(frames), { bluish: true, orangish: true });
      // And the orbit moves the picture.
      const motion = moved(frames[0], frames[15], frames[29]);
      assert.equal(motion.moved, true, JSON.stringify(motion.motion));
    } finally {
      await queue.close();
      store.close();
    }
  },
);

test(
  "a cinema-blender Director run: a story shot planned, rendered, approved by a person, and placed",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-director-shot-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const queue = new JobSupervisor(store);
    await queue.start();
    try {
      const { loadRun, directorNext } =
        await import("../core/director/runtime.ts");
      const browser = {
        store,
        queue,
        principal: {
          id: "browser-ui" as const,
          scopes: new Set(Scopes) as ReadonlySet<Scope>,
        },
      };
      const agent = {
        store,
        queue,
        principal: {
          id: "agent:director-test" as const,
          scopes: new Set([
            "project:read",
            "project:write",
            "render:execute",
            "job:read",
          ]) as ReadonlySet<Scope>,
        },
      };
      const created = (
        await execute(browser, "yamakan.project.create", { name: "Director" })
      ).result as { id: string; revision: number };
      const projectId = created.id;
      const shotId = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
      const storyDocumentId = "8d2e3f4a-5b6c-4d7e-9f8a-0b1c2d3e4f5a";
      const sceneId = "9e3f4a5b-6c7d-4e8f-8a9b-1c2d3e4f5a6b";
      const story = (takes: unknown[], selectedTakeId: string | null) => ({
        format: "yamakan.story",
        formatVersion: 1,
        title: "Shots",
        scenes: [
          {
            id: sceneId,
            name: "Scene one",
            shots: [
              {
                id: shotId,
                name: "Opening",
                durationTicks: 705_600_000,
                notes: "",
                referencePacks: [],
                takes,
                selectedTakeId,
              },
            ],
          },
        ],
      });
      const saved = (
        await execute(browser, "yamakan.story.save", {
          projectId,
          expectedRevision: created.revision,
          documentId: storyDocumentId,
          expectedContentHash: null,
          story: story([], null),
        })
      ).result as { document: { contentHash: string } };
      const run = (
        await execute(agent, "yamakan.director.start", {
          projectId,
          pipelineName: "cinema-blender",
        })
      ).result as { id: string };

      // An agent may plan and render the shot.
      const rendered = (
        await execute(agent, "yamakan.director.renderShot", {
          runId: run.id,
          storyDocumentId,
          shotId,
          direction: { shot: "medium", movement: "orbit", light: "golden" },
        })
      ).result as {
        job: { id: string };
        followed: string[];
        notFollowed: string[];
        scene: { items: unknown[] };
        settings: { frames: number; fps: number };
      };
      assert.deepEqual(rendered.followed, ["shot:medium", "movement:orbit"]);
      assert.deepEqual(rendered.notFollowed, ["light:golden"]);
      assert.equal(rendered.scene.items.length, 2);
      assert.deepEqual(
        [rendered.settings.frames, rendered.settings.fps],
        [30, 30],
      );
      let done = queue.status(rendered.job.id);
      for (
        let t = 0;
        t < 300000 &&
        !["COMPLETED", "FAILED", "CANCELLED"].includes(done.state);
        t += 250
      ) {
        await new Promise((r) => setTimeout(r, 250));
        done = queue.status(rendered.job.id);
      }
      assert.equal(done.state, "COMPLETED", JSON.stringify(done));
      const assetId = /^asset:(.+)$/.exec(done.artifact ?? "")![1];
      const asset = (await store.load(projectId)).assets.find(
        (a) => a.id === assetId,
      )!;
      assert.equal(asset.name, "Opening.mp4");

      // The render stage waits for a person: an agent cannot approve it.
      await execute(agent, "yamakan.director.advance", {
        runId: run.id,
        stage: "render",
        status: "awaiting_human",
        outputHash: asset.hash,
        expectedVersion: (await loadRun(store, run.id)).version,
      });
      await assert.rejects(
        execute(agent, "yamakan.director.approve", {
          runId: run.id,
          stage: "render",
          outputHash: asset.hash,
          ttlMs: 60 * 60 * 1000,
          expectedVersion: (await loadRun(store, run.id)).version,
        }),
      );
      assert.equal((await directorNext(store, run.id)).kind, "blocked");
      await execute(browser, "yamakan.director.approve", {
        runId: run.id,
        stage: "render",
        outputHash: asset.hash,
        ttlMs: 60 * 60 * 1000,
        expectedVersion: (await loadRun(store, run.id)).version,
      });
      assert.deepEqual(await directorNext(store, run.id), {
        kind: "stage",
        stage: "place",
      });

      // Placed: the approved video becomes the shot's selected take, and the story goes on
      // the timeline.
      const takeId = "af4a5b6c-7d8e-4f9a-8b0c-2d3e4f5a6b7c";
      await execute(browser, "yamakan.story.save", {
        projectId,
        expectedRevision: (await store.load(projectId)).revision,
        documentId: storyDocumentId,
        expectedContentHash: saved.document.contentHash,
        story: story(
          [
            {
              id: takeId,
              assetId,
              sourceStartTicks: 0,
              lineage: {
                label: "Blender: shot medium, orbit",
                outputHash: asset.hash,
                inputs: [],
              },
            },
          ],
          takeId,
        ),
      });
      const before = await store.load(projectId);
      const track = before.tracks.find((t) => t.kind === "video")!;
      await execute(browser, "yamakan.story.assemble", {
        projectId,
        expectedRevision: before.revision,
        documentId: storyDocumentId,
        trackId: track.id,
      });
      const placed = await store.load(projectId);
      assert.ok(placed.clips.some((c) => c.assetId === assetId));
      await execute(agent, "yamakan.director.advance", {
        runId: run.id,
        stage: "place",
        status: "completed",
        outputHash: asset.hash,
        expectedVersion: (await loadRun(store, run.id)).version,
      });
      assert.deepEqual(await directorNext(store, run.id), { kind: "done" });

      // The video is the shot's planned scene: its blue subject and orange block, moving.
      const { file } = await store.assetFile(projectId, assetId);
      const raw = execFileSync(
        mediaTools().ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          file,
          "-vf",
          "scale=64:36",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgb24",
          "-",
        ],
        { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
      );
      const size = 64 * 36 * 3;
      const frames = Array.from({ length: raw.length / size }, (_, i) =>
        raw.subarray(i * size, (i + 1) * size),
      );
      assert.deepEqual(boxColours(frames), { bluish: true, orangish: true });
      assert.equal(moved(frames[0], frames[15], frames[29]).moved, true);
    } finally {
      await queue.close();
      store.close();
    }
  },
);

test(
  "camera moves are made: a push grows the subject, a pull shrinks it, a pan slides it, handheld sways",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-camera-moves-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const project = await store.create("Moves");
    const supervisor = new JobSupervisor(store);
    await supervisor.start();
    try {
      // The same medium shot each time (the blue subject and the orange block), small and quick.
      const shotId = "6e5d4c3b-2a19-4f8e-9d7c-6b5a49382716";
      const W = 64;
      const H = 36;
      const frames = 12;
      // The share of the picture that is not background (the colour of its top-left corner, as
      // rendered), and the middle of it across.
      const measure = (f: Uint8Array) => {
        const background = [f[0], f[1], f[2]];
        let shown = 0;
        let across = 0;
        for (let i = 0; i < W * H; i++) {
          const d = Math.max(
            Math.abs(f[i * 3] - background[0]),
            Math.abs(f[i * 3 + 1] - background[1]),
            Math.abs(f[i * 3 + 2] - background[2]),
          );
          if (d > 24) {
            shown++;
            across += (i % W) / W;
          }
        }
        return { share: shown / (W * H), middle: shown ? across / shown : 0.5 };
      };
      const render = async (movement: string) => {
        const plan = planCinemaShot({
          shotId,
          direction: { shot: "medium", movement },
          seconds: frames / 24,
          fps: 24,
        });
        const job = await supervisor.submitBlenderRender(
          project.id,
          blenderSceneFromCinema(plan.scene, {
            ...plan.settings,
            width: 160,
            height: 90,
            samples: 4,
          }),
          movement,
        );
        const done = await settled(supervisor, job.id);
        assert.equal(done.state, "COMPLETED", JSON.stringify(done));
        const assetId = /^asset:(.+)$/.exec(done.artifact ?? "")![1];
        const { file } = await store.assetFile(project.id, assetId);
        const raw = execFileSync(
          mediaTools().ffmpeg,
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            file,
            "-vf",
            `scale=${W}:${H}`,
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
        );
        const size = W * H * 3;
        const all = Array.from({ length: raw.length / size }, (_, i) =>
          raw.subarray(i * size, (i + 1) * size),
        );
        assert.equal(all.length, frames);
        // The most any frame changes from the one before: a sway, not a flicker.
        let step = 0;
        for (let i = 1; i < frames; i++)
          step = Math.max(step, changedPercent(all[i - 1], all[i]));
        return { first: all[0], last: all[frames - 1], step };
      };
      const results: Record<string, unknown> = {};
      const still = await render("still");
      assert.equal(changedPercent(still.first, still.last), 0);

      const push = await render("push");
      const pushed = [measure(push.first).share, measure(push.last).share];
      assert.ok(pushed[1] > pushed[0] * 1.3, `push: ${pushed}`);

      const pull = await render("pull");
      const pulled = [measure(pull.first).share, measure(pull.last).share];
      assert.ok(pulled[1] < pulled[0] / 1.3, `pull: ${pulled}`);

      const pan = await render("pan");
      const panned = [measure(pan.first).middle, measure(pan.last).middle];
      assert.ok(Math.abs(panned[1] - panned[0]) > 0.15, `pan: ${panned}`);

      const handheld = await render("handheld");
      const swayed = changedPercent(handheld.first, handheld.last);
      const held = [
        measure(handheld.first).share,
        measure(handheld.last).share,
      ];
      // It moves, slowly from frame to frame, and the shot stays about the same size.
      assert.ok(swayed > 0, `handheld changed ${swayed}%`);
      assert.ok(
        handheld.step <= Math.max(1, swayed),
        `handheld: ${handheld.step}% from one frame to the next, ${swayed}% over the shot`,
      );
      assert.ok(
        Math.abs(held[1] - held[0]) < 0.5 * held[0],
        `handheld: ${held}`,
      );
      Object.assign(results, {
        pushed,
        pulled,
        panned,
        swayed,
        held,
        handheldStep: handheld.step,
      });
      console.log("camera moves", JSON.stringify(results));
    } finally {
      await supervisor.close();
      store.close();
    }
  },
);
