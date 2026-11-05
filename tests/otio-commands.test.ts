// SS-015: OTIO as a person or agent reaches it, against a real store and media.
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
import {
  OTIO_LIMITS,
  type OtioLossReport,
  type OtioProposal,
} from "../core/interchange/otio.ts";
import type { Project } from "../core/project.ts";

const bases: string[] = [];
const handles: { close: () => unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const b of bases)
    await rm(b, { recursive: true, force: true, maxRetries: 5 });
});

const principal = (scopes: readonly Scope[]) => ({
  id: "browser-ui" as const,
  scopes: new Set(scopes) as ReadonlySet<Scope>,
});

async function fixture(frameRate: { num: number; den: number }) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-otio-"));
  bases.push(root);
  const store = new ProjectStore(path.join(root, "workspace"));
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = { store, queue, principal: principal(Scopes) };
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Otio", frameRate })
  ).result as Project;
  const file = path.join(root, "red.mp4");
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
      "color=c=red:s=64x36:r=30:d=4",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      file,
    ],
    { windowsHide: true },
  );
  const { project: imported } = await store.importAsset(
    project.id,
    "red.mp4",
    await readFile(file),
  );
  const asset = imported.assets[0]!;
  const open = async () =>
    (await execute(ctx, "yamakan.project.open", { projectId: project.id }))
      .result as {
      revision: number;
      tracks: { id: string; kind: string }[];
    };
  const FRAME = Math.round((705_600_000 * frameRate.den) / frameRate.num);
  const opened = await open();
  const track = opened.tracks.find((t) => t.kind === "video")!.id;
  const clipId = crypto.randomUUID();
  await execute(ctx, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: opened.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: track,
        assetId: asset.id,
        title: null,
        startTicks: 7 * FRAME,
        durationTicks: 30 * FRAME,
        sourceStartTicks: 11 * FRAME,
      },
    ],
  });
  return {
    ctx,
    root,
    projectId: project.id,
    asset,
    clipId,
    FRAME,
    track,
    open,
  };
}

for (const [label, frameRate] of [
  ["30 fps", { num: 30, den: 1 }],
  ["24000/1001", { num: 24000, den: 1001 }],
] as const) {
  test(`${label}: an export round-trips through a proposal on its own frames`, async () => {
    const f = await fixture(frameRate);
    const { timeline, report } = (
      await execute(f.ctx, "yamakan.project.exportOtio", {
        projectId: f.projectId,
      })
    ).result as { timeline: unknown; report: OtioLossReport };
    const before = (
      await execute(f.ctx, "yamakan.project.otioLosses", {
        projectId: f.projectId,
      })
    ).result as OtioLossReport;
    assert.deepEqual(before, report, "the report does not need a conversion");
    assert.deepEqual(report.media, [
      {
        assetId: f.asset.id,
        name: "red.mp4",
        hash: f.asset.hash,
        bytes: report.media[0]!.bytes,
      },
    ]);
    const text = JSON.stringify(timeline);
    assert.ok(
      !text.includes(path.basename(f.root)),
      "no host path travels in the file",
    );
    const revision = (await f.open()).revision;
    const proposal = (
      await execute(f.ctx, "yamakan.project.proposeOtio", {
        projectId: f.projectId,
        text,
      })
    ).result as OtioProposal;
    assert.equal(proposal.unresolved, 0);
    assert.deepEqual(proposal.ignored, []);
    assert.equal(proposal.clips.length, 1);
    const [clip] = proposal.clips;
    assert.equal(clip!.assetId, f.asset.id);
    assert.equal(clip!.startTicks, 7 * f.FRAME);
    assert.equal(clip!.durationTicks, 30 * f.FRAME);
    assert.equal(clip!.sourceStartTicks, 11 * f.FRAME);
    assert.equal(
      (await f.open()).revision,
      revision,
      "a proposal writes nothing",
    );
  });
}

test("a track's lock is reported by the service before conversion", async () => {
  const f = await fixture({ num: 30, den: 1 });
  await execute(f.ctx, "yamakan.project.applyBatch", {
    projectId: f.projectId,
    expectedRevision: (await f.open()).revision,
    operations: [{ type: "track.update", trackId: f.track, locked: true }],
  });
  const { losses } = (
    await execute(f.ctx, "yamakan.project.otioLosses", {
      projectId: f.projectId,
    })
  ).result as OtioLossReport;
  assert.ok(losses.some((l) => l.id === f.track && l.field === "locked"));
});

test("hostile files are refused with a validation error, and the project is untouched", async () => {
  const f = await fixture({ num: 30, den: 1 });
  const held = await execute(f.ctx, "yamakan.project.export", {
    projectId: f.projectId,
  });
  let deep = "null";
  for (let i = 0; i < OTIO_LIMITS.maxDepth + 2; i++) deep = `{"a":${deep}}`;
  for (const text of [
    "{",
    "null",
    deep,
    JSON.stringify({ OTIO_SCHEMA: "Timeline.1", tracks: { children: 1 } }),
    "x".repeat(OTIO_LIMITS.maxBytes + 1),
  ]) {
    await assert.rejects(
      execute(f.ctx, "yamakan.project.proposeOtio", {
        projectId: f.projectId,
        text,
      }),
      (e) => toCommandError(e).code === "VALIDATION",
      text.slice(0, 80),
    );
  }
  assert.deepEqual(
    await execute(f.ctx, "yamakan.project.export", { projectId: f.projectId }),
    held,
  );
});

test("the three commands read only: a read scope is enough, none needs write", async () => {
  const f = await fixture({ num: 30, den: 1 });
  const reader = { ...f.ctx, principal: principal(["project:read"]) };
  for (const [operation, extra] of [
    ["yamakan.project.otioLosses", {}],
    ["yamakan.project.exportOtio", {}],
    [
      "yamakan.project.proposeOtio",
      { text: JSON.stringify({ OTIO_SCHEMA: "Timeline.1" }) },
    ],
  ] as const)
    await execute(reader, operation, { projectId: f.projectId, ...extra });
  const nobody = { ...f.ctx, principal: principal([]) };
  await assert.rejects(
    execute(nobody, "yamakan.project.exportOtio", { projectId: f.projectId }),
  );
});
