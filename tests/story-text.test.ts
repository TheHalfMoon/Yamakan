// MPR-106: the words of a story. The page's helpers against the service's own schema, counter and
// store, on the real store and commands.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { validateDocument } from "../core/documents.ts";
import {
  STORY_LIMITS,
  StoryBriefSchema,
  StoryDocumentSchema,
  ShotIntentSchema,
  storyTextBytes,
  type StoryDocument,
} from "../core/story.ts";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import type { Project } from "../core/project.ts";
import { CREATE_MODELS, emptyBrief } from "../src/create/create-model.ts";
import {
  CREATE_STORY_TITLE,
  addMadeVideo,
  type CreateStory,
} from "../src/create/create-story.ts";
import { pinElement, unpinElement } from "../src/create/create-elements.ts";
import { withRenderedTake } from "../src/director/cinemaShot.ts";
import { saveStory } from "../src/story/save-story.ts";
import {
  BRIEF_FIELDS,
  SHOT_FIELDS,
  TEXT_LIMITS,
  changedUnder,
  directionText,
  documentBytes,
  draftOffer,
  draftToIntent,
  edit,
  editsThatFit,
  fieldKey,
  fieldText,
  fullness,
  languagesFit,
  languagesOf,
  stillToSave,
  textBytes,
  upTo,
  withBrief,
  withEdits,
  withIntent,
  withScript,
  type Edits,
  type Field,
  type TextStory,
} from "../src/story/story-text.ts";

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
const ARABIC = "فيلم قصير عن طائرة ورقية حمراء";
type Shot = StoryDocument["scenes"][number]["shots"][number];
const shot = (over: Partial<Shot> = {}): Shot => ({
  id: id(),
  name: "Shot",
  durationTicks: 30 * FRAME,
  notes: "",
  referencePacks: [],
  takes: [],
  selectedTakeId: null,
  ...over,
});
const story = (...scenes: Shot[][]): StoryDocument => ({
  format: "yamakan.story",
  formatVersion: 2,
  title: "Words",
  scenes: scenes.map((shots, i) => ({ id: id(), name: `Scene ${i}`, shots })),
});
const asText = (s: StoryDocument) => s as unknown as TextStory;
const back = (s: TextStory) => StoryDocumentSchema.parse(s);

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-story-text-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  } as unknown as CommandContext;
  const projectId = (
    (await execute(ctx, "yamakan.project.create", { name: "W" }))
      .result as Project
  ).id;
  const save = async (documentId: string, body: object, over: object = {}) =>
    (
      await execute(ctx, "yamakan.story.save", {
        projectId,
        expectedRevision: (await store.load(projectId)).revision,
        documentId,
        expectedContentHash:
          store.listDocuments(projectId).find((d) => d.id === documentId)
            ?.contentHash ?? null,
        story: body,
        ...over,
      })
    ).result;
  const read = async (documentId: string) =>
    (
      (await execute(ctx, "yamakan.document.get", { projectId, documentId }))
        .result as { content: StoryDocument }
    ).content;
  return { root, ctx, store, projectId, save, read };
}

// The head's story as an older build left it: its bytes, hash and version 1, named by a head
// snapshot of its own.
function asAnOlderBuildStored(
  w: Awaited<ReturnType<typeof workspace>>,
  documentId: string,
  one: object,
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
      .replace('"schemaVersion":2', '"schemaVersion":1'),
    "utf8",
  );
  const next = sha256Hex(snapshot);
  db.prepare(
    "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) SELECT ?, kind, 1, asset_ids, object_digests, ?, ? FROM creative_documents WHERE hash = ?",
  ).run(hash, bytes, bytes.length, ref.contentHash);
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
const refused = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};

