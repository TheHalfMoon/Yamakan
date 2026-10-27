// YU-051: continuity references and per-stage consent. A take records the
// exact pack-version entries (and identity encoding) it was made with.
// Saving a story only needs them traceable, so a pack update or a
// revocation leaves old takes traceable; a check before an attempt and the
// attach (take.apply) need every consent usable now, and the attach checks
// again whatever an earlier check said. Metadata validity is reported apart
// from a continuity score, which stays unmeasured. Revocation races,
// foreign references, forged encoding hashes and old approvals fail.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import type { Project } from "../core/project.ts";
import type {
  ContinuityRef,
  ReferencePack,
  StoryDocument,
} from "../core/story.ts";
import type { TakeProposal } from "../core/takes.ts";

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
const DAY = 24 * 60 * 60 * 1000;
const id = () => crypto.randomUUID();
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const browser = {
  id: "browser-ui" as const,
  scopes: new Set(Scopes) as ReadonlySet<Scope>,
};

function ffmpeg(args: string[]) {
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-continuity-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = { store, queue, principal: browser };
  const call = async <T>(operation: string, args: object) =>
    (await execute(ctx, operation, args)).result as T;
  const project = await call<Project>("yamakan.project.create", {
    name: "Continuity",
  });
  const media = {
    a: [
      "a.mp4",
      ["-f", "lavfi", "-i", "testsrc=size=160x90:rate=30:duration=2"],
    ],
    b: [
      "b.mp4",
      ["-f", "lavfi", "-i", "smptebars=size=160x90:rate=30:duration=2"],
    ],
    still: [
      "still.png",
      ["-f", "lavfi", "-i", "testsrc=size=160x90", "-frames:v", "1"],
    ],
    voice: [
      "voice.wav",
      ["-f", "lavfi", "-i", "sine=frequency=220:duration=1"],
    ],
  } as const;
  const asset = {} as Record<keyof typeof media, Project["assets"][number]>;
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
    asset[key] = (
      await store.importAsset(project.id, name, await readFile(file))
    ).asset;
  }
  const grant = (characterId: string, purpose: string, ttlMs = DAY) =>
    call<{ id: string }>("yamakan.consent.grant", {
      characterId,
      purpose,
      version: "v1",
      ttlMs,
    }).then((r) => r.id);
  const likeness = await grant("lead", "likeness-generate");
  const voiceConsent = await grant("lead", "voice-clone");
  const encodeConsent = await grant("lead", "identity-encode");
  const encoding = await call<{ id: string; payloadHash: string }>(
    "yamakan.identity.encode",
    {
      characterId: "lead",
      purpose: "identity-encode",
      consentId: encodeConsent,
      provider: "stand-in",
      method: "none",
      payloadHash: "ab".repeat(32),
    },
  );
  const head = () => store.load(project.id);
  const run = <T>(operation: string, args: object) =>
    call<T>(operation, { projectId: project.id, ...args });
  const entries = {
    lead: id(),
    voice: id(),
    room: id(),
  };
  const pack = (label = "Lead"): ReferencePack => ({
    format: "yamakan.reference-pack",
    formatVersion: 1,
    name: "Cast",
    entries: [
      {
        id: entries.lead,
        role: "character",
        label,
        assetId: asset.still.id,
        assetHash: asset.still.hash,
        characterId: "lead",
        consentId: likeness,
      },
      {
        id: entries.voice,
        role: "voice",
        label: "Lead voice",
        assetId: asset.voice.id,
        assetHash: asset.voice.hash,
        characterId: "lead",
        consentId: voiceConsent,
      },
      {
        id: entries.room,
        role: "environment",
        label: "Room",
        assetId: asset.still.id,
        assetHash: asset.still.hash,
        characterId: null,
        consentId: null,
      },
    ],
  });
  const packId = id();
  const savePack = async (p: ReferencePack, expected: string | null) =>
    (
      await run<{ document: { contentHash: string } }>("yamakan.pack.save", {
        expectedRevision: (await head()).revision,
        documentId: packId,
        expectedContentHash: expected,
        pack: p,
      })
    ).document.contentHash;
  const packV1 = await savePack(pack(), null);
  const refs = (contentHash = packV1): ContinuityRef[] => [
    {
      packDocumentId: packId,
      packContentHash: contentHash,
      entryId: entries.lead,
      encoding: { id: encoding.id, payloadHash: encoding.payloadHash },
    },
    {
      packDocumentId: packId,
      packContentHash: contentHash,
      entryId: entries.voice,
    },
  ];
  // One shot: footage a selected, footage b a generated take that names
  // its continuity references.
  const shotId = id();
  const takes = { a: id(), b: id() };
  const storyId = id();
  const story = (continuity: ContinuityRef[]): StoryDocument => ({
    format: "yamakan.story",
    formatVersion: 1,
    title: "One shot",
    scenes: [
      {
        id: id(),
        name: "One",
        shots: [
          {
            id: shotId,
            name: "Wide",
            durationTicks: 30 * FRAME,
            notes: "",
            referencePacks: [],
            takes: [
              { id: takes.a, assetId: asset.a.id, sourceStartTicks: 0 },
              {
                id: takes.b,
                assetId: asset.b.id,
                sourceStartTicks: 0,
                lineage: {
                  outputHash: asset.b.hash,
                  inputs: [],
                  continuity,
                },
              },
            ],
            selectedTakeId: takes.a,
          },
        ],
      },
    ],
  });
  let storyHash: string | null = null;
  const saveStory = async (continuity = refs()) => {
    const r = await run<{ document: { contentHash: string } }>(
      "yamakan.story.save",
      {
        expectedRevision: (await head()).revision,
        documentId: storyId,
        expectedContentHash: storyHash,
        story: story(continuity),
      },
    );
    storyHash = r.document.contentHash;
  };
  await saveStory();
  const before = await head();
  await run("yamakan.story.assemble", {
    expectedRevision: before.revision,
    documentId: storyId,
    trackId: before.tracks.find((t) => t.kind === "video")!.id,
  });
  const propose = (takeId: string) =>
    run<TakeProposal>("yamakan.take.proposeReplace", {
      documentId: storyId,
      shotId,
      takeId,
    });
  const apply = (p: TakeProposal) =>
    run("yamakan.take.apply", { expectedRevision: p.revision, proposal: p });
  const check = (stage: string, references = refs()) =>
    run<{
      metadataValid: boolean;
      consentChecked: boolean;
      references: { role: string; consentsChecked: string[] }[];
      continuity: { score: null; status: string };
    }>("yamakan.continuity.check", { stage, references });
  const clipAsset = async () => {
    const p = await head();
    const shot = p.scenes
      .flatMap((s) => s.shots ?? [])
      .find((s) => s?.id === shotId)!;
    return p.clips.find((c) => c.id === shot.clipIds[0])!.assetId;
  };
  return {
    root,
    store,
    call,
    run,
    head,
    projectId: project.id,
    asset,
    consents: { likeness, voiceConsent, encodeConsent },
    encoding,
    entries,
    pack,
    packId,
    savePack,
    packV1,
    refs,
    takes,
    saveStory,
    propose,
    apply,
    check,
    clipAsset,
  };
}

