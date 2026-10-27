// YU-031: story documents and reference packs. A three-shot manual
// storyboard (footage, a still, and a shot without a take) assembles onto
// the timeline and reopens with its references and timings; missing media,
// revoked consent, duplicate ids and unsupported references are refused.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { fromEditView } from "../core/canonical.ts";
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
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};

function ffmpeg(args: string[]) {
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
}

async function workspace(frameRate?: { num: number; den: number }) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-story-"));
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
    await execute(browser, "yamakan.project.create", {
      name: "Storyboard",
      ...(frameRate ? { frameRate } : {}),
    })
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
  const tone = path.join(root, "tone.wav");
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=1", tone]);
  const imported = {} as Record<
    "footage" | "still" | "tone",
    Project["assets"][number]
  >;
  for (const [key, file, name] of [
    ["footage", footage, "footage.mp4"],
    ["still", still, "still.png"],
    ["tone", tone, "tone.wav"],
  ] as const)
    imported[key] = (
      await store.importAsset(project.id, name, await readFile(file))
    ).asset;
  return { root, store, queue, browser, projectId: project.id, imported };
}

type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = async (c: Ctx) => c.store.load(c.projectId);

async function grant(c: Ctx, characterId = "lead") {
  return (
    await execute(c.browser, "yamakan.consent.grant", {
      characterId,
      purpose: "likeness-generate",
      version: "v1",
      ttlMs: 24 * 60 * 60 * 1000,
    })
  ).result as { id: string };
}

function pack(c: Ctx, consentId: string): ReferencePack {
  return {
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
      {
        id: id(),
        role: "environment",
        label: "Alley",
        assetId: c.imported.footage.id,
        assetHash: c.imported.footage.hash,
        characterId: null,
        consentId: null,
      },
    ],
  };
}

async function savePack(c: Ctx, documentId: string, content: ReferencePack) {
  const result = (
    await execute(c.browser, "yamakan.pack.save", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: null,
      pack: content,
    })
  ).result as { document: { contentHash: string } };
  return result.document.contentHash;
}

function story(
  c: Ctx,
  pin: { documentId: string; contentHash: string } | null,
): StoryDocument {
  const takeA = id(),
    takeB = id();
  return {
    format: "yamakan.story",
    formatVersion: 1,
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
            notes: "Footage take, from 0.5 s into the source.",
            referencePacks: pin ? [pin] : [],
            takes: [
              {
                id: takeA,
                assetId: c.imported.footage.id,
                sourceStartTicks: 15 * FRAME,
              },
            ],
            selectedTakeId: takeA,
          },
          {
            id: id(),
            name: "Close on the lead",
            durationTicks: 60 * FRAME,
            notes: "An imported still stands in for the shot.",
            referencePacks: [],
            takes: [
              { id: takeB, assetId: c.imported.still.id, sourceStartTicks: 0 },
            ],
            selectedTakeId: takeB,
          },
          {
            id: id(),
            name: "She turns the corner",
            durationTicks: 45 * FRAME,
            notes: "No take yet: a title card holds its place.",
            referencePacks: [],
            takes: [],
            selectedTakeId: null,
          },
        ],
      },
    ],
  };
}

async function saveStory(c: Ctx, documentId: string, content: StoryDocument) {
  return execute(c.browser, "yamakan.story.save", {
    projectId: c.projectId,
    expectedRevision: (await head(c)).revision,
    documentId,
    expectedContentHash: null,
    story: content,
  });
}