test("the limits are the service's", () => {
  const long = (n: number) => "x".repeat(n);
  for (const [field, n] of [
    ["logline", TEXT_LIMITS.logline],
    ["audience", TEXT_LIMITS.audience],
    ["format", TEXT_LIMITS.format],
    ["tone", TEXT_LIMITS.tone],
  ] as const) {
    assert.ok(StoryBriefSchema.safeParse({ [field]: long(n) }).success, field);
    assert.ok(!StoryBriefSchema.safeParse({ [field]: long(n + 1) }).success);
    assert.ok(!StoryBriefSchema.safeParse({ [field]: "" }).success);
  }
  for (const [field, n] of [
    ["framing", TEXT_LIMITS.framing],
    ["movement", TEXT_LIMITS.movement],
    ["action", TEXT_LIMITS.action],
    ["dialogue", TEXT_LIMITS.dialogue],
  ] as const) {
    assert.ok(ShotIntentSchema.safeParse({ [field]: long(n) }).success, field);
    assert.ok(!ShotIntentSchema.safeParse({ [field]: long(n + 1) }).success);
  }
  const scene = (sceneText: string) =>
    StoryDocumentSchema.safeParse({
      ...story([]),
      scenes: [{ ...story([]).scenes[0], sceneText }],
    }).success;
  assert.ok(scene(long(TEXT_LIMITS.sceneText)));
  assert.ok(!scene(long(TEXT_LIMITS.sceneText + 1)) && !scene(""));
});

test("the browser counter and the server counter agree", () => {
  for (const words of [
    "plain words",
    ARABIC,
    "a \u{1F600} b",
    "مزيج of both ✓",
  ]) {
    const s = withIntent(
      withIntent(
        withScript(
          withBrief(asText(story([shot(), shot()], [shot()])), {
            logline: words,
            tone: words,
            languages: ["ar", "en-GB"],
          }),
          "none",
          words,
        ),
        "none",
        { action: words },
      ),
      "none",
      { action: words },
    );
    const [first, second] = s.scenes;
    const told = withIntent(
      withIntent(withScript(s, first!.id, words), first!.shots[0]!.id, {
        framing: words,
        movement: words,
        action: words,
        dialogue: words,
        direction: { shot: "wide", lens: "long" },
      }),
      second!.shots[0]!.id,
      { action: words },
    );
    assert.equal(textBytes(told), storyTextBytes(back(told)), words);
    assert.ok(textBytes(told) > 8 * words.length);
    assert.equal(
      documentBytes(told),
      Buffer.byteLength(canonicalJson(back(told))),
    );
  }
  assert.equal(textBytes(asText(story([shot()]))), 0);
});

test("a brief, a script and an intent survive save and read", async () => {
  const w = await workspace();
  const documentId = id();
  const s = story([shot()]);
  const told = back(
    withIntent(
      withScript(
        withBrief(asText(s), {
          logline: ARABIC,
          audience: "families",
          format: "short film",
          tone: "gentle",
          languages: ["ar", "en"],
        }),
        s.scenes[0]!.id,
        `${ARABIC}\nA red kite.`,
      ),
      s.scenes[0]!.shots[0]!.id,
      {
        framing: "wide",
        movement: "slow pan",
        action: ARABIC,
        dialogue: "“Look!”",
        direction: { shot: "wide", light: "golden" },
      },
    ),
  );
  await w.save(documentId, told);
  assert.deepEqual(await w.read(documentId), told);
  // What looks like a path, an address, markup or a command is words like any other.
  const odd = `<script>x</script> C:\\Windows\\x.exe https://example.com $(rm -rf /)`;
  const next = back(
    withIntent(asText(told), told.scenes[0]!.shots[0]!.id, { action: odd }),
  );
  await w.save(documentId, next);
  assert.equal(
    (await w.read(documentId)).scenes[0]!.shots[0]!.intent!.action,
    odd,
  );
  // Stale, it writes nothing.
  assert.match(
    await refused(
      w.save(documentId, told, { expectedContentHash: "a".repeat(64) }),
    ),
    /^REVISION_CONFLICT/,
  );
  assert.deepEqual(await w.read(documentId), next);
  // Nor without the right to write.
  const reader = {
    ...w.ctx,
    principal: { id: "agent:x", scopes: new Set(["project:read"]) },
  } as unknown as CommandContext;
  assert.match(
    await refused(
      execute(reader, "yamakan.story.save", {
        projectId: w.projectId,
        expectedRevision: 0,
        documentId,
        expectedContentHash: null,
        story: told,
      }),
    ),
    /^SCOPE_DENIED/,
  );
});

test("text over the budget is refused with both numbers", async () => {
  const w = await workspace();
  const documentId = id();
  const s = story([shot()]);
  await w.save(documentId, s);
  const before = await w.read(documentId);
  const scenes = Array.from({ length: 25 }, (_, i) => ({
    id: id(),
    name: `Scene ${i}`,
    sceneText: "x".repeat(4_000),
    shots: [],
  }));
  const over = { ...s, scenes };
  const n = storyTextBytes(StoryDocumentSchema.parse(over));
  assert.equal(
    await refused(w.save(documentId, over)),
    `LIMIT_EXCEEDED: The story's brief, scripts and shot intents hold ${n} bytes of text; the limit is 98304.`,
  );
  assert.deepEqual(await w.read(documentId), before);
  // As the page says it.
  assert.deepEqual(fullness(asText(over as never)), {
    percent: Math.ceil((n / 98_304) * 100),
    tooFull: true,
  });
});

