// YU-032: non-destructive take compare and replace. A three-shot story is
// assembled; one shot's clip is switched to another take through a
// revision-bound proposal, leaving every other byte and meaning of the
// project as it was, and undo (or reopening the workspace) returns exactly
// the old take. Stale or forged proposals, a take shorter than its clip,
// missing or unprobed media and a revoked reference consent are refused.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import type { Project } from "../core/project.ts";
import type { ReferencePack, StoryDocument } from "../core/story.ts";
import type { TakeProposal } from "../core/takes.ts";
import { fromEditView } from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";

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
const id = () => crypto.randomUUID();
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};
const message = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).message;
  }
};

function ffmpeg(args: string[]) {
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
}

const browserPrincipal = {
  id: "browser-ui" as const,
  scopes: new Set(Scopes) as ReadonlySet<Scope>,
};

async function open(root: string) {
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  return {
    store,
    queue,
    browser: { store, queue, principal: browserPrincipal },
  };
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-takes-"));
  bases.push(root);
  const { store, queue, browser } = await open(root);
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Takes" })
  ).result as Project;
  const media = {
    // Two takes of footage (the second with sound) and a still.
    a: [
      "a.mp4",
      ["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=3"],
    ],
    b: [
      "b.mp4",
      [
        "-f",
        "lavfi",
        "-i",
        "smptebars=size=320x180:rate=30:duration=3",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=330:duration=3",
        "-c:a",
        "aac",
        "-shortest",
      ],
    ],
    still: [
      "still.png",
      ["-f", "lavfi", "-i", "testsrc=size=320x180", "-frames:v", "1"],
    ],
  } as const;
  const imported = {} as Record<keyof typeof media, Project["assets"][number]>;
  for (const [key, [name, args]] of Object.entries(media) as [
    keyof typeof media,
    (typeof media)[keyof typeof media],
  ][]) {
    const file = path.join(root, name);
    ffmpeg([
      ...args,
      ...(name.endsWith(".mp4")
        ? ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
        : []),
      file,
    ]);
    imported[key] = (
      await store.importAsset(project.id, name, await readFile(file))
    ).asset;
  }
  return { root, store, queue, browser, projectId: project.id, imported };
}

type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = async (c: Ctx) => c.store.load(c.projectId);
const run = async <T>(c: Ctx, operation: string, args: object) =>
  (await execute(c.browser, operation, { projectId: c.projectId, ...args }))
    .result as T;

function board(
  c: Ctx,
  pin: { documentId: string; contentHash: string } | null,
) {
  const t = { a1: id(), b1: id(), still2: id(), b2: id(), a3: id() };
  const shot = (
    name: string,
    frames: number,
    takes: StoryDocument["scenes"][number]["shots"][number]["takes"],
    selected: string | null,
    referencePacks = [] as { documentId: string; contentHash: string }[],
  ) => ({
    id: id(),
    name,
    durationTicks: frames * FRAME,
    notes: "",
    referencePacks,
    takes,
    selectedTakeId: selected,
  });
  const story: StoryDocument = {
    format: "yamakan.story",
    formatVersion: 1,
    title: "Three shots",
    scenes: [
      {
        id: id(),
        name: "One",
        shots: [
          shot(
            "Wide",
            30,
            [
              {
                id: t.a1,
                assetId: c.imported.a.id,
                sourceStartTicks: 15 * FRAME,
              },
              {
                id: t.b1,
                assetId: c.imported.b.id,
                sourceStartTicks: 30 * FRAME,
                lineage: {
                  label: "Second pass",
                  outputHash: c.imported.b.hash,
                  inputs: [
                    { assetId: c.imported.a.id, assetHash: c.imported.a.hash },
                  ],
                },
              },
            ],
            t.a1,
            pin ? [pin] : [],
          ),
          shot(
            "Close",
            30,
            [
              {
                id: t.still2,
                assetId: c.imported.still.id,
                sourceStartTicks: 0,
              },
              { id: t.b2, assetId: c.imported.b.id, sourceStartTicks: 0 },
            ],
            t.still2,
          ),
          shot(
            "Card",
            45,
            [{ id: t.a3, assetId: c.imported.a.id, sourceStartTicks: 0 }],
            null,
          ),
        ],
      },
    ],
  };
  return { story, t };
}

