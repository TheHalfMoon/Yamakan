// A document save is a step in the writer's undo history, so it no longer ends
// the timeline edits before it. Stories and reference packs still end history:
// they are checked against the consent ledger when committed, and undo must not
// bring one back unchecked.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { ProjectStore } from "../core/store.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";

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
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nFirst\n";

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-undo-docs-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const person = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const call = async (operation: string, args: object, ctx: object = person) =>
    (await execute(ctx as typeof person, operation, args)).result as any;
  const project = await call("yamakan.project.create", { name: "Undo" });
  const id: string = project.id;
  const head = () => store.load(id);
  const revision = async () => (await head()).revision;
  const addTrack = async (ctx: object = person) =>
    call(
      "yamakan.project.applyBatch",
      {
        projectId: id,
        expectedRevision: await revision(),
        operations: [
          {
            type: "track.add",
            trackId: randomUUID(),
            name: "Extra",
            kind: "video",
          },
        ],
      },
      ctx,
    );
  const importCaptions = async (documentId: string, ctx: object = person) =>
    call(
      "yamakan.captions.import",
      {
        projectId: id,
        expectedRevision: await revision(),
        documentId,
        expectedContentHash: null,
        name: "Track",
        language: "en",
        format: "srt",
        text: SRT,
      },
      ctx,
    );
  const undo = async (ctx: object = person) =>
    call(
      "yamakan.project.undo",
      { projectId: id, expectedRevision: await revision() },
      ctx,
    );
  const redo = async (ctx: object = person) =>
    call(
      "yamakan.project.redo",
      { projectId: id, expectedRevision: await revision() },
      ctx,
    );
  const refused = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { code?: string }).code;
    }
    return "accepted";
  };
  return {
    root,
    store,
    person,
    call,
    id,
    head,
    revision,
    addTrack,
    importCaptions,
    undo,
    redo,
    refused,
  };
}

test("a timeline edit stays undoable across a caption save, step by step", async () => {
  const w = await workspace();
  const documentId = randomUUID();
  const tracks = async () => (await w.head()).tracks.length;
  const documents = () => w.store.listDocuments(w.id).map((d) => d.id);
  const base = await tracks();

  await w.addTrack();
  await w.importCaptions(documentId);
  await w.addTrack();
  assert.equal(await tracks(), base + 2);
  assert.deepEqual(documents(), [documentId]);

  // The newest first: the later timeline edit, then the caption, then the first.
  await w.undo();
  assert.equal(await tracks(), base + 1);
  assert.deepEqual(documents(), [documentId]);
  await w.undo();
  assert.equal(await tracks(), base + 1);
  assert.deepEqual(documents(), []);
  await w.undo();
  assert.equal(await tracks(), base);
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");

  // And forward again, with the same document version.
  await w.redo();
  await w.redo();
  assert.deepEqual(documents(), [documentId]);
  await w.redo();
  assert.equal(await tracks(), base + 2);
  assert.equal(await w.refused(w.redo()), "REVISION_CONFLICT");
});

test("an undone caption edit brings its earlier cues back, and the hash check follows", async () => {
  const w = await workspace();
  const documentId = randomUUID();
  const first = (await w.importCaptions(documentId)).document.contentHash;
  const edit = async (name: string, expectedContentHash: string) =>
    w.call("yamakan.captions.save", {
      projectId: w.id,
      expectedRevision: await w.revision(),
      documentId,
      expectedContentHash,
      name,
    });
  const second = (await edit("Second", first)).document.contentHash;
  const current = () =>
    w.store.listDocuments(w.id).find((d) => d.id === documentId)!.contentHash;
  assert.equal(current(), second);
  await w.undo();
  assert.equal(current(), first);
  // A save made from the undone version is a conflict, not a silent overwrite.
  assert.notEqual(await w.refused(edit("Stale", second)), "accepted");
  assert.equal(current(), first);
  // A new edit from the restored version works, and ends the redo.
  await edit("Third", first);
  assert.equal(await w.refused(w.redo()), "REVISION_CONFLICT");
});

test("a Studio document save is a step too", async () => {
  const w = await workspace();
  const documentId = randomUUID();
  await w.addTrack();
  const bytes = Buffer.from(
    JSON.stringify(
      createEmptyStudioDocument({ id: documentId, name: "Board" }),
    ),
  );
  await w.store.commitDocument({
    projectId: w.id,
    expectedRevision: await w.revision(),
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes },
    principalId: "browser-ui",
  });
  await w.undo();
  assert.deepEqual(w.store.listDocuments(w.id), []);
  await w.undo();
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
});

