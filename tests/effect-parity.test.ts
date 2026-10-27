// YU-020: a typed transform/crop effect. The export and the reference
// preview draw it the same way (golden regions of a two-colour still); an
// identity transform leaves the output as it was; it persists, undoes,
// redoes and reopens; hostile values are refused before any filter exists.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import { compilePlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { fromEditView, parseCanonical } from "../core/canonical.ts";
import {
  IDENTITY_TRANSFORM,
  type TransformEffect,
} from "../core/effects/registry.ts";
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
const FRAME = 23_520_000; // flicks per 30 fps frame
const W = 1280; // the default 1280x720 output
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-effects-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Effects" })
  ).result as Project;
  // A 320x180 still: red left half, blue right half.
  const still = path.join(root, "halves.png");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=160x180",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x180",
    "-filter_complex",
    "[0][1]hstack",
    "-frames:v",
    "1",
    still,
  ]);
  const { asset } = await store.importAsset(
    project.id,
    "halves.png",
    await readFile(still),
  );
  const head = await store.load(project.id);
  const clipId = crypto.randomUUID();
  await execute(browser, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: head.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: head.tracks.find((t) => t.kind === "video")!.id,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 30 * FRAME,
        sourceStartTicks: 0,
      },
    ],
  });
  return { root, store, queue, browser, projectId: project.id, clipId };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = (c: Ctx) => c.store.load(c.projectId);

async function setTransform(c: Ctx, t: TransformEffect | null) {
  return (
    await execute(c.browser, "yamakan.clip.setEffects", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      clipId: c.clipId,
      effects: t ? [t] : null,
    })
  ).result as Project;
}

