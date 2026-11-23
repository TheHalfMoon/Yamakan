// MPR-102: a generation made for a story shot. Its video becomes a take of that shot as it is
// brought in, in a new version of the story as it then is, and the timeline stays the person's.
// The store, the job table and the commands are the real ones. The engine is a double whose one
// video is already the project's, as its rows and ten bytes, so that no decoder is asked.
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
import { CommandError, toCommandError } from "../core/command/errors.ts";
import {
  createGenerationService,
  type GenerationRecord,
  type TakeOutcome,
} from "../core/engines/generation.ts";
import type {
  EngineAdapterV2,
  EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import { sha256Hex } from "../core/hash/canonical.ts";
import type { Asset, Project } from "../core/project.ts";
import { STORY_LIMITS, type StoryDocument } from "../core/story.ts";
import type { TakeRecord } from "../core/take-record.ts";

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

async function workspace(root?: string) {
  if (!root) {
    root = await mkdtemp(path.join(tmpdir(), "yamakan-target-"));
    bases.push(root);
  }
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const sent: EngineRequestV2[] = [];
  // Which video each run leaves, by the order they are started in.
  const videos = new Map<string, string>();
  let next = "";
  const adapter = {
    submit: async (request: EngineRequestV2) => {
      sent.push(request);
      const executionRef = `run-${request.attemptKey}`;
      videos.set(executionRef, next);
      return { executionRef };
    },
    status: async (executionRef: string) => ({
      executionRef,
      state: "succeeded",
    }),
    enumerateArtifacts: async (ref: string) => [
      {
        handle: "o.mp4",
        mediaType: "video/mp4",
        byteLength: 10,
        sha256: videos.get(ref),
      },
    ],
  } as unknown as EngineAdapterV2;
  const service = createGenerationService({
    adapter,
    store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger: queue.generationLedger(),
  });
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    generation: { service, recipes: [recipe] },
  } as unknown as CommandContext;
  const w = {
    root,
    store,
    queue,
    ctx,
    service,
    sent,
    projectId: "",
    leaves: (hash: string) => {
      next = hash;
    },
    remember: (from: Map<string, string>) =>
      from.forEach((v, k) => videos.set(k, v)),
    videos,
  };
  return w;
}
type W = Awaited<ReturnType<typeof workspace>>;
const withProject = async () => {
  const w = await workspace();
  w.projectId = (
    (await execute(w.ctx, "yamakan.project.create", { name: "T" }))
      .result as Project
  ).id;
  return w;
};

