// SS-015: a project's whole closure, through a backup and a restore to a new
// root: media by hash, timing, references and every document kind a project uses.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { RESTORE_UNFINISHED } from "../core/paths.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";
import { backupWorkspace, restoreWorkspace } from "../core/recovery.ts";
import type { Project } from "../core/project.ts";

const bases: string[] = [];
const handles: { close: () => unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const b of bases)
    await rm(b, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
});
const temp = async (prefix: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  bases.push(dir);
  return dir;
};
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const browser = (store: ProjectStore) => {
  const queue = new JobSupervisor(store);
  handles.push(queue);
  return {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
};
async function open(root: string) {
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  return browser(store);
}
const FRAME = 29_429_400; // flicks per frame at 24000/1001
const CUBE = [
  "LUT_3D_SIZE 2",
  "1 1 1",
  "0 1 1",
  "1 0 1",
  "0 0 1",
  "1 1 0",
  "0 1 0",
  "1 0 0",
  "0 0 0",
].join("\n");
const SRT = "1\n00:00:00,500 --> 00:00:01,500\nA line\n";

async function project(root: string) {
  const c = await open(root);
  const created = (
    await execute(c, "yamakan.project.create", {
      name: "Closure",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result as Project;
  const projectId = created.id;
  const run = async <T>(operation: string, args: object) =>
    (await execute(c, operation, { projectId, ...args })).result as T;
  const head = () =>
    run<Project & { tracks: { id: string; kind: string }[] }>(
      "yamakan.project.open",
      {},
    );
  const media = async (name: string, source: string) => {
    const file = path.join(await temp("yamakan-closure-media-"), name);
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
        source,
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
    const bytes = await readFile(file);
    await rm(file);
    const { project: p } = await c.store.importAsset(projectId, name, bytes);
    return p.assets.find((a) => a.name === name)!;
  };
  const a = await media("a.mp4", "color=c=red:s=64x36:r=30:d=4");
  const b = await media("b.mp4", "color=c=blue:s=64x36:r=30:d=4");
  const opened = await head();
  const trackId = opened.tracks.find((t) => t.kind === "video")!.id;
  const shotId = crypto.randomUUID();
  const storyId = crypto.randomUUID();
  await run("yamakan.story.save", {
    expectedRevision: opened.revision,
    documentId: storyId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 1,
      title: "One shot",
      scenes: [
        {
          id: crypto.randomUUID(),
          name: "One",
          shots: [
            {
              id: shotId,
              name: "Wide",
              durationTicks: 30 * FRAME,
              notes: "",
              referencePacks: [],
              takes: [
                { id: crypto.randomUUID(), assetId: a.id, sourceStartTicks: 0 },
                { id: crypto.randomUUID(), assetId: b.id, sourceStartTicks: 0 },
              ],
              selectedTakeId: null,
            },
          ],
        },
      ],
    },
  });
  await run("yamakan.captions.import", {
    expectedRevision: (await head()).revision,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    name: "English",
    language: "en",
    format: "srt",
    text: SRT,
  });
  await run("yamakan.lut.import", {
    expectedRevision: (await head()).revision,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    name: "Grade",
    text: CUBE,
  });
  const clipId = crypto.randomUUID();
  await run("yamakan.project.applyBatch", {
    expectedRevision: (await head()).revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId,
        assetId: a.id,
        title: null,
        startTicks: 7 * FRAME,
        durationTicks: 30 * FRAME,
        sourceStartTicks: 11 * FRAME,
      },
    ],
  });
  return { ...c, projectId, run, a, b, clipId };
}

// What a project is, as a comparison sees it.
const portrait = async (c: { store: ProjectStore }, projectId: string) => {
  const canonical = await c.store.exportProject(projectId);
  const documents = c.store.listDocuments(projectId) as unknown as {
    id: string;
    kind: string;
    contentHash: string;
  }[];
  return {
    canonical: JSON.stringify(canonical),
    documents: documents
      .map((d) => {
        const { bytes } = c.store.getDocument(projectId, d.id);
        return {
          id: d.id,
          kind: d.kind,
          hash: d.contentHash,
          bytes: sha(bytes),
        };
      })
      .sort((x, y) => x.id.localeCompare(y.id)),
  };
};

const tree = async (root: string) => {
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((f) => f.isFile())
    .map((f) => path.relative(root, path.join(f.parentPath, f.name)))
    .filter((f) => !/workspace\.sqlite|\.lock|\.tmp/.test(f))
    .sort();
  assert.ok(files.length >= 2, "the media files are compared");
  return Promise.all(
    files.map(async (f) => [f, sha(await readFile(path.join(root, f)))]),
  );
};

test("a restore to a new root holds the project's media, timing, references and documents", async () => {
  const home = await temp("yamakan-closure-");
  const root = await temp("yamakan-closure-root-");
  const p = await project(root);
  const before = await portrait(p, p.projectId);
  assert.deepEqual(before.documents.map((d) => d.kind).sort(), [
    "captions",
    "lut",
    "story",
  ]);
  const backup = await backupWorkspace(p.store, home);
  assert.equal(backup.creative, "complete");
  assert.equal(backup.closureGaps, 0);
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored"),
  );
  assert.equal(restored.closure.gaps, 0);
  assert.equal(restored.closure.documents, 3);

  const copy = await open(restored.root);
  assert.deepEqual(await portrait(copy, p.projectId), before);
  // Timing on the project's own frames, and media by content.
  const head = await copy.store.exportProject(p.projectId);
  const clip = head.clips.find((c) => c.id === p.clipId)!;
  assert.equal(clip.startTicks, 7 * FRAME);
  assert.equal(clip.durationTicks, 30 * FRAME);
  assert.equal(clip.sourceStartTicks, 11 * FRAME);
  for (const asset of [p.a, p.b]) {
    const { file } = await copy.store.assetFile(p.projectId, asset.id);
    assert.equal(sha(await readFile(file)), asset.hash, asset.name);
  }
  // An OTIO export is the same file from either root.
  const otio = async (c: typeof copy) =>
    JSON.stringify(
      (
        await execute(c, "yamakan.project.exportOtio", {
          projectId: p.projectId,
        })
      ).result,
    );
  assert.equal(await otio(copy), await otio(p));
});