// One decoded frame as RGB, and a colour name for a pixel.
function rgb(file: string, at?: string): Buffer {
  return ffmpeg([
    ...(at ? ["-ss", at] : []),
    "-i",
    file,
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
}
function colour(frame: Buffer, x: number, y: number) {
  const i = (y * W + x) * 3;
  const [r, g, b] = [frame[i]!, frame[i + 1]!, frame[i + 2]!];
  if (r > 160 && g < 80 && b < 80) return "red";
  if (b > 160 && r < 80 && g < 80) return "blue";
  if (r < 40 && g < 40 && b < 40) return "black";
  return `rgb(${r},${g},${b})`;
}

async function exportFrame(c: Ctx) {
  const p = await head(c);
  const out = await renderRevision(
    c.store,
    c.projectId,
    p.revision,
    ["exports", `r${p.revision}`],
    new AbortController().signal,
    () => {},
  );
  return { frame: rgb(out.output, "0.5"), plan: out.plan };
}
async function previewFrame(c: Ctx) {
  const p = await head(c);
  return rgb(
    (await preview(c.store, c.projectId, p.revision, "frame", 15)).file,
  );
}

const T = (patch: Partial<TransformEffect>): TransformEffect => ({
  ...IDENTITY_TRANSFORM,
  ...patch,
  crop: { ...IDENTITY_TRANSFORM.crop, ...patch.crop },
});

test("export and reference preview draw crop, scale and offset the same, at golden regions", async () => {
  const c = await workspace();
  const cases: [string, TransformEffect, [number, number, string][]][] = [
    [
      // The right (blue) half only, fitted to the frame: 640x720 centred.
      "crop left half",
      T({ crop: { left: 500, top: 0, right: 0, bottom: 0 } }),
      [
        [640, 360, "blue"],
        [400, 360, "blue"],
        [200, 360, "black"],
        [1100, 360, "black"],
      ],
    ],
    [
      // Half size about the centre: 640x360 at (320, 180).
      "scale 0.5",
      T({ scale: 500 }),
      [
        [480, 360, "red"],
        [800, 360, "blue"],
        [100, 100, "black"],
        [640, 650, "black"],
      ],
    ],
    [
      // Half size, a quarter frame right and a quarter frame up.
      "scale 0.5, offset",
      T({ scale: 500, offsetX: 250, offsetY: -250 }),
      [
        [800, 180, "red"],
        [1120, 180, "blue"],
        [400, 180, "black"],
        [800, 500, "black"],
      ],
    ],
  ];
  for (const [label, t, rois] of cases) {
    await setTransform(c, t);
    const exported = await exportFrame(c);
    assert.deepEqual(exported.plan.layers[0]?.transform, t, label);
    const reference = await previewFrame(c);
    for (const [x, y, want] of rois) {
      assert.equal(
        colour(exported.frame, x, y),
        want,
        `${label} export ${x},${y}`,
      );
      assert.equal(colour(reference, x, y), want, `${label} preview ${x},${y}`);
    }
  }
});

test("an identity transform leaves the plan and the output exactly as before", async () => {
  const c = await workspace();
  const before = await exportFrame(c);
  assert.equal(before.plan.layers[0]?.transform, undefined);
  // An explicit identity is stored but compiles to nothing.
  const canonical = fromEditView(await head(c));
  canonical.clips[0]!.effects = [IDENTITY_TRANSFORM];
  const fonts = await titleFonts();
  const hash = "0".repeat(64);
  const plain = fromEditView(await head(c));
  assert.equal(
    compilePlan(canonical, hash, fonts).plan.planHash,
    compilePlan(plain, hash, fonts).plan.planHash,
  );
  // Setting and then resetting a transform gives back the same picture.
  await setTransform(c, T({ scale: 700 }));
  const reset = await setTransform(c, null);
  assert.equal(reset.clips[0]!.effects, undefined);
  const after = await exportFrame(c);
  assert.equal(after.plan.layers[0]?.transform, undefined);
  assert.ok(after.frame.equals(before.frame), "same decoded frame");
});

test("a transform persists, undoes, redoes and reopens", async () => {
  const c = await workspace();
  const t = T({
    scale: 1500,
    offsetX: -100,
    crop: { left: 0, top: 100, right: 0, bottom: 50 },
  });
  const set = await setTransform(c, t);
  assert.deepEqual(set.clips[0]!.effects, [t]);
  const undone = (
    await execute(c.browser, "yamakan.project.undo", {
      projectId: c.projectId,
      expectedRevision: set.revision,
    })
  ).result as Project;
  assert.equal(undone.clips[0]!.effects, undefined);
  const redone = (
    await execute(c.browser, "yamakan.project.redo", {
      projectId: c.projectId,
      expectedRevision: undone.revision,
    })
  ).result as Project;
  assert.deepEqual(redone.clips[0]!.effects, [t]);
  await c.queue.close();
  c.store.close();
  const reopened = new ProjectStore(c.root);
  handles.push(reopened);
  await reopened.initialize();
  assert.deepEqual((await reopened.load(c.projectId)).clips[0]!.effects, [t]);
});

test("NaN, huge scale, unknown effects and filter text are refused; effects stay on footage and stills", async () => {
  const c = await workspace();
  const bad: unknown[] = [
    [{ ...IDENTITY_TRANSFORM, scale: Number.NaN }],
    [{ ...IDENTITY_TRANSFORM, scale: Number.POSITIVE_INFINITY }],
    [{ ...IDENTITY_TRANSFORM, scale: 1e9 }],
    [{ ...IDENTITY_TRANSFORM, scale: 4001 }],
    [{ ...IDENTITY_TRANSFORM, scale: 99 }],
    [{ ...IDENTITY_TRANSFORM, scale: 1000.5 }],
    [{ ...IDENTITY_TRANSFORM, offsetX: "0:ass=x.ass" }],
    [{ ...IDENTITY_TRANSFORM, offsetY: "(H-h)/2,movie=/etc/passwd" }],
    [{ ...IDENTITY_TRANSFORM, version: 2 }],
    [{ ...IDENTITY_TRANSFORM, filter: "drawtext=text=x" }],
    [{ type: "blur", version: 1, radius: 4 }],
    [{ type: "lut", version: 1, path: "C:\\luts\\x.cube" }],
    [
      {
        ...IDENTITY_TRANSFORM,
        crop: { left: 500, top: 0, right: 401, bottom: 0 },
      },
    ],
    [IDENTITY_TRANSFORM, IDENTITY_TRANSFORM],
    [],
  ];
  for (const effects of bad)
    assert.equal(
      await code(
        head(c).then((h) =>
          execute(c.browser, "yamakan.clip.setEffects", {
            projectId: c.projectId,
            expectedRevision: h.revision,
            clipId: c.clipId,
            effects,
          }),
        ),
      ),
      "VALIDATION",
      JSON.stringify(effects),
    );
  // A stored snapshot from a newer build with an unknown effect is refused,
  // never read with the effect dropped.
  const canonical = JSON.parse(JSON.stringify(fromEditView(await head(c))));
  canonical.clips[0].effects = [{ type: "blur", version: 1, radius: 4 }];
  assert.throws(
    () => parseCanonical(canonical),
    (e: unknown) => toCommandError(e).code === "VALIDATION",
  );
  // A title cannot carry an effect.
  const h = await head(c);
  const titleId = crypto.randomUUID();
  const titled = (
    await execute(c.browser, "yamakan.project.applyBatch", {
      projectId: c.projectId,
      expectedRevision: h.revision,
      operations: [
        {
          type: "clip.add",
          clipId: titleId,
          trackId: h.tracks.find((t) => t.kind === "video")!.id,
          assetId: null,
          title: "Title",
          startTicks: 30 * FRAME,
          durationTicks: 30 * FRAME,
          sourceStartTicks: 0,
        },
      ],
    })
  ).result as Project;
  assert.equal(
    await code(
      execute(c.browser, "yamakan.clip.setEffects", {
        projectId: c.projectId,
        expectedRevision: titled.revision,
        clipId: titleId,
        effects: [T({ scale: 500 })],
      }),
    ),
    "VALIDATION",
  );
});

test("the off switch refuses effect writes and keeps stored effects rendering", async () => {
  const c = await workspace();
  const t = T({ scale: 500 });
  await setTransform(c, t);
  process.env.YAMAKAN_EFFECTS_OFF = "1";
  try {
    assert.equal(await code(setTransform(c, null)), "CAPABILITY_UNAVAILABLE");
    // A whole-project save cannot change them either.
    const p = await head(c);
    const changed = structuredClone(p);
    delete changed.clips[0]!.effects;
    assert.equal(
      await code(c.store.save(changed, p.revision)),
      "CAPABILITY_UNAVAILABLE",
    );
    // An unrelated save still works, and the stored effect still renders.
    const renamed = { ...structuredClone(p), name: "Renamed" };
    await c.store.save(renamed, p.revision);
    const exported = await exportFrame(c);
    assert.deepEqual(exported.plan.layers[0]?.transform, t);
    assert.equal(colour(exported.frame, 100, 100), "black");
  } finally {
    delete process.env.YAMAKAN_EFFECTS_OFF;
  }
});
