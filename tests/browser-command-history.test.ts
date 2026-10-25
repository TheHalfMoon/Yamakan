// YU-015: the editor's gestures as canonical typed operations, committed
// with compare-and-swap, and undone by the service's writer-scoped history.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { CommandError } from "../core/command/errors.ts";
import { fromEditView } from "../core/canonical.ts";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import type { Project } from "../core/project.ts";
import {
  applyLocal,
  deleteClip,
  rippleDeleteClip,
  setClipSound,
  setClipSpeed,
  splitClip,
  updateClips,
} from "../src/edit-ops.ts";
import { editorView } from "../src/adapter.ts";
import { operationsBetween } from "../src/edit-diff.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) => rm(b, { recursive: true, force: true, maxRetries: 10 })),
  );
});

const V = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const VIDEO = "33333333-3333-4333-8333-333333333333";
const AUDIO = "44444444-4444-4444-8444-444444444444";
const C1 = "55555555-5555-4555-8555-555555555555";
const C2 = "66666666-6666-4666-8666-666666666666";
const C3 = "77777777-7777-4777-8777-777777777777";
const SCENE = "88888888-8888-4888-8888-888888888888";
const SHOT = "99999999-9999-4999-8999-999999999999";

function fixture(): Project {
  return {
    schemaVersion: 2,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Gestures",
    revision: 3,
    fps: 30,
    width: 640,
    height: 360,
    assets: [
      {
        id: V,
        name: "v.mp4",
        kind: "video",
        hash: "a".repeat(64),
        extension: "mp4",
        bytes: 1000,
        durationFrames: 600,
        width: 640,
        height: 360,
        hasAudio: true,
      },
      {
        id: A,
        name: "a.wav",
        kind: "audio",
        hash: "b".repeat(64),
        extension: "wav",
        bytes: 1000,
        durationFrames: 600,
        width: 0,
        height: 0,
        hasAudio: true,
      },
    ],
    scenes: [
      {
        id: SCENE,
        name: "Scene 1",
        referenceAssetId: null,
        camera: { focalLengthMm: 35, shotScale: "medium", movement: "static" },
        shots: [{ id: SHOT, name: "Shot 1", clipIds: [C1, C2] }],
      },
    ],
    tracks: [
      {
        id: VIDEO,
        name: "Picture",
        kind: "video",
        muted: false,
        locked: false,
      },
      { id: AUDIO, name: "Audio", kind: "audio", muted: false, locked: false },
    ],
    clips: [
      {
        id: C1,
        trackId: VIDEO,
        assetId: V,
        startFrame: 0,
        durationFrames: 90,
        sourceFrame: 0,
        title: null,
        sound: { enabled: true },
      },
      {
        id: C2,
        trackId: VIDEO,
        assetId: V,
        startFrame: 90,
        durationFrames: 60,
        sourceFrame: 30,
        title: null,
        sound: { enabled: true },
      },
      {
        id: C3,
        trackId: AUDIO,
        assetId: A,
        startFrame: 0,
        durationFrames: 120,
        sourceFrame: 0,
        title: null,
      },
    ],
  } as unknown as Project;
}

// The committed result, as the service would store it (clip order aside).
const canon = (p: Project) => {
  const c = fromEditView(p);
  const { revision: _r, ...rest } = c;
  return canonicalJson({
    ...rest,
    clips: [...c.clips].sort((x, y) => (x.id < y.id ? -1 : 1)),
  });
};

function expressible(head: Project, draft: Project, label: string) {
  const ops = operationsBetween(head, draft);
  assert.ok(ops && ops.length > 0, `${label}: expressible as operations`);
  assert.equal(
    canon(applyLocal(head, ops!)),
    canon(draft),
    `${label}: reproduces the draft exactly`,
  );
  return ops!;
}

