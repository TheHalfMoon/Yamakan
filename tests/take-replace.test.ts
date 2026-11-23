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
import {
  TAKE_LIMITS,
  TakeProposalInputSchema,
  compareTakes,
  listTakes,
  proposeReplace,
  replaceOperations,
  type TakeProposal,
} from "../core/takes.ts";
import {
  CanonicalProjectSchema,
  FORMAT,
  FORMAT_VERSION,
  fromEditView,
  type CanonicalProject,
} from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { IDENTITY_TRANSFORM } from "../core/effects/registry.ts";
import {
  advanceStage,
  approveStage,
  loadRun,
  startDirectorRun,
} from "../core/director/runtime.ts";

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
  // The same file is refused in a shot that pins nothing too: what is newly
  // shown is the file, whichever shot asks (the founder's decision of 2026-11-23).
  const other = await propose(c, documentId, shots[1].id, t.b2);
  assert.match(await message(apply(c, other)), /consent was revoked/);
  assert.equal((await head(c)).revision, revision);
  assert.equal((await clipOf(c, shots[1].id)).assetId, c.imported.still.id);
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

test("a replacement keeps the clip's effects, animation and sound gain and fades, and refuses a take whose sound is unlinked elsewhere", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  await apply(c, await propose(c, documentId, shots[1].id, t.b2));
  const close = await clipOf(c, shots[1].id);
  await run(c, "yamakan.project.applyBatch", {
    expectedRevision: (await head(c)).revision,
    operations: [
      {
        type: "clip.setEffects",
        clipId: close.id,
        effects: [{ ...IDENTITY_TRANSFORM, scale: 1500 }],
      },
      {
        type: "clip.upsertAnimationKeyframe",
        clipId: close.id,
        channel: "opacity",
        timeTicks: 0,
        value: 0.5,
      },
      {
        type: "clip.setSound",
        clipId: close.id,
        enabled: false,
        gainDb: -6,
        fadeInTicks: 5 * FRAME,
      },
    ],
  });
  const before = (await exported(c)).clips.find((x) => x.id === close.id)!;
  // Footage to a still and back: effects and animation stay throughout.
  await apply(c, await propose(c, documentId, shots[1].id, t.still2));
  const still = (await exported(c)).clips.find((x) => x.id === close.id)!;
  assert.deepEqual(
    [still.effects, still.animation, still.sound],
    [before.effects, before.animation, null],
  );
  await apply(c, await propose(c, documentId, shots[1].id, t.b2));
  const back = (await exported(c)).clips.find((x) => x.id === close.id)!;
  assert.deepEqual(
    [back.effects, back.animation],
    [before.effects, before.animation],
  );
  // A take whose sound is unlinked onto an audio track elsewhere.
  await apply(c, await propose(c, documentId, shots[0].id, t.b1));
  const wide = await clipOf(c, shots[0].id);
  assert.equal(wide.sound?.enabled, true);
  const p = fromEditView(await head(c));
  const audio = p.tracks.find((x) => x.kind === "audio")!;
  const cardClip = await clipOf(c, shots[2].id);
  const unlinked = applyBatch(p, [
    {
      type: "clip.unlinkSound",
      clipId: wide.id,
      audioTrackId: audio.id,
      audioClipId: id(),
    },
  ]);
  assert.throws(
    () =>
      applyBatch(unlinked, [
        {
          type: "clip.replaceMedia",
          clipId: cardClip.id,
          assetId: c.imported.b.id,
          sourceStartTicks: 0,
        },
      ]),
    /unlinked sound/,
  );

  // Footage to footage keeps the sound gain and fades.
  await run(c, "yamakan.project.applyBatch", {
    expectedRevision: (await head(c)).revision,
    operations: [
      {
        type: "clip.setSound",
        clipId: wide.id,
        enabled: false,
        gainDb: -6,
        fadeInTicks: 5 * FRAME,
      },
    ],
  });
  await apply(c, await propose(c, documentId, shots[0].id, t.a1));
  assert.deepEqual((await clipOf(c, shots[0].id)).sound, {
    enabled: false,
    gainDb: -6,
    fadeInTicks: 5 * FRAME,
    fadeOutTicks: 0,
  });
});

