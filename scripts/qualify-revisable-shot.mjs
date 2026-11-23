/**
 * MPR-101: a take's record, end to end in one temporary workspace with the real store, job
 * table and commands. A generation is started, followed, imported and saved as a take with
 * its record; the workspace is closed and opened again and the record is the same; a version
 * 1 story is read and saved as version 2. MPR-102: a generation made for a shot becomes a take
 * of it as it is brought in, the timeline stays as it was, and what stops it is said. MPR-107:
 * one shot's history says what was tried for it, the same over REST and MCP from the service
 * started on this workspace, and stays inside its time and size on a project with many runs.
 * MPR-103: a take's request is read back as a draft, a run from it with another seed records that
 * the seed is what changed, and the new take is placed and undone as one step. The stand-in
 * engine's output does not follow its request, so this proves the record and not a model.
 *
 * The engine is the in-process fake, and its one output is replaced by a test pattern made
 * with ffmpeg here: nothing in it is AI output. No network, no model, no spend.
 *
 * What this host has is recorded first. What the run needs is unmeasured, so nothing is
 * refused for it; a missing ffmpeg or native helper ends BLOCKED, never PASS.
 *
 * Usage: node scripts/qualify-revisable-shot.mjs [receipt.json [MPR-102-receipt.json [MPR-107-receipt.json [MPR-103-receipt.json]]]]
 */
import { execFileSync, fork, spawn } from "node:child_process";
import { once } from "node:events";
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
import { YamakanClient } from "../sdk/client.ts";
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
const historyOut =
  process.argv[4] ??
  (process.argv[2]
    ? null
    : fileURLToPath(
        new URL(
          "../docs/evidence/ultimate/MPR-107-shot-history-receipt.json",
          import.meta.url,
        ),
      ));
const revisionOut =
  process.argv[5] ??
  (process.argv[2]
    ? null
    : fileURLToPath(
        new URL(
          "../docs/evidence/ultimate/MPR-103-take-revision-receipt.json",
          import.meta.url,
        ),
      ));
