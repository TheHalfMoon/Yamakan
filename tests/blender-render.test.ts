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
import { boxColours, moved } from "../scripts/lib/frame-checks.ts";
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
      t < 300000 && !["COMPLETED", "FAILED", "CANCELLED"].includes(done.state);
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
      { windowsHide: true, maxBuffer: 1 << 26 },
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
    await queue.close();
    store.close();
  },
);
