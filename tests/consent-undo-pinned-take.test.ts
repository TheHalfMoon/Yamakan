// MPR-010: after a person's consent is revoked, a take made with that person's references does
// not return to the timeline by undo, redo, placing or restore. Two kinds of take: one whose
// shot pins a reference pack linked to the consent, and one whose lineage inputs are media a
// pack links to it. Controls: what is already on the timeline stays, and takes with no link to
// the revoked consent behave as before. The helpers are copied from tests/story-packs.test.ts.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";
import { DatabaseSync } from "node:sqlite";
import { assertPlacementConsent } from "../core/continuity.ts";
import { sha256Hex } from "../core/hash/canonical.ts";
import type { Project } from "../core/project.ts";
import type { ReferencePack, StoryDocument } from "../core/story.ts";

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
const REVOKED = /^VALIDATION: This person's consent was revoked/;

function ffmpeg(args: string[]) {
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-undo-take-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Undo takes" })
  ).result as Project;
  const footage = path.join(root, "footage.mp4");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=30:duration=3",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    footage,
  ]);
  const still = path.join(root, "still.png");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180",
    "-frames:v",
    "1",
    still,
  ]);
  const imported = {} as Record<"footage" | "still", Project["assets"][number]>;
  for (const [key, file, name] of [
    ["footage", footage, "footage.mp4"],
    ["still", still, "still.png"],
  ] as const)
    imported[key] = (
      await store.importAsset(project.id, name, await readFile(file))
    ).asset;
  return { root, store, queue, browser, projectId: project.id, imported };
}

type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = async (c: Ctx) => c.store.load(c.projectId);

async function grant(
  c: Ctx,
  ttlMs = 24 * 60 * 60 * 1000,
  characterId = "lead",
) {
  return (
    await execute(c.browser, "yamakan.consent.grant", {
      characterId,
      purpose: "likeness-generate",
      version: "v1",
      ttlMs,
    })
  ).result as { id: string };
}

// The still is the person's picture, linked to their consent.
const pack = (c: Ctx, consentId: string): ReferencePack => ({
  format: "yamakan.reference-pack",
  formatVersion: 1,
  name: "Lead and alley",
  entries: [
    {
      id: id(),
      role: "character",
      label: "Lead, front",
      assetId: c.imported.still.id,
      assetHash: c.imported.still.hash,
      characterId: "lead",
      consentId,
    },
  ],
});

async function savePack(
  c: Ctx,
  documentId: string,
  content: ReferencePack,
  previous: string | null = null,
) {
  const result = (
    await execute(c.browser, "yamakan.pack.save", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: previous,
      pack: content,
    })
  ).result as { document: { contentHash: string } };
  return result.document.contentHash;
}

type Kind = "pin" | "inputs" | "none";

// One footage take, pinned, made from the still, or with no link at all, beside a title card.
function story(
  c: Ctx,
  kind: Kind,
  pin: { documentId: string; contentHash: string },
): StoryDocument {
  const take = id();
  return {
    format: "yamakan.story",
    formatVersion: 2,
    title: "Night walk",
    scenes: [
      {
        id: id(),
        name: "Alley",
        shots: [
          {
            id: id(),
            name: "Wide on the alley",
            durationTicks: 30 * FRAME,
            notes: "A take made with the lead.",
            referencePacks: kind === "pin" ? [pin] : [],
            takes: [
              {
                id: take,
                assetId: c.imported.footage.id,
                sourceStartTicks: 0,
                ...(kind === "inputs"
                  ? {
                      lineage: {
                        outputHash: c.imported.footage.hash,
                        inputs: [
                          {
                            assetId: c.imported.still.id,
                            assetHash: c.imported.still.hash,
                          },
                        ],
                      },
                    }
                  : {}),
              },
            ],
            selectedTakeId: take,
          },
        ],
      },
    ],
  };
}

