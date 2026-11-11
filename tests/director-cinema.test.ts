// The cinema-blender Director pipeline: registered, gated like any built-in pipeline, and its
// shot render refuses what is not a shot of a story of a cinema-blender run. The real Blender
// run end to end is in tests/blender-render.test.ts, beside the other real renders.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { ProjectStore } from "../core/store.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import {
  CINEMA_BLENDER_MANIFEST,
  renderStoryShot,
} from "../core/director/cinema-pipeline.ts";
import {
  builtinManifest,
  registerBuiltinManifest,
} from "../core/director/manifest.ts";
import { directorNext } from "../core/director/runtime.ts";
import type { JobSupervisor } from "../core/jobs.ts";
import type { Project } from "../core/project.ts";

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
const id = () => crypto.randomUUID();
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};

// A queue that must not be reached: every refusal happens before a render is queued.
const noQueue = {
  submitBlenderRender: () => {
    throw new Error("a render was queued");
  },
} as unknown as JobSupervisor;

export function storyWithShot(shotId: string) {
  return {
    format: "yamakan.story" as const,
    formatVersion: 1 as const,
    title: "Shots",
    scenes: [
      {
        id: id(),
        name: "Scene one",
        shots: [
          {
            id: shotId,
            name: "Opening",
            durationTicks: 705_600_000,
            notes: "",
            referencePacks: [],
            takes: [],
            selectedTakeId: null,
          },
        ],
      },
    ],
  };
}

test("the cinema-blender pipeline is a built-in: render with a person's approval, then place", () => {
  assert.deepEqual(builtinManifest("cinema-blender"), CINEMA_BLENDER_MANIFEST);
  // A name is registered once, and a registered pipeline is checked as a built-in is.
  assert.throws(
    () => registerBuiltinManifest(CINEMA_BLENDER_MANIFEST),
    /registered already/,
  );
  assert.throws(() =>
    registerBuiltinManifest({
      ...CINEMA_BLENDER_MANIFEST,
      name: "with-a-tool",
      stages: [{ name: "x", tools_available: ["ffmpeg"] }],
    } as never),
  );
  assert.deepEqual(
    CINEMA_BLENDER_MANIFEST.stages.map((s) => [
      s.name,
      s.human_approval_default === true,
      s.tools_available.length,
    ]),
    [
      ["render", true, 0],
      ["place", false, 0],
    ],
  );
});

test("a shot is rendered only from a story shot of a cinema-blender run", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-director-cinema-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const ctx = {
    store,
    queue: noQueue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Director" })
  ).result as Project;
  const shotId = id();
  const storyDocumentId = id();
  await execute(ctx, "yamakan.story.save", {
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: storyDocumentId,
    expectedContentHash: null,
    story: storyWithShot(shotId),
  });
  const run = (
    await execute(ctx, "yamakan.director.start", {
      projectId: project.id,
      pipelineName: "cinema-blender",
    })
  ).result as { id: string };
  const next = await directorNext(store, run.id);
  assert.deepEqual(next, { kind: "stage", stage: "render" });
  const smoke = (
    await execute(ctx, "yamakan.director.start", {
      projectId: project.id,
      pipelineName: "framework-smoke",
    })
  ).result as { id: string };

  const ok = { runId: run.id, storyDocumentId, shotId, direction: {} };
  assert.equal(
    await code(renderStoryShot(store, noQueue, { ...ok, runId: smoke.id })),
    "VALIDATION",
  );
  assert.equal(
    await code(
      renderStoryShot(store, noQueue, { ...ok, storyDocumentId: id() }),
    ),
    "NOT_FOUND",
  );
  assert.equal(
    await code(renderStoryShot(store, noQueue, { ...ok, shotId: id() })),
    "NOT_FOUND",
  );
  // Only the Create page's own direction choices, nothing else.
  for (const direction of [
    { shot: "extreme" },
    { mood: "dark" },
    { shot: "toString" },
  ])
    await assert.rejects(
      renderStoryShot(store, noQueue, { ...ok, direction } as never),
    );
  // The command needs render:execute, as a Blender render does.
  assert.equal(
    await code(
      execute(
        {
          ...ctx,
          principal: {
            id: "agent:director-test" as const,
            scopes: new Set([
              "project:read",
              "project:write",
            ]) as ReadonlySet<Scope>,
          },
        },
        "yamakan.director.renderShot",
        ok,
      ),
    ),
    "SCOPE_DENIED",
  );
});

test("a shot is rendered at least as long as it lasts, at the project's own rate, or refused", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-director-fps-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const ctx = {
    store,
    queue: noQueue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  // What would be rendered, without rendering it.
  const queued: { frames: number; fps: number }[] = [];
  const recordingQueue = {
    submitBlenderRender: async (
      _p: string,
      scene: { frames: number; fps: number },
    ) => {
      queued.push({ frames: scene.frames, fps: scene.fps });
      return { id: id(), state: "QUEUED" };
    },
  } as unknown as JobSupervisor;
  // The project rates Yamakan supports: 23.976 fps and 30 fps.
  const cases = [
    // 23.976 fps: 100 frames last 4.1708 s, so 101 frames at 24.
    {
      rate: { num: 24000, den: 1001 } as { num: number; den: number } | null,
      frames: 100,
      want: { frames: 101, fps: 24 } as { frames: number; fps: number } | null,
    },
    // 30 fps: 120 frames, the most a render may be.
    { rate: null, frames: 120, want: { frames: 120, fps: 30 } },
    // 30 fps: 121 frames is longer than a render may be, so refused before anything runs.
    { rate: null, frames: 121, want: null },
  ];
  for (const c of cases) {
    const project = (
      await execute(ctx, "yamakan.project.create", {
        name: "Rate",
        ...(c.rate ? { frameRate: c.rate } : {}),
      })
    ).result as Project;
    const shotId = id();
    const storyDocumentId = id();
    const doc = storyWithShot(shotId);
    const rate = c.rate ?? { num: 30, den: 1 };
    doc.scenes[0].shots[0].durationTicks = Math.round(
      (c.frames * 705_600_000 * rate.den) / rate.num,
    );
    await execute(ctx, "yamakan.story.save", {
      projectId: project.id,
      expectedRevision: project.revision,
      documentId: storyDocumentId,
      expectedContentHash: null,
      story: doc,
    });
    const run = (
      await execute(ctx, "yamakan.director.start", {
        projectId: project.id,
        pipelineName: "cinema-blender",
      })
    ).result as { id: string };
    const attempt = renderStoryShot(store, recordingQueue, {
      runId: run.id,
      storyDocumentId,
      shotId,
      direction: {},
    });
    if (c.want) {
      await attempt;
      assert.deepEqual(queued.at(-1), c.want);
      // The render covers the shot.
      assert.ok(c.want.frames / c.want.fps >= (c.frames * rate.den) / rate.num);
    } else {
      const before = queued.length;
      assert.equal(await code(attempt), "VALIDATION");
      assert.equal(queued.length, before, "nothing was queued");
    }
  }
});