async function video(w: W, seed: string, frames = 90): Promise<Asset> {
  const bytes = Buffer.from(seed.padEnd(10).slice(0, 10));
  const asset: Asset = {
    id: id(),
    name: `${seed}.mp4`,
    kind: "video",
    hash: sha256Hex(bytes),
    extension: "mp4",
    bytes: 10,
    durationFrames: frames,
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
const story = (shots: Shot[]): StoryDocument => ({
  format: "yamakan.story",
  formatVersion: 2,
  title: "Targets",
  scenes: [{ id: id(), name: "One", shots }],
});
const call = async (w: W, operation: string, parameters: object) =>
  (await execute(w.ctx, operation, parameters)).result as any;
const save = async (w: W, documentId: string, body: StoryDocument) =>
  call(w, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    expectedContentHash:
      w.store.listDocuments(w.projectId).find((d) => d.id === documentId)
        ?.contentHash ?? null,
    story: body,
  });
const stored = (w: W, documentId: string) =>
  JSON.parse(
    w.store.getDocument(w.projectId, documentId).bytes.toString("utf8"),
  ) as StoryDocument;
const takesOf = (w: W, documentId: string, shotId: string) =>
  stored(w, documentId)
    .scenes.flatMap((s) => s.shots)
    .find((s) => s.id === shotId)!.takes;
// What the person has cut, which a take of a story never changes.
const timeline = async (w: W) => {
  const { scenes, tracks, clips } = await call(w, "yamakan.project.export", {
    projectId: w.projectId,
  });
  return JSON.stringify({ scenes, tracks, clips });
};
const start = async (
  w: W,
  made: { hash: string },
  target?: object,
  over: object = {},
) => {
  w.leaves(made.hash);
  return (
    await call(w, "yamakan.generation.start", {
      projectId: w.projectId,
      recipeId: recipe.id,
      prompt: "go",
      seed: 7,
      width: 64,
      height: 36,
      durationFrames: 90,
      ...(target ? { target } : {}),
      ...over,
    })
  ).generationId as string;
};
const bring = async (w: W, generationId: string) =>
  (await call(w, "yamakan.generation.import", { generationId })) as {
    assetId: string;
    lineage: object;
    take: TakeOutcome | null;
  };
const rows = (w: W) =>
  w.store.read(
    (db) =>
      db
        .prepare("SELECT count(*) AS n FROM jobs WHERE kind = ?")
        .get("remote-generation") as { n: number },
  ).n;
const added = (take: TakeOutcome | null) => {
  assert.ok(take?.appended, JSON.stringify(take));
  return take;
};

test("a targeted generation appends one take and leaves the timeline alone", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const other = shot({ name: "Other" });
  const mine = shot();
  const documentId = id();
  await save(w, documentId, story([other, mine]));
  // A cut exists, which the import must not touch.
  await call(w, "yamakan.story.assemble", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    trackId: (await w.store.load(w.projectId)).tracks.find(
      (t) => t.kind === "video",
    )!.id,
  });
  const before = await timeline(w);
  assert.match(before, /"clips":\[\{/);
  const head = await w.store.load(w.projectId);
  const was = w.store.getDocument(w.projectId, documentId).ref.contentHash;
  const target = { documentId, shotId: mine.id };
  const generationId = await start(w, made, target);
  const imported = await bring(w, generationId);
  const take = added(imported.take);
  assert.equal(imported.assetId, made.id);
  assert.deepEqual(
    { documentId: take.documentId, shotId: take.shotId },
    target,
  );
  assert.equal(take.revision, head.revision + 1);
  const now = w.store.getDocument(w.projectId, documentId).ref.contentHash;
  assert.equal(take.contentHash, now);
  assert.notEqual(now, was);
  const [kept, ...more] = takesOf(w, documentId, mine.id);
  assert.equal(more.length, 0);
  assert.deepEqual(kept, {
    id: take.takeId,
    assetId: made.id,
    sourceStartTicks: 0,
    lineage: { outputHash: made.hash, inputs: [] },
    recordHash: take.recordHash,
  });
  const { record } = (await call(w, "yamakan.take.record", {
    projectId: w.projectId,
    documentId,
    shotId: mine.id,
    takeId: take.takeId,
  })) as { record: TakeRecord };
  assert.deepEqual(record.source, { generationId });
  assert.equal(await timeline(w), before);
  // The other shot, and the selection, are as they were.
  const after = stored(w, documentId).scenes[0]!.shots;
  assert.deepEqual(after[0], other);
  assert.equal(after[1]!.selectedTakeId, null);
  // Said in the list and the status, and the same when brought in again.
  const again = await bring(w, generationId);
  assert.deepEqual(again, imported);
  assert.equal(takesOf(w, documentId, mine.id).length, 1);
  const [listed] = await call(w, "yamakan.generation.list", {
    projectId: w.projectId,
  });
  assert.deepEqual(listed.target, target);
  assert.deepEqual(listed.take, take);
  const status = await call(w, "yamakan.generation.status", { generationId });
  assert.equal(status.state, "succeeded");
  assert.deepEqual([status.target, status.take], [target, take]);
});

test("a generation with no target touches no story, and an older row reads as one", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const mine = shot();
  const documentId = id();
  await save(w, documentId, story([mine]));
  const was = w.store.getDocument(w.projectId, documentId).ref.contentHash;
  const generationId = await start(w, made);
  const [listed] = await call(w, "yamakan.generation.list", {
    projectId: w.projectId,
  });
  assert.deepEqual([listed.target, listed.take], [null, null]);
  const row = w.service.row(generationId) as GenerationRecord;
  assert.ok(!("target" in row) && !("take" in row));
  const imported = await bring(w, generationId);
  assert.equal(imported.take, null);
  assert.equal(
    w.store.getDocument(w.projectId, documentId).ref.contentHash,
    was,
  );
});

test("a story edited between start and import keeps its edits and gains the take", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const still = await video(w, "theirs");
  const mine = shot();
  const documentId = id();
  const first = story([mine]);
  await save(w, documentId, first);
  const generationId = await start(w, made, { documentId, shotId: mine.id });
  const theirs = {
    id: id(),
    assetId: still.id,
    sourceStartTicks: 0,
  };
  const edited: StoryDocument = {
    ...first,
    title: "Renamed",
    scenes: [
      {
        ...first.scenes[0]!,
        shots: [
          {
            ...mine,
            name: "New name",
            durationTicks: 30 * FRAME,
            takes: [theirs],
            selectedTakeId: theirs.id,
          },
        ],
      },
      { id: id(), name: "Two", shots: [shot({ name: "Added" })] },
    ],
  };
  await save(w, documentId, edited);
  const take = added((await bring(w, generationId)).take);
  const now = stored(w, documentId);
  const [kept, mineNow] = now.scenes[0]!.shots[0]!.takes;
  assert.deepEqual(kept, theirs);
  assert.equal(mineNow!.id, take.takeId);
  now.scenes[0]!.shots[0]!.takes.pop();
  assert.deepEqual(now, edited);
});