// A workspace with the take placed and then taken off, so that putting it back is a new use.
async function scene(kind: Kind, ttlMs?: number) {
  const c = await workspace();
  const consent = await grant(c, ttlMs);
  const packId = id();
  const storyId = id();
  const packHash = await savePack(c, packId, pack(c, consent.id));
  await execute(c.browser, "yamakan.story.save", {
    projectId: c.projectId,
    expectedRevision: (await head(c)).revision,
    documentId: storyId,
    expectedContentHash: null,
    story: story(c, kind, { documentId: packId, contentHash: packHash }),
  });
  const assemble = async () =>
    (
      await execute(c.browser, "yamakan.story.assemble", {
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        documentId: storyId,
        trackId: (await head(c)).tracks.find((t) => t.kind === "video")!.id,
      })
    ).result as Project;
  const edit = async (operations: object[], as: unknown = c.browser) =>
    (
      await execute(as as typeof c.browser, "yamakan.project.applyBatch", {
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        operations,
      })
    ).result as Project;
  const placed = await assemble();
  const clip = placed.clips.find((x) => x.assetId === c.imported.footage.id)!;
  const track = clip.trackId;
  const add = (assetId = clip.assetId!, startFrame = 100) => ({
    type: "clip.add",
    clipId: id(),
    trackId: track,
    assetId,
    title: null,
    startTicks: startFrame * FRAME,
    durationTicks: FRAME,
    sourceStartTicks: 0,
  });
  const undo = async (as: unknown = c.browser) =>
    execute(as as typeof c.browser, "yamakan.project.undo", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
    });
  const redo = async () =>
    execute(c.browser, "yamakan.project.redo", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
    });
  const restore = async (revision: number) =>
    execute(c.browser, "yamakan.project.restore", {
      projectId: c.projectId,
      revision,
      expectedHeadFingerprint: (
        (
          await execute(c.browser, "yamakan.project.history", {
            projectId: c.projectId,
            limit: 20,
          })
        ).result as { headFingerprint: string }
      ).headFingerprint,
    });
  return {
    c,
    consent,
    packId,
    packHash,
    storyId,
    placed,
    clip,
    track,
    add,
    edit,
    undo,
    redo,
    restore,
  };
}

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return `${(e as { code?: string }).code}: ${(e as Error).message}`;
  }
  return "accepted";
};

for (const kind of ["pin", "inputs"] as const) {
  const what =
    kind === "pin"
      ? "a take in a shot that pins a pack linked to a revoked consent"
      : "a take whose lineage inputs are linked to a revoked consent";

  test(`${what} cannot return by placing, swapping media or restore`, async () => {
    const s = await scene(kind);
    const { c } = s;
    const removed = await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
    // Something else on the timeline, so a media swap has a clip to swap: the person's own
    // picture goes on while the consent stands.
    const other = id();
    await s.edit([{ ...s.add(c.imported.still.id, 200), clipId: other }]);
    const before = await head(c);
    await execute(c.browser, "yamakan.consent.revoke", {
      consentId: s.consent.id,
    });
    const refused = async (p: Promise<unknown>, label: string) => {
      const message = await failure(p);
      assert.match(message, REVOKED, label);
      // It gives away nothing: no path, no hash and no consent id.
      for (const secret of [
        c.root,
        c.imported.footage.hash,
        c.imported.still.hash,
        s.consent.id,
      ])
        assert.equal(message.includes(secret), false, label);
      const now = await head(c);
      assert.equal(now.revision, before.revision, `${label}: the head moved`);
      assert.deepEqual(now.clips, before.clips, `${label}: the clips changed`);
    };
    await refused(s.edit([s.add()]), "placing it directly");
    await refused(
      s.edit([
        {
          type: "clip.replaceMedia",
          clipId: other,
          assetId: s.clip.assetId!,
          sourceStartTicks: 0,
        },
      ]),
      "swapping a clip's media for it",
    );
    await refused(
      s.restore(s.placed.revision),
      "restoring a revision that showed it",
    );
    assert.ok(removed.revision < before.revision);
    // An agent with write access gets the same answer as a person.
    const agent = {
      ...c.browser,
      principal: {
        id: "agent:undo-test" as const,
        scopes: new Set<Scope>(["project:read", "project:write"]),
      },
    };
    await refused(s.edit([s.add()], agent), "an agent placing it");
  });

  test(`${what} cannot come back through undo or redo`, async () => {
    const s = await scene(kind);
    const { c } = s;
    const removed = await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
    await execute(c.browser, "yamakan.consent.revoke", {
      consentId: s.consent.id,
    });
    for (const attempt of ["first", "second"]) {
      assert.match(await failure(s.undo()), REVOKED, attempt);
      assert.equal((await head(c)).revision, removed.revision, attempt);
    }
    // Redo: an undo taken before the revocation puts the clip away; redo would bring it back.
    const r = await scene(kind);
    await r.undo();
    const undone = await head(r.c);
    assert.equal(
      undone.clips.some((x) => x.id === r.clip.id),
      false,
    );
    await execute(r.c.browser, "yamakan.consent.revoke", {
      consentId: r.consent.id,
    });
    assert.match(await failure(r.redo()), REVOKED, "redo");
    assert.equal((await head(r.c)).revision, undone.revision);
  });
}