test("a three-shot manual storyboard assembles onto the timeline and reopens with its references and timings", async () => {
  const c = await workspace();
  const consent = await grant(c);
  const packId = id(),
    storyId = id();
  const packHash = await savePack(c, packId, pack(c, consent.id));
  const board = story(c, { documentId: packId, contentHash: packHash });
  await saveStory(c, storyId, board);
  const before = await head(c);
  const track = before.tracks.find((t) => t.kind === "video")!;
  const assembled = (
    await execute(c.browser, "yamakan.story.assemble", {
      projectId: c.projectId,
      expectedRevision: before.revision,
      documentId: storyId,
      trackId: track.id,
    })
  ).result as Project;
  const shots = board.scenes[0].shots;
  const expected = [
    [0, 30, c.imported.footage.id, null, 15],
    [30, 60, c.imported.still.id, null, 0],
    [90, 45, null, "She turns the corner", 0],
  ];
  const check = (p: Project) => {
    const canonical = fromEditView(p);
    const scene = canonical.scenes.find((s) => s.id === board.scenes[0].id)!;
    assert.deepEqual(
      scene.shots.map((s) => [s.id, s.name]),
      shots.map((s) => [s.id, s.name]),
    );
    const placed = scene.shots.map((s) =>
      canonical.clips.find((x) => x.id === s.clipIds[0])!,
    );
    assert.deepEqual(
      placed.map((x) => [
        x.startTicks / FRAME,
        x.durationTicks / FRAME,
        x.assetId,
        x.title,
        x.sourceStartTicks / FRAME,
      ]),
      expected,
    );
    assert.ok(placed.every((x) => x.trackId === track.id));
  };
  check(assembled);
  // A second assembly would duplicate the shots: refused.
  assert.equal(
    await code(
      execute(c.browser, "yamakan.story.assemble", {
        projectId: c.projectId,
        expectedRevision: assembled.revision,
        documentId: storyId,
        trackId: track.id,
      }),
    ),
    "VALIDATION",
  );
  // Reopen the workspace: the story, its pinned pack and the timeline keep
  // their ids, references and timings.
  await c.queue.close();
  c.store.close();
  const reopened = new ProjectStore(c.root);
  handles.push(reopened);
  await reopened.initialize();
  check(await reopened.load(c.projectId));
  const savedStory = reopened.getDocument(c.projectId, storyId);
  assert.equal(savedStory.ref.kind, "story");
  assert.deepEqual(JSON.parse(savedStory.bytes.toString("utf8")), board);
  const savedPack = reopened.getDocument(c.projectId, packId);
  assert.equal(savedPack.ref.contentHash, packHash);
  const reopenedPack = JSON.parse(
    savedPack.bytes.toString("utf8"),
  ) as ReferencePack;
  assert.deepEqual(
    reopenedPack.entries.map((e) => [
      e.role,
      e.assetId,
      e.assetHash,
      e.consentId,
    ]),
    [
      ["character", c.imported.still.id, c.imported.still.hash, consent.id],
      ["environment", c.imported.footage.id, c.imported.footage.hash, null],
    ],
  );
  const pinned = JSON.parse(savedStory.bytes.toString("utf8")) as StoryDocument;
  assert.deepEqual(pinned.scenes[0].shots[0].referencePacks, [
    { documentId: packId, contentHash: packHash },
  ]);
});

test("missing media, unsupported references, duplicate ids and unheld packs are refused", async () => {
  const c = await workspace();
  const board = story(c, null);
  const missing = structuredClone(board);
  missing.scenes[0].shots[0].takes[0].assetId = id();
  assert.equal(await code(saveStory(c, id(), missing)), "VALIDATION");
  const audio = structuredClone(board);
  audio.scenes[0].shots[0].takes[0].assetId = c.imported.tone.id;
  assert.equal(await code(saveStory(c, id(), audio)), "VALIDATION");
  const duplicate = structuredClone(board);
  duplicate.scenes[0].shots[1].id = duplicate.scenes[0].shots[0].id;
  assert.equal(await code(saveStory(c, id(), duplicate)), "VALIDATION");
  const strayTake = structuredClone(board);
  strayTake.scenes[0].shots[2].selectedTakeId = id();
  assert.equal(await code(saveStory(c, id(), strayTake)), "VALIDATION");
  const pastSource = structuredClone(board);
  pastSource.scenes[0].shots[0].takes[0].sourceStartTicks = 80 * FRAME;
  assert.equal(await code(saveStory(c, id(), pastSource)), "VALIDATION");
  // A pin to a pack this project never held.
  const unheld = story(c, { documentId: id(), contentHash: "a".repeat(64) });
  assert.equal(await code(saveStory(c, id(), unheld)), "VALIDATION");
  // Pack entries: audio, a changed media version, and a likeness without
  // consent are refused.
  const consent = await grant(c);
  const good = pack(c, consent.id);
  const audioRef = structuredClone(good);
  audioRef.entries[1].assetId = c.imported.tone.id;
  audioRef.entries[1].assetHash = c.imported.tone.hash;
  const staleVersion = structuredClone(good);
  staleVersion.entries[1].assetHash = "b".repeat(64);
  const noConsent = structuredClone(good);
  noConsent.entries[0].consentId = null;
  const otherCharacter = structuredClone(good);
  otherCharacter.entries[0].characterId = "someone-else";
  for (const bad of [audioRef, staleVersion, noConsent, otherCharacter])
    assert.equal(await code(savePack(c, id(), bad)), "VALIDATION");
  // The generic document commit cannot write a story or pack.
  assert.equal(
    await code(
      execute(c.browser, "yamakan.document.commit", {
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        documentId: id(),
        kind: "story",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: "c".repeat(64) },
      }),
    ),
    "VALIDATION",
  );
  // Nothing above was committed.
  assert.deepEqual(c.store.listDocuments(c.projectId), []);
});