const steps = [];
const historySteps = [];
const revisionSteps = [];
const measured = { worstMs: null, largestBytes: null };
// The service and the MCP server, while they run.
let served;
let spoken;
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
  const pattern = (name, source) => {
    const file = join(root, name);
    execFileSync(
      mediaTools().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `${source}=size=704x480:rate=30:duration=2`,
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        file,
      ],
      { windowsHide: true },
    );
    const bytes = readFileSync(file);
    return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
  };
  const onePattern = pattern("pattern.mp4", "testsrc2");
  const { sha256 } = onePattern;

  let ctx = await workspace();
  const fake = createFakeEngineV2();
  const recipe = {
    id: "qualify-pattern",
    hash: "a".repeat(64),
    operation: "textToVideo",
    modelManifestHash: "b".repeat(64),
  };
  // The fake runs and follows the request; its output is the pattern.
  const serving = (engine, output = () => onePattern) => ({
    ...engine,
    enumerateArtifacts: async (ref) =>
      (await engine.enumerateArtifacts(ref)).map((x) => ({
        ...x,
        byteLength: output().bytes.length,
        sha256: output().sha256,
      })),
    readArtifact: async function* () {
      const { bytes } = output();
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
  // MPR-106: what the first is meant to show.
  const meant = { action: "A red kite.", direction: { shot: "wide" } };
  const shots = [0, 1, 2, 3].map((n) => ({
    id: randomUUID(),
    name: `Target ${n}`,
    durationTicks: 60 * FRAME,
    notes: "",
    referencePacks: [],
    takes: [],
    selectedTakeId: null,
    ...(n === 0 ? { intent: meant } : {}),
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
  // MPR-106: the words and the take leave each other as they are.
  const [meantShot] = (await storyNow()).scenes[0].shots;
  assert.deepEqual(meantShot.intent, meant);
  const saidAgain = {
    ...meant,
    action: "A red kite, higher.",
    dialogue: "Up!",
  };
  await saveShots(
    (await storyNow()).scenes[0].shots.map((s) =>
      s.id === meantShot.id ? { ...s, intent: saidAgain } : s,
    ),
  );
  const [nowSaid] = (await storyNow()).scenes[0].shots;
  assert.deepEqual(nowSaid, { ...meantShot, intent: saidAgain });
  assert.deepEqual(
    await call("yamakan.take.record", {
      projectId,
      documentId: targets,
      shotId: meantShot.id,
      takeId: one.take.takeId,
    }),
    { recordHash: one.take.recordHash, record: made },
  );
  step(
    "a take added to a shot keeps its intent, and a new intent keeps the take's record (MPR-106)",
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

  // MPR-107, on a shot of its own: two runs brought in, one that fails, one that is stopped, a
  // replacement and its undo.
  const historyStep = (name, detail) => {
    historySteps.push({ name, ...detail });
    console.log(`ok - ${name}`);
  };
  let ends = "succeeded";
  // The second run makes other media, so that a replacement changes what the clip shows.
  const otherPattern = pattern("second.mp4", "smptebars");
  let makes = onePattern;
  const engine = createFakeEngineV2();
  const ledgered = createGenerationService({
    adapter: {
      ...serving(engine, () => makes),
      status: async (ref) => {
        const said = await engine.status(ref);
        return ends === "failed"
          ? {
              executionRef: ref,
              state: "failed",
              failureClass: "timeout",
              diagnostic: "It failed, for this check.",
            }
          : ends === "running"
            ? { executionRef: ref, state: "running" }
            : said;
      },
    },
    store: ctx.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger: ctx.queue.generationLedger(),
  });
  ctx = { ...ctx, generation: { service: ledgered, recipes: [recipe] } };
  const told = {
    id: randomUUID(),
    name: "Ledger",
    durationTicks: 60 * FRAME,
    notes: "",
    referencePacks: [],
    takes: [],
    selectedTakeId: null,
  };
  const ledgerStory = randomUUID();
  const ledgerScene = randomUUID();
  const saveTold = async (shot) => {
    const held = (await call("yamakan.document.list", { projectId })).find(
      (d) => d.id === ledgerStory,
    );
    return call("yamakan.story.save", {
      projectId,
      expectedRevision: await head(),
      documentId: ledgerStory,
      expectedContentHash: held?.contentHash ?? null,
      story: {
        format: "yamakan.story",
        formatVersion: 2,
        title: "Ledger",
        scenes: [{ id: ledgerScene, name: "One", shots: [shot] }],
      },
    });
  };
  await saveTold(told);
  const goes = async (how) => {
    ends = how;
    const { generationId } = await call("yamakan.generation.start", {
      projectId,
      recipeId: recipe.id,
      prompt: PROMPT,
      seed: 7,
      width: 704,
      height: 480,
      durationFrames: 60,
      target: { documentId: ledgerStory, shotId: told.id },
    });
    await call("yamakan.generation.status", { generationId });
    return generationId;
  };
  const brought = [];
  for (const made of [onePattern, otherPattern]) {
    makes = made;
    const generationId = await goes("succeeded");
    const { take } = await call("yamakan.generation.import", { generationId });
    brought.push({ generationId, takeId: take.takeId });
  }
  const failedRun = await goes("failed");
  const stoppedRun = await goes("running");
  await call("yamakan.generation.cancel", { generationId: stoppedRun });
  const inStory = (
    await call("yamakan.document.get", { projectId, documentId: ledgerStory })
  ).content.scenes[0].shots[0];
  await saveTold({ ...inStory, selectedTakeId: brought[0].takeId });
  await call("yamakan.story.assemble", {
    projectId,
    expectedRevision: await head(),
    documentId: ledgerStory,
    trackId: (await call("yamakan.project.open", { projectId })).tracks.find(
      (t) => t.kind === "video",
    ).id,
  });
  const proposal = await call("yamakan.take.proposeReplace", {
    projectId,
    documentId: ledgerStory,
    shotId: told.id,
    takeId: brought[1].takeId,
  });
  const applied = await call("yamakan.take.apply", {
    projectId,
    expectedRevision: await head(),
    proposal,
  });
  await call("yamakan.project.undo", {
    projectId,
    expectedRevision: await head(),
  });
  const ask = { projectId, documentId: ledgerStory, shotId: told.id };
  const ledger = await call("yamakan.shot.history", ask);
  assert.deepEqual(
    ledger.attempts.map((x) => [x.id, x.outcome, x.takeId]),
    [
      [stoppedRun, "cancelled", null],
      [failedRun, "failed", null],
      [brought[1].generationId, "succeeded", brought[1].takeId],
      [brought[0].generationId, "succeeded", brought[0].takeId],
    ],
  );
  assert.deepEqual(ledger.replacements, [
    {
      revision: applied.revision,
      principalId: "browser-ui",
      fromTakeId: brought[0].takeId,
      toTakeId: brought[1].takeId,
      clips: 1,
    },
  ]);
  assert.equal(ledger.current.shownTakeId, brought[0].takeId);
  assert.deepEqual(
    [
      ledger.totals.attempts,
      ledger.totals.succeeded,
      ledger.totals.failed,
      ledger.totals.cancelled,
      ledger.totals.takes,
      ledger.totals.replacements,
    ],
    [4, 2, 1, 1, 2, 1],
  );
  assert.ok(!JSON.stringify(ledger).includes(PROMPT));
  historyStep(
    "one shot's history: two runs brought in, one failed, one stopped, a replacement and its undo",
    { ledger },
  );

  // MPR-103, on a shot of its own.
  const revisionStep = (name, detail) => {
    revisionSteps.push({ name, ...detail });
    console.log(`ok - ${name}`);
  };
  const revisedShot = { ...told, id: randomUUID(), name: "Revised" };
  const revisionStory = randomUUID();
  const revisionScene = randomUUID();
  const saveRevised = async (shot) => {
    const held = (await call("yamakan.document.list", { projectId })).find(
      (d) => d.id === revisionStory,
    );
    return call("yamakan.story.save", {
      projectId,
      expectedRevision: await head(),
      documentId: revisionStory,
      expectedContentHash: held?.contentHash ?? null,
      story: {
        format: "yamakan.story",
        formatVersion: 2,
        title: "Revised",
        scenes: [{ id: revisionScene, name: "One", shots: [shot] }],
      },
    });
  };
  const aim = { documentId: revisionStory, shotId: revisedShot.id };
  await saveRevised(revisedShot);
  ends = "succeeded";
  const makeTake = async (made, more) => {
    makes = made;
    const { generationId } = await call("yamakan.generation.start", {
      projectId,
      target: aim,
      ...more,
    });
    await call("yamakan.generation.status", { generationId });
    const { take } = await call("yamakan.generation.import", { generationId });
    assert.equal(take.appended, true);
    const { record } = await call("yamakan.take.record", {
      projectId,
      ...aim,
      takeId: take.takeId,
    });
    return { ...take, record };
  };
  const firstTake = await makeTake(onePattern, {
    recipeId: recipe.id,
    prompt: PROMPT,
    seed: 7,
    width: 704,
    height: 480,
    durationFrames: 60,
  });
  const drafted = await call("yamakan.take.revisionDraft", {
    projectId,
    ...aim,
    takeId: firstTake.takeId,
  });
  assert.equal(drafted.base.recordHash, firstTake.recordHash);
  assert.deepEqual(drafted.draft, {
    recipeId: recipe.id,
    prompt: PROMPT,
    seed: 7,
    width: 704,
    height: 480,
    durationFrames: 60,
    firstFrameAssetId: null,
  });
  assert.deepEqual(
    [drafted.complete, drafted.startable, drafted.reason],
    [true, true, null],
  );
  revisionStep("a take's request is read back as a draft", {
    baseRecordHash: firstTake.recordHash,
    draft: { ...drafted.draft, prompt: "(kept)" },
    checks: drafted.checks,
  });
  const shownRevised = (
    await call("yamakan.document.get", { projectId, documentId: revisionStory })
  ).content.scenes[0].shots[0];
  await saveRevised({ ...shownRevised, selectedTakeId: firstTake.takeId });
  await call("yamakan.story.assemble", {
    projectId,
    expectedRevision: await head(),
    documentId: revisionStory,
    trackId: (await call("yamakan.project.open", { projectId })).tracks.find(
      (t) => t.kind === "video",
    ).id,
  });
  const { firstFrameAssetId: _none, ...startAgain } = drafted.draft;
  const nextTake = await makeTake(otherPattern, {
    ...startAgain,
    seed: 8,
    derivedFromTakeId: firstTake.takeId,
    revisionNote: "Another seed, for this check.",
  });
  assert.equal(nextTake.record.derivedFromTakeId, firstTake.takeId);
  assert.equal(nextTake.record.derivedFromRecordHash, firstTake.recordHash);
  assert.deepEqual(nextTake.record.changedFields, ["seed"]);
  assert.equal(nextTake.record.revisionNote, "Another seed, for this check.");
  revisionStep("a run from the draft with another seed records that change", {
    baseRecordHash: firstTake.recordHash,
    newRecordHash: nextTake.recordHash,
    changedFields: nextTake.record.changedFields,
    revisionNote: nextTake.record.revisionNote,
  });
  const repeated = await makeTake(otherPattern, {
    ...startAgain,
    derivedFromTakeId: firstTake.takeId,
  });
  assert.deepEqual(repeated.record.changedFields, []);
  assert.equal(repeated.record.revisionNote, null);
  revisionStep("a run from the draft as it is records no change", {
    newRecordHash: repeated.recordHash,
    changedFields: repeated.record.changedFields,
  });
  const shownNow = async () =>
    (await call("yamakan.take.list", { projectId, documentId: revisionStory }))
      .shots[0].timeline.currentTakeId;
  assert.equal(await shownNow(), firstTake.takeId);
  const sideBySide = await call("yamakan.take.compare", {
    projectId,
    ...aim,
    takeIds: [firstTake.takeId, nextTake.takeId],
  });
  assert.equal(sideBySide.takes.length, 2);
  const revisionProposal = await call("yamakan.take.proposeReplace", {
    projectId,
    ...aim,
    takeId: nextTake.takeId,
  });
  const beforeApply = await head();
  const placed = await call("yamakan.take.apply", {
    projectId,
    expectedRevision: beforeApply,
    proposal: revisionProposal,
  });
  assert.equal(placed.revision, beforeApply + 1);
  assert.equal(await shownNow(), nextTake.takeId);
  const takenBack = await call("yamakan.project.undo", {
    projectId,
    expectedRevision: placed.revision,
  });
  assert.equal(takenBack.revision, placed.revision + 1);
  assert.equal(await shownNow(), firstTake.takeId);
  revisionStep("the new take is compared, placed and undone as one step", {
    revisionBefore: beforeApply,
    applied: placed.revision,
    undone: takenBack.revision,
  });

  // A project with many runs and many notes.
  const many = { ...told, id: randomUUID(), name: "Many" };
  const manyStory = randomUUID();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId: manyStory,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "Many",
      scenes: [{ id: randomUUID(), name: "One", shots: [many] }],
    },
  });
  const table = ctx.queue.generationLedger();
  for (let n = 0; n < 2_000; n++) {
    const generationId = randomUUID();
    const made = {
      generationId,
      projectId,
      recipe,
      prompt: PROMPT,
      seed: n,
      width: 704,
      height: 480,
      durationFrames: 60,
      firstFrameAssetId: null,
      inputs: [],
      ...(n % 8 === 0
        ? { target: { documentId: manyStory, shotId: many.id } }
        : {}),
      executionRef: `seeded-${n}`,
      phase: "sent",
      startedAt: 1_000,
      state: "running",
      diagnostic: "It failed, for this check. ".repeat(20),
      videoSha256: null,
      imported: null,
      cancelled: false,
      dismissed: false,
    };
    table.begin(made);
    table.update(generationId, { state: "failed", endedAt: 2_000 });
  }
  const db = new DatabaseSync(join(root, "workspace", "workspace.sqlite"));
  db.exec("BEGIN");
  for (let n = 0; n < 300; n++) {
    const noteBytes = Buffer.from(
      canonicalJson({
        format: "yamakan.take-replacement",
        formatVersion: 1,
        documentId: manyStory,
        shotId: many.id,
        fromTakeId: randomUUID(),
        toTakeId: randomUUID(),
        clips: 1,
        revision: n + 1,
        principalId: "browser-ui",
      }),
      "utf8",
    );
    const hash = sha256Hex(noteBytes);
    db.prepare(
      "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) VALUES (?, 'takeReplacement', 1, '[]', '[]', ?, ?)",
    ).run(hash, noteBytes, noteBytes.length);
    db.prepare(
      "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) VALUES (?, ?, ?, ?)",
    ).run(projectId, manyStory, hash, n + 1);
  }
  db.exec("COMMIT");
  db.close();
  measured.worstMs = 0;
  measured.largestBytes = 0;
  const asked = {
    projectId,
    documentId: manyStory,
    shotId: many.id,
    limit: 100,
  };
  for (let n = 0; n < 20; n++) {
    const began = performance.now();
    const page = await call("yamakan.shot.history", asked);
    measured.worstMs = Math.max(
      measured.worstMs,
      Math.round((performance.now() - began) * 10) / 10,
    );
    measured.largestBytes = Math.max(
      measured.largestBytes,
      Buffer.byteLength(JSON.stringify(page)),
    );
    assert.equal(page.totals.attempts, 250);
    assert.equal(page.attempts.length, 100);
    assert.equal(page.replacementTotal, 300);
    assert.equal(page.replacements.length, 32);
    assert.equal(page.totals.complete, true);
  }
  assert.ok(measured.largestBytes <= 128 * 1024, `${measured.largestBytes}`);
  assert.ok(measured.worstMs <= 250, `${measured.worstMs} ms`);
  const pages = [];
  let upTo;
  do {
    const page = await call("yamakan.shot.history", {
      ...asked,
      ...(upTo === undefined ? {} : { before: upTo }),
    });
    pages.push(page.attempts.length);
    upTo = page.next ?? undefined;
  } while (upTo !== undefined);
  assert.deepEqual(pages, [100, 100, 50]);
  historyStep(
    "twenty calls on 2,000 runs, 250 of them the shot's, and 300 notes",
    {
      ...measured,
      pages,
    },
  );

  // The same from the service itself, over both of its transports.
  await shut();
  const port = 24379;
  const url = `http://127.0.0.1:${port}`;
  const where = fileURLToPath(new URL("..", import.meta.url));
  const workspaceFolder = join(root, "workspace");
  served = fork(join(where, "server", "main.ts"), [], {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: workspaceFolder,
      YAMAKAN_PORT: String(port),
    },
    silent: true,
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The service did not start.")),
      20_000,
    );
    served.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("Yamakan is running")) return;
      clearTimeout(timer);
      resolve();
    });
    served.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`The service exited ${code}.`));
    });
  });
  const client = new YamakanClient({
    baseUrl: url,
    token: readFileSync(join(workspaceFolder, "token"), "utf8").trim(),
  });
  const overRest = await client.call("yamakan.shot.history", ask);
  const askDraft = { projectId, ...aim, takeId: firstTake.takeId };
  const draftOverRest = await client.call(
    "yamakan.take.revisionDraft",
    askDraft,
  );
  spoken = spawn(process.execPath, [join(where, "mcp", "main.ts")], {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: workspaceFolder,
      YAMAKAN_MCP_LOCAL_CLIENT: "1",
      YAMAKAN_URL: url,
    },
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });
  const answers = [];
  const [overMcp, draftOverMcp] = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("MCP did not answer.")),
      20_000,
    );
    let said = "";
    spoken.stdout.on("data", (chunk) => {
      said += String(chunk);
      const lines = said.split("\n");
      said = lines.pop();
      for (const line of lines) {
        const { id, result } = JSON.parse(line);
        answers[id - 1] = JSON.parse(result.content[0].text);
      }
      if (answers[0] === undefined || answers[1] === undefined) return;
      clearTimeout(timer);
      resolve(answers);
    });
    // One that has gone is said, after the receipts are written.
    spoken.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`MCP exited ${code}.`));
    });
    spoken.once("error", reject);
    spoken.stdin.on("error", reject);
    spoken.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "yamakan_shot_history", arguments: ask },
      })}\n${JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "yamakan_take_revisionDraft", arguments: askDraft },
      })}\n`,
    );
  });
  assert.deepEqual(overMcp, overRest);
  // The run of before is followed no more by a service with no engine, and told the same.
  const bare = ({ revision: _r, ...rest }) => rest;
  assert.deepEqual(bare(overRest), bare(JSON.parse(JSON.stringify(ledger))));
  historyStep("the service answers the same over REST and over MCP");
  assert.deepEqual(draftOverMcp, draftOverRest);
  assert.deepEqual(draftOverRest.draft, drafted.draft);
  // A service with nothing set up still reads the request, and says why it starts nothing.
  assert.deepEqual(
    [
      draftOverRest.complete,
      draftOverRest.startable,
      draftOverRest.checks.find((c) => c.field === "route").state,
    ],
    [true, false, "unavailable"],
  );
  revisionStep(
    "a service with no engine gives the same draft over REST and over MCP",
    { checks: draftOverRest.checks },
  );
  passed = true;
} catch (e) {
  // This receipt may be committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
} finally {
  for (const child of [spoken, served])
    if (child && child.exitCode === null && child.signalCode === null) {
      const gone = once(child, "exit");
      child.kill();
      await gone.catch(() => {});
    }
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
  for (const [out, task, its, more] of [
    [receiptOut, "MPR-101", steps],
    [targetOut, "MPR-102", targetSteps],
    [historyOut, "MPR-107", historySteps, measured],
    [revisionOut, "MPR-103", revisionSteps],
  ])
    if (out)
      writeFileSync(
        out,
        `${JSON.stringify({ task, ...common, ...more, steps: its }, null, 2)}
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
