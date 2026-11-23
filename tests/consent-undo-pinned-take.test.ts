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

  test(`${what} cannot return by undo, redo, placing or restore`, async () => {
    const s = await scene(kind);
    const { c } = s;
    const removed = await s.edit([{ type: "clip.remove", clipId: s.clip.id }]);
    // A redo to refuse too: a placement undone before the revocation.
    const added = id();
    await s.edit([{ ...s.add(), clipId: added }]);
    await s.undo();
    assert.equal(
      (await head(c)).clips.some((x) => x.id === added),
      false,
    );
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