test("a take's references resolve; metadata validity is apart from an unmeasured score", async () => {
  const c = await workspace();
  const r = await c.check("attempt");
  assert.equal(r.metadataValid, true);
  assert.equal(r.consentChecked, true);
  assert.deepEqual(
    r.references.map((x) => x.role),
    ["character", "voice"],
  );
  // The likeness consent and the encoding's own consent; the voice consent.
  assert.deepEqual(r.references[0]!.consentsChecked, [
    c.consents.likeness,
    c.consents.encodeConsent,
  ]);
  assert.deepEqual(r.references[1]!.consentsChecked, [c.consents.voiceConsent]);
  assert.deepEqual(r.continuity, {
    score: null,
    status: "unmeasured",
    basis:
      "Matching hashes show which references a take named, not that it resembles them.",
  });
  assert.equal((await c.check("record")).consentChecked, false);
  // The attach puts the take on the timeline.
  await c.apply(await c.propose(c.takes.b));
  assert.equal(await c.clipAsset(), c.asset.b.id);
});

test("a pack update leaves old takes traceable to the version they named", async () => {
  const c = await workspace();
  const v2 = await c.savePack(c.pack("Lead, recast"), c.packV1);
  assert.notEqual(v2, c.packV1);
  // The old take still names v1, which the project held: traceable at
  // every stage while its consents stand, and the story saves unchanged.
  assert.equal((await c.check("record")).metadataValid, true);
  assert.equal((await c.check("attach")).metadataValid, true);
  await c.saveStory();
  await c.apply(await c.propose(c.takes.b));
  // A new take may name v2; both versions resolve.
  assert.equal((await c.check("attempt", c.refs(v2))).metadataValid, true);
});