test("how full a story is, in whole percents of the nearer limit", () => {
  const filledWith = (n: number) =>
    asText({
      ...story([]),
      scenes: [{ ...story([]).scenes[0]!, sceneText: "x".repeat(n) }],
    } as never);
  assert.deepEqual(fullness(asText(story([]))), { percent: 0, tooFull: false });
  for (const [n, percent, tooFull] of [
    [TEXT_LIMITS.textBytes / 2, 50, false],
    [TEXT_LIMITS.textBytes - 1, 99, false],
    [TEXT_LIMITS.textBytes, 100, false],
    [TEXT_LIMITS.textBytes + 1, 101, true],
    [TEXT_LIMITS.textBytes * 2, 200, true],
  ] as const)
    assert.deepEqual(fullness(filledWith(n)), { percent, tooFull }, `${n}`);
  // The whole story can be the nearer one.
  const wide = asText(
    story(
      Array.from({ length: 100 }, () => shot({ notes: "x".repeat(1_500) })),
    ),
  );
  assert.equal(textBytes(wide), 0);
  assert.equal(
    fullness(wide).percent,
    Math.floor((documentBytes(wide) / TEXT_LIMITS.documentBytes) * 100),
  );
  assert.ok(fullness(wide).percent > 50);
});

test("a maximal story fits the document limit and reports the room left for takes", () => {
  for (const [name, letter] of [
    ["ASCII", "x"],
    ["Arabic", "م"],
  ] as const) {
    const size = Buffer.byteLength(letter);
    const scenes = [];
    let left = Math.floor(STORY_LIMITS.textBytes / size);
    while (left > 0 && scenes.length < STORY_LIMITS.scenes) {
      const n = Math.min(left, TEXT_LIMITS.sceneText);
      scenes.push({
        id: id(),
        name: "Scene",
        sceneText: letter.repeat(n),
        shots: [],
      });
      left -= n;
    }
    assert.equal(left, 0);
    const s = StoryDocumentSchema.parse({ ...story(), scenes });
    assert.ok(storyTextBytes(s) > STORY_LIMITS.textBytes - size);
    const { bytes } = validateDocument(
      "story",
      2,
      Buffer.from(JSON.stringify(s)),
    );
    const room = STORY_LIMITS.documentBytes - bytes.length;
    console.log(
      `${name}: a story full of text is ${bytes.length} bytes; ${room} are left for shots and takes`,
    );
    // Arabic is stored as it is written, not escaped.
    assert.ok(room > 150_000, `${room}`);
  }
});

test("setting one field keeps every other field, known or not", () => {
  const s = {
    ...story([shot({ notes: "kept" }), shot()]),
    later: { more: 1 },
  } as never as TextStory & { later: unknown };
  const [a, b] = s.scenes[0]!.shots;
  (a as { later?: unknown }).later = [1, 2];
  (s.scenes[0] as { later?: unknown }).later = "scene";
  const frozen = structuredClone(s);
  const told = withIntent(
    withScript(withBrief(s, { tone: "dry" }), s.scenes[0]!.id, "Words."),
    a!.id,
    { action: "Runs." },
  );
  assert.deepEqual(s, frozen, "the story it was given is left as it was");
  assert.deepEqual(told, {
    ...frozen,
    brief: { tone: "dry" },
    scenes: [
      {
        ...frozen.scenes[0]!,
        sceneText: "Words.",
        shots: [
          { ...frozen.scenes[0]!.shots[0]!, intent: { action: "Runs." } },
          frozen.scenes[0]!.shots[1]!,
        ],
      },
    ],
  });
  // Empty is left out, at every depth, and takes away what was there.
  const emptied = withIntent(
    withScript(
      withBrief(told, { tone: "", languages: [], logline: undefined }),
      told.scenes[0]!.id,
      "",
    ),
    a!.id,
    { action: "", direction: {}, dialogue: "" },
  );
  assert.deepEqual(emptied, frozen);
  assert.ok(!("intent" in emptied.scenes[0]!.shots[0]!));
  // An id it does not know changes nothing.
  assert.deepEqual(withIntent(s, id(), { action: "x" }), frozen);
  assert.equal(b!.id, told.scenes[0]!.shots[1]!.id);
});

