// The prompt library's presets kept with the project: one `promptPresets` document per project,
// saved only by yamakan.prompt.savePresets, checked against the library, and kept across a
// restart of the service.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import type { Project } from "../core/project.ts";
import {
  PROMPT_PRESET_LIMITS,
  emptyPromptPresets,
  withoutMissingTemplates,
  type PromptPreset,
  type PromptPresetsDocument,
} from "../core/prompts/presets.ts";

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
    return "";
  } catch (e) {
    return toCommandError(e).message;
  }
};

async function open(root: string) {
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  return { store, queue, ctx };
}

const preset = (over: Partial<PromptPreset> = {}): PromptPreset => ({
  id: id(),
  name: "Rainy harbour",
  templateId: "yamakan.rain-night-street",
  language: "en",
  values: [{ field: "place", value: "a harbour road" }],
  prompt: "Rain falling on a harbour road at night.",
  ...over,
});
const doc = (...presets: PromptPreset[]): PromptPresetsDocument => ({
  ...emptyPromptPresets(),
  presets,
});

test("presets are saved with the project, read back, and kept across a restart", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-presets-"));
  bases.push(root);
  const { ctx, queue } = await open(root);
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Presets" })
  ).result as Project;
  const documentId = id();
  const first = doc(
    preset(),
    preset({
      name: "Free text",
      templateId: null,
      values: [],
      language: "ar",
      prompt: "قارب ورقي على بركة ماء.",
    }),
  );
  const saved = (
    await execute(ctx, "yamakan.prompt.savePresets", {
      projectId: project.id,
      expectedRevision: project.revision,
      documentId,
      expectedContentHash: null,
      presets: first,
    })
  ).result as {
    project: Project;
    document: { id: string; kind: string; contentHash: string };
  };
  assert.equal(saved.project.revision, project.revision + 1);
  assert.equal(saved.document.kind, "promptPresets");

  // A second save compares against the first's hash and the new head.
  const second = doc(...first.presets.slice(1));
  assert.equal(
    await code(
      execute(ctx, "yamakan.prompt.savePresets", {
        projectId: project.id,
        expectedRevision: saved.project.revision,
        documentId,
        expectedContentHash: null,
        presets: second,
      }),
    ),
    "REVISION_CONFLICT",
  );
  const after = (
    await execute(ctx, "yamakan.prompt.savePresets", {
      projectId: project.id,
      expectedRevision: saved.project.revision,
      documentId,
      expectedContentHash: saved.document.contentHash,
      presets: second,
    })
  ).result as { project: Project };

  // Another presets document in the same project is refused.
  assert.match(
    await message(
      execute(ctx, "yamakan.prompt.savePresets", {
        projectId: project.id,
        expectedRevision: after.project.revision,
        documentId: id(),
        expectedContentHash: null,
        presets: first,
      }),
    ),
    /keeps its prompt presets in document/,
  );
  await queue.close();

  // Reopened by a new service on the same workspace.
  const again = await open(root);
  const listed = (
    await execute(again.ctx, "yamakan.document.list", {
      projectId: project.id,
    })
  ).result as { id: string; kind: string }[];
  assert.deepEqual(
    listed.filter((d) => d.kind === "promptPresets").map((d) => d.id),
    [documentId],
  );
  const read = (
    await execute(again.ctx, "yamakan.document.get", {
      projectId: project.id,
      documentId,
    })
  ).result as { content: PromptPresetsDocument };
  assert.deepEqual(read.content, second);
  await again.queue.close();
});

test("presets are checked against the library, and only their own command saves them", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-presets-"));
  bases.push(root);
  const { ctx, queue } = await open(root);
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Checks" })
  ).result as Project;
  const save = (presets: unknown) =>
    message(
      execute(ctx, "yamakan.prompt.savePresets", {
        projectId: project.id,
        expectedRevision: project.revision,
        documentId: id(),
        expectedContentHash: null,
        presets,
      }),
    );
  const same = id();
  for (const [bad, why] of [
    [doc(preset({ templateId: "yamakan.nope" })), /names no library template/],
    [
      doc(preset({ values: [{ field: "colour", value: "red" }] })),
      /field colour its template does not/,
    ],
    [
      doc(
        preset({
          values: [
            { field: "place", value: "a" },
            { field: "place", value: "b" },
          ],
        }),
      ),
      /gives a field twice/,
    ],
    [
      doc(
        preset({ templateId: null, values: [{ field: "place", value: "x" }] }),
      ),
      /no template for its fields/,
    ],
    [doc(preset({ id: same }), preset({ id: same, name: "B" })), /used twice/],
    [doc(preset(), preset({ name: "rainy HARBOUR" })), /Two presets are named/],
  ] as const)
    assert.match(await save(bad), why);
  // Bounded by the schema: an empty or over-long prompt, and too many presets.
  for (const bad of [
    doc(preset({ prompt: "  " })),
    doc(preset({ prompt: "x".repeat(2001) })),
    doc(preset({ name: "x".repeat(81) })),
    doc(
      ...Array.from({ length: PROMPT_PRESET_LIMITS.presets + 1 }, (_, i) =>
        preset({ name: `P${i}` }),
      ),
    ),
  ])
    assert.equal(
      await code(
        execute(ctx, "yamakan.prompt.savePresets", {
          projectId: project.id,
          expectedRevision: project.revision,
          documentId: id(),
          expectedContentHash: null,
          presets: bad,
        }),
      ),
      "VALIDATION",
    );
  // The generic commit refuses the kind; nothing was saved.
  assert.match(
    await message(
      execute(ctx, "yamakan.document.commit", {
        projectId: project.id,
        expectedRevision: project.revision,
        documentId: id(),
        kind: "promptPresets",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: "0".repeat(64) },
      }),
    ),
    /yamakan.prompt.savePresets/,
  );
  const listed = (
    await execute(ctx, "yamakan.document.list", { projectId: project.id })
  ).result as unknown[];
  assert.equal(listed.length, 0);
  await queue.close();
});

test("a preset whose template is gone is saved as the prompt it made", () => {
  const gone = preset({ templateId: "yamakan.withdrawn" });
  const kept = preset({ name: "Kept" });
  assert.deepEqual(withoutMissingTemplates([gone, kept]), [
    { ...gone, templateId: null, values: [] },
    kept,
  ]);
});