test("a removed shot, a story absent from the head after a restore to a revision from before its first save, a full shot and a short video each report their reason and keep the asset", async () => {
  const w = await withProject();
  const clips: Asset[] = [];
  for (let i = 0; i < 4; i++) clips.push(await video(w, `made ${i}`));
  const short = await video(w, "short", 30);
  const filler = await video(w, "filler");
  const before = (await w.store.load(w.projectId)).revision;
  const documentId = id();
  const gone = shot({ name: "Gone" });
  const full = shot({ name: "Full" });
  const long = shot({ name: "Long" });
  const stays = shot({ name: "Stays" });
  const body = story([gone, full, long, stays]);
  await save(w, documentId, body);
  const to = (s: Shot) => ({ documentId, shotId: s.id });
  const runs = {
    gone: await start(w, clips[0]!, to(gone)),
    full: await start(w, clips[1]!, to(full)),
    long: await start(w, short, to(long)),
    story: await start(w, clips[2]!, to(stays)),
  };
  const filled = Array.from({ length: STORY_LIMITS.takesPerShot }, () => ({
    id: id(),
    assetId: filler.id,
    sourceStartTicks: 0,
  }));
  await save(w, documentId, {
    ...body,
    scenes: [
      {
        ...body.scenes[0]!,
        shots: [{ ...full, takes: filled }, long, stays],
      },
    ],
  });
  const cut = await timeline(w);
  const expect = async (
    generationId: string,
    made: Asset,
    why: string,
    message: RegExp,
  ) => {
    const at = w.store
      .listDocuments(w.projectId)
      .find((d) => d.id === documentId)?.contentHash;
    const answer = await bring(w, generationId);
    assert.equal(answer.assetId, made.id);
    assert.ok(answer.take && !answer.take.appended);
    assert.equal(answer.take.reason, why);
    assert.match(answer.take.message, message);
    assert.deepEqual(w.service.row(generationId)!.take, answer.take);
    assert.ok(
      (await w.store.load(w.projectId)).assets.some((a) => a.id === made.id),
    );
    assert.equal(
      w.store.listDocuments(w.projectId).find((d) => d.id === documentId)
        ?.contentHash,
      at,
      "no story changed",
    );
  };
  await expect(
    runs.gone,
    clips[0]!,
    "shot-gone",
    /^The story has no such shot\.$/,
  );
  await expect(
    runs.full,
    clips[1]!,
    "shot-full",
    /^The shot already holds 8 takes; remove one before generating another\.$/,
  );
  await expect(
    runs.long,
    short,
    "take-too-short",
    /^The shot lasts 2 s and this take lasts 1 s; ask for a longer take or shorten the shot\.$/,
  );
  assert.equal(await timeline(w), cut);
  await call(w, "yamakan.project.restore", {
    projectId: w.projectId,
    revision: before,
    expectedHeadFingerprint: (
      await call(w, "yamakan.project.history", {
        projectId: w.projectId,
        limit: 1,
      })
    ).headFingerprint,
  });
  await expect(
    runs.story,
    clips[2]!,
    "story-gone",
    /^This project has no such story\.$/,
  );
  // Kept, it can still be saved onto a shot by hand, with its record.
  const hand = {
    id: id(),
    assetId: clips[2]!.id,
    sourceStartTicks: 0,
  };
  const other = id();
  const saved = await call(w, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId: other,
    expectedContentHash: null,
    story: story([shot({ takes: [hand] })]),
    records: [{ takeId: hand.id, from: { generationId: runs.story } }],
  });
  assert.equal(saved.records.length, 1);
});

test("a second import after a failed append appends once", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const mine = shot();
  const documentId = id();
  const body = story([mine, shot({ name: "Other" })]);
  await save(w, documentId, body);
  const generationId = await start(w, made, { documentId, shotId: mine.id });
  await save(w, documentId, {
    ...body,
    scenes: [{ ...body.scenes[0]!, shots: [body.scenes[0]!.shots[1]!] }],
  });
  const first = await bring(w, generationId);
  assert.ok(first.take && !first.take.appended);
  const assets = (await w.store.load(w.projectId)).assets.length;
  await save(w, documentId, body);
  const second = await bring(w, generationId);
  added(second.take);
  assert.deepEqual(
    [second.assetId, second.lineage],
    [first.assetId, first.lineage],
  );
  assert.equal((await w.store.load(w.projectId)).assets.length, assets);
  added((await bring(w, generationId)).take);
  assert.equal(takesOf(w, documentId, mine.id).length, 1);
  // Taken out by the person, it is not put back.
  await save(w, documentId, body);
  assert.deepEqual((await bring(w, generationId)).take, second.take);
  assert.equal(takesOf(w, documentId, mine.id).length, 0);
});