test("a Create draft maps to an action and a direction, never a model or a seed", () => {
  const draft = {
    ...emptyBrief(),
    prompt: "A red kite.",
    modelId: CREATE_MODELS[1]!.id,
    seed: 99,
    direction: { shot: "wide", lens: undefined },
  };
  const intent = draftToIntent(draft as never);
  assert.deepEqual(intent, {
    action: "A red kite.",
    direction: { shot: "wide" },
  });
  ShotIntentSchema.parse(intent);
  assert.deepEqual(draftToIntent({ ...emptyBrief(), prompt: "x" }), {
    action: "x",
  });
  assert.deepEqual(draftToIntent(emptyBrief()), {});
  // As long as it may be, and never half a character.
  const long = draftToIntent({
    ...emptyBrief(),
    prompt: `x${"\u{1F600}".repeat(2_000)}`,
  });
  assert.equal(long.action!.length, 1_999);
  ShotIntentSchema.parse(long);
  assert.equal(upTo("a\u{1F600}", 2), "a");
});

test("the offer shows once and only with a draft and a story", () => {
  const draft = JSON.stringify({ ...emptyBrief(), prompt: "A red kite." });
  const some = [asText(story([])), asText(story([shot()]))];
  assert.equal(draftOffer(draft, some, false)?.prompt, "A red kite.");
  assert.equal(draftOffer(draft, some, true), null);
  assert.equal(draftOffer(null, some, false), null);
  assert.equal(draftOffer(draft, [], false), null);
  assert.equal(draftOffer(draft, [asText(story([]))], false), null);
  for (const kept of [
    JSON.stringify(emptyBrief()),
    JSON.stringify({ ...emptyBrief(), prompt: "  \n" }),
    "{not json",
    "7",
    "null",
    '{"prompt":7}',
  ])
    assert.equal(draftOffer(kept, some, false), null, kept);
  // Only what reading a draft accepts.
  const hostile = draftOffer(
    JSON.stringify({
      prompt: "x".repeat(100_000),
      modelId: "no such model",
      seed: "1",
      direction: { shot: "no such shot", extra: "y", lens: { a: 1 } },
      more: true,
    }),
    some,
    false,
  )!;
  const intent = draftToIntent(hostile);
  ShotIntentSchema.parse(intent);
  assert.deepEqual(Object.keys(intent), ["action"]);
  assert.equal(intent.action!.length, 2_000);
});

test("saving text into a version 1 story upgrades it without changing a take", async () => {
  const w = await workspace();
  const documentId = id();
  // A still of the project, as its rows: a take needs no more.
  const still = Buffer.from("a still   ");
  const asset = {
    id: id(),
    name: "a.png",
    kind: "image" as const,
    hash: sha256Hex(still),
    extension: "png" as const,
    bytes: 10,
    durationFrames: 1,
    width: 64,
    height: 36,
    hasAudio: false,
  };
  await w.store.attachAsset(w.projectId, asset as never, (db) => {
    db.prepare(
      "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, 10, 'ready', 1)",
    ).run(w.projectId, asset.hash);
    db.prepare(
      "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, '{}')",
    ).run(asset.id, w.projectId, asset.hash);
  });
  const take = {
    id: id(),
    assetId: asset.id,
    sourceStartTicks: 0,
    lineage: { label: "seed 3", outputHash: asset.hash, inputs: [] },
  };
  const s = story([
    shot({
      notes: "The prompt of before.",
      takes: [take],
      selectedTakeId: take.id,
    }),
  ]);
  await w.save(documentId, s);
  const { formatVersion: _2, ...rest } = s;
  asAnOlderBuildStored(w, documentId, { ...rest, formatVersion: 1 });
  assert.equal(
    w.store.listDocuments(w.projectId).find((d) => d.id === documentId)!
      .schemaVersion,
    1,
  );
  const read = await w.read(documentId);
  const told = withBrief(asText(read), { tone: "dry" });
  assert.equal(told.formatVersion, 2);
  await w.save(documentId, told);
  assert.deepEqual(await w.read(documentId), { ...s, brief: { tone: "dry" } });
  assert.equal(
    w.store.listDocuments(w.projectId).find((d) => d.id === documentId)!
      .schemaVersion,
    2,
  );
});

