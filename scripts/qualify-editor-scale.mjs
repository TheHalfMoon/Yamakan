// YU-026: named editor scale profiles, measured before any limit changes.
// S (typical) and M (the enforced maximum: 200 clips, 16 tracks, ten
// minutes, 1080p output) are built through the command layer and measured:
// saves, the snapshot, history, reopening, plan compile, a reference frame,
// the full export, and backup/restore under stress. L, H, A and K (one past
// each limit) must be refused exactly, leaving the project as it was. The
// result goes to docs/evidence/ultimate/editor-scale.json; nothing here
// raises a limit.
//
// Usage: node scripts/qualify-editor-scale.mjs [--profiles S,M] [--no-export]
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  stat,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import { compilePlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { fromEditView } from "../core/canonical.ts";
import { RESOURCE_POLICY, SCALE_PROFILES } from "../core/command/policy.ts";

const args = process.argv.slice(2);
const ALL = Object.keys(SCALE_PROFILES.supported);
const named = args.includes("--profiles")
  ? (args[args.indexOf("--profiles") + 1] ?? "").split(",")
  : ALL;
if (!named.length || named.some((n) => !ALL.includes(n)))
  throw new Error(`--profiles takes some of ${ALL.join(",")}.`);
const only = named;
const withExport = !args.includes("--no-export");
const FRAME = 23_520_000; // flicks per 30 fps frame
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ffmpeg = (a) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...a],
    {
      windowsHide: true,
    },
  );
const ms = (t0) => Math.round(performance.now() - t0);
async function timed(fn) {
  const t0 = performance.now();
  const value = await fn();
  return { ms: ms(t0), value };
}
async function folderBytes(dir) {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await folderBytes(p);
    else if (e.isFile()) total += (await stat(p)).size;
  }
  return total;
}
// Peak resident memory of this process, sampled every 100 ms.
let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);

async function workspace(name) {
  const root = await mkdtemp(path.join(tmpdir(), `yamakan-scale-${name}-`));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  const ctx = {
    store,
    queue,
    recoveryHome: `${root}-recovery`,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  };
  return { root, store, queue, ctx };
}
const run = async (ctx, op, a) => (await execute(ctx, op, a)).result;

// Clips spread over tracks, each track filled end to end with stills.
function layout(profile, trackIds, stillId) {
  const perTrack = Math.ceil(profile.clips / trackIds.length);
  const frames = Math.floor(profile.timelineFrames / perTrack);
  // Each track's last clip runs to the timeline's last frame exactly.
  const last = profile.timelineFrames - frames * (perTrack - 1);
  const ops = [];
  let n = 0;
  for (const trackId of trackIds)
    for (let i = 0; i < perTrack && n < profile.clips; i++, n++)
      ops.push({
        type: "clip.add",
        clipId: crypto.randomUUID(),
        trackId,
        assetId: stillId,
        title: null,
        startTicks: i * frames * FRAME,
        durationTicks: (i === perTrack - 1 ? last : frames) * FRAME,
        sourceStartTicks: 0,
      });
  return ops;
}

