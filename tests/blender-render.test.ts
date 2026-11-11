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
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { crc32, deflateSync } from "node:zlib";
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
  assert.equal((scene.objects[0] as { colour: string }).colour, "#ab12cd");
  assert.equal((scene.objects[1] as { colour: string }).colour, "#888888");
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
          direction: { shot: "medium", movement: "orbit", light: "studio" },
        })
      ).result as {
        job: { id: string };
        followed: string[];
        notFollowed: string[];
        scene: { items: unknown[] };
        settings: { frames: number; fps: number };
      };
      assert.deepEqual(rendered.followed, [
        "shot:medium",
        "movement:orbit",
        "light:studio",
      ]);
      assert.deepEqual(rendered.notFollowed, []);
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
        handheld.step <= swayed / 2,
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

test(
  "each light changes the picture as it says: night darker, studio brighter, golden warmer, morning cooler",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-lighting-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const project = await store.create("Light");
    const supervisor = new JobSupervisor(store);
    await supervisor.start();
    try {
      const shotId = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2918";
      const W = 64;
      const H = 36;
      // The mean brightness and warmth (red over blue), 0 to 255, of the lit boxes only: every
      // pixel unlike the sky (the top-left corner). The sky changes with each light too, so it is
      // left out: what is measured is the sun on the boxes.
      const measure = (f: Uint8Array) => {
        const sky = [f[0], f[1], f[2]];
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < W * H; i++) {
          const px = [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]];
          if (Math.max(...px.map((v, k) => Math.abs(v - sky[k]))) <= 24)
            continue;
          r += px[0];
          g += px[1];
          b += px[2];
          n++;
        }
        assert.ok(n > 20, "the boxes are in the picture");
        return {
          brightness: (r + g + b) / (3 * n),
          warmth: (r - b) / n,
          boxes: n,
          frame: f,
        };
      };
      const render = async (light?: string) => {
        const plan = planCinemaShot({
          shotId,
          direction: light ? { shot: "medium", light } : { shot: "medium" },
          seconds: 1 / 24,
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
          light ?? "neutral",
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
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
        );
        return measure(raw.subarray(0, W * H * 3));
      };
      const neutral = await render();
      const morning = await render("morning");
      const golden = await render("golden");
      const night = await render("night");
      const studio = await render("studio");
      const seen = Object.fromEntries(
        Object.entries({ neutral, morning, golden, night, studio }).map(
          ([k, v]) => [
            k,
            {
              brightness: Math.round(v.brightness),
              warmth: Math.round(v.warmth),
              boxes: v.boxes,
            },
          ],
        ),
      );
      console.log("lighting", JSON.stringify(seen));
      assert.ok(
        night.brightness < neutral.brightness * 0.6,
        JSON.stringify(seen),
      );
      assert.ok(studio.brightness > neutral.brightness, JSON.stringify(seen));
      assert.ok(golden.warmth > neutral.warmth + 10, JSON.stringify(seen));
      assert.ok(morning.warmth < neutral.warmth, JSON.stringify(seen));
      // Each light makes a picture of its own.
      for (const [name, other] of Object.entries({
        morning,
        golden,
        night,
        studio,
      }))
        assert.ok(
          changedPercent(neutral.frame, other.frame) > 5,
          `${name} looks like the neutral light`,
        );
    } finally {
      await supervisor.close();
      store.close();
    }
  },
);