test("a proposal hash is never a Director stage output, and reviewing approves nothing", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  const started = await startDirectorRun(c.store, {
    projectId: c.projectId,
    pipelineName: "framework-smoke",
  });
  const before = await loadRun(c.store, started.id);
  assert.match(
    await message(
      advanceStage(c.store, {
        runId: started.id,
        stage: "research",
        status: "awaiting_human",
        outputHash: proposal.proposalHash,
      }),
    ),
    /not a stored object/,
  );
  assert.deepEqual(await loadRun(c.store, started.id), before);
  const waiting = await advanceStage(c.store, {
    runId: started.id,
    stage: "research",
    status: "awaiting_human",
    // A real stored output, so that only the hash named below is wrong.
    outputHash: c.imported.still.hash,
  });
  const refused = await message(
    approveStage(c.store, {
      runId: started.id,
      stage: "research",
      outputHash: proposal.proposalHash,
      ttlMs: 60_000,
    }),
  );
  assert.match(refused, /does not match/);
  assert.deepEqual(await loadRun(c.store, started.id), waiting);
  // A proposal is refused for any other project.
  const other = await c.store.create("Other");
  assert.equal(
    await code(
      execute(c.browser, "yamakan.take.apply", {
        projectId: other.id,
        expectedRevision: proposal.revision,
        proposal,
      }),
    ),
    "REVISION_CONFLICT",
  );
  // Applying a reviewed proposal leaves the run exactly as it was.
  await apply(c, proposal);
  assert.deepEqual(await loadRun(c.store, started.id), waiting);
});

test("another writer's later work is never undone with a take", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  const agent = {
    ...c.browser,
    principal: {
      id: "agent:take-reviewer" as const,
      scopes: new Set<Scope>(["project:read", "project:write"]),
    },
  };
  const before = await head(c);
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  const clipId = proposal.mappings[0].clipId;
  const shownBefore = before.clips.find((x) => x.id === clipId)!;
  const applied = (
    await execute(agent, "yamakan.take.apply", {
      projectId: c.projectId,
      expectedRevision: proposal.revision,
      proposal,
    })
  ).result as Project;
  const shownAfter = applied.clips.find((x) => x.id === clipId)!;
  assert.notEqual(shownAfter.assetId, shownBefore.assetId);
  const audio = applied.tracks.find((x) => x.kind === "audio")!;
  const other = await run<Project>(c, "yamakan.project.applyBatch", {
    expectedRevision: applied.revision,
    operations: [{ type: "track.update", trackId: audio.id, name: "Other" }],
  });
  // The agent cannot undo through the other writer's edit: nothing changes.
  assert.match(
    await message(
      execute(agent, "yamakan.project.undo", {
        projectId: c.projectId,
        expectedRevision: other.revision,
      }),
    ),
    /made by another client/,
  );
  const held = await head(c);
  assert.equal(held.revision, other.revision);
  assert.equal(held.tracks.find((x) => x.id === audio.id)!.name, "Other");
  assert.equal(
    held.clips.find((x) => x.id === clipId)!.assetId,
    shownAfter.assetId,
  );
  // Once that writer has undone its own edit, the agent can undo the take.
  const back = await run<Project>(c, "yamakan.project.undo", {
    expectedRevision: other.revision,
  });
  const undone = (
    await execute(agent, "yamakan.project.undo", {
      projectId: c.projectId,
      expectedRevision: back.revision,
    })
  ).result as Project;
  assert.equal(
    undone.clips.find((x) => x.id === clipId)!.assetId,
    shownBefore.assetId,
  );
});

