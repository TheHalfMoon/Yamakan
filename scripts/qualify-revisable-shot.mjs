/**
 * MPR-101: a take's record, end to end in one temporary workspace with the real store, job
 * table and commands. A generation is started, followed, imported and saved as a take with
 * its record; the workspace is closed and opened again and the record is the same; a version
 * 1 story is read and saved as version 2. MPR-102: a generation made for a shot becomes a take
 * of it as it is brought in, the timeline stays as it was, and what stops it is said.
 *
 * The engine is the in-process fake, and its one output is replaced by a test pattern made
 * with ffmpeg here: nothing in it is AI output. No network, no model, no spend.
 *
 * What this host has is recorded first. What the run needs is unmeasured, so nothing is
 * refused for it; a missing ffmpeg or native helper ends BLOCKED, never PASS.
 *
 * Usage: node scripts/qualify-revisable-shot.mjs [receipt.json [MPR-102-receipt.json]]
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
const targetOut =
  process.argv[3] ??
  (process.argv[2]
    ? null
    : fileURLToPath(
        new URL(
          "../docs/evidence/ultimate/MPR-102-shot-target-receipt.json",
          import.meta.url,
        ),
      ));
const steps = [];
// MPR-102's own, in a receipt of their own.
const targetSteps = [];
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
  // The fake runs and follows the request; its output is the pattern.
  const serving = (engine) => ({
    ...engine,
    enumerateArtifacts: async (ref) =>
      (await engine.enumerateArtifacts(ref)).map((x) => ({
        ...x,
        byteLength: bytes.length,
        sha256,
      })),
    readArtifact: async function* () {
      for (let i = 0; i < bytes.length; i += 1024 * 1024)
        yield new Uint8Array(bytes.subarray(i, i + 1024 * 1024));
    },
  });
  const service = createGenerationService({
    adapter: serving(fake),
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

  // MPR-102, in the same workspace: what a run leaves is the pattern, two seconds long.
  const again = createGenerationService({
    adapter: serving(createFakeEngineV2()),
    store: ctx.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger: ctx.queue.generationLedger(),
  });
  ctx = { ...ctx, generation: { service: again, recipes: [recipe] } };
  const shots = [0, 1, 2, 3].map((n) => ({
    id: randomUUID(),
    name: `Target ${n}`,
    durationTicks: 60 * FRAME,
    notes: "",
    referencePacks: [],
    takes: [],
    selectedTakeId: null,
  }));
  const targets = randomUUID();
  const sceneId = randomUUID();
  const saveShots = async (list) => {
    const held = (await call("yamakan.document.list", { projectId })).find(
      (d) => d.id === targets,
    );
    return call("yamakan.story.save", {
      projectId,
      expectedRevision: await head(),
      documentId: targets,
      expectedContentHash: held?.contentHash ?? null,
      story: {
        format: "yamakan.story",
        formatVersion: 2,
        title: "Targets",
        scenes: [{ id: sceneId, name: "One", shots: list }],
      },
    });
  };
  const storyNow = async () =>
    (await call("yamakan.document.get", { projectId, documentId: targets }))
      .content;
  const timelineHash = async () => {
    const { scenes, tracks, clips } = await call("yamakan.project.export", {
      projectId,
    });
    return sha256Hex(canonicalJson({ scenes, tracks, clips }));
  };
  await saveShots(shots);
  // A cut to keep: the first story, assembled.
  await call("yamakan.story.assemble", {
    projectId,
    expectedRevision: await head(),
    documentId,
    trackId: (await call("yamakan.project.open", { projectId })).tracks.find(
      (t) => t.kind === "video",
    ).id,
  });
  assert.equal(
    (await call("yamakan.project.export", { projectId })).clips.length,
    1,
  );
  const begin = async (shot, durationFrames = 60) => {
    const { generationId } = await call("yamakan.generation.start", {
      projectId,
      recipeId: recipe.id,
      prompt: PROMPT,
      seed: 7,
      width: 704,
      height: 480,
      durationFrames,
      target: { documentId: targets, shotId: shot.id },
    });
    await call("yamakan.generation.status", { generationId });
    return generationId;
  };
  const bring = async (generationId) => {
    const before = await timelineHash();
    const answer = await call("yamakan.generation.import", { generationId });
    assert.equal(await timelineHash(), before);
    return { ...answer, timeline: before };
  };
  const targetStep = (name, detail) => {
    targetSteps.push({ name, ...detail });
    console.log(`ok - ${name}`);
  };
  const one = await bring(await begin(shots[0]));
  assert.equal(one.take.appended, true);
  const { record: made } = await call("yamakan.take.record", {
    projectId,
    documentId: targets,
    shotId: shots[0].id,
    takeId: one.take.takeId,
  });
  assert.equal(made.output.sha256, sha256);
  assert.equal((await storyNow()).scenes[0].shots[0].selectedTakeId, null);
  targetStep(
    "a run made for a shot is a take of it, and the cut is as it was",
    {
      timelineBeforeAndAfter: one.timeline,
      recordHash: one.take.recordHash,
    },
  );
  const running = await begin(shots[0]);
  let now = await storyNow();
  now.scenes[0].shots[0].name = "Renamed";
  await saveShots(now.scenes[0].shots);
  const two = await bring(running);
  now = await storyNow();
  assert.equal(two.take.appended, true);
  assert.equal(now.scenes[0].shots[0].name, "Renamed");
  assert.equal(now.scenes[0].shots[0].takes.length, 2);
  targetStep("a shot renamed meanwhile keeps its name and gains the take", {
    timelineBeforeAndAfter: two.timeline,
  });
  const orphan = await begin(shots[1]);
  await saveShots(now.scenes[0].shots.filter((s) => s.id !== shots[1].id));
  const three = await bring(orphan);
  assert.equal(three.take.reason, "shot-gone");
  assert.ok(
    (await call("yamakan.project.open", { projectId })).assets.some(
      (a) => a.id === three.assetId,
    ),
  );
  targetStep("a shot removed meanwhile is said, and the video stays", {
    timelineBeforeAndAfter: three.timeline,
    reason: three.take.reason,
    message: three.take.message,
  });
  for (let n = 0; n < 8; n++)
    assert.equal((await bring(await begin(shots[2]))).take.appended, true);
  await assert.rejects(begin(shots[2]), /already holds 8 takes/);
  targetStep(
    "eight takes fill a shot, and a ninth is refused before it starts",
    {
      timelineBeforeAndAfter: await timelineHash(),
    },
  );
  const stopped = await begin(shots[3]);
  const keep = again.keepTake;
  again.keepTake = () => {
    throw new Error("stopped between the story and the run's row");
  };
  await assert.rejects(
    call("yamakan.generation.import", { generationId: stopped }),
    /stopped between/,
  );
  again.keepTake = keep;
  const four = await bring(stopped);
  assert.equal(four.take.appended, true);
  assert.equal(
    (await storyNow()).scenes[0].shots.find((s) => s.id === shots[3].id).takes
      .length,
    1,
  );
  targetStep("a stop between the story and the run's row adds nothing twice", {
    timelineBeforeAndAfter: four.timeline,
  });
  passed = true;
} catch (e) {
  // This receipt may be committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
} finally {
  await shut().catch(() => {});
  // Read once, before either receipt is written.
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
  const common = {
    head: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain") !== "",
    host,
    outcome: passed ? "PASS" : blocked ? "BLOCKED" : "FAIL",
    passed,
    failure,
  };
  for (const [out, task, its] of [
    [receiptOut, "MPR-101", steps],
    [targetOut, "MPR-102", targetSteps],
  ])
    if (out)
      writeFileSync(
        out,
        `${JSON.stringify({ task, ...common, steps: its }, null, 2)}
`,
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