test("undo never rewinds another writer's document, and the refusal says why", async () => {
  const w = await workspace();
  const agent = {
    ...w.person,
    principal: {
      id: `agent:${randomUUID()}` as const,
      scopes: new Set(["project:read", "project:write"]),
    },
  };
  await w.addTrack();
  const documentId = randomUUID();
  await w.importCaptions(documentId, agent);
  await assert.rejects(w.undo(), /made by another client/);
  assert.equal(w.store.listDocuments(w.id).length, 1);
  // Its writer can.
  await w.undo(agent);
  assert.equal(w.store.listDocuments(w.id).length, 0);
});

test("a retried save replays without adding a second step", async () => {
  const w = await workspace();
  await w.addTrack();
  const asked = { ...w.person, requestId: "import.1" };
  const documentId = randomUUID();
  const args = {
    projectId: w.id,
    expectedRevision: await w.revision(),
    documentId,
    expectedContentHash: null,
    name: "Track",
    language: "en",
    format: "srt",
    text: SRT,
  };
  const first = await w.call("yamakan.captions.import", args, asked);
  const again = await w.call("yamakan.captions.import", args, asked);
  assert.deepEqual(again, first);
  await w.undo();
  assert.deepEqual(w.store.listDocuments(w.id), []);
  await w.undo();
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
});

test("the history survives a reopen", async () => {
  const w = await workspace();
  const documentId = randomUUID();
  await w.addTrack();
  await w.importCaptions(documentId);
  handles.pop()!.close();
  handles.pop()!.close();
  const store = new ProjectStore(w.root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = { ...w.person, store, queue };
  const at = (await store.load(w.id)).revision;
  await w.call(
    "yamakan.project.undo",
    { projectId: w.id, expectedRevision: at },
    ctx,
  );
  assert.deepEqual(store.listDocuments(w.id), []);
});

test("a save with no named writer still ends history, as nobody could undo it", async () => {
  const w = await workspace();
  await w.addTrack();
  const documentId = randomUUID();
  await w.store.commitDocument({
    projectId: w.id,
    expectedRevision: await w.revision(),
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    source: {
      bytes: Buffer.from(
        JSON.stringify(
          createEmptyStudioDocument({ id: documentId, name: "Board" }),
        ),
      ),
    },
  });
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
});

test("a story or pack still ends history, so undo cannot bring one back unchecked", async () => {
  const w = await workspace();
  await w.addTrack();
  const documentId = randomUUID();
  await w.call("yamakan.pack.save", {
    projectId: w.id,
    expectedRevision: await w.revision(),
    documentId,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Pack",
      entries: [],
    },
  });
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
  assert.equal(w.store.listDocuments(w.id).length, 1);
  // An edit after it is undoable, and undoing it keeps the pack.
  await w.addTrack();
  await w.undo();
  assert.equal(w.store.listDocuments(w.id).length, 1);
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
});

test("a story ends history too, and steps after it never move it", async () => {
  const w = await workspace();
  await w.addTrack();
  const documentId = randomUUID();
  await w.call("yamakan.story.save", {
    projectId: w.id,
    expectedRevision: await w.revision(),
    documentId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 1,
      title: "Story",
      scenes: [],
    },
  });
  const story = () =>
    w.store.listDocuments(w.id).find((d) => d.id === documentId)!.contentHash;
  const saved = story();
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
  // A caption and a timeline edit after it undo down to the story, no further.
  await w.importCaptions(randomUUID());
  await w.addTrack();
  await w.undo();
  await w.undo();
  assert.equal(story(), saved);
  assert.equal(await w.refused(w.undo()), "REVISION_CONFLICT");
  await w.redo();
  await w.redo();
  assert.equal(story(), saved);
});

test("with document writes off, undo may not change documents but may change the timeline", async () => {
  const w = await workspace();
  const documentId = randomUUID();
  await w.importCaptions(documentId);
  await w.addTrack();
  process.env.YAMAKAN_AG_DOCS_OFF = "1";
  try {
    const tracks = (await w.head()).tracks.length;
    await w.undo();
    assert.equal((await w.head()).tracks.length, tracks - 1);
    assert.equal(await w.refused(w.undo()), "CAPABILITY_UNAVAILABLE");
    assert.equal(w.store.listDocuments(w.id).length, 1);
  } finally {
    delete process.env.YAMAKAN_AG_DOCS_OFF;
  }
  await w.undo();
  assert.equal(w.store.listDocuments(w.id).length, 0);
});
