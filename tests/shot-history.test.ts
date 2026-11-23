// MPR-107: what was tried for one shot and what it cost. The store, the job table and the
// commands are the real ones. The engine is a double whose video is already the project's, as its
// rows and ten bytes, so that no decoder is asked.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import {
  createGenerationService,
  type GenerationRecord,
} from "../core/engines/generation.ts";
import { refusedSubmit } from "../core/engines/failures.ts";
import type {
  EngineAdapterV2,
  EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import type { Asset, Project } from "../core/project.ts";
import type { StoryDocument } from "../core/story.ts";
import {
  SHOT_HISTORY_LIMITS,
  TakeReplacementSchema,
  generationOutcome,
} from "../core/shot-history.ts";
import { validateDocument } from "../core/documents.ts";
import { DocumentRefSchema } from "../core/document-ref.ts";
import { TakeRecordSchema, recordHashOf } from "../core/take-record.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
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
const FRAME = 23_520_000; // flicks per 30 fps frame
const id = () => crypto.randomUUID();
const PROMPT = "a marker no answer holds: zq-71-marker";
const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};
const recipe = {
  id: "t",
  hash: "a".repeat(64),
  operation: "textToVideo" as const,
  modelManifestHash: "b".repeat(64),
};

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-history-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  // A job is claimed and goes no further: no worker starts here.
  const queue = new JobSupervisor(store, {
    fault: () => {
      throw new Error("Not run in this test.");
    },
  });
  handles.push(queue);
  const runs = new Map<string, { hash: string; state: string }>();
  let next = { hash: "", state: "succeeded" };
  let refuse = false;
  const adapter = {
    submit: async (request: EngineRequestV2) => {
      if (refuse) throw refusedSubmit("quotaExhausted", "No quota is left.");
      const executionRef = `run-${request.attemptKey}`;
      runs.set(executionRef, next);
      return { executionRef };
    },
    status: async (executionRef: string) => {
      const { state } = runs.get(executionRef)!;
      return state === "failed"
        ? {
            executionRef,
            state,
            failureClass: "timeout",
            diagnostic: `It failed at C:\\Users\\someone\\x.py ${"y".repeat(400)}`,
          }
        : { executionRef, state };
    },
    requestCancel: async () => ({
      requested: true,
      localProcessExited: false,
    }),
    enumerateArtifacts: async (ref: string) => [
      {
        handle: "o.mp4",
        mediaType: "video/mp4",
        byteLength: 10,
        sha256: runs.get(ref)!.hash,
      },
    ],
  } as unknown as EngineAdapterV2;
  const clock = { now: 1_000 };
  const service = createGenerationService({
    adapter,
    store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger: queue.generationLedger(),
    now: () => clock.now,
  });
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    generation: { service, recipes: [recipe] },
  } as unknown as CommandContext;
  const projectId = (
    (await execute(ctx, "yamakan.project.create", { name: "H" }))
      .result as Project
  ).id;
  return {
    root,
    store,
    queue,
    ctx,
    service,
    clock,
    projectId,
    leaves: (hash: string, state = "succeeded") => {
      next = { hash, state };
    },
    refuseNext: (on: boolean) => {
      refuse = on;
    },
  };
}
type W = Awaited<ReturnType<typeof workspace>>;