async function assembled(c: Ctx, pin: Parameters<typeof board>[1] = null) {
  const documentId = id();
  const { story, t } = board(c, pin);
  await run(c, "yamakan.story.save", {
    expectedRevision: (await head(c)).revision,
    documentId,
    expectedContentHash: null,
    story,
  });
  const before = await head(c);
  await run(c, "yamakan.story.assemble", {
    expectedRevision: before.revision,
    documentId,
    trackId: before.tracks.find((x) => x.kind === "video")!.id,
  });
  const shots = story.scenes[0].shots;
  return { documentId, story, t, shots };
}

const exported = (c: Ctx) =>
  run<Record<string, unknown> & { clips: Record<string, unknown>[] }>(
    c,
    "yamakan.project.export",
    {},
  );
const clipOf = async (c: Ctx, shotId: string) => {
  const p = await exported(c);
  const shot = (p.scenes as { shots: { id: string; clipIds: string[] }[] }[])
    .flatMap((s) => s.shots)
    .find((s) => s.id === shotId)!;
  return p.clips.find((x) => x.id === shot.clipIds[0]) as {
    id: string;
    assetId: string | null;
    title: string | null;
    sourceStartTicks: number;
    sound: { enabled: boolean } | null;
  };
};
const propose = (c: Ctx, documentId: string, shotId: string, takeId: string) =>
  run<TakeProposal>(c, "yamakan.take.proposeReplace", {
    documentId,
    shotId,
    takeId,
  });
const apply = async (c: Ctx, proposal: TakeProposal, revision?: number) =>
  run<Project>(c, "yamakan.take.apply", {
    expectedRevision: revision ?? (await head(c)).revision,
    proposal,
  });