test(
  "the compositor's finish shows: glow brightens, a vignette darkens the corners, film does both",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-finish-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const project = await store.create("Finish");
    const supervisor = new JobSupervisor(store);
    await supervisor.start();
    try {
      const W = 64;
      const H = 36;
      const plan = planCinemaShot({
        shotId: "3d4e5f60-7182-49a0-8bcd-2e3f40516273",
        direction: { shot: "medium", light: "studio" },
        seconds: 1 / 24,
        fps: 24,
      });
      // Mean brightness of the whole frame, of its four corner blocks, and of its middle block.
      const measure = (f: Uint8Array) => {
        const at = (x: number, y: number) => {
          const i = (y * W + x) * 3;
          return (f[i] + f[i + 1] + f[i + 2]) / 3;
        };
        const block = (x0: number, y0: number, w: number, h: number) => {
          let sum = 0;
          for (let y = y0; y < y0 + h; y++)
            for (let x = x0; x < x0 + w; x++) sum += at(x, y);
          return sum / (w * h);
        };
        const c = 6;
        return {
          all: block(0, 0, W, H),
          corners:
            (block(0, 0, c, c) +
              block(W - c, 0, c, c) +
              block(0, H - c, c, c) +
              block(W - c, H - c, c, c)) /
            4,
          middle: block(W / 2 - c, H / 2 - c, 2 * c, 2 * c),
          frame: f,
        };
      };
      const render = async (
        finish?: "glow" | "vignette" | "film",
        fringeOnly = false,
      ) => {
        const scene = blenderSceneFromCinema(plan.scene, {
          ...plan.settings,
          width: 160,
          height: 90,
          samples: 4,
          ...(finish ? { finish } : {}),
        });
        // The lens fringe alone, at its most, to see it apart from the glow and vignette.
        if (fringeOnly)
          scene.finish = { glow: 0, vignette: 0, dispersion: 0.1 };
        const job = await supervisor.submitBlenderRender(
          project.id,
          scene,
          fringeOnly ? "fringe" : (finish ?? "none"),
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
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
        );
        return measure(raw.subarray(0, W * H * 3));
      };
      const none = await render();
      const glow = await render("glow");
      const vignette = await render("vignette");
      const film = await render("film");
      const fringe = await render(undefined, true);
      // How far apart the colour channels are, over the picture: a lens fringe parts them at
      // the boxes' edges.
      const parted = (f: Uint8Array) => {
        let sum = 0;
        for (let i = 0; i < W * H; i++)
          sum +=
            Math.abs(f[i * 3] - f[i * 3 + 1]) +
            Math.abs(f[i * 3 + 1] - f[i * 3 + 2]);
        return sum / (W * H);
      };
      const seen = Object.fromEntries(
        Object.entries({ none, glow, vignette, film }).map(([k, v]) => [
          k,
          {
            all: Math.round(v.all),
            corners: Math.round(v.corners),
            middle: Math.round(v.middle),
          },
        ]),
      );
      console.log(
        "finish",
        JSON.stringify(seen),
        "parted",
        parted(none.frame).toFixed(2),
        parted(fringe.frame).toFixed(2),
      );
      assert.ok(
        parted(fringe.frame) > parted(none.frame) + 0.3,
        `the fringe parts no colours: ${parted(none.frame)} against ${parted(fringe.frame)}`,
      );
      const falloff = (m: typeof none) => m.corners / Math.max(1, m.middle);
      // The glow lifts the whole picture a little, most where the lit boxes are.
      assert.ok(glow.all > none.all + 4, `glow: ${JSON.stringify(seen)}`);
      assert.ok(glow.middle > none.middle + 4, `glow: ${JSON.stringify(seen)}`);
      assert.ok(
        falloff(vignette) < falloff(none) * 0.8,
        `vignette: ${JSON.stringify(seen)}`,
      );
      assert.ok(
        falloff(film) < falloff(none) * 0.9,
        `film: ${JSON.stringify(seen)}`,
      );
      // Film's glow lifts the middle while its vignette lowers the corners.
      assert.ok(film.middle > none.middle + 2, `film: ${JSON.stringify(seen)}`);
      // The vignette changes whole cells of the picture, not just a shade.
      assert.ok(
        changedPercent(none.frame, vignette.frame) > 3,
        "the vignette looks like no finish",
      );
    } finally {
      await supervisor.close();
      store.close();
    }
  },
);