test("what is no brief or intent is refused, and nothing is saved", async () => {
  const w = await workspace();
  const documentId = id();
  const s = story([shot()]);
  await w.save(documentId, s);
  const before = await w.read(documentId);
  const languages = (...tags: string[]) => ({
    ...s,
    brief: { languages: tags },
  });
  const intent = (over: object) => ({
    ...s,
    scenes: [
      {
        ...s.scenes[0]!,
        shots: [{ ...s.scenes[0]!.shots[0]!, intent: over }],
      },
    ],
  });
  for (const body of [
    { ...s, brief: { logline: "x", more: 1 } },
    { ...s, brief: {} },
    { ...s, brief: { logline: "" } },
    languages("ar", "AR"),
    languages("a"),
    languages("english language"),
    languages("ar_EG"),
    languages("de", "en", "ar", "fr", "es", "it", "pt", "nl", "sv"),
    intent({}),
    intent({ action: "x", more: 1 }),
    intent({ direction: {} }),
    intent({ direction: { shot: "Wide Shot" } }),
    intent({ direction: { other: "x" } }),
    intent({ direction: { shot: "x".repeat(41) } }),
  ])
    assert.match(
      await refused(w.save(documentId, body)),
      /^VALIDATION/,
      JSON.stringify(body).slice(0, 200),
    );
  assert.deepEqual(await w.read(documentId), before);
  await w.save(documentId, languages("ar", "en-GB", "zh-Hant-TW"));
});

const told = () => {
  const one = shot({ intent: { framing: "wide" } });
  const two = shot();
  return {
    one,
    two,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "T",
      brief: { tone: "Quiet", languages: ["ar", "en"] },
      scenes: [
        { id: id(), name: "A", sceneText: "Words.", shots: [one, two] },
        { id: id(), name: "B", shots: [] },
      ],
    } as TextStory & { title: string },
  };
};

test("every field is read, and typed over, in its own place", () => {
  const { story, one, two } = told();
  const fields: Field[] = [
    ...BRIEF_FIELDS.map((name): Field => ({ at: "brief", name })),
    ...story.scenes.map((s): Field => ({ at: "scene", id: s.id })),
    ...[one, two].flatMap((x) =>
      SHOT_FIELDS.map((name): Field => ({ at: "shot", id: x.id, name })),
    ),
  ];
  assert.equal(new Set(fields.map(fieldKey)).size, fields.length);
  assert.equal(fieldText(story, { at: "brief", name: "tone" }), "Quiet");
  assert.equal(fieldText(story, { at: "brief", name: "languages" }), "ar, en");
  assert.equal(fieldText(story, { at: "brief", name: "logline" }), "");
  assert.equal(
    fieldText(story, { at: "shot", id: one.id, name: "framing" }),
    "wide",
  );
  assert.equal(fieldText(story, { at: "scene", id: id() }), null);
  assert.equal(
    fieldText(story, { at: "shot", id: id(), name: "action" }),
    null,
  );
  for (const field of fields) {
    const typed =
      field.at === "brief" && field.name === "languages" ? "fr, de" : "Typed";
    const after = withEdits(story, edit({}, story, field, typed));
    for (const other of fields)
      assert.equal(
        fieldText(after, other),
        fieldKey(other) === fieldKey(field) ? typed : fieldText(story, other),
        `${fieldKey(field)} ${fieldKey(other)}`,
      );
    assert.equal(after.title, "T");
    // Emptied again, it is as it was without it.
    const emptied = withEdits(after, edit({}, after, field, ""));
    assert.equal(fieldText(emptied, field), "");
    StoryDocumentSchema.parse(emptied);
  }
});