// MPR-105, over a project made here: no media is needed, so these run anywhere.
const uid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const V = uid(2);
const A = uid(10); // footage
const B = uid(11); // other footage
const STILL = uid(12);
const SHOT = uid(20);
const STORY = { id: uid(90), contentHash: "c".repeat(64) } as never;
const TAKES = { a: uid(30), b: uid(31), still: uid(32), a2: uid(33) };
const hexOf = (n: number) => String(n).padStart(64, "0");

const canonicalAsset = (id: string, kind: "image" | "video", n: number) => ({
  id,
  name: `m${n}`,
  kind,
  hash: hexOf(n),
  extension: kind === "video" ? ("mp4" as const) : ("png" as const),
  bytes: 10,
  width: 320,
  height: 180,
  durationTicks: kind === "video" ? 300 * FRAME : 0,
  timebase: null,
  hasAudio: kind === "video",
});

const clipAt = (
  n: number,
  start: number,
  length: number,
  assetId: string | null,
  sourceStart = 0,
  more: object = {},
) => ({
  id: uid(n),
  trackId: V,
  assetId,
  startTicks: start * FRAME,
  durationTicks: length * FRAME,
  sourceStartTicks: sourceStart * FRAME,
  title: assetId === null ? "Card" : null,
  gainDb: 0,
  fadeInTicks: 0,
  fadeOutTicks: 0,
  sound:
    assetId === null || assetId === STILL
      ? null
      : { enabled: true, gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0 },
  ...more,
});

// A project whose shot SHOT is shown by these clips, in a story with takes of A, B and a still.
function project(clips: object[], clipIds?: string[]): CanonicalProject {
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: uid(1),
    name: "Takes",
    revision: 4,
    language: "en",
    output: { width: 1280, height: 720, fps: { num: 30, den: 1 } },
    assets: [
      canonicalAsset(A, "video", 1),
      canonicalAsset(B, "video", 2),
      canonicalAsset(STILL, "image", 3),
    ],
    scenes: [
      {
        id: uid(21),
        name: "One",
        referenceAssetId: null,
        camera: { focalLengthMm: 35, shotScale: "wide", movement: "static" },
        shots: [
          {
            id: SHOT,
            name: "Shot",
            clipIds: clipIds ?? clips.map((c) => (c as { id: string }).id),
          },
        ],
      },
    ],
    tracks: [
      {
        id: V,
        name: "V1",
        kind: "video",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
      {
        id: uid(3),
        name: "A1",
        kind: "audio",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
    ],
    clips,
  });
}

type Take = StoryDocument["scenes"][number]["shots"][number]["takes"][number];
function storyOf(takes?: Take[]): StoryDocument {
  return {
    format: "yamakan.story",
    formatVersion: 1,
    title: "One shot",
    scenes: [
      {
        id: uid(21),
        name: "One",
        shots: [
          {
            id: SHOT,
            name: "Shot",
            durationTicks: 60 * FRAME,
            notes: "",
            referencePacks: [],
            takes: takes ?? [
              { id: TAKES.a, assetId: A, sourceStartTicks: 10 * FRAME },
              { id: TAKES.b, assetId: B, sourceStartTicks: 50 * FRAME },
              { id: TAKES.still, assetId: STILL, sourceStartTicks: 0 },
            ],
            selectedTakeId: (takes ?? [{ id: TAKES.a }])[0]!.id,
          },
        ],
      },
    ],
  };
}
const proposeIn = (p: CanonicalProject, takeId: string, story = storyOf()) =>
  proposeReplace(story, STORY, p, p.id, SHOT, takeId);
const reasonOf = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as { code: string; message: string }).message;
  }
  return "accepted";
};