// A solid-colour PNG, for a model's own texture.
function solidPng(rgb: [number, number, number], side = 4) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([
    Buffer.from([0]),
    ...Array.from({ length: side }, () => Buffer.from(rgb)),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array(side).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A bar as a .glb: a box mesh of the given half sizes, red by its own material, or coloured
// only by an embedded texture. `scale` is a node scale inside the file; `offset` moves the
// vertices away from the origin; `parent` puts the mesh under a translated parent node. The
// fit to a 1 m box takes all of these out.
function redBar(
  scale = 1,
  {
    half = [1, 0.25, 0.25] as [number, number, number],
    offset = [0, 0, 0] as [number, number, number],
    parent = false,
    texture = null as Buffer | null,
  } = {},
) {
  const [hx, hy, hz] = half;
  const positions = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ].map(([x, y, z]) => [x + offset[0], y + offset[1], z + offset[2]]);
  // prettier-ignore
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
  ];
  // Positions (96 bytes), indices (72), texture coordinates (64), then the image.
  const image = texture ?? Buffer.alloc(0);
  const imageAt = 96 + 72 + 64;
  const bin = Buffer.alloc(imageAt + Math.ceil(image.length / 4) * 4);
  positions.flat().forEach((v, i) => bin.writeFloatLE(v, i * 4));
  indices.forEach((v, i) => bin.writeUInt16LE(v, 96 + i * 2));
  [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1].forEach((v, i) =>
    bin.writeFloatLE(v, 168 + i * 4),
  );
  image.copy(bin, imageAt);
  const mesh = {
    mesh: 0,
    ...(scale !== 1 ? { scale: [scale, scale, scale] } : {}),
  };
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: parent ? [{ translation: [3, -2, 1], children: [1] }, mesh] : [mesh],
    meshes: [
      {
        primitives: [
          {
            attributes: texture
              ? { POSITION: 0, TEXCOORD_0: 2 }
              : { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: texture ? [1, 1, 1, 1] : [1, 0, 0, 1],
          ...(texture ? { baseColorTexture: { index: 0 } } : {}),
          metallicFactor: 0,
          roughnessFactor: 0.6,
        },
      },
    ],
    ...(texture
      ? {
          images: [{ bufferView: 3, mimeType: "image/png" }],
          textures: [{ source: 0 }],
        }
      : {}),
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96 },
      { buffer: 0, byteOffset: 96, byteLength: 72 },
      { buffer: 0, byteOffset: 168, byteLength: 64 },
      ...(texture
        ? [{ buffer: 0, byteOffset: imageAt, byteLength: image.length }]
        : []),
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3" },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
      { bufferView: 2, componentType: 5126, count: 8, type: "VEC2" },
    ],
  };
  const text = Buffer.from(JSON.stringify(gltf), "utf8");
  const json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(json);
  const header = Buffer.alloc(28);
  const length = 20 + json.length + 8 + bin.length;
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header.subarray(0, 20), json, binHeader, bin]);
}

test("a Cinema item's model maps to a model object; a render holds at most eight", () => {
  const digest = "a".repeat(64);
  const scene = blenderSceneFromCinema(
    cinema([{ model: digest, color: "#ff0000" }, {}]),
    settings,
  );
  assert.deepEqual(
    scene.objects.map((o) => o.shape),
    ["model", "box"],
  );
  assert.equal((scene.objects[0] as { model: string }).model, digest);
  assert.equal("colour" in scene.objects[0], false);
  assert.throws(
    () =>
      BlenderSceneSchema.parse(
        blenderSceneFromCinema(
          cinema(Array.from({ length: 9 }, () => ({ model: digest }))),
          settings,
        ),
      ),
    /at most 8 3D models/,
  );
  assert.throws(() =>
    BlenderSceneSchema.parse({
      ...scene,
      objects: [{ ...scene.objects[0], model: "../../etc/passwd" }],
    }),
  );
});