test("edits hold on while the story moves on, and one put back is no edit", () => {
  const { story, one, two } = told();
  const action: Field = { at: "shot", id: one.id, name: "action" };
  const tone: Field = { at: "brief", name: "tone" };
  let edits: Edits = edit({}, story, action, "A");
  edits = edit(edits, story, action, "A red kite");
  assert.equal(edits[fieldKey(action)]!.was, "");
  assert.deepEqual(edit(edits, story, action, ""), {});
  edits = edit(edits, story, tone, "Loud");
  assert.deepEqual(changedUnder(edits, story), []);
  // Someone else changes the tone and the dialogue.
  const moved = withIntent(withBrief(story, { tone: "Bright" }), one.id, {
    framing: "wide",
    dialogue: "Higher!",
  });
  assert.deepEqual(
    changedUnder(edits, moved).map((e) => [fieldKey(e.field), e.says]),
    [["brief:tone", "Bright"]],
  );
  const merged = withEdits(moved, edits);
  assert.deepEqual(merged.brief, { tone: "Loud" });
  assert.deepEqual(merged.scenes[0]!.shots[0]!.intent, {
    framing: "wide",
    action: "A red kite",
    dialogue: "Higher!",
  });
  // Typing on after that still knows what the story said when the person began.
  const on = edit(edits, moved, tone, "Very loud");
  assert.equal(on["brief:tone"]!.was, "Quiet");
  assert.deepEqual(
    changedUnder(on, moved).map((e) => e.says),
    ["Bright"],
  );
  // What the story already says is not to be saved again.
  assert.deepEqual(stillToSave(edits, merged), {});
  assert.deepEqual(
    Object.keys(stillToSave(edits, moved)).sort(),
    ["brief:tone", fieldKey(action)].sort(),
  );
  // A shot that is gone takes nothing with it, and what was typed for it is still known.
  const gone = {
    ...moved,
    scenes: [{ ...moved.scenes[0]!, shots: [two] }, moved.scenes[1]!],
  };
  assert.deepEqual(
    withEdits(gone, { [fieldKey(action)]: edits[fieldKey(action)]! }),
    gone,
  );
  assert.deepEqual(Object.keys(editsThatFit(edits, gone)), ["brief:tone"]);
  assert.equal(Object.keys(editsThatFit(edits, moved)).length, 2);
  assert.deepEqual(
    changedUnder(edits, gone).map((e) => [e.now, e.says]),
    [
      ["A red kite", null],
      ["Loud", "Bright"],
    ],
  );
});

test("languages are told from one another as the service tells them", () => {
  assert.deepEqual(languagesOf(" ar, en-GB\u060C fr\nde "), [
    "ar",
    "en-GB",
    "fr",
    "de",
  ]);
  for (const [text, fits] of [
    ["", true],
    ["ar, en-GB", true],
    ["ar, AR", false],
    ["english", false],
    ["en_GB", false],
    ["a", false],
    ["aa ab ac ad ae af ag ah", true],
    ["aa ab ac ad ae af ag ah ai", false],
    [`en-${"abcdefgh-".repeat(4)}ab`, false],
  ] as const) {
    assert.equal(languagesFit(text), fits, text);
    const languages = languagesOf(text);
    if (languages.length > 0)
      assert.equal(
        StoryBriefSchema.safeParse({ languages }).success,
        fits,
        text,
      );
  }
});

test("a direction is shown in words, and one no longer there as it is", () => {
  assert.deepEqual(directionText({ shot: "wide", lens: "gone-lens" }), [
    "wide shot",
    "gone-lens",
  ]);
  assert.deepEqual(directionText({ shot: "constructor" }), ["constructor"]);
  assert.deepEqual(directionText(undefined), []);
});

test("the page's other writers of a story keep its words", () => {
  const { story, one } = told();
  const whole = {
    ...story,
    title: CREATE_STORY_TITLE,
    scenes: story.scenes.map((s) => ({ ...s })),
  } as unknown as StoryDocument;
  const words = (s: unknown) => {
    const read = s as StoryDocument;
    return {
      brief: read.brief,
      scripts: read.scenes.map((x) => x.sceneText),
      intent: read.scenes[0]!.shots.find((x) => x.id === one.id)!.intent,
    };
  };
  const said = words(whole);
  assert.ok(said.brief && said.scripts[0] && said.intent);
  const hash = "c".repeat(64);
  const made = addMadeVideo(
    whole as unknown as CreateStory,
    {
      assetId: id(),
      assetHash: hash,
      durationTicks: 60 * FRAME,
      receipt: {
        model: "m",
        revision: "r",
        prompt: "p",
        seed: 1,
        steps: 1,
        sha256: hash,
        licence: "l",
        inputs: [],
      } as never,
    },
    id,
  );
  assert.ok(typeof made === "object");
  assert.deepEqual(words(made), said);
  const rendered = withRenderedTake(whole, one.id, {
    id: id(),
    assetId: id(),
    outputHash: hash,
    label: "x",
  });
  assert.ok(!("refused" in rendered));
  assert.deepEqual(words(rendered), said);
  const pin = { documentId: id(), contentHash: hash };
  const pinned = pinElement(whole as never, one.id, pin as never);
  assert.ok(typeof pinned === "object");
  assert.deepEqual(words(pinned), said);
  assert.deepEqual(
    words(unpinElement(pinned as never, one.id, pin.documentId)),
    said,
  );
});

