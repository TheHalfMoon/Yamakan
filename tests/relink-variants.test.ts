// YU-025: verified relink and batch aspect/export variants. Missing media
// is replaced by an imported medium through a revision-bound proposal that
// re-points every clip using it and records its provenance; undo returns
// the old source. Three aspect variants export as one batch whose plans
// are deterministic and whose sizes are verified, reopen with the same
// status, and re-export identically. A replacement with the same name but
// other bytes is shown before approval; an incompatible, stale or forged
// relink, a failing output (ENOSPC), and a late cancel never show a batch
// as complete or touch the source.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor, type SupervisorOptions } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import type { Project } from "../core/project.ts";
import type { RelinkProposal } from "../core/relink.ts";

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
const FRAME = 23_520_000; // flicks per 30 fps frame
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
const dims = (file: string) =>
  execFileSync(
    mediaTools().ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      file,
    ],
    { windowsHide: true },
  )
    .toString()
    .trim();

function clip(root: string, name: string, src: string, seconds = 2) {
  const file = path.join(root, name);
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `${src}=size=320x180:rate=30:duration=${seconds}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    file,
  ]);
  return file;
}

async function workspace(options: SupervisorOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-relink-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store, options);
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
    await execute(browser, "yamakan.project.create", { name: "Deliverables" })
  ).result as Project;
  const original = (
    await store.importAsset(
      project.id,
      "shot.mp4",
      await readFile(clip(root, "shot.mp4", "testsrc")),
    )
  ).asset;
  const head = await store.load(project.id);
  const video = head.tracks.find((t) => t.kind === "video")!.id;
  const clipIds = [crypto.randomUUID(), crypto.randomUUID()];
  await execute(browser, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: head.revision,
    operations: clipIds.map((clipId, i) => ({
      type: "clip.add",
      clipId,
      trackId: video,
      assetId: original.id,
      title: null,
      startTicks: i * 30 * FRAME,
      durationTicks: 30 * FRAME,
      sourceStartTicks: i * 15 * FRAME,
    })),
  });
  return {
    root,
    store,
    queue,
    browser,
    projectId: project.id,
    original,
    clipIds,
  };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = (c: Ctx) => c.store.load(c.projectId);
const run = async <T>(c: Ctx, operation: string, args: object) =>
  (await execute(c.browser, operation, { projectId: c.projectId, ...args }))
    .result as T;
type Batch = {
  batchId: string;
  state: string;
  revision: number;
  outputs: {
    id: string;
    state: string;
    error: string | null;
    artifact: string | null;
    planHash: string | null;
    variant: { name: string; width: number; height: number };
    profile: { width: number; height: number } | null;
  }[];
};
async function finished(c: Ctx, batchId: string, ms = 180_000) {
  const end = Date.now() + ms;
  for (;;) {
    const b = await run<Batch>(c, "yamakan.export.batchStatus", { batchId });
    if (b.state !== "RUNNING") return b;
    if (Date.now() > end) throw new Error("Batch did not finish.");
    await new Promise((r) => setTimeout(r, 200));
  }
}
const VARIANTS = [
  { name: "wide", width: 1280, height: 720 },
  { name: "vertical", width: 608, height: 1080 },
  { name: "square", width: 1080, height: 1080 },
];

test("missing media is relinked through an approved proposal; undo returns the old source and provenance is kept", async () => {
  const c = await workspace();
  // The original's bytes go missing: renders refuse it.
  const file = await c.store.readyObjectFile(c.projectId, c.original);
  await rename(file, `${file}.lost`);
  // The same file name with other bytes is a different medium: shown.
  const replacement = (
    await c.store.importAsset(
      c.projectId,
      "shot.mp4",
      await readFile(clip(c.root, "again.mp4", "testsrc2")),
    )
  ).asset;
  const missing = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "before-relink",
    variants: [VARIANTS[0]],
  });
  assert.equal((await finished(c, missing.batchId)).state, "FAILED");
  const before = await head(c);
  // The generic batch cannot relink: only the approved proposal does.
  assert.match(
    await failure(
      run(c, "yamakan.project.applyBatch", {
        expectedRevision: before.revision,
        operations: [
          {
            type: "asset.relink",
            fromAssetId: c.original.id,
            toAssetId: replacement.id,
          },
        ],
      }),
    ),
    /relinkApply/,
  );
  const proposal = await run<RelinkProposal>(c, "yamakan.asset.relinkPropose", {
    fromAssetId: c.original.id,
    toAssetId: replacement.id,
  });
  assert.deepEqual(proposal.clipIds, [...c.clipIds].sort());
  assert.ok(proposal.differences.includes("bytes"));
  assert.ok(!proposal.differences.includes("name"));
  assert.equal(
    (await head(c)).revision,
    before.revision,
    "proposing changes nothing",
  );
  const applied = await run<Project>(c, "yamakan.asset.relinkApply", {
    expectedRevision: before.revision,
    proposal,
  });
  assert.deepEqual(
    applied.clips.map((x) => [x.assetId, x.startFrame, x.sourceFrame]),
    before.clips.map((x) => [replacement.id, x.startFrame, x.sourceFrame]),
  );
  // The old medium stays in the project (rooted), and the swap is recorded.
  assert.ok(applied.assets.some((a) => a.id === c.original.id));
  const records = await run<
    { revision: number; fromHash: string; toHash: string; clips: number }[]
  >(c, "yamakan.asset.replacements", {});
  assert.deepEqual(
    records.map((r) => [r.revision, r.fromHash, r.toHash, r.clips]),
    [[applied.revision, c.original.hash, replacement.hash, 2]],
  );
  // It renders now; the same proposal is stale.
  const batch = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "after-relink",
    variants: [VARIANTS[0]],
  });
  assert.equal((await finished(c, batch.batchId)).state, "COMPLETED");
  assert.match(
    await failure(
      run(c, "yamakan.asset.relinkApply", {
        expectedRevision: (await head(c)).revision,
        proposal,
      }),
    ),
    /^REVISION_CONFLICT/,
  );
  // Undo is a new revision with exactly the old source.
  const now = await head(c);
  const undone = await run<Project>(c, "yamakan.project.undo", {
    expectedRevision: now.revision,
  });
  assert.deepEqual(
    undone.clips.map((x) => x.assetId),
    before.clips.map((x) => x.assetId),
  );
  await rename(`${file}.lost`, file);
});

test("incompatible, forged and partial relinks are refused", async () => {
  const c = await workspace();
  const short = (
    await c.store.importAsset(
      c.projectId,
      "short.mp4",
      await readFile(clip(c.root, "short.mp4", "testsrc2", 1)),
    )
  ).asset;
  // The second clip reads 0.5–1.5 s of the source: one second is too short.
  assert.match(
    await failure(
      run(c, "yamakan.asset.relinkPropose", {
        fromAssetId: c.original.id,
        toAssetId: short.id,
      }),
    ),
    /shorter than the source a clip reads/,
  );
  const tone = path.join(c.root, "tone.wav");
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=3", tone]);
  const audio = (
    await c.store.importAsset(c.projectId, "tone.wav", await readFile(tone))
  ).asset;
  assert.match(
    await failure(
      run(c, "yamakan.asset.relinkPropose", {
        fromAssetId: c.original.id,
        toAssetId: audio.id,
      }),
    ),
    /replaced only by another video medium/,
  );
  assert.match(
    await failure(
      run(c, "yamakan.asset.relinkPropose", {
        fromAssetId: c.original.id,
        toAssetId: crypto.randomUUID(),
      }),
    ),
    /^NOT_FOUND/,
  );
  // A forged proposal (a clip left out: a partial relink) is refused.
  const good = (
    await c.store.importAsset(
      c.projectId,
      "good.mp4",
      await readFile(clip(c.root, "good.mp4", "testsrc2", 3)),
    )
  ).asset;
  const proposal = await run<RelinkProposal>(c, "yamakan.asset.relinkPropose", {
    fromAssetId: c.original.id,
    toAssetId: good.id,
  });
  const partial = { ...proposal, clipIds: [proposal.clipIds[0]!] };
  assert.match(
    await failure(
      run(c, "yamakan.asset.relinkApply", {
        expectedRevision: proposal.revision,
        proposal: partial,
      }),
    ),
    /^REVISION_CONFLICT/,
  );
  assert.deepEqual(
    await run(c, "yamakan.asset.replacements", {}),
    [],
    "nothing recorded",
  );
});

test("three aspect variants export as one batch, deterministically, and reopen with the same status", async () => {
  const c = await workspace();
  const batch = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "deliver",
    variants: VARIANTS,
  });
  assert.equal(batch.outputs.length, 3);
  const done = await finished(c, batch.batchId);
  assert.equal(done.state, "COMPLETED");
  for (const o of done.outputs) {
    assert.deepEqual(o.profile, {
      width: o.variant.width,
      height: o.variant.height,
    });
    const file = await c.store.file(c.projectId, ...o.artifact!.split("/"));
    assert.equal(
      dims(file),
      `${o.variant.width},${o.variant.height}`,
      o.variant.name,
    );
  }
  // A retry with the same key is the same batch.
  const again = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "deliver",
    variants: VARIANTS,
  });
  assert.equal(again.batchId, batch.batchId);
  assert.deepEqual(
    again.outputs.map((o) => o.id),
    done.outputs.map((o) => o.id),
  );
  // A new batch of the same revision compiles the same plans.
  const second = await finished(
    c,
    (
      await run<Batch>(c, "yamakan.export.batch", {
        idempotencyKey: "deliver-again",
        variants: VARIANTS,
      })
    ).batchId,
  );
  assert.deepEqual(
    second.outputs.map((o) => o.planHash),
    done.outputs.map((o) => o.planHash),
  );
  assert.equal(new Set(done.outputs.map((o) => o.planHash)).size, 3);
  // Reopened, the batch reads the same.
  await c.queue.close();
  c.store.close();
  const store = new ProjectStore(c.root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const reopened = {
    ...c,
    store,
    queue,
    browser: { ...c.browser, store, queue },
  };
  const read = await run<Batch>(reopened, "yamakan.export.batchStatus", {
    batchId: batch.batchId,
  });
  assert.deepEqual(
    read.outputs.map((o) => [o.id, o.state, o.planHash]),
    done.outputs.map((o) => [o.id, o.state, o.planHash]),
  );
  // Re-exported after reopening, the same plans again.
  const rerun = await run<Batch>(reopened, "yamakan.export.batch", {
    idempotencyKey: "after-reopen",
    variants: VARIANTS,
  });
  const end = Date.now() + 180_000;
  let after = rerun;
  while (after.state === "RUNNING" && Date.now() < end) {
    await new Promise((res) => setTimeout(res, 200));
    after = await run<Batch>(reopened, "yamakan.export.batchStatus", {
      batchId: rerun.batchId,
    });
  }
  assert.equal(after.state, "COMPLETED");
  assert.deepEqual(
    after.outputs.map((o) => o.planHash),
    done.outputs.map((o) => o.planHash),
  );
  // The same key asking for other variants is another batch.
  const other = await run<Batch>(reopened, "yamakan.export.batch", {
    idempotencyKey: "deliver",
    variants: [VARIANTS[0]],
  });
  assert.notEqual(other.batchId, batch.batchId);
  // Duplicate names or sizes, and too many variants, are refused.
  assert.match(
    await failure(
      run(reopened, "yamakan.export.batch", {
        idempotencyKey: "dupes",
        variants: [VARIANTS[0], { ...VARIANTS[0], name: "other" }],
      }),
    ),
    /own name and size/,
  );
  assert.match(
    await failure(
      run(reopened, "yamakan.export.batch", {
        idempotencyKey: "many",
        variants: [
          ...VARIANTS,
          { name: "a", width: 640, height: 360 },
          { name: "b", width: 320, height: 180 },
        ],
      }),
    ),
    /^VALIDATION/,
  );
});

test("a failing output (ENOSPC) fails the batch alone; a cancel keeps finished exports; the source is untouched", async () => {
  let publishes = 0;
  const c = await workspace({
    fault: (point) => {
      // The second output to publish finds the disk full.
      if (point === "before-publish" && ++publishes === 2)
        throw Object.assign(new Error("ENOSPC: no space left on device"), {
          code: "ENOSPC",
        });
    },
  });
  const sourceBefore = await readFile(
    await c.store.readyObjectFile(c.projectId, c.original),
  );
  const batch = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "full-disk",
    variants: VARIANTS,
  });
  const done = await finished(c, batch.batchId);
  assert.equal(done.state, "FAILED", "a partial batch is never complete");
  assert.deepEqual(
    done.outputs.map((o) => o.state),
    ["COMPLETED", "FAILED", "COMPLETED"],
  );
  const failed = done.outputs[1]!;
  assert.ok(failed.error);
  assert.equal(failed.artifact, null);
  assert.equal(failed.profile, null);
  // A late cancel changes nothing that finished.
  const late = await run<Batch>(c, "yamakan.export.batchCancel", {
    batchId: batch.batchId,
  });
  assert.deepEqual(
    late.outputs.map((o) => [o.state, o.artifact]),
    done.outputs.map((o) => [o.state, o.artifact]),
  );
  assert.deepEqual(
    await readFile(await c.store.readyObjectFile(c.projectId, c.original)),
    sourceBefore,
  );
});

test("cancelling a running batch cancels its unfinished outputs, twice safely, and leaves earlier exports", async () => {
  let cancelFrom: Ctx | null = null;
  let batchId = "";
  const c = await workspace({
    fault: (point) => {
      // While the first output is about to publish, the batch is cancelled.
      if (point === "before-publish" && cancelFrom && batchId) {
        const ctx = cancelFrom;
        cancelFrom = null;
        ctx.queue.cancelBatch(ctx.projectId, batchId);
        ctx.queue.cancelBatch(ctx.projectId, batchId);
      }
    },
  });
  const earlier = await finished(
    c,
    (
      await run<Batch>(c, "yamakan.export.batch", {
        idempotencyKey: "earlier",
        variants: [VARIANTS[0]],
      })
    ).batchId,
  );
  assert.equal(earlier.state, "COMPLETED");
  const batch = await run<Batch>(c, "yamakan.export.batch", {
    idempotencyKey: "stopped",
    variants: VARIANTS,
  });
  batchId = batch.batchId;
  cancelFrom = c;
  const done = await finished(c, batch.batchId);
  assert.equal(done.state, "CANCELLED");
  assert.ok(done.outputs.every((o) => o.state === "CANCELLED" && !o.artifact));
  const again = await run<Batch>(c, "yamakan.export.batchStatus", {
    batchId: earlier.batchId,
  });
  assert.deepEqual(
    again.outputs.map((o) => [o.state, o.artifact]),
    earlier.outputs.map((o) => [o.state, o.artifact]),
  );
});
