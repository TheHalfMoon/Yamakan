import test from "node:test";
import assert from "node:assert/strict";
import { validateDocument } from "../core/documents.ts";
import {
  CINEMA_SAMPLE_SCENE,
  freshCinemaScene,
  loadProjectScene,
  saveProjectScene,
  type CinemaProjectClient,
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