test("a save whose answer is lost is asked for again as the same request, and said as it is", async () => {
  const w = await workspace();
  const documentId = id();
  await w.save(documentId, story([shot()]));
  const lost = new TypeError("fetch failed");
  // The service's own answers, as the page's client gives them.
  const client = (
    lose: (n: number) => boolean,
    over?: (n: number) => Promise<unknown>,
  ) => {
    const asked: (string | undefined)[] = [];
    return {
      asked,
      call: async (
        operation: string,
        args: Record<string, unknown>,
        requestId?: string,
      ) => {
        asked.push(requestId);
        const n = asked.length;
        if (over) return over(n);
        try {
          const { result } = await execute(
            { ...w.ctx, requestId } as CommandContext,
            operation,
            args,
          );
          if (lose(n)) throw lost;
          return result;
        } catch (e) {
          if (e === lost) throw e;
          const c = toCommandError(e);
          throw Object.assign(new Error(c.message), {
            code: c.code,
            requestId: "r",
          });
        }
      },
    };
  };
  const held = () =>
    w.store.listDocuments(w.projectId).find((d) => d.id === documentId)!;
  const args = async (text: string) => ({
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    expectedContentHash: held().contentHash,
    story: withBrief(asText(await w.read(documentId)), { tone: text }),
  });
  // Lost once: it landed once, and the second answer is of the same save.
  const before = (await w.store.load(w.projectId)).revision;
  const once = client((n) => n === 1);
  const outcome = await saveStory(once, await args("dry"));
  assert.deepEqual(outcome, {
    kind: "saved",
    revision: before + 1,
    contentHash: held().contentHash,
  });
  assert.equal(once.asked.length, 2);
  assert.ok(once.asked[0] && once.asked[0] === once.asked[1]);
  assert.equal((await w.store.load(w.projectId)).revision, before + 1);
  // Lost twice: not known.
  const twice = client(() => true);
  assert.deepEqual(await saveStory(twice, await args("wet")), {
    kind: "unknown",
  });
  assert.equal(twice.asked.length, 2);
  // A refusal is asked for once, and said as what it is.
  const stale = client(() => false);
  assert.deepEqual(
    await saveStory(stale, {
      ...(await args("x")),
      expectedContentHash: "0".repeat(64),
    }),
    { kind: "conflict" },
  );
  assert.equal(stale.asked.length, 1);
  const tooFull = await args("x");
  const full = client(() => false);
  assert.deepEqual(
    await saveStory(full, {
      ...tooFull,
      story: {
        ...tooFull.story,
        scenes: Array.from({ length: 30 }, () => ({
          id: id(),
          name: "S",
          sceneText: "x".repeat(4_000),
          shots: [],
        })),
      },
    }),
    { kind: "full" },
  );
  const says = async (code: string | undefined, message: string, r = "r") =>
    saveStory(
      client(
        () => false,
        () =>
          Promise.reject(
            Object.assign(new Error(message), { code, requestId: r }),
          ),
      ),
      tooFull,
    );
  // A limit that is not the story's own is not said as a full story.
  const disk = "Insufficient free disk space to commit a revision.";
  assert.deepEqual(await says("LIMIT_EXCEEDED", disk), {
    kind: "refused",
    message: disk,
  });
  assert.deepEqual(
    await says("LIMIT_EXCEEDED", "Canonical document exceeds 262144 bytes."),
    { kind: "full" },
  );
  // A schema's issues and an unknown fault are not shown.
  for (const code of ["VALIDATION", "INTERNAL", "FORBIDDEN"])
    assert.deepEqual(await says(code, "[{path: C:/x}]"), {
      kind: "refused",
      message: null,
    });
  // A code without the service's request is no answer of it.
  assert.deepEqual(await says("UNAVAILABLE", "x", null as never), {
    kind: "unknown",
  });
  assert.deepEqual(await says(undefined, "x"), { kind: "unknown" });
  const long = (await says("BUSY", "b".repeat(900))) as { message: string };
  assert.equal(long.message.length, 200);
});
