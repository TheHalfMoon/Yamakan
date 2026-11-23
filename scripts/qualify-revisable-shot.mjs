/**
 * MPR-101: a take's record, end to end in one temporary workspace with the real store, job
 * table and commands. A generation is started, followed, imported and saved as a take with
 * its record; the workspace is closed and opened again and the record is the same; a version
 * 1 story is read and saved as version 2.
 *
 * The engine is the in-process fake, and its one output is replaced by a test pattern made
 * with ffmpeg here: nothing in it is AI output. No network, no model, no spend.
 *
 * What this host has is recorded first. What the run needs is unmeasured, so nothing is
 * refused for it; a missing ffmpeg or native helper ends BLOCKED, never PASS.
 *
 * Usage: node scripts/qualify-revisable-shot.mjs [receipt.json]
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
} from "../core/command/registry.ts";
import { createFakeEngineV2 } from "../core/engines/fake.ts";
import { createGenerationService } from "../core/engines/generation.ts";
import { diagnostic } from "../core/engines/contract-v2.ts";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import { mediaTools } from "../core/process/workers.ts";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();

const receiptOut =
  process.argv[2] ??
  fileURLToPath(
    new URL(
      "../docs/evidence/ultimate/MPR-101-take-record-receipt.json",
      import.meta.url,
    ),
  );
const root = mkdtempSync(join(tmpdir(), "yamakan-revisable-shot-"));
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
// Where core/process/owner.ts looks for it, on Windows. Elsewhere it needs none.
const procd =
  process.env.YAMAKAN_PROCD ||
  fileURLToPath(
    new URL(
      "../native/procd/target/release/yamakan-procd.exe",
      import.meta.url,
    ),
  );
const FRAME = 23_520_000;
// core/store.ts MAX_REVISION.
const MAX_REVISION = 10_000;
const PROMPT = "A test pattern, not a generated video.";
let passed = false;
let blocked = null;
let failure = null;
const open = [];

// The head's story as an older build stored it: its bytes, hash and version 1, named by a
// head snapshot of its own. The service is closed.
const asAnOlderBuildStored = (projectId, ref, story) => {
  const bytes = Buffer.from(canonicalJson(story), "utf8");
  const hash = sha256Hex(bytes);
  const db = new DatabaseSync(join(root, "workspace", "workspace.sqlite"));
  const head = db
    .prepare(
      "SELECT p.snapshot_hash AS hash, s.format AS format, s.bytes AS bytes FROM projects p JOIN snapshots s ON s.hash = p.snapshot_hash WHERE p.project_id = ?",
    )
    .get(projectId);
  const was = Buffer.from(head.bytes).toString("utf8");
  const project = JSON.parse(was);
  assert.equal(JSON.stringify(project), was, "the snapshot keeps its form");
  const named = project.documents.find((d) => d.id === ref.id);
  named.contentHash = hash;
  named.schemaVersion = 1;
  const snapshot = Buffer.from(JSON.stringify(project), "utf8");
  const next = sha256Hex(snapshot);
  db.prepare(
    "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) SELECT ?, kind, 1, asset_ids, object_digests, ?, ? FROM creative_documents WHERE hash = ?",
  ).run(hash, bytes, bytes.length, ref.contentHash);
  db.prepare(
    "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) SELECT project_id, document_id, ?, revision FROM story_document_versions WHERE content_hash = ?",
  ).run(hash, ref.contentHash);
  db.prepare(
    "INSERT INTO snapshots(hash, format, bytes, byte_length) VALUES (?, ?, ?, ?)",
  ).run(next, head.format, snapshot, snapshot.length);
  db.prepare(
    "INSERT INTO snapshot_document_refs SELECT ?, document_hash FROM snapshot_document_refs WHERE snapshot_hash = ? AND document_hash <> ?",
  ).run(next, head.hash, ref.contentHash);
  db.prepare("INSERT INTO snapshot_document_refs VALUES (?, ?)").run(
    next,
    hash,
  );
  db.prepare("UPDATE projects SET snapshot_hash = ? WHERE project_id = ?").run(
    next,
    projectId,
  );
  db.prepare(
    "UPDATE revisions SET snapshot_hash = ? WHERE project_id = ? AND snapshot_hash = ?",
  ).run(next, projectId, head.hash);
  db.close();
  return hash;
};

const workspace = async () => {
  const store = new ProjectStore(join(root, "workspace"));
  open.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  open.push(queue);
  return {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  };
};
const shut = async () => {
  for (const handle of open.splice(0).reverse()) await handle.close();
};

try {
  // Looked for before anything runs.
  if (process.platform === "win32" && !existsSync(procd))
    blocked = "The native helpers are not built.";
  else
    try {
      execFileSync(mediaTools().ffmpeg, ["-version"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      blocked = "ffmpeg does not start on this host.";
    }
  if (blocked) throw new Error(blocked);
  const file = join(root, "pattern.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=704x480:rate=30:duration=2",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      file,
    ],
    { windowsHide: true },
  );
  const bytes = readFileSync(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  let ctx = await workspace();
  const fake = createFakeEngineV2();
  const recipe = {
    id: "qualify-pattern",
    hash: "a".repeat(64),
    operation: "textToVideo",
    modelManifestHash: "b".repeat(64),
  };
  const service = createGenerationService({
    // The fake runs and follows the request; its output is the pattern.
    adapter: {
      ...fake,
      enumerateArtifacts: async (ref) =>
        (await fake.enumerateArtifacts(ref)).map((a) => ({
          ...a,
          byteLength: bytes.length,
          sha256,
        })),
      readArtifact: async function* () {
        for (let i = 0; i < bytes.length; i += 1024 * 1024)
          yield new Uint8Array(bytes.subarray(i, i + 1024 * 1024));
      },
    },
    store: ctx.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger: ctx.queue.generationLedger(),
  });
  ctx = { ...ctx, generation: { service, recipes: [recipe] } };
  const call = async (operation, parameters) =>
    (await execute(ctx, operation, parameters)).result;
  const project = await call("yamakan.project.create", { name: "Records" });
  const projectId = project.id;
  const head = async () =>
    (await call("yamakan.project.open", { projectId })).revision;

  const { generationId } = await call("yamakan.generation.start", {
    projectId,
    recipeId: recipe.id,
    prompt: PROMPT,
    seed: 7,
    width: 704,
    height: 480,
    durationFrames: 60,
  });
  const status = await call("yamakan.generation.status", { generationId });
  assert.equal(status.state, "succeeded");
  const imported = await call("yamakan.generation.import", { generationId });
  assert.equal(imported.lineage.outputHash, sha256);
  step("a run is started, followed and its checked video imported");

  const before = await head();
  const documentId = randomUUID();
  const takeId = randomUUID();
  const shotId = randomUUID();
  const story = {
    format: "yamakan.story",
    formatVersion: 2,
    title: "Records",
    scenes: [
      {
        id: randomUUID(),
        name: "One",
        shots: [
          {
            id: shotId,
            name: "Shot",
            durationTicks: 60 * FRAME,
            notes: "",
            referencePacks: [],
            takes: [
              { id: takeId, assetId: imported.assetId, sourceStartTicks: 0 },
            ],
            selectedTakeId: takeId,
          },
        ],
      },
    ],
  };
  const saved = await call("yamakan.story.save", {
    projectId,
    expectedRevision: before,
    documentId,
    expectedContentHash: null,
    story,
    records: [{ takeId, from: { generationId } }],
  });
  assert.equal(saved.document.schemaVersion, 2);
  const read = () =>
    call("yamakan.take.record", { projectId, documentId, shotId, takeId });
  const { recordHash, record } = await read();
  assert.deepEqual(saved.records, [{ takeId, recordHash }]);
  assert.equal(recordHash, sha256Hex(canonicalJson(record)));
  assert.equal(record.output.sha256, sha256);
  assert.equal(record.request.seed, 7);
  assert.deepEqual(record.recipe, { id: recipe.id, hash: recipe.hash });
  assert.equal(record.model.manifestHash, recipe.modelManifestHash);
  assert.equal(record.request.promptHash, sha256Hex(PROMPT));
  // FD-2: the project keeps the words, and they match their hash.
  assert.equal(record.request.prompt, PROMPT);
  assert.ok(record.timings.endedAt >= record.timings.startedAt);
  assert.ok(record.timings.importedAt >= record.timings.endedAt);
  step(
    "its take is saved with a record that matches the run and its own hash",
    {
      recordHash,
      revisions: (await head()) - before,
      maxRevision: MAX_REVISION,
    },
  );

  await shut();
  ctx = await workspace();
  assert.deepEqual(await read(), { recordHash, record });
  step("the record is the same after the workspace is closed and opened again");

  const list = await call("yamakan.take.list", { projectId, documentId });
  assert.equal(list.shots[0].takes[0].recordHash, recordHash);
  const second = randomUUID();
  const old = {
    ...structuredClone(story),
    formatVersion: 1,
    title: "An older story",
  };
  old.scenes[0].id = randomUUID();
  old.scenes[0].shots[0].id = randomUUID();
  old.scenes[0].shots[0].takes[0].id = randomUUID();
  old.scenes[0].shots[0].selectedTakeId = old.scenes[0].shots[0].takes[0].id;
  const first = await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId: second,
    expectedContentHash: null,
    story: { ...old, formatVersion: 2 },
  });
  await shut();
  const oldHash = asAnOlderBuildStored(projectId, first.document, old);
  ctx = await workspace();
  const readOld = await call("yamakan.document.get", {
    projectId,
    documentId: second,
  });
  assert.equal(readOld.schemaVersion, 1);
  assert.deepEqual(readOld.content, old);
  const oldList = await call("yamakan.take.list", {
    projectId,
    documentId: second,
  });
  assert.equal(oldList.shots[0].takes[0].recordHash, null);
  const upgraded = await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId: second,
    expectedContentHash: oldHash,
    story: readOld.content,
  });
  assert.equal(upgraded.document.schemaVersion, 2);
  const content = (
    await call("yamakan.document.get", { projectId, documentId: second })
  ).content;
  assert.deepEqual(content, { ...old, formatVersion: 2 });
  step(
    "a stored version 1 story is read, and saved as version 2 with every part kept",
  );
  passed = true;
} catch (e) {
  // This receipt may be committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
} finally {
  await shut().catch(() => {});
  if (receiptOut)
    writeFileSync(
      receiptOut,
      `${JSON.stringify(
        {
          task: "MPR-101",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          dirty:
            execFileSync("git", ["status", "--porcelain"], {
              encoding: "utf8",
            }).trim() !== "",
          host,
          outcome: passed ? "PASS" : blocked ? "BLOCKED" : "FAIL",
          passed,
          failure,
          steps,
        },
        null,
        2,
      )}\n`,
    );
  try {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  } catch (e) {
    console.log(`note - left behind: ${root} (${e.code})`);
  }
}
console.log(
  passed
    ? "REVISABLE SHOT PASS"
    : blocked
      ? `REVISABLE SHOT BLOCKED: ${blocked}`
      : "REVISABLE SHOT FAIL",
);
process.exit(passed ? 0 : 1);