test("control: a clip on the timeline at revocation stays and can be moved and split", async () => {
  const s = await scene("pin");
  await execute(s.c.browser, "yamakan.consent.revoke", {
    consentId: s.consent.id,
  });
  assert.ok((await head(s.c)).clips.some((x) => x.id === s.clip.id));
  await s.edit([
    { type: "clip.move", clipId: s.clip.id, startTicks: 60 * FRAME },
  ]);
  await s.edit([
    {
      type: "clip.split",
      clipId: s.clip.id,
      atTicks: 75 * FRAME,
      newClipId: id(),
    },
  ]);
  assert.equal(
    (await head(s.c)).clips.filter((x) => x.assetId === s.clip.assetId).length,
    2,
  );
});

test("control: a take with no pin and no linked input returns through undo", async () => {
  const s = await scene("none");
  await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
  await execute(s.c.browser, "yamakan.consent.revoke", {
    consentId: s.consent.id,
  });
  await s.undo();
  assert.ok((await head(s.c)).clips.some((x) => x.id === s.clip.id));
});

test("control: revoking another person's consent refuses nothing for the take", async () => {
  const s = await scene("pin");
  const stranger = await grant(s.c, undefined, "stranger");
  await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
  await execute(s.c.browser, "yamakan.consent.revoke", {
    consentId: stranger.id,
  });
  await s.undo();
  assert.ok((await head(s.c)).clips.some((x) => x.id === s.clip.id));
});

test("control: an expired consent that was not revoked does not block a return", async (t) => {
  const s = await scene("pin", 60_000);
  await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
  const realNow = Date.now;
  const clock = t.mock.method(Date, "now", () => realNow() + 10 * 60_000);
  await s.undo();
  clock.mock.restore();
  assert.ok((await head(s.c)).clips.some((x) => x.id === s.clip.id));
});

test("control: a newer consent, saved in a pack version with the story, lets the take be placed again", async () => {
  const s = await scene("pin");
  const { c } = s;
  await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
  await execute(c.browser, "yamakan.consent.revoke", {
    consentId: s.consent.id,
  });
  assert.match(await failure(s.edit([s.add()])), REVOKED);
  const renewed = await grant(c);
  const packHash = await savePack(c, s.packId, pack(c, renewed.id), s.packHash);
  const current = c.store.getDocument(c.projectId, s.storyId);
  await execute(c.browser, "yamakan.story.save", {
    projectId: c.projectId,
    expectedRevision: (await head(c)).revision,
    documentId: s.storyId,
    expectedContentHash: current.ref.contentHash,
    story: story(c, "pin", { documentId: s.packId, contentHash: packHash }),
  });
  await s.edit([s.add()]);
  assert.ok((await head(c)).clips.some((x) => x.assetId === s.clip.assetId));
});

// The commit point itself, over a database made here: no media is needed, so these run anywhere.
const PROJECT = "11111111-1111-4111-8111-111111111111";
const hex = (n: number) => String(n).padStart(64, "0");
const FILE = hex(7); // the take's own file
const PERSON = hex(8); // the person's picture a pack links to the consent
const CONSENT = "22222222-2222-4222-8222-222222222222";
const TAKE_ASSET = "33333333-3333-4333-8333-333333333333";
const PERSON_ASSET = "44444444-4444-4444-8444-444444444444";
const FRESH_ASSET = "55555555-5555-4555-8555-555555555555";
const OTHER = hex(9); // a file no take is made of
const OTHER_ASSET = "99999999-9999-4999-8999-999999999999";