test("an import interrupted after the story commit does not append twice", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const mine = shot();
  const documentId = id();
  await save(w, documentId, story([mine]));
  const target = { documentId, shotId: mine.id };
  const generationId = await start(w, made, target);
  const keep = w.service.keepTake;
  w.service.keepTake = () => {
    throw new Error("stopped here");
  };
  await assert.rejects(bring(w, generationId), /stopped here/);
  w.service.keepTake = keep;
  assert.equal(w.service.row(generationId)!.take, undefined);
  const [there] = takesOf(w, documentId, mine.id);
  // In a service started again, with the job table it left.
  for (const h of [w.queue, w.store]) await h.close();
  const next = await workspace(w.root);
  next.projectId = w.projectId;
  next.remember(w.videos);
  assert.deepEqual(next.service.row(generationId)!.target, target);
  const take = added((await bring(next, generationId)).take);
  assert.equal(take.takeId, there!.id);
  assert.equal(take.recordHash, there!.recordHash);
  assert.equal(takesOf(next, documentId, mine.id).length, 1);
  // Two calls at once, where neither has kept its answer, are one take too.
  const both = await video(next, "both");
  const racing = await start(next, both, target);
  const [a, b] = await Promise.all([bring(next, racing), bring(next, racing)]);
  assert.equal(added(a.take).takeId, added(b.take).takeId);
  assert.equal(takesOf(next, documentId, mine.id).length, 2);
});

test("two generations for one shot both land, and a ninth take is refused as shot-full", async () => {
  const w = await withProject();
  const mine = shot();
  const documentId = id();
  const filler = await video(w, "filler");
  await save(
    w,
    documentId,
    story([
      {
        ...mine,
        takes: Array.from({ length: 6 }, () => ({
          id: id(),
          assetId: filler.id,
          sourceStartTicks: 0,
        })),
      },
    ]),
  );
  const target = { documentId, shotId: mine.id };
  const runs: string[] = [];
  for (const seed of ["one", "two", "three"])
    runs.push(await start(w, await video(w, seed), target));
  const answers = await Promise.all(runs.map((r) => bring(w, r)));
  const landed = answers.filter((a) => a.take?.appended);
  assert.equal(landed.length, 2);
  const [left] = answers.filter((a) => !a.take?.appended);
  assert.ok(left?.take && !left.take.appended);
  assert.equal(left.take.reason, "shot-full");
  assert.ok(
    (await w.store.load(w.projectId)).assets.some((a) => a.id === left.assetId),
  );
  const takes = takesOf(w, documentId, mine.id);
  assert.equal(takes.length, 8);
  assert.equal(new Set(takes.map((t) => t.recordHash).filter(Boolean)).size, 2);
  // And now none may be started for it.
  assert.equal(
    await reason(start(w, await video(w, "four"), target)),
    "LIMIT_EXCEEDED: The shot already holds 8 takes; remove one before generating another.",
  );
});

test("what refuses the story is said in its own words, and a story that keeps changing is busy", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const mine = shot();
  const documentId = id();
  await save(w, documentId, story([mine]));
  const generationId = await start(w, made, { documentId, shotId: mine.id });
  const commit = w.store.commitDocument.bind(w.store);
  const tries: string[] = [];
  const refusing = (e: () => unknown) => {
    tries.length = 0;
    w.store.commitDocument = (async (input: { documentId: string }) => {
      tries.push(input.documentId);
      throw e();
    }) as never;
  };
  refusing(() => new CommandError("VALIDATION", "Another shot's pack."));
  const refused = (await bring(w, generationId)).take;
  assert.deepEqual(refused, {
    appended: false,
    reason: "story-refused",
    message: "Another shot's pack.",
  });
  assert.equal(tries.length, 1);
  refusing(() => new CommandError("REVISION_CONFLICT", "Changed."));
  const busy = (await bring(w, generationId)).take;
  assert.ok(busy && !busy.appended);
  assert.equal(busy.reason, "busy");
  // Once, and at most three times more.
  assert.equal(tries.length, 4);
  // What is no refusal is not hidden as one, and nothing is kept of it.
  refusing(() => new Error("disk"));
  await assert.rejects(bring(w, generationId), /disk/);
  assert.deepEqual(w.service.row(generationId)!.take, busy);
  // A change in between is only another try.
  let first = true;
  w.store.commitDocument = (async (...input: Parameters<typeof commit>) => {
    if (first) {
      first = false;
      throw new CommandError("REVISION_CONFLICT", "Changed.");
    }
    return commit(...input);
  }) as never;
  added((await bring(w, generationId)).take);
  assert.equal(takesOf(w, documentId, mine.id).length, 1);
});