async function build(w, profile) {
  const project = await run(w.ctx, "yamakan.project.create", {
    name: `Scale ${profile.name}`,
  });
  const head0 = await w.store.load(project.id);
  if (profile.width !== head0.width || profile.height !== head0.height) {
    await run(w.ctx, "yamakan.project.save", {
      expectedRevision: head0.revision,
      project: { ...head0, width: profile.width, height: profile.height },
    });
  }
  const still = path.join(w.root, "still.png");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${profile.width}x${profile.height}`,
    "-frames:v",
    "1",
    still,
  ]);
  const { asset } = await w.store.importAsset(
    project.id,
    "still.png",
    await readFile(still),
  );
  let head = await w.store.load(project.id);
  // The profile counts every track (the default audio track included).
  const tracks = head.tracks.filter((t) => t.kind === "video").map((t) => t.id);
  const addTracks = [];
  for (let total = head.tracks.length; total < profile.tracks; total++) {
    const id = crypto.randomUUID();
    tracks.push(id);
    addTracks.push({
      type: "track.add",
      trackId: id,
      name: `V${tracks.length}`,
      kind: "video",
    });
  }
  const ops = [...addTracks, ...layout(profile, tracks, asset.id)];
  const saves = [];
  for (let i = 0; i < ops.length; i += 64) {
    head = await w.store.load(project.id);
    const t = await timed(() =>
      run(w.ctx, "yamakan.project.applyBatch", {
        projectId: project.id,
        expectedRevision: head.revision,
        operations: ops.slice(i, i + 64),
      }),
    );
    saves.push(t.ms);
  }
  return { projectId: project.id, saves };
}

async function measure(profile) {
  const w = await workspace(profile.name);
  const out = { profile: profile.name, limits: profile };
  try {
    const built = await build(w, profile);
    const projectId = built.projectId;
    out.batchSaveMs = {
      count: built.saves.length,
      max: Math.max(...built.saves),
      total: built.saves.reduce((a, b) => a + b, 0),
    };
    const head = await w.store.load(projectId);
    out.clips = head.clips.length;
    out.tracks = head.tracks.length;
    const exported = await run(w.ctx, "yamakan.project.export", { projectId });
    out.snapshotBytes = Buffer.byteLength(JSON.stringify(exported));
    out.snapshotLimitBytes = RESOURCE_POLICY.enforced.snapshotBytes;
    // History: one edit, undo, redo.
    const edit = await timed(() =>
      run(w.ctx, "yamakan.project.applyBatch", {
        projectId,
        expectedRevision: head.revision,
        operations: [
          {
            type: "clip.move",
            clipId: head.clips[0].id,
            startTicks: head.clips[0].startFrame * FRAME,
          },
        ],
      }),
    );
    const undo = await timed(() =>
      run(w.ctx, "yamakan.project.undo", {
        projectId,
        expectedRevision: edit.value.revision,
      }),
    );
    const redo = await timed(() =>
      run(w.ctx, "yamakan.project.redo", {
        projectId,
        expectedRevision: undo.value.revision,
      }),
    );
    out.historyMs = { edit: edit.ms, undo: undo.ms, redo: redo.ms };
    // Reopening the workspace.
    await w.queue.close();
    w.store.close();
    const reopenT = await timed(async () => {
      w.store = new ProjectStore(w.root);
      await w.store.initialize();
      w.queue = new JobSupervisor(w.store);
      w.ctx = { ...w.ctx, store: w.store, queue: w.queue };
      return w.store.load(projectId);
    });
    out.reopenMs = reopenT.ms;
    const current = reopenT.value;
    const fonts = await titleFonts();
    const compile = await timed(() =>
      compilePlan(fromEditView(current), "0".repeat(64), fonts),
    );
    out.planCompileMs = compile.ms;
    out.planLayers = compile.value.plan.layers.length;
    const frame = await timed(() =>
      preview(
        w.store,
        projectId,
        current.revision,
        "frame",
        Math.floor(profile.timelineFrames / 2),
      ),
    );
    out.referenceFrameMs = frame.ms;
    if (withExport) {
      const t0 = performance.now();
      try {
        const r = await renderRevision(
          w.store,
          projectId,
          current.revision,
          ["exports", "scale"],
          new AbortController().signal,
          () => {},
        );
        out.export = {
          ok: true,
          ms: ms(t0),
          bytes: (await stat(r.output)).size,
          frames: r.receipt.durationFrames,
        };
      } catch (e) {
        const err = toCommandError(e);
        out.export = {
          ok: false,
          ms: ms(t0),
          code: err.code,
          message: err.message,
          // The bounded stderr tail (kept server-side) says why.
          cause: String(e?.cause ?? "")
            .trim()
            .split(/\r?\n/)
            .slice(-3)
            .join(" | ")
            .slice(0, 400),
        };
      }
      out.renderWallLimitSeconds = RESOURCE_POLICY.enforced.renderWallSeconds;
    }
    // Backup under stress: edits keep committing while the backup runs.
    // The restored workspace holds one revision between the last one
    // acknowledged before the backup began and the last acknowledged while
    // it ran, byte for byte as the live workspace stored it, and it can be
    // opened and edited.
    const atBackup = await w.store.load(projectId);
    const acknowledged = [];
    let editing = true;
    const edits = (async () => {
      // A bounded stream of edits (a person editing, not a flood that
      // would spend the project's revision budget).
      while (editing && acknowledged.length < 25) {
        await new Promise((res) => setTimeout(res, 5));
        const cur = await w.store.load(projectId);
        const c0 = cur.clips[0];
        const saved = await run(w.ctx, "yamakan.project.applyBatch", {
          projectId,
          expectedRevision: cur.revision,
          operations: [
            {
              type: "clip.move",
              clipId: c0.id,
              startTicks: c0.startFrame * FRAME,
            },
          ],
        });
        acknowledged.push(saved.revision);
      }
    })();
    const backup = await timed(() =>
      run(w.ctx, "yamakan.workspace.backup", {}),
    );
    const duringBackup = acknowledged.length;
    editing = false;
    await edits;
    const restore = await timed(() =>
      run(w.ctx, "yamakan.workspace.restore", {
        backupId: backup.value.backupId,
      }),
    );
    const restored = new ProjectStore(restore.value.root);
    await restored.initialize();
    const back = await restored.load(projectId);
    const lastDuring = acknowledged[duringBackup - 1] ?? atBackup.revision;
    const same =
      JSON.stringify(restored.revisionCanonical(projectId, back.revision)) ===
      JSON.stringify(w.store.revisionCanonical(projectId, back.revision));
    // The restored workspace is usable: one more edit commits there.
    const restoredQueue = new JobSupervisor(restored);
    const edited = await run(
      { ...w.ctx, store: restored, queue: restoredQueue },
      "yamakan.project.applyBatch",
      {
        projectId,
        expectedRevision: back.revision,
        operations: [{ type: "clip.remove", clipId: back.clips[1].id }],
      },
    );
    out.backup = {
      backupMs: backup.ms,
      restoreMs: restore.ms,
      backupBytes: await folderBytes(path.join(w.ctx.recoveryHome, "backups")),
      editsDuringBackup: duringBackup,
      editsTotal: acknowledged.length,
      acknowledgedBefore: atBackup.revision,
      lastAcknowledgedDuring: lastDuring,
      restoredRevision: back.revision,
      restoredSnapshotIdentical: same,
      editedAfterRestore: edited.revision === back.revision + 1,
      retained:
        back.revision >= atBackup.revision &&
        back.revision <= Math.max(lastDuring, atBackup.revision) + 1 &&
        same &&
        edited.revision === back.revision + 1,
    };
    await restoredQueue.close();
    restored.close();
    out.workspaceBytes = await folderBytes(w.root);
  } finally {
    await w.queue.close().catch(() => {});
    w.store.close();
    await rm(w.root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    }).catch(() => {});
    await rm(w.ctx.recoveryHome, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    }).catch(() => {});
  }
  return out;
}

// One past each limit: refused, and the project is unchanged.
async function refusals() {
  const w = await workspace("refuse");
  const results = [];
  try {
    const project = await run(w.ctx, "yamakan.project.create", {
      name: "Refusals",
    });
    const still = path.join(w.root, "still.png");
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180",
      "-frames:v",
      "1",
      still,
    ]);
    const { asset } = await w.store.importAsset(
      project.id,
      "still.png",
      await readFile(still),
    );
    const base = await w.store.load(project.id);
    const video = base.tracks.find((t) => t.kind === "video").id;
    const attempt = async (name, fn) => {
      const before = JSON.stringify(await w.store.load(project.id));
      let refusal = null;
      try {
        await fn(await w.store.load(project.id));
      } catch (e) {
        const err = toCommandError(e);
        refusal = { code: err.code, message: err.message };
      }
      const unchanged =
        JSON.stringify(await w.store.load(project.id)) === before;
      results.push({
        profile: name,
        refused: refusal !== null,
        refusal,
        unchanged,
      });
    };
    const clipOp = (i, startFrame, frames, trackId = video) => ({
      type: "clip.add",
      clipId: crypto.randomUUID(),
      trackId,
      assetId: asset.id,
      title: null,
      startTicks: startFrame * FRAME,
      durationTicks: frames * FRAME,
      sourceStartTicks: 0,
    });
    // H: tracks past the limit.
    await attempt("H", async (h) => {
      const ops = [];
      for (let i = h.tracks.length; i < SCALE_PROFILES.refused.H.tracks; i++)
        ops.push({
          type: "track.add",
          trackId: crypto.randomUUID(),
          name: `T${i}`,
          kind: "video",
        });
      await run(w.ctx, "yamakan.project.applyBatch", {
        projectId: project.id,
        expectedRevision: h.revision,
        operations: ops,
      });
    });
    // A: a timeline one frame past ten minutes.
    await attempt("A", async (h) => {
      await run(w.ctx, "yamakan.project.applyBatch", {
        projectId: project.id,
        expectedRevision: h.revision,
        operations: [
          clipOp(0, SCALE_PROFILES.refused.A.timelineFrames - 10, 10),
        ],
      });
    });
    // K: an output larger than 1920x1080.
    await attempt("K", async (h) => {
      await run(w.ctx, "yamakan.project.save", {
        expectedRevision: h.revision,
        project: {
          ...h,
          width: SCALE_PROFILES.refused.K.width,
          height: SCALE_PROFILES.refused.K.height,
        },
      });
    });
    // L: one clip past the limit, on a project filled to it.
    const L = SCALE_PROFILES.refused.L;
    for (let i = 0; i < L.clips - 1; i += 64) {
      const cur = await w.store.load(project.id);
      await run(w.ctx, "yamakan.project.applyBatch", {
        projectId: project.id,
        expectedRevision: cur.revision,
        operations: Array.from(
          { length: Math.min(64, L.clips - 1 - i) },
          (_, k) => clipOp(i + k, (i + k) * 10, 10),
        ),
      });
    }
    await attempt("L", async (h) => {
      await run(w.ctx, "yamakan.project.applyBatch", {
        projectId: project.id,
        expectedRevision: h.revision,
        operations: [clipOp(L.clips, L.clips * 10, 10)],
      });
    });
  } finally {
    await w.queue.close().catch(() => {});
    w.store.close();
    await rm(w.root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    }).catch(() => {});
  }
  return results;
}

const report = {
  format: "yamakan.editor-scale/v1",
  profiles: SCALE_PROFILES.version,
  policy: RESOURCE_POLICY.policy,
  host: {
    os: `${process.platform} ${(await import("node:os")).release()}`,
    node: process.version,
    cpus: (await import("node:os")).cpus().length,
  },
  measured: [],
  refusals: [],
  unmeasured: [
    "Browser timeline virtualization at M (no browser in this script)",
    "History depth and growth (one edit, undo and redo are measured)",
    "Decode and preview-cache costs beyond one reference frame",
    "An exhausted disk at a named profile (covered without a profile by tests/backup.test.ts, tests/jobs.test.ts and tests/command.test.ts)",
    "Oversized projects arriving by import or restore (only editing commands are refused here)",
  ],
  probes: [],
};
// --probe clips:tracks:frames:WIDTHxHEIGHT measures one unnamed profile and
// prints it, leaving the evidence file as it is (to bound a ceiling).
const probe = args.includes("--probe")
  ? args[args.indexOf("--probe") + 1]
  : null;
if (probe) {
  const [clips, tracks, timelineFrames, size] = probe.split(":");
  if (!/^\d+x\d+$/.test(size ?? ""))
    throw new Error("--probe takes clips:tracks:frames:WIDTHxHEIGHT.");
  const [width, height] = size.split("x").map(Number);
  const result = await measure({
    name: "probe",
    clips: Number(clips),
    tracks: Number(tracks),
    timelineFrames: Number(timelineFrames),
    width,
    height,
  });
  await closePreviews();
  clearInterval(sampler);
  console.log(JSON.stringify(result.export));
  process.exit(0);
}
for (const name of only)
  report.measured.push(
    await measure({ name, ...SCALE_PROFILES.supported[name] }),
  );
report.refusals = await refusals();
// Recorded probe: 40 1080p stills on one track over three minutes, the
// smallest still-heavy export found to fail (export only).
{
  const probeResult = await measure({
    name: "probe-40-stills-3min",
    clips: 40,
    tracks: 2,
    timelineFrames: 5400,
    width: 1920,
    height: 1080,
  });
  report.probes.push({ name: probeResult.profile, export: probeResult.export });
}
// Which profiles export: an explicit flag, never implied by "supported".
for (const m of report.measured) {
  m.editingQualified = Boolean(m.backup?.retained);
  m.exportQualified = m.export?.ok === true;
}
await closePreviews();
clearInterval(sampler);
report.peakRssMiB = Math.round(peakRss / 1024 / 1024);
const file = path.join(
  repo,
  "docs",
  "evidence",
  "ultimate",
  "editor-scale.json",
);
// The evidence file holds a full run only.
if (only.length === ALL.length)
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
else console.error("Partial run: the evidence file is left as it is.");
console.log(JSON.stringify(report, null, 2));
const ok =
  report.refusals.every((r) => r.refused && r.unchanged) &&
  report.measured.every((m) => m.backup?.retained);
process.exit(ok ? 0 : 1);