function commitPoint(
  kind: "pin" | "inputs",
  opts: {
    revoked?: boolean;
    // Also a later story version, which no longer has the pin or inputs.
    laterVersionClean?: boolean;
    pack?: "ok" | "missing" | "damaged";
    epoch?: number;
  } = {},
) {
  const db = new DatabaseSync(":memory:");
  db.exec(`

    CREATE TABLE asset_versions(version_id TEXT, project_id TEXT, digest TEXT);
    CREATE TABLE creative_documents(hash TEXT, kind TEXT, bytes BLOB);
    CREATE TABLE story_document_versions(project_id TEXT, document_id TEXT, content_hash TEXT);
    CREATE TABLE likeness_consents(id TEXT, character_id TEXT, purpose TEXT, version TEXT, granted_at INTEGER, expires_at INTEGER, grantor_principal_id TEXT, epoch INTEGER);
    CREATE TABLE consent_revocations(consent_id TEXT, revoked_at INTEGER);
    CREATE TABLE consent_revalidations(consent_id TEXT, epoch INTEGER);
    CREATE TABLE director_epoch(singleton INTEGER, value INTEGER);
  `);
  const store = (value: unknown, kindOf: string) => {
    const bytes = Buffer.from(JSON.stringify(value));
    const hash = sha256Hex(bytes);
    db.prepare("INSERT INTO creative_documents VALUES (?, ?, ?)").run(
      hash,
      kindOf,
      bytes,
    );
    return hash;
  };
  const pack = {
    format: "yamakan.reference-pack",
    formatVersion: 1,
    name: "Lead",
    entries: [
      {
        id: id(),
        role: "character",
        label: "Lead",
        assetId: PERSON_ASSET,
        assetHash: PERSON,
        characterId: "lead",
        consentId: CONSENT,
      },
    ],
  };
  const packDocument = "66666666-6666-4666-8666-666666666666";
  const packHash = store(pack, "referencePack");
  db.prepare("INSERT INTO story_document_versions VALUES (?, ?, ?)").run(
    PROJECT,
    packDocument,
    packHash,
  );
  if (opts.pack === "missing")
    db.prepare("DELETE FROM creative_documents WHERE hash = ?").run(packHash);
  if (opts.pack === "damaged")
    db.prepare("UPDATE creative_documents SET bytes = ? WHERE hash = ?").run(
      Buffer.from("not the pack"),
      packHash,
    );
  const takeId = "77777777-7777-4777-8777-777777777777";
  const storyOf = (title: string) => ({
    format: "yamakan.story",
    formatVersion: 1,
    title,
    scenes: [
      {
        id: id(),
        name: "One",
        shots: [
          {
            id: id(),
            name: "Shot",
            durationTicks: 30 * FRAME,
            notes: "",
            referencePacks:
              kind === "pin"
                ? [{ documentId: packDocument, contentHash: packHash }]
                : [],
            takes: [
              {
                id: takeId,
                assetId: TAKE_ASSET,
                sourceStartTicks: 0,
                ...(kind === "inputs"
                  ? {
                      lineage: {
                        outputHash: FILE,
                        inputs: [{ assetId: PERSON_ASSET, assetHash: PERSON }],
                      },
                    }
                  : {}),
              },
            ],
            selectedTakeId: takeId,
          },
        ],
      },
    ],
  });
  const storyHash = store(storyOf("Takes"), "story");
  db.prepare("INSERT INTO story_document_versions VALUES (?, ?, ?)").run(
    PROJECT,
    "88888888-8888-4888-8888-888888888888",
    storyHash,
  );
  if (opts.laterVersionClean) {
    const clean = storyOf("Takes, later");
    const shot = clean.scenes[0].shots[0];
    shot.referencePacks = [];
    delete (shot.takes[0] as { lineage?: unknown }).lineage;
    db.prepare("INSERT INTO story_document_versions VALUES (?, ?, ?)").run(
      PROJECT,
      "88888888-8888-4888-8888-888888888888",
      store(clean, "story"),
    );
  }
  // The asset that the take names, kept as a version after the timeline has lost it.
  db.prepare("INSERT INTO asset_versions VALUES (?, ?, ?)").run(
    TAKE_ASSET,
    PROJECT,
    FILE,
  );
  db.prepare(
    "INSERT INTO likeness_consents VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    CONSENT,
    "lead",
    "likeness-generate",
    "v1",
    1,
    9_999_999_999_999,
    "browser-ui",
    opts.epoch ?? 1,
  );
  db.prepare("INSERT INTO director_epoch VALUES (1, 1)").run();
  if (opts.revoked !== false)
    db.prepare("INSERT INTO consent_revocations VALUES (?, 2)").run(CONSENT);
  const track = { id: "t", kind: "video", muted: false, solo: false };
  const placed = (
    clips: { assetId: string; ticks: number }[],
    ids: string[],
  ) => ({
    assets: ids.map((x) => ({
      id: x,
      hash: x === PERSON_ASSET ? PERSON : x === OTHER_ASSET ? OTHER : FILE,
      kind: "video",
    })),
    tracks: [track],
    clips: clips.map((c) => ({
      trackId: "t",
      assetId: c.assetId,
      durationTicks: c.ticks,
      sound: null,
    })),
  });
  const check = (
    before: ReturnType<typeof placed> | null,
    after: ReturnType<typeof placed>,
  ) =>
    assertPlacementConsent(
      {
        db,
        projectId: PROJECT,
        project: after as never,
        held: () => true,
        nowMs: 5,
      },
      before,
      after,
    );
  return { db, check, placed };
}