test("each editor gesture becomes a verified batch of typed operations", () => {
  const head = fixture();
  const view = editorView(head);
  const tl = (id: string) => view.clips.find((c) => c.id === id)!;
  const gestures: [string, Project][] = [
    [
      "drag along the track",
      updateClips(head, [{ ...tl(C2), start: 5, end: 7 }]),
    ],
    [
      "drag to the other end",
      updateClips(head, [{ ...tl(C1), start: 10, end: 13 }]),
    ],
    // Two clips trade places: moved one by one they would overlap.
    [
      "trade places",
      updateClips(head, [
        { ...tl(C1), start: 2, end: 5 },
        { ...tl(C2), start: 0, end: 2 },
      ]),
    ],
    ["trim the end", updateClips(head, [{ ...tl(C1), end: 2 }])],
    [
      "trim the start",
      updateClips(head, [{ ...tl(C2), start: 3.5, sourceIn: 1.5 }]),
    ],
    ["split", splitClip(head, C1, 1, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")],
    ["delete", deleteClip(head, C2)],
    ["ripple delete", rippleDeleteClip(head, C1)],
    ["sound", setClipSound(head, C1, { enabled: false })],
    ["speed", setClipSpeed(head, C1, { num: 2, den: 1 })],
    [
      "add a clip",
      {
        ...head,
        clips: [
          ...head.clips,
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            trackId: AUDIO,
            assetId: A,
            startFrame: 200,
            durationFrames: 30,
            sourceFrame: 0,
            title: null,
          },
        ],
      } as Project,
    ],
    [
      "add a track",
      {
        ...head,
        tracks: [
          ...head.tracks,
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "Audio 2",
            kind: "audio",
            muted: false,
            locked: false,
          },
        ],
      } as Project,
    ],
    [
      "rename, mute and lock a track",
      {
        ...head,
        tracks: head.tracks.map((t) =>
          t.id === AUDIO
            ? { ...t, name: "Music", muted: true, locked: true }
            : t,
        ),
      } as Project,
    ],
    [
      "add a scene",
      {
        ...head,
        scenes: [
          ...head.scenes,
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            name: "Scene 2",
            referenceAssetId: null,
            camera: {
              focalLengthMm: 85,
              shotScale: "close",
              movement: "dolly",
            },
            shots: [],
          },
        ],
      } as Project,
    ],
    [
      "add a title on a new track",
      {
        ...head,
        tracks: [
          ...head.tracks,
          {
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            name: "Titles",
            kind: "video",
            muted: false,
            locked: false,
          },
        ],
        clips: [
          ...head.clips,
          {
            id: "abababab-abab-4bab-8bab-abababababab",
            trackId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            assetId: null,
            startFrame: 0,
            durationFrames: 60,
            sourceFrame: 0,
            title: "Hello",
          },
        ],
      } as Project,
    ],
  ];
  for (const [label, draft] of gestures) expressible(head, draft, label);
  // Unlocking a track and editing on it in one change.
  const locked = {
    ...head,
    tracks: head.tracks.map((t) =>
      t.id === VIDEO ? { ...t, locked: true } : t,
    ),
  } as Project;
  const unlocked = updateClips({ ...locked, tracks: head.tracks } as Project, [
    { ...tl(C2), start: 6, end: 8 },
  ]);
  expressible(locked, unlocked, "unlock and drag");
  // Shot membership survives a moved clip.
  const moved = updateClips(head, [{ ...tl(C2), start: 6, end: 8 }]);
  const after = applyLocal(head, operationsBetween(head, moved)!);
  assert.deepEqual(after.scenes[0]?.shots?.[0]?.clipIds, [C1, C2]);
});