test("a revoked grant blocks new effects and keeps history", async () => {
  const c = await workspace();
  const proposal = await c.propose(c.takes.b);
  await c.call("yamakan.consent.revoke", {
    consentId: c.consents.voiceConsent,
  });
  assert.match(await failure(c.check("attempt")), /^VALIDATION: .*revoked/);
  const revision = (await c.head()).revision;
  assert.match(await failure(c.apply(proposal)), /^VALIDATION: .*revoked/);
  assert.equal((await c.head()).revision, revision);
  assert.equal(await c.clipAsset(), c.asset.a.id);
  // History is kept: the references are still traceable, and the story
  // with the old take still saves.
  const record = await c.check("record");
  assert.equal(record.metadataValid, true);
  assert.equal(record.consentChecked, false);
  await c.saveStory();
});

test("a check before an attempt is not an approval at attach; expiry counts too", async () => {
  const c = await workspace();
  assert.equal((await c.check("attempt")).metadataValid, true);
  const proposal = await c.propose(c.takes.b);
  // The encoding's own consent is revoked after the attempt was checked.
  await c.call("yamakan.consent.revoke", {
    consentId: c.consents.encodeConsent,
  });
  assert.match(await failure(c.apply(proposal)), /^VALIDATION: .*revoked/);
  assert.match(await failure(c.check("attach")), /^VALIDATION/);
  assert.equal(await c.clipAsset(), c.asset.a.id);
  // Expiry counts the same way: two days on, every consent here has run
  // out, so neither a check nor an attach of the take succeeds.
  const fresh = await workspace();
  const later = await fresh.propose(fresh.takes.b);
  const realNow = Date.now;
  Date.now = () => realNow() + 2 * DAY;
  try {
    assert.match(
      await failure(fresh.check("attempt")),
      /^VALIDATION: .*expired/,
    );
    assert.match(await failure(fresh.apply(later)), /^VALIDATION: .*expired/);
  } finally {
    Date.now = realNow;
  }
  assert.equal(await fresh.clipAsset(), fresh.asset.a.id);
  // Traceable all the same.
  assert.equal((await fresh.check("record")).metadataValid, true);
});

test("a revocation racing an attach either lands after it or refuses it", async () => {
  const c = await workspace();
  const proposal = await c.propose(c.takes.b);
  const revision = (await c.head()).revision;
  const [applied, revoked] = await Promise.all([
    failure(c.apply(proposal)),
    failure(
      c.call("yamakan.consent.revoke", { consentId: c.consents.likeness }),
    ),
  ]);
  assert.equal(revoked, "ok");
  if (applied === "ok") {
    assert.equal((await c.head()).revision, revision + 1);
    assert.equal(await c.clipAsset(), c.asset.b.id);
  } else {
    assert.match(applied, /^VALIDATION: .*revoked/);
    assert.equal((await c.head()).revision, revision);
    assert.equal(await c.clipAsset(), c.asset.a.id);
  }
  // Whichever won, no attach after the revocation has effect.
  if (applied === "ok") await c.apply(await c.propose(c.takes.a));
  assert.match(
    await failure(c.apply(await c.propose(c.takes.b))),
    /^VALIDATION: .*revoked/,
  );
});