test("a revoked consent refuses the pack and the assembly of a story pinning it", async () => {
  const c = await workspace();
  const consent = await grant(c);
  const packId = id(),
    storyId = id();
  const packHash = await savePack(c, packId, pack(c, consent.id));
  await saveStory(
    c,
    storyId,
    story(c, { documentId: packId, contentHash: packHash }),
  );
  await execute(c.browser, "yamakan.consent.revoke", { consentId: consent.id });
  // Saving the same pack again, or a story pinning it, is refused.
  assert.equal(
    await code(savePack(c, id(), pack(c, consent.id))),
    "VALIDATION",
  );
  assert.equal(
    await code(
      saveStory(
        c,
        id(),
        story(c, { documentId: packId, contentHash: packHash }),
      ),
    ),
    "VALIDATION",
  );
  const now = await head(c);
  assert.equal(
    await code(
      execute(c.browser, "yamakan.story.assemble", {
        projectId: c.projectId,
        expectedRevision: now.revision,
        documentId: storyId,
        trackId: now.tracks.find((t) => t.kind === "video")!.id,
      }),
    ),
    "VALIDATION",
  );
  // The timeline is unchanged, and a revoked consent cannot be restored by
  // revalidation: the consent ledger is not artistic history.
  assert.equal((await head(c)).clips.length, 0);
  const regranted = await code(
    execute(c.browser, "yamakan.consent.revalidate", { consentId: consent.id }),
  );
  assert.equal(regranted, "VALIDATION");
});

test("agents save packs without likeness links, and limits and the off switch hold", async () => {
  const c = await workspace();
  const created = (
    await execute(c.browser, "yamakan.agent.create", {
      scopes: ["project:read", "project:write"],
    })
  ).result as { token: string };
  const agent = {
    store: c.store,
    queue: c.queue,
    principal: c.store.principalForAgentToken(created.token)!,
  };
  const consent = await grant(c);
  const withLikeness = pack(c, consent.id);
  const agentSave = (content: ReferencePack) =>
    head(c).then((h) =>
      execute(agent, "yamakan.pack.save", {
        projectId: c.projectId,
        expectedRevision: h.revision,
        documentId: id(),
        expectedContentHash: null,
        pack: content,
      }),
    );
  assert.equal(await code(agentSave(withLikeness)), "SCOPE_DENIED");
  const plain = { ...withLikeness, entries: [withLikeness.entries[1]] };
  assert.equal(await code(agentSave(plain)), "ok");
  // Over the 256 KiB story ceiling: refused before anything is stored.
  const big = story(c, null);
  const shot = big.scenes[0].shots[2];
  big.scenes = Array.from({ length: 2 }, () => ({
    id: id(),
    name: "Scene",
    shots: Array.from({ length: 75 }, () => ({
      ...structuredClone(shot),
      id: id(),
      notes: "x".repeat(2_000),
    })),
  }));
  assert.equal(await code(saveStory(c, id(), big)), "LIMIT_EXCEEDED");
  // More shots than one timeline holds: refused by the schema.
  const many = story(c, null);
  many.scenes[0].shots = [];
  many.scenes = Array.from({ length: 3 }, () => ({
    id: id(),
    name: "Scene",
    shots: Array.from({ length: 70 }, () => ({
      ...structuredClone(shot),
      id: id(),
    })),
  }));
  assert.equal(await code(saveStory(c, id(), many)), "VALIDATION");
  // The AG-DOCS off switch turns story writes off.
  process.env.YAMAKAN_AG_DOCS_OFF = "1";
  try {
    assert.equal(
      await code(saveStory(c, id(), story(c, null))),
      "CAPABILITY_UNAVAILABLE",
    );
  } finally {
    delete process.env.YAMAKAN_AG_DOCS_OFF;
  }
});