test("a split shot's pieces each keep their place in the new take, in one batch", () => {
  // The shot showed take A from 10: split at 30, so the second piece starts 30 in.
  const p = project([clipAt(101, 30, 30, A, 40), clipAt(100, 0, 30, A, 10)]);
  const made = proposeIn(p, TAKES.b);
  assert.equal(made.formatVersion, 2);
  assert.deepEqual(
    made.mappings.map((m) => [
      m.clipId,
      m.startTicks / FRAME,
      m.durationTicks / FRAME,
      m.takeOffsetTicks / FRAME,
      m.to.assetId,
      m.to.sourceStartTicks / FRAME,
    ]),
    [
      [uid(100), 0, 30, 0, B, 50],
      [uid(101), 30, 30, 30, B, 80],
    ],
    "in timeline order, the first from its start, the second from the split",
  );
  const after = applyBatch(p, replaceOperations(made));
  assert.deepEqual(
    after.clips
      .map((c) => [
        c.id,
        c.startTicks / FRAME,
        c.durationTicks / FRAME,
        c.assetId,
      ])
      .sort(),
    [
      [uid(100), 0, 30, B],
      [uid(101), 30, 30, B],
    ].sort(),
  );
});

test("a clip trimmed at its start maps that far into the new take", () => {
  const p = project([clipAt(100, 12, 20, A, 17)]);
  const made = proposeIn(p, TAKES.b);
  assert.deepEqual(
    [made.mappings.length, made.mappings[0]!.takeOffsetTicks / FRAME],
    [1, 7],
  );
  assert.equal(made.mappings[0]!.to.sourceStartTicks, 57 * FRAME);
});

test("a single untouched clip is proposed as before, with offset 0", () => {
  const p = project([clipAt(100, 0, 60, A, 10)]);
  const made = proposeIn(p, TAKES.b);
  assert.equal(made.mappings.length, 1);
  assert.equal(made.mappings[0]!.takeOffsetTicks, 0);
  assert.equal(made.mappings[0]!.to.sourceStartTicks, 50 * FRAME);
  assert.equal(
    reasonOf(() => proposeIn(p, TAKES.a)),
    "The shot already shows this take.",
  );
});

test("a still as the new take starts every clip at 0; footage after a still runs on across the cuts", () => {
  const split = project([
    clipAt(100, 0, 30, A, 10),
    clipAt(101, 30, 30, A, 40),
  ]);
  const toStill = proposeIn(split, TAKES.still);
  assert.deepEqual(
    toStill.mappings.map((m) => [m.to.sourceStartTicks, m.takeOffsetTicks]),
    [
      [0, 0],
      [0, 0],
    ],
  );
  const still = project([
    clipAt(100, 0, 30, STILL),
    clipAt(101, 30, 25, STILL),
    clipAt(102, 55, 5, STILL),
  ]);
  const fromStill = proposeIn(still, TAKES.b);
  assert.deepEqual(
    fromStill.mappings.map((m) => m.takeOffsetTicks / FRAME),
    [0, 30, 55],
  );
});

test("clips that already show the take at their place are left out", () => {
  // Two takes of different media would be ambiguous; here one piece is B already.
  const p = project([clipAt(100, 0, 30, A, 10), clipAt(101, 30, 30, B, 80)]);
  const made = proposeIn(p, TAKES.b);
  assert.deepEqual(
    made.mappings.map((m) => m.clipId),
    [uid(100)],
  );
});

test("refusals name the clip and change nothing", () => {
  const speed = { speed: { num: 1, den: 2 } };
  const p = project([
    clipAt(100, 0, 30, A, 10),
    clipAt(101, 30, 30, A, 40, speed),
    clipAt(102, 60, 10, A, 70),
  ]);
  const before = JSON.stringify(p);
  assert.equal(
    reasonOf(() => proposeIn(p, TAKES.b)),
    "Clip 2 of 3 of this shot: Reset the clip's speed before replacing its take.",
  );
  assert.equal(JSON.stringify(p), before);
  const short = project([
    clipAt(100, 0, 30, A, 10),
    clipAt(101, 30, 100, A, 200),
  ]);
  assert.equal(
    reasonOf(() => proposeIn(short, TAKES.b)),
    "Clip 2 of 2 of this shot: The take is shorter than the clip.",
  );
  const locked = project([
    clipAt(100, 0, 30, A, 10),
    clipAt(101, 30, 30, A, 40),
  ]);
  locked.tracks[0]!.locked = true;
  assert.equal(
    reasonOf(() => proposeIn(locked, TAKES.b)),
    "Clip 1 of 2 of this shot: Track is locked.",
  );
});