test(
  "a stored 3D model renders with its own material and shape, fitted to a 1 m box",
  real,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-model-"));
    bases.push(root);
    const store = new ProjectStore(root);
    await store.initialize();
    const project = await store.create("Models");
    const supervisor = new JobSupervisor(store);
    await supervisor.start();
    try {
      const W = 160;
      const H = 90;
      const upload = async (bytes: Buffer) =>
        (
          await store.importCinemaModel(
            project.id,
            (async function* () {
              yield bytes;
            })(),
            bytes.length,
          )
        ).digest;
      const small = await upload(redBar(1));
      const large = await upload(redBar(50));
      assert.notEqual(small, large);
      // Red pixels in the first frame, and how far across and down they spread.
      const render = async (
        item: Partial<Scene3D["items"][number]>,
        name: string,
      ) => {
        const scene = blenderSceneFromCinema(cinema([item]), {
          ...settings,
          width: W,
          height: H,
          frames: 1,
          samples: 4,
        });
        const job = await supervisor.submitBlenderRender(
          project.id,
          scene,
          name,
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
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
        ).subarray(0, W * H * 3);
        let red = 0;
        let green = 0;
        let [x0, x1, y0, y1] = [W, -1, H, -1];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 3;
            const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
            if (g > 90 && g > 2 * r && g > 2 * b) green++;
            if (r > 90 && r > 2 * g && r > 2 * b) {
              red++;
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
          }
        return {
          red,
          green,
          wide: x1 - x0 + 1,
          tall: y1 - y0 + 1,
          cx: (x0 + x1) / 2,
          cy: (y0 + y1) / 2,
        };
      };
      const box = await render({ color: "#888888" }, "box");
      const model = await render({ model: small }, "model");
      const scaled = await render({ model: large }, "scaled");
      console.log("model", JSON.stringify({ box, model, scaled }));
      // The grey box has no red; the model brings its own red material.
      assert.equal(box.red, 0);
      assert.ok(model.red > 60, `${model.red} red pixels`);
      // A bar, wider than it is tall, as its mesh is (a box would be about as wide as tall).
      assert.ok(model.wide > 1.6 * model.tall, JSON.stringify(model));
      // Fifty times larger inside the file, the same size on screen: both fit a 1 m box.
      assert.ok(
        Math.abs(scaled.red - model.red) <= 0.1 * model.red,
        JSON.stringify({ model, scaled }),
      );
      // Tall along glTF's up axis, its vertices far from the origin, under a moved parent node:
      // it stands up (taller than wide), and sits where the plain bar did.
      const tall = await render(
        {
          model: await upload(
            redBar(1, {
              half: [0.25, 1, 0.25],
              offset: [6, 0, 0],
              parent: true,
            }),
          ),
        },
        "tall",
      );
      // Coloured only by an embedded PNG texture, decoded inside the sandbox.
      const textured = await render(
        {
          model: await upload(redBar(1, { texture: solidPng([0, 220, 0]) })),
        },
        "textured",
      );
      console.log("model placed", JSON.stringify({ tall, textured }));
      assert.ok(tall.tall > 1.6 * tall.wide, JSON.stringify(tall));
      assert.ok(
        Math.abs(tall.cx - model.cx) <= 3 && Math.abs(tall.cy - model.cy) <= 3,
        JSON.stringify({ model, tall }),
      );
      assert.equal(textured.red, 0);
      assert.ok(textured.green > 60, JSON.stringify(textured));

      // A model this project does not hold is refused when the render is asked for.
      const missing = blenderSceneFromCinema(
        cinema([{ model: "c".repeat(64) }]),
        settings,
      );
      await assert.rejects(
        supervisor.submitBlenderRender(project.id, missing, "missing"),
        /Model not found/,
      );
      // A stored copy changed on disk (same length) stops the render before Blender reads it.
      const stored = await store.cinemaModelFile(project.id, small);
      const bytes = readFileSync(stored);
      bytes[bytes.length - 1] ^= 0xff;
      writeFileSync(stored, bytes);
      const tampered = blenderSceneFromCinema(cinema([{ model: small }]), {
        ...settings,
        frames: 1,
      });
      const job = await supervisor.submitBlenderRender(
        project.id,
        tampered,
        "tampered",
      );
      const done = await settled(supervisor, job.id);
      assert.equal(done.state, "FAILED");
      assert.match(JSON.stringify(done), /does not match its digest/);
    } finally {
      await supervisor.close();
      store.close();
    }
  },
);