test("a target that no take could be added to starts nothing", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const documentId = id();
  const mine = shot();
  const filler = await video(w, "filler");
  const full = shot({
    takes: Array.from({ length: 8 }, () => ({
      id: id(),
      assetId: filler.id,
      sourceStartTicks: 0,
    })),
  });
  await save(w, documentId, story([mine, full]));
  const still = await video(w, "pack");
  const pack = id();
  await call(w, "yamakan.pack.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId: pack,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Pack",
      entries: [
        {
          id: id(),
          role: "environment",
          assetId: still.id,
          assetHash: still.hash,
          label: "Place",
          characterId: null,
          consentId: null,
        },
      ],
    },
  });
  const elsewhere = (
    (await execute(w.ctx, "yamakan.project.create", { name: "Other" }))
      .result as Project
  ).id;
  const NO_STORY = "NOT_FOUND: This project has no such story.";
  for (const [target, over, why] of [
    [{ documentId: id(), shotId: mine.id }, {}, NO_STORY],
    [{ documentId: pack, shotId: mine.id }, {}, NO_STORY],
    [{ documentId, shotId: mine.id }, { projectId: elsewhere }, NO_STORY],
    [
      { documentId, shotId: id() },
      {},
      "NOT_FOUND: The story has no such shot.",
    ],
    [
      { documentId, shotId: full.id },
      {},
      "LIMIT_EXCEEDED: The shot already holds 8 takes; remove one before generating another.",
    ],
    [
      { documentId, shotId: mine.id },
      { durationFrames: 59 },
      "VALIDATION: The shot lasts 2 s and this request makes 1.97 s; ask for a longer take or shorten the shot.",
    ],
  ] as const)
    assert.equal(await reason(start(w, made, target, over)), why);
  for (const target of [
    { documentId },
    { shotId: mine.id },
    { documentId, shotId: mine.id, path: "C:/x" },
    { documentId: "x", shotId: mine.id },
    { documentId, shotId: 1 },
    null,
  ])
    assert.match(
      await reason(
        call(w, "yamakan.generation.start", {
          projectId: w.projectId,
          recipeId: recipe.id,
          width: 64,
          height: 36,
          durationFrames: 90,
          target,
        }),
      ),
      /^VALIDATION/,
    );
  // An agent, and a request id, as before.
  const target = { documentId, shotId: mine.id };
  const agent = {
    ...w,
    ctx: {
      ...w.ctx,
      principal: { id: "agent:x", scopes: new Set(Scopes) },
    } as unknown as CommandContext,
  };
  assert.match(await reason(start(agent, made, target)), /^SCOPE_DENIED/);
  assert.match(
    await reason(
      execute({ ...w.ctx, requestId: "r.1" }, "yamakan.generation.start", {
        projectId: w.projectId,
        recipeId: recipe.id,
        width: 64,
        height: 36,
        durationFrames: 90,
        target,
      }),
    ),
    /cannot replay a request ID/,
  );
  assert.equal(rows(w), 0);
  assert.equal(w.sent.length, 0);
  // Exactly as long as the shot is long enough.
  await start(w, made, target, { durationFrames: 60 });
  assert.equal(rows(w), 1);
});

test("an earlier version's story that receives a take is saved as the newest", async () => {
  const w = await withProject();
  const made = await video(w, "made");
  const mine = shot();
  const documentId = id();
  await save(w, documentId, story([mine]));
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
    readOnly: true,
  });
  const versions = () =>
    (
      db
        .prepare(
          "SELECT count(*) AS n FROM story_document_versions WHERE document_id = ?",
        )
        .get(documentId) as { n: number }
    ).n;
  const before = versions();
  const generationId = await start(w, made, { documentId, shotId: mine.id });
  added((await bring(w, generationId)).take);
  // The story's new version, and the record it names.
  assert.equal(versions() - before, 2);
  db.close();
  assert.equal(
    w.store.listDocuments(w.projectId).find((d) => d.id === documentId)!
      .schemaVersion,
    2,
  );
});