test("a refused restore leaves no folder and the original as it was, and the backup can still restore", async () => {
  const home = await temp("yamakan-closure-bad-");
  const root = await temp("yamakan-closure-root-");
  const p = await project(root);
  const backup = await backupWorkspace(p.store, home);
  const dir = path.join(home, "backups", backup.backupId);
  const original = await tree(root);
  const held = await portrait(p, p.projectId);

  // A database copy cut short: refused by its size, before anything is read.
  const database = path.join(dir, "workspace.sqlite");
  const good = await readFile(database);
  await writeFile(database, good.subarray(0, Math.floor(good.length / 2)));
  const target = path.join(home, "restored");
  await assert.rejects(restoreWorkspace(dir, target), {
    code: "RECOVERY_REQUIRED",
  });
  assert.ok(
    await stat(target).then(
      () => false,
      () => true,
    ),
    "a refused restore leaves no folder to mistake for a workspace",
  );
  assert.deepEqual(await tree(root), original);
  assert.deepEqual(await portrait(p, p.projectId), held);

  // Put back, the same backup still restores.
  await writeFile(database, good);
  const restored = await restoreWorkspace(dir, path.join(home, "restored-2"));
  assert.equal(restored.closure.gaps, 0);
});

test("a folder a restore did not finish refuses to open, and a finished one does not", async () => {
  const home = await temp("yamakan-closure-unfinished-");
  const root = await temp("yamakan-closure-root-");
  const p = await project(root);
  const backup = await backupWorkspace(p.store, home);
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored"),
  );
  assert.ok(
    !(await readdir(restored.root)).includes(RESTORE_UNFINISHED),
    "a finished restore carries no mark",
  );
  const unfinished = await temp("yamakan-closure-partial-");
  await writeFile(path.join(unfinished, RESTORE_UNFINISHED), "");
  await assert.rejects(new ProjectStore(unfinished).initialize(), {
    code: "RECOVERY_REQUIRED",
  });
  assert.deepEqual(await readdir(unfinished), [RESTORE_UNFINISHED]);
});