for (const kind of ["pin", "inputs"] as const) {
  test(`commit point (${kind}): a re-import of the file after a restore dropped the asset is refused`, () => {
    const { check, placed } = commitPoint(kind);
    // The restore left neither the old asset nor the take's clip; the bytes came back as another asset.
    assert.throws(
      () =>
        check(
          placed([], []),
          placed([{ assetId: FRESH_ASSET, ticks: 30 }], [FRESH_ASSET]),
        ),
      /This person's consent was revoked/,
    );
  });

  test(`commit point (${kind}): a second copy and a longer clip are new uses, a split or move is not`, () => {
    const { check, placed } = commitPoint(kind);
    const one = [{ assetId: TAKE_ASSET, ticks: 30 }];
    const at = placed(one, [TAKE_ASSET]);
    assert.throws(
      () =>
        check(
          at,
          placed([...one, { assetId: TAKE_ASSET, ticks: 10 }], [TAKE_ASSET]),
        ),
      /This person's consent was revoked/,
      "a second copy",
    );
    assert.throws(
      () =>
        check(at, placed([{ assetId: TAKE_ASSET, ticks: 31 }], [TAKE_ASSET])),
      /This person's consent was revoked/,
      "a longer clip",
    );
    // Split or moved: the same total time, nothing new.
    check(
      at,
      placed(
        [
          { assetId: TAKE_ASSET, ticks: 12 },
          { assetId: TAKE_ASSET, ticks: 18 },
        ],
        [TAKE_ASSET],
      ),
    );
    check(at, placed([{ assetId: TAKE_ASSET, ticks: 20 }], [TAKE_ASSET]));
  });

  test(`commit point (${kind}): an unrevoked consent of an earlier epoch is refused until revalidated`, () => {
    const { check, placed, db } = commitPoint(kind, {
      revoked: false,
      epoch: 0,
    });
    const after = placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]);
    assert.throws(() => check(placed([], []), after), /must be revalidated/);
    db.prepare("INSERT INTO consent_revalidations VALUES (?, 1)").run(CONSENT);
    check(placed([], []), after);
  });

  test(`commit point (${kind}): a commit that adds nothing reads no story`, () => {
    const { check, placed, db } = commitPoint(kind);
    // With the story versions gone, anything that read them would throw.
    db.exec("DROP TABLE story_document_versions");
    const at = placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]);
    check(at, placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]));
    check(at, placed([{ assetId: TAKE_ASSET, ticks: 5 }], [TAKE_ASSET]));
  });
}

test("commit point: a pinned pack that is missing or damaged refuses the take, and names the pack", () => {
  for (const pack of ["missing", "damaged"] as const) {
    const { check, placed } = commitPoint("pin", { pack });
    const after = placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]);
    assert.throws(
      () => check(placed([], []), after),
      /reference pack a take is pinned to/,
    );
    // Any other file, and a commit that adds nothing, are not held up.
    check(after, after);
    check(
      placed([], []),
      placed([{ assetId: OTHER_ASSET, ticks: 30 }], [OTHER_ASSET]),
    );
  }
});

test("commit point: with the consent in force the take places; after a revocation a file with no linked take is not affected", () => {
  for (const kind of ["pin", "inputs"] as const) {
    const revoked = commitPoint(kind);
    revoked.check(
      revoked.placed([], []),
      revoked.placed([{ assetId: OTHER_ASSET, ticks: 30 }], [OTHER_ASSET]),
    );
    const { check, placed } = commitPoint(kind, { revoked: false });
    check(
      placed([], []),
      placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]),
    );
  }
});

test("commit point: a past story version counts after a later one drops the pin or the inputs", () => {
  for (const kind of ["pin", "inputs"] as const) {
    const { check, placed } = commitPoint(kind, { laterVersionClean: true });
    assert.throws(
      () =>
        check(
          placed([], []),
          placed([{ assetId: TAKE_ASSET, ticks: 30 }], [TAKE_ASSET]),
        ),
      /This person's consent was revoked/,
    );
  }
});