test("replacing one of three shots' takes changes that clip only, and undo or reopening returns exactly the old take", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  const before = await exported(c);
  const storyBefore = await run<{ contentHash: string }>(
    c,
    "yamakan.document.get",
    { documentId },
  );

  // Listing and comparing change nothing.
  const listed = await run<{
    shots: {
      shotId: string;
      timeline: { clipId: string; currentTakeId: string | null } | null;
      takes: { id: string; lineage: unknown }[];
    }[];
  }>(c, "yamakan.take.list", { documentId });
  assert.deepEqual(
    listed.shots.map((s) => s.timeline?.currentTakeId ?? null),
    [t.a1, t.still2, null],
  );
  assert.equal(listed.shots[0].takes[1].lineage !== null, true);
  const compared = await run<{
    takes: {
      takeId: string;
      current: boolean;
      covers: boolean;
      preview: { type: string; index?: number } | null;
    }[];
  }>(c, "yamakan.take.compare", {
    documentId,
    shotId: shots[0].id,
    takeIds: [t.a1, t.b1],
  });
  assert.deepEqual(
    compared.takes.map((x) => [x.takeId, x.current, x.covers, x.preview?.type]),
    [
      [t.a1, true, true, "thumbnail"],
      [t.b1, false, true, "thumbnail"],
    ],
  );
  // The middle of 1.0–2.0 s of the source: second 1.
  assert.equal(compared.takes[1].preview?.index, 1);
  assert.deepEqual(await exported(c), before);

  // The proposal names the exact mapping and changes nothing either.
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  assert.equal(proposal.revision, before.revision);
  assert.equal(proposal.storyContentHash, storyBefore.contentHash);
  assert.deepEqual(proposal.mappings[0].from, {
    assetId: c.imported.a.id,
    assetHash: c.imported.a.hash,
    title: null,
    sourceStartTicks: 15 * FRAME,
  });
  assert.deepEqual(proposal.mappings[0].to, {
    assetId: c.imported.b.id,
    assetHash: c.imported.b.hash,
    title: null,
    sourceStartTicks: 30 * FRAME,
  });
  assert.deepEqual(await exported(c), before);

  const applied = await apply(c, proposal);
  assert.equal(applied.revision, (before.revision as number) + 1);
  const after1 = await exported(c);
  // Only that clip changed: its media, in-point and (new media) sound.
  const changed = proposal.mappings[0].clipId;
  const strip = (p: typeof before) => ({
    ...p,
    revision: 0,
    clips: p.clips.filter((x) => x.id !== changed),
  });
  assert.deepEqual(strip(after1), strip(before));
  const was = before.clips.find((x) => x.id === changed)!;
  const now = after1.clips.find((x) => x.id === changed)!;
  assert.deepEqual(
    {
      ...now,
      assetId: was.assetId,
      sourceStartTicks: was.sourceStartTicks,
      sound: was.sound,
    },
    was,
  );
  assert.equal(now.assetId, c.imported.b.id);
  assert.equal(now.sourceStartTicks, 30 * FRAME);
  // The original take's media stays in the project, its take in the story.
  assert.ok(
    (after1.assets as { id: string }[]).some((a) => a.id === c.imported.a.id),
  );
  const storyAfter = await run<{ contentHash: string }>(
    c,
    "yamakan.document.get",
    { documentId },
  );
  assert.equal(storyAfter.contentHash, storyBefore.contentHash);
  const relisted = await run<typeof listed>(c, "yamakan.take.list", {
    documentId,
  });
  assert.equal(relisted.shots[0].timeline?.currentTakeId, t.b1);

  // The same proposal cannot be applied twice.
  assert.equal(await code(apply(c, proposal)), "REVISION_CONFLICT");

  // Undo is a new revision with exactly the old take.
  const undone = await run<Project>(c, "yamakan.project.undo", {
    expectedRevision: applied.revision,
  });
  assert.equal(undone.revision, applied.revision + 1);
  const after2 = await exported(c);
  assert.deepEqual({ ...after2, revision: 0 }, { ...before, revision: 0 });

  // Redo, then reopen the workspace: the replacement is what was stored.
  await run(c, "yamakan.project.redo", { expectedRevision: undone.revision });
  const redone = await exported(c);
  await c.queue.close();
  c.store.close();
  const reopened = await open(c.root);
  const r = { ...c, ...reopened };
  assert.deepEqual(await exported(r), redone);
  assert.equal((await clipOf(r, shots[0].id)).assetId, c.imported.b.id);
  const back = await run<Project>(r, "yamakan.project.undo", {
    expectedRevision: redone.revision as number,
  });
  assert.ok(back.revision > (redone.revision as number));
  assert.deepEqual(
    { ...(await exported(r)), revision: 0 },
    { ...before, revision: 0 },
  );
});

test("a still is replaced by footage with sound, and a title card by a take", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  await apply(c, await propose(c, documentId, shots[1].id, t.b2));
  const close = await clipOf(c, shots[1].id);
  assert.equal(close.assetId, c.imported.b.id);
  assert.equal(close.sound?.enabled, true);
  await apply(c, await propose(c, documentId, shots[2].id, t.a3));
  const card = await clipOf(c, shots[2].id);
  assert.deepEqual([card.assetId, card.title], [c.imported.a.id, null]);
  assert.equal(card.sound?.enabled, false);
  // Back to the still: no sound settings remain.
  await apply(c, await propose(c, documentId, shots[1].id, t.still2));
  assert.equal((await clipOf(c, shots[1].id)).sound, null);
  // Proposing the take already shown is refused.
  assert.equal(
    await code(propose(c, documentId, shots[1].id, t.still2)),
    "VALIDATION",
  );
});