test("foreign references, forged encoding hashes and misplaced encodings are refused", async () => {
  const c = await workspace();
  // A pack version of another project in the same workspace.
  const other = await c.call<Project>("yamakan.project.create", {
    name: "Other",
  });
  const otherStill = (
    await c.store.importAsset(
      other.id,
      "s.png",
      await readFile(path.join(c.root, "still.png")),
    )
  ).asset;
  const otherPack = id();
  const foreign = (
    await c.call<{ document: { contentHash: string } }>("yamakan.pack.save", {
      projectId: other.id,
      expectedRevision: (await c.store.load(other.id)).revision,
      documentId: otherPack,
      expectedContentHash: null,
      pack: {
        format: "yamakan.reference-pack",
        formatVersion: 1,
        name: "Theirs",
        entries: [
          {
            id: c.entries.room,
            role: "environment",
            label: "Their room",
            assetId: otherStill.id,
            assetHash: otherStill.hash,
            characterId: null,
            consentId: null,
          },
        ],
      },
    })
  ).document.contentHash;
  const ref = (over: Partial<ContinuityRef>): ContinuityRef[] => [
    {
      packDocumentId: c.packId,
      packContentHash: c.packV1,
      entryId: c.entries.room,
      ...over,
    },
  ];
  for (const [refs, pattern] of [
    [
      ref({ packDocumentId: otherPack, packContentHash: foreign }),
      /does not hold/,
    ],
    [ref({ packContentHash: foreign }), /does not hold/],
    [ref({ entryId: id() }), /does not have in that version/],
    [
      ref({
        encoding: { id: c.encoding.id, payloadHash: c.encoding.payloadHash },
      }),
      /Only a character reference/,
    ],
    [
      ref({
        entryId: c.entries.lead,
        encoding: { id: c.encoding.id, payloadHash: "cd".repeat(32) },
      }),
      /does not match a recorded one/,
    ],
    [
      ref({
        entryId: c.entries.lead,
        encoding: { id: id(), payloadHash: c.encoding.payloadHash },
      }),
      /does not match a recorded one/,
    ],
    [[...ref({}), ...ref({})], /each reference entry once/],
  ] as const) {
    assert.match(await failure(c.check("record", [...refs])), pattern);
    // A story naming them is refused at save, before anything is kept.
    assert.match(await failure(c.saveStory([...refs])), pattern);
  }
  // Another character's encoding on the lead's entry.
  const otherConsent = await c.call<{ id: string }>("yamakan.consent.grant", {
    characterId: "stranger",
    purpose: "identity-encode",
    version: "v1",
    ttlMs: DAY,
  });
  const strangers = await c.call<{ id: string; payloadHash: string }>(
    "yamakan.identity.encode",
    {
      characterId: "stranger",
      purpose: "identity-encode",
      consentId: otherConsent.id,
      provider: "stand-in",
      method: "none",
      payloadHash: "ef".repeat(32),
    },
  );
  assert.match(
    await failure(
      c.check(
        "attempt",
        ref({
          entryId: c.entries.lead,
          encoding: { id: strangers.id, payloadHash: strangers.payloadHash },
        }),
      ),
    ),
    /does not match a recorded one/,
  );
});

test("a voice reference is project audio under voice-clone consent", async () => {
  const c = await workspace();
  const withVoice = (asset: Project["assets"][number], consentId: string) => {
    const p = c.pack();
    const v = p.entries.find((e) => e.role === "voice")!;
    Object.assign(v, { assetId: asset.id, assetHash: asset.hash, consentId });
    return p;
  };
  assert.match(
    await failure(
      c.savePack(withVoice(c.asset.still, c.consents.voiceConsent), c.packV1),
    ),
    /^VALIDATION: Voice reference "Lead voice" is project audio/,
  );
  assert.match(
    await failure(
      c.savePack(withVoice(c.asset.voice, c.consents.likeness), c.packV1),
    ),
    /^VALIDATION: .*does not allow voice-clone/,
  );
  const audioCharacter = c.pack();
  Object.assign(audioCharacter.entries[0]!, {
    assetId: c.asset.voice.id,
    assetHash: c.asset.voice.hash,
  });
  assert.match(
    await failure(c.savePack(audioCharacter, c.packV1)),
    /^VALIDATION: A reference is a still or footage/,
  );
  const consentOnRoom = c.pack();
  Object.assign(consentOnRoom.entries[2]!, {
    characterId: "lead",
    consentId: c.consents.likeness,
  });
  assert.match(
    await failure(c.savePack(consentOnRoom, c.packV1)),
    /^VALIDATION: (pack: )?Only a character or voice reference links a consent/,
  );
});