test("timings are on the project's frames at 24000/1001, and a long story assembles in one revision", async () => {
  const c = await workspace({ num: 24000, den: 1001 });
  const NTSC = 29_429_400; // flicks per 24000/1001 frame
  const card = (durationTicks: number) => ({
    id: id(),
    name: "Card",
    durationTicks,
    notes: "",
    referencePacks: [],
    takes: [],
    selectedTakeId: null,
  });
  const board = (shots: ReturnType<typeof card>[]): StoryDocument => ({
    format: "yamakan.story",
    formatVersion: 1,
    title: "Long",
    scenes: [
      { id: id(), name: "One", shots: shots.slice(0, 100) },
      { id: id(), name: "Two", shots: shots.slice(100) },
    ],
  });
  // One second is 23.976 frames: refused when saved, not at assembly.
  assert.equal(
    await code(saveStory(c, id(), board([card(705_600_000)]))),
    "VALIDATION",
  );
  const offTake = story(c, null);
  offTake.scenes[0].shots[0].durationTicks = 24 * NTSC;
  offTake.scenes[0].shots[0].takes[0].sourceStartTicks = 1;
  assert.equal(await code(saveStory(c, id(), offTake)), "VALIDATION");
  // 200 shots of one frame each: 403 operations, one revision.
  const storyId = id();
  await saveStory(
    c,
    storyId,
    board(Array.from({ length: 200 }, () => card(NTSC))),
  );
  const before = await head(c);
  const track = before.tracks.find((t) => t.kind === "video")!.id;
  assert.equal(
    await code(
      execute(c.browser, "yamakan.story.assemble", {
        projectId: c.projectId,
        expectedRevision: before.revision,
        documentId: storyId,
        trackId: track,
        startTicks: 1,
      }),
    ),
    "VALIDATION",
  );
  const retrying = { ...c.browser, requestId: "assemble-once" };
  const assembled = (
    await execute(retrying, "yamakan.story.assemble", {
      projectId: c.projectId,
      expectedRevision: before.revision,
      documentId: storyId,
      trackId: track,
    })
  ).result as Project;
  assert.equal(assembled.revision, before.revision + 1);
  assert.equal(assembled.clips.length, 200);
  assert.deepEqual(
    fromEditView(assembled)
      .clips.map((x) => x.startTicks / NTSC)
      .sort((a, b) => a - b)
      .slice(0, 3),
    [0, 1, 2],
  );
  // A retry after a lost response replays the same result.
  const replay = (
    await execute(retrying, "yamakan.story.assemble", {
      projectId: c.projectId,
      expectedRevision: before.revision,
      documentId: storyId,
      trackId: track,
    })
  ).result as Project;
  assert.equal(replay.revision, assembled.revision);
  assert.deepEqual(
    replay.clips.map((x) => x.id),
    assembled.clips.map((x) => x.id),
  );
});

test("a pin names a version of its own pack; an earlier held version is accepted", async () => {
  const c = await workspace();
  const consent = await grant(c);
  const first = id(),
    second = id();
  const firstHash = await savePack(c, first, pack(c, consent.id));
  const other = pack(c, consent.id);
  other.name = "Another pack";
  const secondHash = await savePack(c, second, other);
  // The hash of the second pack under the first pack's id: refused.
  assert.equal(
    await code(
      saveStory(
        c,
        id(),
        story(c, { documentId: first, contentHash: secondHash }),
      ),
    ),
    "VALIDATION",
  );
  // A new version of the first pack; the earlier version stays pinnable.
  const changed = pack(c, consent.id);
  changed.name = "Lead and alley, second look";
  await execute(c.browser, "yamakan.pack.save", {
    projectId: c.projectId,
    expectedRevision: (await head(c)).revision,
    documentId: first,
    expectedContentHash: firstHash,
    pack: changed,
  });
  assert.equal(
    await code(
      saveStory(
        c,
        id(),
        story(c, { documentId: first, contentHash: firstHash }),
      ),
    ),
    "ok",
  );
  // A still take starts at the beginning of its source.
  const stillOffset = story(c, null);
  stillOffset.scenes[0].shots[1].takes[0].sourceStartTicks = FRAME;
  assert.equal(await code(saveStory(c, id(), stillOffset)), "VALIDATION");
});