test("stale, forged and story-changed proposals are refused", async () => {
  const c = await workspace();
  const { documentId, story, t, shots } = await assembled(c);
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  // A forged mapping keeps the hash but names other media.
  const forged = structuredClone(proposal);
  forged.mappings[0].to.assetId = c.imported.still.id;
  forged.mappings[0].to.sourceStartTicks = 0;
  assert.equal(await code(apply(c, forged)), "REVISION_CONFLICT");
  // Any other edit makes the proposal stale.
  const p = await head(c);
  await run(c, "yamakan.project.applyBatch", {
    expectedRevision: p.revision,
    operations: [
      {
        type: "track.update",
        trackId: p.tracks.find((x) => x.kind === "audio")!.id,
        name: "Renamed",
      },
    ],
  });
  assert.equal(
    await code(apply(c, proposal, proposal.revision)),
    "REVISION_CONFLICT",
  );
  assert.equal(await code(apply(c, proposal)), "REVISION_CONFLICT");
  // A proposal from the new head, after the story changed, is stale too.
  const fresh = await propose(c, documentId, shots[0].id, t.b1);
  const document = await run<{ contentHash: string }>(
    c,
    "yamakan.document.get",
    { documentId },
  );
  await run(c, "yamakan.story.save", {
    expectedRevision: (await head(c)).revision,
    documentId,
    expectedContentHash: document.contentHash,
    story: { ...story, title: "Retitled" },
  });
  const stale = { ...fresh, revision: (await head(c)).revision };
  assert.match(
    await message(apply(c, stale)),
    /story changed since the proposal/,
  );
  // Its fresh proposal applies.
  await apply(c, await propose(c, documentId, shots[0].id, t.b1));
  assert.equal((await clipOf(c, shots[0].id)).assetId, c.imported.b.id);
});

test("a take shorter than its clip, missing or unprobed media and a wrong lineage are refused", async () => {
  const c = await workspace();
  const { documentId, story, t, shots } = await assembled(c);
  // The title card is lengthened past the take's three seconds.
  const card = await clipOf(c, shots[2].id);
  await run(c, "yamakan.project.applyBatch", {
    expectedRevision: (await head(c)).revision,
    operations: [
      { type: "clip.trim", clipId: card.id, endTicks: (60 + 100) * FRAME },
    ],
  });
  assert.match(
    await message(propose(c, documentId, shots[2].id, t.a3)),
    /shorter than the clip/,
  );

  // Missing media: the object is gone from disk.
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  const file = await c.store.readyObjectFile(c.projectId, c.imported.b);
  await rename(file, `${file}.away`);
  assert.equal(await code(apply(c, proposal)), "RECOVERY_REQUIRED");
  await rename(`${file}.away`, file);
  // Media without its recorded probe is not attached.
  const db = new DatabaseSync(path.join(c.root, "workspace.sqlite"));
  const probe = (
    db
      .prepare("SELECT probe FROM asset_versions WHERE version_id = ?")
      .get(c.imported.b.id) as { probe: string }
  ).probe;
  db.prepare("UPDATE asset_versions SET probe = NULL WHERE version_id = ?").run(
    c.imported.b.id,
  );
  assert.match(await message(apply(c, proposal)), /no recorded probe/);
  db.prepare("UPDATE asset_versions SET probe = ? WHERE version_id = ?").run(
    probe,
    c.imported.b.id,
  );
  db.close();
  assert.equal((await apply(c, proposal)).revision, proposal.revision + 1);

  // A take whose lineage names another media version is not saved.
  const wrong = structuredClone(story);
  wrong.scenes[0].shots[0].takes[1].lineage!.outputHash = c.imported.a.hash;
  const document = await run<{ contentHash: string }>(
    c,
    "yamakan.document.get",
    { documentId },
  );
  assert.match(
    await message(
      run(c, "yamakan.story.save", {
        expectedRevision: (await head(c)).revision,
        documentId,
        expectedContentHash: document.contentHash,
        story: wrong,
      }),
    ),
    /does not match its recorded media version/,
  );
});