test("what cannot be told is refused: no clip, a split title card, no take, two takes of one medium, too many", () => {
  assert.equal(
    reasonOf(() => proposeIn(project([], []), TAKES.b)),
    "The shot has no clip on the timeline; assemble it again or attach a clip.",
  );
  assert.equal(
    reasonOf(() =>
      proposeIn(
        project([clipAt(100, 0, 30, null), clipAt(101, 30, 30, null)]),
        TAKES.b,
      ),
    ),
    "The shot's title card was split; replace its clips in the editor.",
  );
  // A lone title card is replaced as before.
  assert.equal(
    proposeIn(project([clipAt(100, 0, 60, null)]), TAKES.b).mappings[0]!
      .takeOffsetTicks,
    0,
  );
  // Media no take of the shot uses.
  assert.equal(
    reasonOf(() =>
      proposeIn(
        project([clipAt(100, 0, 60, B, 0)]),
        TAKES.a,
        storyOf([{ id: TAKES.a, assetId: A, sourceStartTicks: 0 }]),
      ),
    ),
    "The shot's clip no longer shows one of this shot's takes; replace it in the editor.",
  );
  const twins = storyOf([
    { id: TAKES.a, assetId: A, sourceStartTicks: 0 },
    { id: TAKES.a2, assetId: A, sourceStartTicks: 90 * FRAME },
    { id: TAKES.b, assetId: B, sourceStartTicks: 0 },
  ]);
  // At a take's own in-point the take is known; elsewhere it cannot be told.
  assert.equal(
    proposeIn(project([clipAt(100, 0, 20, A, 90)]), TAKES.b, twins).mappings[0]!
      .takeOffsetTicks,
    0,
  );
  assert.equal(
    reasonOf(() =>
      proposeIn(project([clipAt(100, 0, 20, A, 95)]), TAKES.b, twins),
    ),
    "Two takes of this shot use the same media, so the clip's place in the take cannot be told; replace it in the editor.",
  );
  const many = project(
    Array.from({ length: 65 }, (_, i) => clipAt(100 + i, i, 1, A, 10 + i)),
  );
  assert.equal(
    reasonOf(() => proposeIn(many, TAKES.b)),
    "The shot is shown by more than 64 clips; replace its takes in the editor.",
  );
});

test("a proposal of an older page parses as version 1 only, and version 2 is bounded", () => {
  const p = project([clipAt(100, 0, 60, A, 10)]);
  const v2 = proposeIn(p, TAKES.b);
  assert.equal(TakeProposalInputSchema.safeParse(v2).success, true);
  const { takeOffsetTicks: _, ...old } = v2.mappings[0]!;
  const v1 = { ...v2, formatVersion: 1, mappings: [old] };
  assert.equal(TakeProposalInputSchema.safeParse(v1).success, true);
  assert.equal(
    TakeProposalInputSchema.safeParse({ ...v2, formatVersion: 3 }).success,
    false,
  );
  assert.equal(
    TakeProposalInputSchema.safeParse({ ...v2, mappings: [] }).success,
    false,
  );
  assert.equal(
    TakeProposalInputSchema.safeParse({
      ...v2,
      mappings: Array.from(
        { length: TAKE_LIMITS.mappings + 1 },
        () => v2.mappings[0],
      ),
    }).success,
    false,
  );
});

