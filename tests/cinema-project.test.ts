import test from "node:test";
import assert from "node:assert/strict";
import { validateDocument } from "../core/documents.ts";
import {
  CINEMA_SAMPLE_SCENE,
  cinemaCanEdit,
  cinemaCanReopen,
  cinemaCanSave,
  cinemaChangedState,
  freshCinemaScene,
  loadProjectScene,
  saveProjectScene,
  storedSceneHash,
  type CinemaProjectClient,
  type CinemaSaveState,
} from "../src/cinema/cinemaProject.ts";

const hash = (c: string) => c.repeat(64);

test("a new project's Cinema scene is one a project accepts", () => {
  const scene = freshCinemaScene();
  assert.notEqual(scene.id, CINEMA_SAMPLE_SCENE.id);
  assert.notEqual(freshCinemaScene().id, scene.id);
  const validated = validateDocument(
    "cinemaScene",
    1,
    new TextEncoder().encode(JSON.stringify(scene)),
  );
  // No asset the project would have to hold.
  assert.deepEqual(validated.assetIds, []);
});

test("the project's scene is opened by kind, the lowest id first", async () => {
  const calls: Array<[string, unknown]> = [];
  const client = {
    call: async (operation: string, parameters: unknown) => {
      calls.push([operation, parameters]);
      if (operation === "yamakan.document.list")
        return [
          { id: "s-2", kind: "cinemaScene", contentHash: hash("b") },
          { id: "s-0", kind: "studio", contentHash: hash("c") },
          { id: "s-1", kind: "cinemaScene", contentHash: hash("a") },
        ];
      return { id: "s-1", contentHash: hash("a"), content: { id: "s-1" } };
    },
  };
  const opened = await loadProjectScene(client, "p-1");
  assert.deepEqual(opened, {
    documentId: "s-1",
    contentHash: hash("a"),
    scene: { id: "s-1" },
  });
  assert.deepEqual(calls[1], [
    "yamakan.document.get",
    { projectId: "p-1", documentId: "s-1" },
  ]);
});

test("a project without a Cinema scene opens none", async () => {
  const client = {
    call: async () => [{ id: "s-0", kind: "studio", contentHash: hash("c") }],
  };
  assert.equal(await loadProjectScene(client, "p-1"), null);
});

test("a save commits a cinemaScene with compare-and-swap", async () => {
  let sent: Parameters<CinemaProjectClient["saveDocument"]>[0] | null = null;
  const client: CinemaProjectClient = {
    call: async () => null,
    saveDocument: async (input) => {
      sent = input;
      return {
        project: { revision: 8 },
        document: { contentHash: hash("d") },
      };
    },
  };
  const scene = freshCinemaScene();
  const result = await saveProjectScene({
    client,
    projectId: "p-1",
    expectedRevision: 7,
    documentId: scene.id,
    expectedContentHash: hash("a"),
    scene,
  });
  assert.deepEqual(result, { revision: 8, contentHash: hash("d") });
  const input = sent!;
  assert.equal(input.kind, "cinemaScene");
  assert.equal(input.schemaVersion, 1);
  assert.equal(input.expectedRevision, 7);
  assert.equal(input.expectedContentHash, hash("a"));
  assert.equal(input.documentId, scene.id);
  assert.equal(input.content, scene);
  assert.match(input.requestId, /^[0-9a-f-]{36}$/);
});

test("a conflict reaches the page as the service's error", async () => {
  const conflict = Object.assign(new Error("Revision moved."), {
    code: "REVISION_CONFLICT",
  });
  const client: CinemaProjectClient = {
    call: async () => null,
    saveDocument: async () => {
      throw conflict;
    },
  };
  await assert.rejects(
    saveProjectScene({
      client,
      projectId: "p-1",
      expectedRevision: 1,
      documentId: "s-1",
      expectedContentHash: null,
      scene: freshCinemaScene(),
    }),
    (e) => e === conflict,
  );
});

test("Save and Reopen are offered only where they do something", () => {
  const saved = hash("a");
  const cases: Array<[CinemaSaveState | null, boolean, boolean]> = [
    [null, false, false],
    [{ state: "loading" }, false, false],
    [{ state: "new" }, true, false],
    [{ state: "saved", contentHash: saved }, false, false],
    // Nothing saved yet: Reopen would only swap in another sample.
    [{ state: "changed", contentHash: null }, true, false],
    [{ state: "changed", contentHash: saved }, true, true],
    [{ state: "saving" }, false, false],
    [{ state: "conflict", message: "m" }, false, true],
    [{ state: "error", message: "m", contentHash: null }, true, false],
    [{ state: "error", message: "m", contentHash: saved }, true, true],
    [{ state: "loadError", message: "m" }, false, true],
  ];
  for (const [state, save, reopen] of cases) {
    assert.equal(cinemaCanSave(state), save, JSON.stringify(state));
    assert.equal(cinemaCanReopen(state), reopen, JSON.stringify(state));
  }
  assert.equal(cinemaCanEdit({ state: "loading" }), false);
  // Only Reopen leads on from these, so a change could never be saved.
  assert.equal(cinemaCanEdit({ state: "conflict", message: "m" }), false);
  assert.equal(cinemaCanEdit({ state: "loadError", message: "m" }), false);
  assert.equal(cinemaCanEdit(null), true);
  assert.equal(cinemaCanEdit({ state: "saving" }), true);
});

test("a change during a save leaves the save running, not a second Save", () => {
  const saving: CinemaSaveState = { state: "saving" };
  assert.equal(cinemaChangedState(saving, hash("a")), saving);
  assert.equal(cinemaCanSave(cinemaChangedState(saving, hash("a"))), false);
  for (const s of [
    { state: "conflict", message: "m" },
    { state: "loadError", message: "m" },
    { state: "loading" },
  ] as CinemaSaveState[])
    assert.equal(cinemaChangedState(s, hash("a")), s);
  assert.deepEqual(
    cinemaChangedState({ state: "saved", contentHash: hash("a") }, hash("a")),
    { state: "changed", contentHash: hash("a") },
  );
  assert.equal(cinemaChangedState(null, null), null);
});

test("the stored hash is the one of the scene the page opens", async () => {
  const client = {
    call: async () => [
      { id: "s-2", kind: "cinemaScene", contentHash: hash("b") },
      { id: "s-1", kind: "cinemaScene", contentHash: hash("a") },
    ],
  };
  assert.equal(await storedSceneHash(client, "p-1"), hash("a"));
  assert.equal(await storedSceneHash({ call: async () => [] }, "p-1"), null);
});