async function video(w: W, seed: string): Promise<Asset> {
  const bytes = Buffer.from(seed.padEnd(10).slice(0, 10));
  const asset: Asset = {
    id: id(),
    name: `${seed}.mp4`,
    kind: "video",
    hash: sha256Hex(bytes),
    extension: "mp4",
    bytes: 10,
    durationFrames: 90,
    width: 64,
    height: 36,
    hasAudio: false,
  };
  const folder = path.join(w.root, "projects", w.projectId, "assets");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${asset.hash}.mp4`), bytes);
  await w.store.attachAsset(w.projectId, asset, (db) => {
    db.prepare(
      "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, 10, 'ready', 1)",
    ).run(w.projectId, asset.hash);
    db.prepare(
      "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, '{}')",
    ).run(asset.id, w.projectId, asset.hash);
  });
  return asset;
}

type Shot = StoryDocument["scenes"][number]["shots"][number];
const shot = (over: Partial<Shot> = {}): Shot => ({
  id: id(),
  name: "Shot",
  durationTicks: 60 * FRAME,
  notes: "",
  referencePacks: [],
  takes: [],
  selectedTakeId: null,
  ...over,
});
const call = async (w: W, operation: string, parameters: object) =>
  (await execute(w.ctx, operation, parameters)).result as any;
const head = async (w: W) => (await w.store.load(w.projectId)).revision;
const save = async (w: W, documentId: string, shots: Shot[], over = {}) =>
  call(w, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: await head(w),
    documentId,
    expectedContentHash:
      w.store.listDocuments(w.projectId).find((d) => d.id === documentId)
        ?.contentHash ?? null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "History",
      scenes: [
        {
          id:
            (w as { sceneId?: string }).sceneId ??
            ((w as { sceneId?: string }).sceneId = id()),
          name: "One",
          shots,
        },
      ],
    },
    ...over,
  });
const stored = (w: W, documentId: string) =>
  JSON.parse(
    w.store.getDocument(w.projectId, documentId).bytes.toString("utf8"),
  ) as StoryDocument;
const start = async (w: W, target: object | null, over: object = {}) =>
  (
    await call(w, "yamakan.generation.start", {
      projectId: w.projectId,
      recipeId: recipe.id,
      prompt: PROMPT,
      seed: 7,
      width: 64,
      height: 36,
      durationFrames: 90,
      ...(target ? { target } : {}),
      ...over,
    })
  ).generationId as string;
const history = (w: W, documentId: string, shotId: string, over: object = {}) =>
  call(w, "yamakan.shot.history", {
    projectId: w.projectId,
    documentId,
    shotId,
    ...over,
  });
const follow = async (w: W, generationId: string, at: number) => {
  w.clock.now = at;
  await call(w, "yamakan.generation.status", { generationId });
};
// The last run's id, also of one refused as it was sent, which no answer gives.
const lastRun = (w: W) =>
  (
    w.store.read((db) =>
      db
        .prepare(
          "SELECT job_id AS id FROM jobs WHERE kind = 'remote-generation' ORDER BY rowid DESC LIMIT 1",
        )
        .get(),
    ) as { id: string }
  ).id;

test("a shot's takes, attempts and totals", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  const other = shot({ name: "Other" });
  await save(w, documentId, [mine, other]);
  const target = { documentId, shotId: mine.id };
  const made: string[] = [];
  for (const seed of ["one", "two"]) {
    const asset = await video(w, seed);
    w.leaves(asset.hash);
    w.clock.now = 1_000;
    const run = await start(w, target);
    await follow(w, run, 61_000);
    await call(w, "yamakan.generation.import", { generationId: run });
    made.push(run);
  }
  w.leaves("", "failed");
  w.clock.now = 2_000;
  const failed = await start(w, target);
  await follow(w, failed, 5_000);
  w.leaves("", "running");
  const stopped = await start(w, target);
  await follow(w, stopped, 6_000);
  w.clock.now = 7_000;
  await call(w, "yamakan.generation.cancel", { generationId: stopped });
  // Another shot's, and none's.
  w.leaves("", "running");
  const elsewhere = await start(w, { documentId, shotId: other.id });
  await follow(w, elsewhere, 8_000);
  const answer = await history(w, documentId, mine.id);
  assert.deepEqual(
    answer.attempts.map((a: any) => [
      a.id,
      a.kind,
      a.outcome,
      a.sent,
      a.imported,
      a.takeInShot,
    ]),
    [
      [stopped, "generation", "cancelled", true, false, false],
      [failed, "generation", "failed", true, false, false],
      [made[1], "generation", "succeeded", true, true, true],
      [made[0], "generation", "succeeded", true, true, true],
    ],
  );
  assert.deepEqual(answer.totals, {
    attempts: 4,
    succeeded: 2,
    failed: 1,
    cancelled: 1,
    running: 0,
    uncertain: 0,
    takes: 2,
    replacements: 0,
    // Two runs of a minute, one of three seconds and one of two.
    wallMs: 125_000,
    wallMsUnknown: 0,
    quotaSeconds: 0,
    quotaUnknown: 4,
    complete: true,
  });
});

test("failed, cancelled, dismissed and never-sent attempts are listed", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  w.leaves("", "failed");
  const failed = await start(w, target);
  await follow(w, failed, 5_000);
  await call(w, "yamakan.generation.dismiss", { generationId: failed });
  w.refuseNext(true);
  assert.match(
    await reason(start(w, target)),
    /^CAPABILITY_UNAVAILABLE: No quota is left\.$/,
  );
  w.refuseNext(false);
  const refused = lastRun(w);
  assert.deepEqual(
    (await call(w, "yamakan.generation.list", { projectId: w.projectId }))
      .length,
    0,
    "no list shows either",
  );
  const { attempts } = await history(w, documentId, mine.id);
  assert.deepEqual(
    attempts.map((a: any) => [a.id, a.outcome, a.sent]),
    [
      [refused, "failed", false],
      [failed, "failed", true],
    ],
  );
  // Cut, and with no path of this computer.
  const [, one] = attempts;
  assert.equal(one.diagnostic.length, SHOT_HISTORY_LIMITS.diagnosticChars);
  assert.ok(!/Users/.test(one.diagnostic), one.diagnostic);
});

test("what an attempt is worth follows from its row", () => {
  const row = (over: object) =>
    generationOutcome({
      state: "running",
      phase: "sent",
      cancelled: false,
      imported: null,
      executionRef: "r",
      ...over,
    } as never);
  const imported = { assetId: "a", lineage: {} };
  for (const [over, outcome] of [
    [{}, "running"],
    [{ state: "queued" }, "running"],
    [{ state: "succeeded" }, "succeeded"],
    [{ state: "failed" }, "failed"],
    [{ state: "failed", phase: "sending", executionRef: null }, "failed"],
    [{ state: "cancelled" }, "cancelled"],
    [{ cancelled: true }, "cancelled"],
    [{ cancelled: true, imported }, "succeeded"],
    [{ state: "unknown" }, "uncertain"],
    [{ phase: "sending" }, "uncertain"],
    [{ executionRef: null }, "uncertain"],
    [{ held: true }, "uncertain"],
    [{ state: "something else" }, "running"],
  ] as const)
    assert.equal(row(over), outcome, JSON.stringify(over));
});

// Rows as the job table keeps them, without running any.
const seed = (
  w: W,
  count: number,
  of: (i: number) => Partial<GenerationRecord>,
) => {
  const ledger = w.queue.generationLedger();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const generationId = id();
    ids.push(generationId);
    ledger.begin({
      generationId,
      projectId: w.projectId,
      recipe,
      prompt: PROMPT,
      seed: 1,
      width: 64,
      height: 36,
      durationFrames: 24,
      firstFrameAssetId: null,
      inputs: [],
      executionRef: "r",
      phase: "sent",
      startedAt: 1_000,
      state: "running",
      diagnostic: null,
      videoSha256: null,
      imported: null,
      cancelled: false,
      dismissed: false,
      ...of(i),
    } as GenerationRecord);
    // An ended one is not an active job of the workspace.
    ledger.update(generationId, {
      state: "failed",
      endedAt: 3_000,
      ...of(i),
    } as never);
  }
  return ids;
};

test("pages are stable while new attempts arrive", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  const ids = seed(w, 250, () => ({ target })).reverse();
  const first = await history(w, documentId, mine.id, { limit: 100 });
  // Two more come in between.
  seed(w, 2, () => ({ target }));
  const second = await history(w, documentId, mine.id, {
    limit: 100,
    before: first.next,
  });
  const third = await history(w, documentId, mine.id, {
    limit: 100,
    before: second.next,
  });
  assert.deepEqual(
    [first, second, third].map((p) => p.attempts.length),
    [100, 100, 50],
  );
  assert.deepEqual(
    [first, second, third].flatMap((p) => p.attempts.map((a: any) => a.id)),
    ids,
  );
  assert.equal(third.next, null);
  assert.equal(first.totals.attempts, 250);
  assert.deepEqual(second.totals, third.totals);
  assert.equal(second.totals.attempts, 252);
  assert.equal(second.totals.wallMs, 252 * 2_000);
  assert.equal(
    (await history(w, documentId, mine.id)).attempts.length,
    SHOT_HISTORY_LIMITS.defaultAttempts,
  );
  // Past the last there is nothing.
  const past = await history(w, documentId, mine.id, { before: 0 });
  assert.deepEqual([past.attempts, past.next], [[], null]);
});

test("an answer over the byte limit is cut and paged", async () => {
  const w = await workspace();
  const documentId = id();
  const long = "م".repeat(60);
  const mine = shot({ name: long.slice(0, 120) });
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  seed(w, 100, () => ({
    target,
    diagnostic: "\u0001".repeat(600),
    recipe: { ...recipe, id: "\u0001".repeat(80) },
  }));
  const seen: string[] = [];
  let before: number | undefined;
  let pages = 0;
  do {
    const page = await history(w, documentId, mine.id, {
      limit: 100,
      ...(before === undefined ? {} : { before }),
    });
    assert.ok(
      Buffer.byteLength(canonicalJson(page)) <= SHOT_HISTORY_LIMITS.answerBytes,
    );
    seen.push(...page.attempts.map((a: any) => a.id));
    assert.equal(page.totals.attempts, 100);
    before = page.next ?? undefined;
    pages++;
  } while (before !== undefined);
  assert.equal(new Set(seen).size, 100);
  assert.ok(pages >= 2, `${pages}`);
});

test("a row that says anything is held to its form and its length", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  const taken = id();
  const from = id();
  const rows = [
    { take: { appended: true, takeId: taken }, derivedFromTakeId: from },
    { take: { appended: true, takeId: "z".repeat(300_000) } },
    { derivedFromTakeId: "C:\\Users\\someone\\words of the prompt" },
    { take: { appended: true, takeId: 7 }, derivedFromTakeId: {} },
    { recipe: { ...recipe, id: "r".repeat(300_000) } },
    // Cut at 200 in the middle of a pair.
    { diagnostic: `${"x".repeat(199)}\u{1F600}` },
    { recipe: { ...recipe, id: `${"x".repeat(79)}\u{1F600}` } },
  ];
  seed(w, rows.length, (i) => ({ target, ...(rows[i] as object) }));
  const page = await history(w, documentId, mine.id);
  const of = (key: string) =>
    page.attempts.map((a: any) => a[key]).reverse() as unknown[];
  assert.deepEqual(of("takeId"), [taken, ...Array(6).fill(null)]);
  assert.deepEqual(of("derivedFromTakeId"), [from, ...Array(6).fill(null)]);
  assert.equal((of("recipeId")[4] as string).length, 80);
  assert.equal(of("diagnostic")[5], "x".repeat(199));
  assert.equal(of("recipeId")[6], "x".repeat(79));
  assert.ok(Buffer.byteLength(JSON.stringify(page)) < 8_192);
});

test("a take removed from the shot is still named by its attempt, and one without a record has nulls", async () => {
  const w = await workspace();
  const documentId = id();
  const by = await video(w, "by hand");
  const hand = {
    id: id(),
    assetId: by.id,
    sourceStartTicks: 0,
    lineage: {
      label: "seed 3",
      outputHash: by.hash,
      inputs: [],
    },
  };
  const mine = shot({ takes: [hand], selectedTakeId: hand.id });
  await save(w, documentId, [mine]);
  const asset = await video(w, "made");
  w.leaves(asset.hash);
  const run = await start(w, { documentId, shotId: mine.id });
  await follow(w, run, 4_000);
  const { take } = await call(w, "yamakan.generation.import", {
    generationId: run,
  });
  const before = await history(w, documentId, mine.id);
  assert.deepEqual(before.takes[0], {
    takeId: hand.id,
    kind: "video",
    label: "seed 3",
    selected: true,
    shown: false,
    recordHash: null,
    addedAtRevision: null,
    origin: null,
    route: null,
    source: null,
    summary: null,
    timings: null,
    usage: null,
    derivedFromTakeId: null,
    changedFields: null,
  });
  assert.deepEqual(before.takes[1], {
    takeId: take.takeId,
    kind: "video",
    label: null,
    selected: false,
    shown: false,
    recordHash: take.recordHash,
    addedAtRevision: take.revision,
    origin: "generation",
    route: "comfyui",
    source: { generationId: run },
    summary: {
      recipeId: "t",
      modelId: "t",
      operation: "textToVideo",
      seed: 7,
      width: 64,
      height: 36,
      durationFrames: 90,
      fps: null,
      steps: null,
      promptHash: sha256Hex(PROMPT),
    },
    timings: { startedAt: 1_000, endedAt: 4_000, importedAt: 4_000 },
    usage: { wallMs: 3_000, quotaSeconds: null },
    derivedFromTakeId: null,
    changedFields: [],
  });
  assert.deepEqual(before.current, {
    selectedTakeId: hand.id,
    shownTakeId: null,
    clips: [],
  });
  assert.equal(before.revision, await head(w));
  assert.equal(
    before.contentHash,
    w.store.getDocument(w.projectId, documentId).ref.contentHash,
  );
  // No prompt's words, and no path of this computer.
  const text = JSON.stringify(before);
  assert.ok(!text.includes("zq-71-marker") && !text.includes(w.root), text);
  await save(w, documentId, [mine]);
  const after = await history(w, documentId, mine.id);
  assert.equal(after.takes.length, 1);
  assert.deepEqual(
    after.attempts.map((a: any) => [a.takeId, a.takeInShot]),
    [[take.takeId, false]],
  );
});

// A shot in the cut, with two takes of it.
async function cut(
  w: W,
  pins: (b: Asset) => Promise<Shot["referencePacks"]> = async () => [],
) {
  const documentId = id();
  const [a, b] = [await video(w, "take a"), await video(w, "take b")];
  const takes = [a, b].map((x) => ({
    id: id(),
    assetId: x.id,
    sourceStartTicks: 0,
  }));
  const mine = shot({
    takes,
    selectedTakeId: takes[0]!.id,
    referencePacks: await pins(b),
  });
  await save(w, documentId, [mine]);
  await call(w, "yamakan.story.assemble", {
    projectId: w.projectId,
    expectedRevision: await head(w),
    documentId,
    trackId: (await w.store.load(w.projectId)).tracks.find(
      (t) => t.kind === "video",
    )!.id,
  });
  // The replacement asks for a probed video.
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  db.prepare("UPDATE asset_versions SET probe = ?").run(
    JSON.stringify({ kind: "video", durationFrames: 90 }),
  );
  db.close();
  const propose = (takeId: string) =>
    call(w, "yamakan.take.proposeReplace", {
      projectId: w.projectId,
      documentId,
      shotId: mine.id,
      takeId,
    });
  return { documentId, mine, takes, propose };
}
const notes = (w: W) =>
  (
    w.store.read((db) =>
      db
        .prepare(
          "SELECT count(*) AS n FROM creative_documents WHERE kind = 'takeReplacement'",
        )
        .get(),
    ) as { n: number }
  ).n;

test("an apply writes one note and a replay writes none, and undo keeps the note", async () => {
  const w = await workspace();
  const { documentId, mine, takes, propose } = await cut(w);
  const proposal = await propose(takes[1]!.id);
  const request = {
    projectId: w.projectId,
    expectedRevision: await head(w),
    proposal,
  };
  const ctx = { ...w.ctx, requestId: "apply.1" };
  const first = (await execute(ctx, "yamakan.take.apply", request))
    .result as Project;
  assert.equal(notes(w), 1);
  const again = (await execute(ctx, "yamakan.take.apply", request))
    .result as Project;
  assert.equal(again.revision, first.revision);
  assert.equal(notes(w), 1);
  const one = await history(w, documentId, mine.id);
  assert.deepEqual(one.replacements, [
    {
      revision: first.revision,
      principalId: "browser-ui",
      fromTakeId: takes[0]!.id,
      toTakeId: takes[1]!.id,
      clips: 1,
    },
  ]);
  assert.equal(one.replacementTotal, 1);
  assert.equal(one.totals.replacements, 1);
  assert.equal(one.current.shownTakeId, takes[1]!.id);
  assert.equal(one.current.clips.length, 1);
  assert.ok(one.takes[1].shown && !one.takes[0].shown);
  // The assembly was an earlier batch, which says no replacement.
  assert.deepEqual(one.gaps, ["earlier-replacements"]);
  await call(w, "yamakan.project.undo", {
    projectId: w.projectId,
    expectedRevision: await head(w),
  });
  const undone = await history(w, documentId, mine.id);
  assert.deepEqual(undone.replacements, one.replacements);
  assert.equal(undone.current.shownTakeId, takes[0]!.id);
  // A second replacement comes first.
  const back = await call(w, "yamakan.take.apply", {
    projectId: w.projectId,
    expectedRevision: await head(w),
    proposal: await propose(takes[1]!.id),
  });
  assert.deepEqual(
    (await history(w, documentId, mine.id)).replacements.map(
      (r: any) => r.revision,
    ),
    [back.revision, first.revision],
  );
  assert.equal(notes(w), 2);
});

test("a refused apply writes no note, and no one else may write one", async () => {
  const w = await workspace();
  const { documentId, mine, takes, propose } = await cut(w);
  const proposal = await propose(takes[1]!.id);
  const before = await head(w);
  // Stale: the story has changed since.
  await save(w, documentId, [{ ...mine, name: "Renamed" }]);
  assert.match(
    await reason(
      call(w, "yamakan.take.apply", {
        projectId: w.projectId,
        expectedRevision: before,
        proposal,
      }),
    ),
    /^REVISION_CONFLICT/,
  );
  assert.equal(notes(w), 0);
  const note = {
    format: "yamakan.take-replacement",
    formatVersion: 1,
    documentId,
    shotId: mine.id,
    fromTakeId: null,
    toTakeId: takes[0]!.id,
    clips: 1,
    revision: 1,
    principalId: "browser-ui",
  };
  const bytes = Buffer.from(canonicalJson(note), "utf8");
  assert.equal(
    await reason(
      call(w, "yamakan.document.commit", {
        projectId: w.projectId,
        expectedRevision: await head(w),
        documentId: id(),
        kind: "takeReplacement",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: sha256Hex(bytes) },
      }),
    ),
    "VALIDATION: A take replacement is noted as it is applied.",
  );
  assert.match(
    await reason(
      w.store.commitDocument({
        projectId: w.projectId,
        expectedRevision: await head(w),
        documentId: id(),
        kind: "takeReplacement",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { bytes },
        verify: () => {},
      }),
    ),
    /^VALIDATION: A take replacement is noted as it is applied\.$/,
  );
  assert.ok(
    !DocumentRefSchema.safeParse({
      id: id(),
      kind: "takeReplacement",
      schemaVersion: 1,
      contentHash: sha256Hex(bytes),
    }).success,
    "nor is it ever a project document",
  );
  // The largest there can be is inside its bound.
  assert.equal(SHOT_HISTORY_LIMITS.noteBytes, 512);
  const largest = {
    ...note,
    fromTakeId: id(),
    clips: 64,
    revision: 10_000,
    principalId: "م".repeat(64),
  };
  validateDocument(
    "takeReplacement",
    1,
    Buffer.from(canonicalJson(largest), "utf8"),
  );
  for (const over of [
    { principalId: "p".repeat(65) },
    { clips: 65 },
    { clips: 0 },
    { extra: 1 },
    { toTakeId: "x" },
    { principalId: "" },
  ])
    assert.ok(
      !TakeReplacementSchema.safeParse({ ...note, ...over }).success,
      JSON.stringify(over),
    );
});

test("a proposal found stale inside the commit, or whose commit fails, writes no note", async () => {
  const w = await workspace();
  const { takes, propose } = await cut(w);
  const proposal = await propose(takes[1]!.id);
  const before = await head(w);
  const apply = (over: object = {}) =>
    reason(
      call(w, "yamakan.take.apply", {
        projectId: w.projectId,
        expectedRevision: before,
        proposal: { ...proposal, ...over },
      }),
    );
  // At the head's own revision, so that the commit is what refuses.
  assert.equal(
    await apply({ storyContentHash: "0".repeat(64) }),
    "REVISION_CONFLICT: The story changed since the proposal; propose it again.",
  );
  assert.equal(
    await apply({ proposalHash: "0".repeat(64) }),
    "REVISION_CONFLICT: The proposal no longer matches the project; propose it again.",
  );
  const other = () => new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  // A fault after the note and before the revision.
  let db = other();
  db.exec(
    "CREATE TRIGGER stop BEFORE INSERT ON revisions BEGIN SELECT RAISE(ABORT, 'stopped'); END",
  );
  db.close();
  assert.notEqual(await apply(), "ok");
  db = other();
  db.exec("DROP TRIGGER stop");
  // The document space is full.
  db.exec("PRAGMA ignore_check_constraints = 1");
  const [big] = db
    .prepare("SELECT hash, byte_length AS n FROM creative_documents LIMIT 1")
    .all() as { hash: string; n: number }[];
  const size = (n: number) =>
    db
      .prepare("UPDATE creative_documents SET byte_length = ? WHERE hash = ?")
      .run(n, big!.hash);
  size(4 * 1024 ** 3);
  db.close();
  assert.match(
    await apply(),
    /^LIMIT_EXCEEDED: The workspace's creative document space is full/,
  );
  db = other();
  db.exec("PRAGMA ignore_check_constraints = 1");
  size(big!.n);
  db.close();
  assert.equal(notes(w), 0);
  assert.equal(await head(w), before);
  assert.equal(await apply(), "ok");
  assert.equal(notes(w), 1);
});

test("an apply refused by a consent that is no longer usable writes no note", async () => {
  const w = await workspace();
  const consent = await call(w, "yamakan.consent.grant", {
    characterId: "lead",
    purpose: "likeness-generate",
    version: "v1",
    ttlMs: 24 * 60 * 60 * 1000,
  });
  const { takes, propose } = await cut(w, async (b) => {
    const packId = id();
    const { document } = await call(w, "yamakan.pack.save", {
      projectId: w.projectId,
      expectedRevision: await head(w),
      documentId: packId,
      expectedContentHash: null,
      pack: {
        format: "yamakan.reference-pack",
        formatVersion: 1,
        name: "Lead",
        entries: [
          {
            id: id(),
            role: "character",
            label: "Lead",
            assetId: b.id,
            assetHash: b.hash,
            characterId: "lead",
            consentId: consent.id,
          },
        ],
      },
    });
    return [{ documentId: packId, contentHash: document.contentHash }];
  });
  const proposal = await propose(takes[1]!.id);
  await call(w, "yamakan.consent.revoke", { consentId: consent.id });
  const before = await head(w);
  assert.match(
    await reason(
      call(w, "yamakan.take.apply", {
        projectId: w.projectId,
        expectedRevision: before,
        proposal,
      }),
    ),
    /^VALIDATION: .*consent/,
  );
  assert.equal(notes(w), 0);
  assert.equal(await head(w), before);
});

// The head's story as an older build left it: its bytes, hash and version 1, named by a head
// snapshot of its own.
function asAnOlderBuildStored(
  w: W,
  documentId: string,
  one: object = { ...stored(w, documentId), formatVersion: 1 },
  version = 1,
) {
  const bytes = Buffer.from(canonicalJson(one), "utf8");
  const hash = sha256Hex(bytes);
  const ref = w.store
    .listDocuments(w.projectId)
    .find((d) => d.id === documentId)!;
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const head = db
    .prepare(
      "SELECT p.snapshot_hash AS hash, s.format AS format, s.bytes AS bytes FROM projects p JOIN snapshots s ON s.hash = p.snapshot_hash WHERE p.project_id = ?",
    )
    .get(w.projectId) as { hash: string; format: string; bytes: Uint8Array };
  const snapshot = Buffer.from(
    Buffer.from(head.bytes)
      .toString("utf8")
      .replace(ref.contentHash, hash)
      .replace('"schemaVersion":2', `"schemaVersion":${version}`),
    "utf8",
  );
  const next = sha256Hex(snapshot);
  db.prepare(
    "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) SELECT ?, kind, ?, asset_ids, object_digests, ?, ? FROM creative_documents WHERE hash = ?",
  ).run(hash, version, bytes, bytes.length, ref.contentHash);
  db.prepare(
    "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) SELECT project_id, document_id, ?, revision FROM story_document_versions WHERE content_hash = ?",
  ).run(hash, ref.contentHash);
  db.prepare(
    "INSERT INTO snapshots(hash, format, bytes, byte_length) VALUES (?, ?, ?, ?)",
  ).run(next, head.format, snapshot, snapshot.length);
  db.prepare("INSERT INTO snapshot_document_refs VALUES (?, ?)").run(
    next,
    hash,
  );
  db.prepare("UPDATE projects SET snapshot_hash = ? WHERE project_id = ?").run(
    next,
    w.projectId,
  );
  db.prepare(
    "UPDATE revisions SET snapshot_hash = ? WHERE project_id = ? AND snapshot_hash = ?",
  ).run(next, w.projectId, head.hash);
  db.close();
}

test("a version 1 story and rows without a target give the stated gaps", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  assert.deepEqual((await history(w, documentId, mine.id)).gaps, []);
  seed(w, 1, () => ({}));
  assert.deepEqual((await history(w, documentId, mine.id)).gaps, [
    "untargeted-attempts",
  ]);
  w.store.transaction((db) => {
    const add = (kind: string, payload: string) =>
      db
        .prepare(
          "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state, error, artifact) VALUES (?, ?, ?, 0, ?, ?, 'failed', 'Not enough memory.', NULL)",
        )
        .run(id(), kind, w.projectId, id(), payload);
    add("blender-render", JSON.stringify({ format: "blender/1" }));
    // Rows that do not read, or are another project's, break nothing.
    add("remote-generation", "{not json");
    add("remote-generation", "[]");
    add("remote-generation", "null");
    add(
      "remote-generation",
      JSON.stringify({
        projectId: id(),
        target: { documentId, shotId: mine.id },
      }),
    );
    add(
      "blender-render",
      JSON.stringify({ shot: { documentId, shotId: mine.id } }),
    );
  });
  const answer = await history(w, documentId, mine.id);
  assert.deepEqual(answer.gaps, ["untargeted-attempts", "unlinked-renders"]);
  assert.deepEqual(
    answer.attempts.map((a: any) => [
      a.kind,
      a.route,
      a.outcome,
      a.sent,
      a.startedAt,
      a.wallMs,
      a.diagnostic,
    ]),
    [["render", "blender", "failed", true, null, null, "Not enough memory."]],
  );
  assert.equal(answer.totals.wallMsUnknown, 1);
  // A version 1 story is read as it is.
  asAnOlderBuildStored(w, documentId);
  assert.equal(stored(w, documentId).formatVersion as number, 1);
  assert.deepEqual(
    { ...(await history(w, documentId, mine.id)), contentHash: "" },
    { ...answer, contentHash: "" },
  );
});

test("the scan limit sets complete to false", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  w.store.transaction((db) => {
    const add = db.prepare(
      "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'remote-generation', ?, 0, ?, ?, 'failed')",
    );
    const payload = JSON.stringify({
      projectId: w.projectId,
      target,
      state: "failed",
      phase: "sent",
    });
    for (let i = 0; i < SHOT_HISTORY_LIMITS.jobRowsScanned; i++)
      add.run(id(), w.projectId, id(), payload);
  });
  const all = await history(w, documentId, mine.id);
  assert.equal(all.totals.attempts, SHOT_HISTORY_LIMITS.jobRowsScanned);
  assert.equal(all.totals.complete, true);
  seed(w, 1, () => ({ target }));
  const over = await history(w, documentId, mine.id);
  assert.equal(over.totals.attempts, SHOT_HISTORY_LIMITS.jobRowsScanned);
  assert.equal(over.totals.complete, false);
  assert.deepEqual(over.gaps, ["scan-limit"]);
});

test("another story's shot, another project's story and bad input are refused, and it writes nothing", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const second = id();
  const theirs = shot();
  (w as { sceneId?: string }).sceneId = undefined;
  await save(w, second, [theirs]);
  assert.equal(
    await reason(history(w, documentId, theirs.id)),
    "NOT_FOUND: The story has no such shot.",
  );
  assert.match(await reason(history(w, id(), mine.id)), /^NOT_FOUND/);
  // A document that is no story.
  const packed = await video(w, "pack");
  const packId = id();
  await call(w, "yamakan.pack.save", {
    projectId: w.projectId,
    expectedRevision: await head(w),
    documentId: packId,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Props",
      entries: [
        {
          id: id(),
          role: "prop",
          label: "Prop",
          assetId: packed.id,
          assetHash: packed.hash,
          characterId: null,
          consentId: null,
        },
      ],
    },
  });
  assert.equal(
    await reason(history(w, packId, mine.id)),
    "VALIDATION: This document is not a story.",
  );
  const elsewhere = (
    (await execute(w.ctx, "yamakan.project.create", { name: "E" }))
      .result as Project
  ).id;
  assert.match(
    await reason(history({ ...w, projectId: elsewhere }, documentId, mine.id)),
    /^NOT_FOUND/,
  );
  for (const over of [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { before: -1 },
    { before: 0.5 },
    { before: "1" },
    { path: "C:/x" },
  ])
    assert.match(
      await reason(history(w, documentId, mine.id, over)),
      /^VALIDATION/,
      JSON.stringify(over),
    );
  const agent = (...scopes: string[]) => ({
    ...w,
    ctx: {
      ...w.ctx,
      principal: { id: "agent:x", scopes: new Set(scopes) },
      generation: undefined,
    } as unknown as CommandContext,
  });
  assert.match(
    await reason(history(agent("project:write"), documentId, mine.id)),
    /^SCOPE_DENIED/,
  );
  const was = await head(w);
  // With the read scope alone, and no engine.
  assert.equal(
    (await history(agent("project:read"), documentId, mine.id)).shotId,
    mine.id,
  );
  assert.equal(await head(w), was);
});

// A document held for a story, as the service writes one beside a commit.
function holds(
  w: W,
  documentId: string,
  kind: string,
  content: object,
  revision: number,
) {
  const bytes = Buffer.from(canonicalJson(content), "utf8");
  const hash = sha256Hex(bytes);
  w.store.transaction((db) => {
    db.prepare(
      "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) VALUES (?, ?, 1, '[]', '[]', ?, ?) ON CONFLICT DO NOTHING",
    ).run(hash, kind, bytes, bytes.length);
    db.prepare(
      "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    ).run(w.projectId, documentId, hash, revision);
  });
  return hash;
}

test("only this shot's notes are read, the newest thirty-two of them shown, and at most two thousand scanned", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const revision = await head(w);
  const note = (over: object) => ({
    format: "yamakan.take-replacement",
    formatVersion: 1,
    documentId,
    shotId: mine.id,
    fromTakeId: null,
    toTakeId: id(),
    clips: 1,
    revision,
    principalId: "browser-ui",
    ...over,
  });
  holds(w, documentId, "takeReplacement", note({ shotId: id() }), revision);
  holds(w, documentId, "takeReplacement", note({ documentId: id() }), revision);
  holds(w, documentId, "takeReplacement", { not: "a note" }, revision);
  for (let i = 1; i <= 40; i++)
    holds(
      w,
      documentId,
      "takeReplacement",
      note({ revision: revision + i }),
      revision + i,
    );
  // Another story's note about a shot of the same id is that story's.
  holds(w, id(), "takeReplacement", note({}), revision + 50);
  const answer = await history(w, documentId, mine.id);
  assert.equal(answer.replacementTotal, 40);
  assert.equal(answer.totals.replacements, 40);
  assert.deepEqual(
    answer.replacements.map((r: any) => r.revision),
    Array.from(
      { length: SHOT_HISTORY_LIMITS.replacements },
      (_, i) => revision + 40 - i,
    ),
  );
  // A batch after the first note hides no replacement.
  await call(w, "yamakan.project.applyBatch", {
    projectId: w.projectId,
    expectedRevision: await head(w),
    operations: [{ type: "scene.add", sceneId: id(), name: "Later" }],
  });
  assert.deepEqual((await history(w, documentId, mine.id)).gaps, []);
  for (let i = 0; i < SHOT_HISTORY_LIMITS.notesScanned; i++)
    holds(w, documentId, "takeReplacement", note({}), revision + 1);
  const many = await history(w, documentId, mine.id);
  assert.equal(many.totals.complete, false);
  assert.ok(many.gaps.includes("scan-limit"));
  assert.equal(many.replacements.length, SHOT_HISTORY_LIMITS.replacements);
});

test("a restored copy's run, one that may have left, and another story's run are told apart", async () => {
  const w = await workspace();
  const documentId = id();
  const mine = shot();
  await save(w, documentId, [mine]);
  const target = { documentId, shotId: mine.id };
  const add = (payload: object, state = "running") =>
    w.store.transaction((db) =>
      db
        .prepare(
          "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'remote-generation', ?, 0, ?, ?, ?)",
        )
        .run(
          id(),
          w.projectId,
          id(),
          JSON.stringify({
            projectId: w.projectId,
            target,
            executionRef: "r",
            phase: "sent",
            state: "running",
            ...payload,
          }),
          state,
        ),
    );
  add({}, "reconciliationRequired");
  add({});
  add({ phase: "sending", state: "queued", executionRef: null }, "preparing");
  // The same shot's id in another story, and half a name.
  add({ target: { documentId: id(), shotId: mine.id } });
  add({ target: { shotId: mine.id } });
  const { attempts, totals } = await history(w, documentId, mine.id);
  assert.deepEqual(
    attempts.map((a: any) => [a.outcome, a.sent]),
    [
      // Not known to have left, and not known to have stayed.
      ["uncertain", true],
      ["running", true],
      ["uncertain", true],
    ],
  );
  assert.deepEqual([totals.running, totals.uncertain], [1, 2]);
});

test("a render that made a take of the shot is named with it", async () => {
  const w = await workspace();
  const documentId = id();
  const asset = await video(w, "render");
  const jobId = id();
  const take = { id: id(), assetId: asset.id, sourceStartTicks: 0 };
  const mine = shot({ takes: [take] });
  await save(w, documentId, [mine]);
  const record = TakeRecordSchema.parse({
    format: "yamakan.take-record",
    formatVersion: 1,
    origin: "render",
    route: "blender",
    source: { jobId },
    recipe: null,
    model: null,
    operation: "render",
    request: {
      kind: "render",
      blenderVersion: "5.3.0",
      sceneFormat: "yamakan.blender-scene",
      sceneHash: "a".repeat(64),
      width: 160,
      height: 90,
      fps: 24,
      frames: 48,
      samples: 8,
      camera: { focalLengthMm: 35, sensorWidthMm: 36 },
      moves: { orbitDegrees: 0 },
    },
    inputs: [],
    output: { sha256: asset.hash },
    reported: null,
    timings: { startedAt: null, endedAt: null, importedAt: null },
    usage: { wallMs: null, quotaSeconds: 12.5 },
    derivedFromTakeId: null,
    derivedFromRecordHash: null,
    revisionNote: null,
    changedFields: [],
  });
  const recordHash = recordHashOf(record);
  assert.equal(
    holds(w, documentId, "takeRecord", record, await head(w)),
    recordHash,
  );
  const body = stored(w, documentId);
  body.scenes[0]!.shots[0]!.takes[0]!.recordHash = recordHash;
  asAnOlderBuildStored(w, documentId, body, 2);
  w.store.transaction((db) =>
    db
      .prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state, artifact) VALUES (?, 'blender-render', ?, 0, ?, ?, 'succeeded', ?)",
      )
      .run(
        jobId,
        w.projectId,
        id(),
        JSON.stringify({ shot: { documentId, shotId: mine.id } }),
        `asset:${asset.id}`,
      ),
  );
  const answer = await history(w, documentId, mine.id);
  assert.deepEqual(answer.attempts, [
    {
      seq: answer.attempts[0].seq,
      kind: "render",
      id: jobId,
      route: "blender",
      outcome: "succeeded",
      sent: true,
      imported: true,
      recipeId: null,
      startedAt: null,
      endedAt: null,
      wallMs: null,
      quotaSeconds: 12.5,
      takeId: take.id,
      takeInShot: true,
      derivedFromTakeId: null,
      diagnostic: null,
    },
  ]);
  assert.deepEqual(
    [answer.totals.quotaSeconds, answer.totals.quotaUnknown],
    [12.5, 0],
  );
  assert.deepEqual(answer.takes[0].summary, {
    recipeId: null,
    modelId: null,
    operation: "render",
    seed: null,
    width: 160,
    height: 90,
    durationFrames: 48,
    fps: 24,
    steps: null,
    promptHash: null,
  });
  assert.deepEqual(answer.takes[0].source, { jobId });
});