test("the list gives each clip's place, the take all of them show, and clips that belong to no shot", () => {
  const loose = clipAt(200, 100, 20, B, 5);
  const p = project(
    [clipAt(100, 0, 30, A, 10), clipAt(101, 30, 30, A, 40), loose],
    [uid(100), uid(101)],
  );
  const list = listTakes(storyOf(), STORY, p);
  const shot = list.shots[0]!;
  assert.equal(shot.timeline!.currentTakeId, TAKES.a);
  assert.deepEqual(
    shot.timeline!.clips.map((c) => [
      c.clipId,
      c.takeId,
      c.takeOffsetTicks! / FRAME,
    ]),
    [
      [uid(100), TAKES.a, 0],
      [uid(101), TAKES.a, 30],
    ],
  );
  assert.equal(list.orphanTotal, 1);
  assert.deepEqual(list.orphans, [
    {
      clipId: uid(200),
      startTicks: 100 * FRAME,
      durationTicks: 20 * FRAME,
      assetId: B,
      candidates: [{ shotId: SHOT, takeId: TAKES.b }],
    },
  ]);
  // Pieces of different takes: no one take is shown.
  const mixed = project([
    clipAt(100, 0, 30, A, 10),
    clipAt(101, 30, 30, B, 50),
  ]);
  assert.equal(
    listTakes(storyOf(), STORY, mixed).shots[0]!.timeline!.currentTakeId,
    null,
  );
  // A shot with no clip says so, and is not on the timeline.
  const none = listTakes(storyOf(), STORY, project([], [])).shots[0]!;
  assert.equal(none.timeline, null);
  assert.match(none.problem!, /has no clip on the timeline/);
});

test("comparing counts how far the shot's clips reach into a take", () => {
  const p = project([clipAt(100, 0, 30, A, 10), clipAt(101, 30, 10, A, 280)]);
  const facts = (takeId: string) =>
    compareTakes(storyOf(), STORY, p, SHOT, [takeId]).takes[0]!;
  // The second piece is 270 frames into take A, so a take of 300 from 50 does not cover it.
  assert.equal(facts(TAKES.b).covers, false);
  assert.equal(
    compareTakes(storyOf(), STORY, project([clipAt(100, 0, 30, A, 10)]), SHOT, [
      TAKES.b,
    ]).takes[0]!.covers,
    true,
  );
});

test("a split shot's take is replaced as one revision, and one undo brings every piece back", async () => {
  const c = await workspace();
  const { documentId, t, shots } = await assembled(c);
  const clip = await clipOf(c, shots[0].id);
  const second = id();
  await run(c, "yamakan.project.applyBatch", {
    expectedRevision: (await head(c)).revision,
    operations: [
      {
        type: "clip.split",
        clipId: clip.id,
        atTicks: 10 * FRAME,
        newClipId: second,
      },
    ],
  });
  const before = await exported(c);
  const proposal = await propose(c, documentId, shots[0].id, t.b1);
  assert.equal(proposal.mappings.length, 2);
  const revision = (await head(c)).revision;
  const applied = await apply(c, proposal);
  assert.equal(applied.revision, revision + 1, "one revision");
  const after = await exported(c);
  assert.deepEqual(
    proposal.mappings.map((m) => m.to.assetId),
    [c.imported.b.id, c.imported.b.id],
  );
  for (const m of proposal.mappings) {
    const x = after.clips.find((y) => y.id === m.clipId)!;
    assert.equal(x.assetId, c.imported.b.id);
    assert.equal(x.sourceStartTicks, m.to.sourceStartTicks);
    assert.equal(x.startTicks, m.startTicks);
  }
  const undone = await run<Project>(c, "yamakan.project.undo", {
    expectedRevision: applied.revision,
  });
  assert.ok(undone.revision > applied.revision);
  assert.deepEqual((await exported(c)).clips, before.clips);
  // A proposal made by an older page is refused in words and changes nothing.
  const { takeOffsetTicks: _, ...old } = proposal.mappings[0]!;
  assert.match(
    await message(
      run(c, "yamakan.take.apply", {
        expectedRevision: (await head(c)).revision,
        proposal: { ...proposal, formatVersion: 1, mappings: [old] },
      }),
    ),
    /older page; propose it again/,
  );
  assert.equal(
    await code(
      run(c, "yamakan.take.apply", {
        expectedRevision: (await head(c)).revision,
        proposal: { ...proposal, formatVersion: 1, mappings: [old] },
      }),
    ),
    "REVISION_CONFLICT",
  );
});