test("a change typed operations cannot express exactly stays a draft", () => {
  const head = fixture();
  assert.deepEqual(operationsBetween(head, head), []);
  assert.equal(
    operationsBetween(head, { ...head, name: "Renamed" }),
    null,
    "no rename operation",
  );
  assert.equal(
    operationsBetween(head, { ...head, width: 1280, height: 720 }),
    null,
    "output settings",
  );
  // Editing a clip on a track that stays locked is refused by the
  // operations themselves, so it is never committed.
  const locked = {
    ...head,
    tracks: head.tracks.map((t) =>
      t.id === VIDEO ? { ...t, locked: true } : t,
    ),
  } as Project;
  const illegal = {
    ...locked,
    clips: locked.clips.map((c) =>
      c.id === C2 ? { ...c, startFrame: 300 } : c,
    ),
  } as Project;
  assert.equal(operationsBetween(locked, illegal), null);
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-ops-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Ops");
  return { root, store, project };
}

test("a hundred committed gestures: one revision and one receipt each, the same project as the local path", async () => {
  const { store, project } = await workspace();
  let head = await store.load(project.id);
  head = await store.applyOperations(
    head.id,
    head.revision,
    [{ type: "track.add", trackId: VIDEO, name: "Titles", kind: "video" }],
    "browser-ui",
  );
  let local: Project = head;
  const ids: string[] = [];
  for (let i = 0; i < 100; i++) {
    // A gesture on the local view: add a title, or move / retitle / remove one.
    let draft: Project;
    if (ids.length < 3 || i % 4 === 0) {
      const id = crypto.randomUUID();
      ids.push(id);
      draft = {
        ...local,
        clips: [
          ...local.clips,
          {
            id,
            trackId: VIDEO,
            assetId: null,
            startFrame: 100 * (i + 1),
            durationFrames: 30,
            sourceFrame: 0,
            title: `T${i}`,
          },
        ],
      } as Project;
    } else if (i % 4 === 1) {
      const id = ids[i % ids.length]!;
      draft = {
        ...local,
        clips: local.clips.map((c) =>
          c.id === id ? { ...c, startFrame: c.startFrame + 1 } : c,
        ),
      } as Project;
    } else if (i % 4 === 2) {
      const id = ids[i % ids.length]!;
      draft = {
        ...local,
        clips: local.clips.map((c) =>
          c.id === id ? { ...c, title: `T${i}` } : c,
        ),
      } as Project;
    } else {
      const id = ids.splice(i % ids.length, 1)[0]!;
      draft = {
        ...local,
        clips: local.clips.filter((c) => c.id !== id),
      } as Project;
    }
    const ops = operationsBetween(local, draft);
    assert.ok(ops && ops.length, `gesture ${i} is expressible`);
    const receipt = {
      principalId: "browser-ui",
      requestId: `gesture-${i}`,
      digest: sha256Hex(canonicalJson(ops)),
    };
    const committed = await store.applyOperations(
      head.id,
      head.revision,
      ops!,
      "browser-ui",
      receipt,
    );
    assert.equal(committed.revision, head.revision + 1);
    // A lost response is answered with the same revision.
    assert.equal(
      (
        await store.applyOperations(
          head.id,
          head.revision,
          ops!,
          "browser-ui",
          receipt,
        )
      ).revision,
      committed.revision,
    );
    head = committed;
    local = applyLocal(local, ops!);
    assert.equal(
      canon(head),
      canon(local),
      `gesture ${i}: service and editor agree`,
    );
  }
  assert.equal(head.revision, project.revision + 101);
});

test("undo after a restart undoes only the writer's own step", async () => {
  const { root, store, project } = await workspace();
  const first = await store.applyOperations(
    project.id,
    project.revision,
    [{ type: "track.add", trackId: VIDEO, name: "Mine", kind: "video" }],
    "browser-ui",
  );
  const second = await store.applyOperations(
    project.id,
    first.revision,
    [{ type: "track.add", trackId: AUDIO, name: "Theirs", kind: "audio" }],
    "agent:12121212-1212-4121-8121-121212121212",
  );
  await store.close();
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  // The browser's undo cannot take back the agent's later step.
  await assert.rejects(
    reopened.undo(project.id, second.revision, "browser-ui"),
    (e: unknown) => e instanceof CommandError,
  );
  assert.equal(
    (await reopened.load(project.id)).tracks.length,
    second.tracks.length,
  );
  // The agent may undo its own.
  const undone = await reopened.undo(
    project.id,
    second.revision,
    "agent:12121212-1212-4121-8121-121212121212",
  );
  assert.deepEqual(
    undone.tracks.map((t) => t.name),
    first.tracks.map((t) => t.name),
  );
  assert.ok(undone.tracks.some((t) => t.name === "Mine"));
  // A stale head is a conflict, never an undo of something else.
  await assert.rejects(
    reopened.undo(project.id, second.revision, "browser-ui"),
    (e: unknown) => e instanceof CommandError && e.code === "REVISION_CONFLICT",
  );
});

test("the editor and the CLI/MCP path store identical canonical bytes for the same edits", async () => {
  const { store } = await workspace();
  const { execute } = await import("../core/command/registry.ts");
  const ctx = {
    store,
    queue: {} as never,
    principal: {
      id: "local-client",
      scopes: new Set(["project:write", "project:read"]),
    },
  } as Parameters<typeof execute>[0];
  // Two projects with the same content: one edited by the editor's path,
  // one by commands.
  const setup = async () => {
    const p = await store.create("Parity");
    return store.applyOperations(
      p.id,
      p.revision,
      [
        { type: "track.add", trackId: VIDEO, name: "Titles", kind: "video" },
        {
          type: "clip.add",
          clipId: C1,
          trackId: VIDEO,
          assetId: null,
          title: "One",
          startTicks: 0,
          durationTicks: 30 * 23_520_000,
          sourceStartTicks: 0,
        },
        {
          type: "clip.add",
          clipId: C2,
          trackId: VIDEO,
          assetId: null,
          title: "Two",
          startTicks: 60 * 23_520_000,
          durationTicks: 30 * 23_520_000,
          sourceStartTicks: 0,
        },
      ],
      "browser-ui",
    );
  };
  let ui = await setup();
  let cli = await setup();
  // Each project's default tracks have their own ids: compared by position.
  const bytes = (p: Project) => {
    const c = fromEditView(p);
    const at = new Map(c.tracks.map((t, i) => [t.id, `track-${i}`]));
    return canonicalJson({
      ...c,
      id: "-",
      name: "-",
      revision: 0,
      tracks: c.tracks.map((t) => ({ ...t, id: at.get(t.id) })),
      clips: c.clips.map((x) => ({ ...x, trackId: at.get(x.trackId) })),
    });
  };
  assert.equal(bytes(ui), bytes(cli));
  const view = editorView(ui);
  const tl = (id: string) => view.clips.find((c) => c.id === id)!;
  const edits: [Project, unknown[]][] = [
    [
      updateClips(ui, [{ ...tl(C1), start: 4, end: 5 }]),
      [{ type: "clip.move", clipId: C1, startTicks: 120 * 23_520_000 }],
    ],
  ];
  for (const [draft, commands] of edits) {
    const ops = operationsBetween(ui, draft)!;
    ui = await store.applyOperations(ui.id, ui.revision, ops, "browser-ui");
    cli = (
      await execute(ctx, "yamakan.project.applyBatch", {
        projectId: cli.id,
        expectedRevision: cli.revision,
        operations: commands,
      })
    ).result as Project;
    assert.equal(bytes(ui), bytes(cli), "same stored bytes after a drag");
  }
  // A trim of the end and a retitle, then the same through commands.
  const v2 = editorView(ui);
  const trimmed = updateClips(ui, [
    { ...v2.clips.find((c) => c.id === C2)!, end: 2.5 },
  ]);
  const retitled = {
    ...trimmed,
    clips: trimmed.clips.map((c) =>
      c.id === C2 ? { ...c, title: "Deux" } : c,
    ),
  } as Project;
  ui = await store.applyOperations(
    ui.id,
    ui.revision,
    operationsBetween(ui, retitled)!,
    "browser-ui",
  );
  cli = (
    await execute(ctx, "yamakan.project.applyBatch", {
      projectId: cli.id,
      expectedRevision: cli.revision,
      operations: [
        { type: "clip.trim", clipId: C2, endTicks: 75 * 23_520_000 },
        { type: "clip.setTitle", clipId: C2, title: "Deux" },
      ],
    })
  ).result as Project;
  assert.equal(
    bytes(ui),
    bytes(cli),
    "same stored bytes after a trim and a retitle",
  );
});

test("a concurrent agent edit: the stale commit conflicts, and the change's operations still apply to the current version", async () => {
  const { store, project } = await workspace();
  const head = await store.applyOperations(
    project.id,
    project.revision,
    [{ type: "track.add", trackId: VIDEO, name: "Titles", kind: "video" }],
    "browser-ui",
  );
  // The editor's change, made on `head`.
  const draft = {
    ...head,
    clips: [
      ...head.clips,
      {
        id: C1,
        trackId: VIDEO,
        assetId: null,
        startFrame: 0,
        durationFrames: 30,
        sourceFrame: 0,
        title: "Mine",
      },
    ],
  } as Project;
  const ops = operationsBetween(head, draft)!;
  // An agent commits first, elsewhere in the project.
  const theirs = await store.applyOperations(
    head.id,
    head.revision,
    [{ type: "track.add", trackId: AUDIO, name: "Theirs", kind: "audio" }],
    "agent:34343434-3434-4343-8343-343434343434",
  );
  await assert.rejects(
    store.applyOperations(head.id, head.revision, ops, "browser-ui"),
    (e: unknown) => e instanceof CommandError && e.code === "REVISION_CONFLICT",
  );
  assert.equal(
    (await store.load(head.id)).revision,
    theirs.revision,
    "nothing was overwritten",
  );
  // The same operations, on the current version: both changes are kept.
  applyLocal(theirs, ops);
  const merged = await store.applyOperations(
    head.id,
    theirs.revision,
    ops,
    "browser-ui",
  );
  assert.ok(merged.tracks.some((t) => t.name === "Theirs"));
  assert.ok(merged.clips.some((c) => c.title === "Mine"));
  // A change that no longer applies (the agent removed its track) is refused.
  const gone = await store.applyOperations(
    head.id,
    merged.revision,
    [
      { type: "clip.remove", clipId: C1 },
      { type: "track.remove", trackId: VIDEO },
    ],
    "agent:34343434-3434-4343-8343-343434343434",
  );
  const retitle = {
    ...merged,
    clips: merged.clips.map((c) =>
      c.id === C1 ? { ...c, title: "Again" } : c,
    ),
  } as Project;
  const stale = operationsBetween(merged, retitle)!;
  assert.throws(() => applyLocal(gone, stale));
});

test("auto-committed batches and the legacy whole-project save keep creative documents", async () => {
  const { store, project } = await workspace();
  const { createEmptyStudioDocument } = await import("../core/studio.ts");
  const studio = createEmptyStudioDocument({
    id: crypto.randomUUID(),
    name: "Canvas",
    width: 64,
    height: 64,
  });
  const head = await store.commitDocument({
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: studio.id,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: Buffer.from(JSON.stringify(studio)) },
  });
  const docs = store.listDocuments(project.id);
  assert.equal(docs.length, 1);
  const draft = {
    ...head,
    tracks: [
      ...head.tracks,
      { id: VIDEO, name: "New", kind: "video", muted: false, locked: false },
    ],
  } as Project;
  const after = await store.applyOperations(
    head.id,
    head.revision,
    operationsBetween(head, draft)!,
    "browser-ui",
  );
  assert.deepEqual(
    store.listDocuments(project.id),
    docs,
    "a batch carries documents forward",
  );
  await store.save({ ...after, name: "Renamed" }, after.revision);
  assert.deepEqual(
    store.listDocuments(project.id),
    docs,
    "the whole-project save carries them too",
  );
});