test("a version 12 workspace upgrades its document tables, keeping documents and their references", async () => {
  const c = await workspace();
  await c.queue.close();
  c.store.close();
  const file = path.join(c.root, "workspace.sqlite");
  // Put the two tables back as version 12 defined them, holding a studio
  // document a snapshot references and a staged upload.
  const downgrade = (orphan: boolean) => {
    const db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    for (const table of ["creative_documents", "document_uploads"]) {
      const { sql } = db
        .prepare("SELECT sql FROM sqlite_schema WHERE name = ?")
        .get(table) as { sql: string };
      db.exec(
        `CREATE TABLE ${table}_old ${sql
          .slice(sql.indexOf("("))
          .replace(", 'story', 'referencePack'", "")}`,
      );
      db.exec(`INSERT INTO ${table}_old SELECT * FROM ${table}`);
      db.exec(`DROP TABLE ${table}`);
      db.exec(`ALTER TABLE ${table}_old RENAME TO ${table}`);
    }
    const { hash: snapshot } = db
      .prepare("SELECT hash FROM snapshots LIMIT 1")
      .get() as { hash: string };
    db.prepare(
      "INSERT OR IGNORE INTO creative_documents(hash, kind, schema_version, asset_ids, bytes, byte_length) VALUES (?, 'studio', 1, '[]', x'7b7d', 2)",
    ).run("e".repeat(64));
    db.prepare(
      "INSERT OR IGNORE INTO snapshot_document_refs(snapshot_hash, document_hash) VALUES (?, ?)",
    ).run(snapshot, orphan ? "f".repeat(64) : "e".repeat(64));
    db.prepare(
      "INSERT OR IGNORE INTO document_uploads(id, project_id, principal_id, request_id, request_digest, kind, schema_version, declared_bytes, body_sha256, state, created_at, expires_at) VALUES (?, ?, 'browser-ui', 'r1', ?, 'studio', 1, 2, ?, 'sealed', ?, ?)",
    ).run(
      "00000000-0000-4000-8000-000000000001",
      c.projectId,
      "a".repeat(64),
      "b".repeat(64),
      Date.now(),
      Date.now() + 3_600_000,
    );
    db.exec("PRAGMA user_version = 12");
    db.exec("COMMIT");
    assert.throws(() =>
      db
        .prepare(
          "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, bytes, byte_length) VALUES (?, 'story', 1, '[]', x'00', 1)",
        )
        .run("d".repeat(64)),
    );
    db.close();
  };
  const read = (sql: string, ...args: string[]) => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return db.prepare(sql).get(...args) as Record<string, number>;
    } finally {
      db.close();
    }
  };
  // A reference to a missing document: the upgrade refuses and leaves the
  // database at version 12.
  downgrade(true);
  const refused = new ProjectStore(c.root);
  await assert.rejects(
    refused.initialize(),
    (e: unknown) => toCommandError(e).code === "RECOVERY_REQUIRED",
  );
  assert.equal(read("PRAGMA user_version").user_version, 12);
  {
    const db = new DatabaseSync(file);
    db.prepare(
      "DELETE FROM snapshot_document_refs WHERE document_hash = ?",
    ).run("f".repeat(64));
    db.close();
  }
  downgrade(false);
  const upgraded = new ProjectStore(c.root);
  handles.push(upgraded);
  await upgraded.initialize();
  assert.equal(read("PRAGMA user_version").user_version, 13);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (
        db
          .prepare(
            "SELECT count(*) AS n FROM snapshot_document_refs r JOIN creative_documents c ON c.hash = r.document_hash WHERE c.hash = ?",
          )
          .get("e".repeat(64)) as { n: number }
      ).n,
      1,
    );
    assert.equal(
      (
        db
          .prepare(
            "SELECT count(*) AS n FROM document_uploads WHERE request_id = 'r1'",
          )
          .get() as { n: number }
      ).n,
      1,
    );
  } finally {
    db.close();
  }
  // The upgraded workspace takes a story.
  const after = {
    ...c,
    store: upgraded,
    browser: { ...c.browser, store: upgraded },
  };
  const storyId = id();
  await saveStory(after, storyId, story(after, null));
  assert.equal(upgraded.getDocument(c.projectId, storyId).ref.kind, "story");
});