test("a revoked reference consent refuses the replacement; the clip keeps its take", async () => {
  const c = await workspace();
  const consent = (
    await execute(c.browser, "yamakan.consent.grant", {
      characterId: "lead",
      purpose: "likeness-generate",
      version: "v1",
      ttlMs: 24 * 60 * 60 * 1000,
    })
  ).result as { id: string };
  const pack: ReferencePack = {
    format: "yamakan.reference-pack",
    formatVersion: 1,
    name: "Lead",
    entries: [
      {
        id: id(),
        role: "character",
        label: "Lead",
        assetId: c.imported.still.id,
        assetHash: c.imported.still.hash,
        characterId: "lead",
        consentId: consent.id,
      },
    ],
  };
  const packId = id();
  const saved = await run<{ document: { contentHash: string } }>(
    c,
    "yamakan.pack.save",
    {
      expectedRevision: (await head(c)).revision,
      documentId: packId,
      expectedContentHash: null,
      pack,
    },
  );
  const { documentId, t, shots } = await assembled(c, {
    documentId: packId,
    contentHash: saved.document.contentHash,
  });
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  await execute(c.browser, "yamakan.consent.revoke", { consentId: consent.id });
  const revision = (await head(c)).revision;
  assert.equal(await code(apply(c, proposal)), "VALIDATION");
  assert.equal((await head(c)).revision, revision);
  assert.equal((await clipOf(c, shots[0].id)).assetId, c.imported.a.id);
  // A shot that pins nothing can still change its take.
  await apply(c, await propose(c, documentId, shots[1].id, t.b2));
});

test("take commands need the right scopes and refuse what is not a story shot", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  const reader = {
    ...c.browser,
    principal: {
      id: "agent:reader" as const,
      scopes: new Set(["project:read"]) as ReadonlySet<Scope>,
    },
  };
  const proposal = (
    await execute(reader, "yamakan.take.proposeReplace", {
      projectId: c.projectId,
      documentId,
      shotId: shots[0].id,
      takeId: t.b1,
    })
  ).result as TakeProposal;
  assert.equal(
    await code(
      execute(reader, "yamakan.take.apply", {
        projectId: c.projectId,
        expectedRevision: proposal.revision,
        proposal,
      }),
    ),
    "SCOPE_DENIED",
  );
  assert.equal(
    await code(propose(c, documentId, shots[0].id, t.still2)),
    "NOT_FOUND",
  );
  assert.equal(await code(propose(c, documentId, id(), t.b1)), "NOT_FOUND");
  assert.equal(
    await code(
      run(c, "yamakan.take.compare", {
        documentId,
        shotId: shots[0].id,
        takeIds: [t.a1, t.a1],
      }),
    ),
    "VALIDATION",
  );
});

test("a locked track, a retimed clip and unlinked sound refuse the replacement at proposal", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  await apply(c, await propose(c, documentId, shots[1].id, t.b2));
  const close = await clipOf(c, shots[1].id);
  const p = await head(c);
  const audio = p.tracks.find((x) => x.kind === "audio")!;
  const video = p.tracks.find((x) => x.kind === "video")!;
  const batch = async (operations: object[]) =>
    run(c, "yamakan.project.applyBatch", {
      expectedRevision: (await head(c)).revision,
      operations,
    });
  // Unlinked sound (canonical projects only; the editing view cannot hold
  // it yet) stays with its media.
  const unlinked = applyBatch(fromEditView(p), [
    {
      type: "clip.unlinkSound",
      clipId: close.id,
      audioTrackId: audio.id,
      audioClipId: id(),
    },
  ]);
  assert.throws(
    () =>
      applyBatch(unlinked, [
        {
          type: "clip.replaceMedia",
          clipId: close.id,
          assetId: c.imported.still.id,
          sourceStartTicks: 0,
        },
      ]),
    /unlinked sound/,
  );
  const wide = await clipOf(c, shots[0].id);
  await batch([
    { type: "clip.setSpeed", clipId: wide.id, speed: { num: 1, den: 2 } },
  ]);
  assert.match(
    await message(propose(c, documentId, shots[0].id, t.b1)),
    /speed/,
  );
  await batch([{ type: "track.update", trackId: video.id, locked: true }]);
  assert.match(
    await message(propose(c, documentId, shots[2].id, t.a3)),
    /locked/,
  );
});
