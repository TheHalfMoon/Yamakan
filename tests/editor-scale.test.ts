// YU-026: the named scale profiles. M is exactly the enforced maximum, and
// each refused profile (one past a limit) is refused with its own message
// and leaves the project as it was: no hidden clamp. The measured costs of
// S and M come from scripts/qualify-editor-scale.mjs.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { RESOURCE_POLICY, SCALE_PROFILES } from "../core/command/policy.ts";
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
const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};

test("profile M is exactly the enforced maximum, and each refused profile is one past it", () => {
  const M = SCALE_PROFILES.supported.M;
  assert.equal(M.timelineFrames, RESOURCE_POLICY.enforced.timelineFrames);
  assert.deepEqual(
    [M.clips, M.tracks, M.width, M.height],
    [200, 16, 1920, 1080],
  );
  const R = SCALE_PROFILES.refused;
  assert.equal(R.L.clips, M.clips + 1);
  assert.equal(R.H.tracks, M.tracks + 1);
  assert.equal(R.A.timelineFrames, M.timelineFrames + 1);
  assert.ok(R.K.width > M.width && R.K.height > M.height);
});

test("each refused profile is refused with its own message and the project is unchanged", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-scale-"));
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
    await execute(ctx, "yamakan.project.create", { name: "Limits" })
  ).result as Project;
  const head = () => store.load(project.id);
  const title = (start: number, frames = 10) => ({
    type: "clip.add",
    clipId: crypto.randomUUID(),
    trackId: "",
    assetId: null,
    title: "T",
    startTicks: start * 23_520_000,
    durationTicks: frames * 23_520_000,
    sourceStartTicks: 0,
  });
  const batch = async (operations: object[]) =>
    execute(ctx, "yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: (await head()).revision,
      operations,
    });
  const unchanged = async (attempt: () => Promise<unknown>) => {
    const before = JSON.stringify(await head());
    const message = await refusal(attempt());
    assert.equal(JSON.stringify(await head()), before, "no partial change");
    return message;
  };
  const video = (await head()).tracks.find((t) => t.kind === "video")!.id;
  const M = SCALE_PROFILES.supported.M;
  const track = (i: number) => ({
    type: "track.add",
    trackId: crypto.randomUUID(),
    name: `T${i}`,
    kind: "video",
  });
  // H: 16 tracks are accepted exactly; one more is refused.
  const tracks = (await head()).tracks.length;
  await batch(Array.from({ length: M.tracks - tracks }, (_, i) => track(i)));
  assert.equal((await head()).tracks.length, M.tracks);
  assert.match(
    (await unchanged(() => batch([track(99)])))!,
    /^VALIDATION: .*at most 16 tracks/,
  );
  // A: a clip ending exactly at ten minutes is accepted; one frame more is
  // refused.
  const edge = { ...title(M.timelineFrames - 10), trackId: video };
  await batch([edge]);
  await batch([{ type: "clip.remove", clipId: edge.clipId }]);
  assert.match(
    (await unchanged(() =>
      batch([
        {
          ...title(SCALE_PROFILES.refused.A.timelineFrames - 10),
          trackId: video,
        },
      ]),
    ))!,
    /^VALIDATION: .*ten minutes/,
  );
  // K: a 1920x1080 output is accepted; a larger one is refused.
  const before = await head();
  await execute(ctx, "yamakan.project.save", {
    expectedRevision: before.revision,
    project: { ...before, width: M.width, height: M.height },
  });
  assert.deepEqual(
    [(await head()).width, (await head()).height],
    [M.width, M.height],
  );
  const h = await head();
  assert.match(
    (await unchanged(() =>
      execute(ctx, "yamakan.project.save", {
        expectedRevision: h.revision,
        project: {
          ...h,
          width: SCALE_PROFILES.refused.K.width,
          height: SCALE_PROFILES.refused.K.height,
        },
      }),
    ))!,
    /^VALIDATION: project\.width/,
  );
  // L: one clip past 200, on a project filled to the limit.
  for (let i = 0; i < SCALE_PROFILES.supported.M.clips; i += 64)
    await batch(
      Array.from(
        { length: Math.min(64, SCALE_PROFILES.supported.M.clips - i) },
        (_, k) => ({ ...title((i + k) * 10), trackId: video }),
      ),
    );
  assert.equal((await head()).clips.length, 200);
  assert.match(
    (await unchanged(() => batch([{ ...title(2010), trackId: video }])))!,
    /^VALIDATION: .*at most 200 clips/,
  );
});
