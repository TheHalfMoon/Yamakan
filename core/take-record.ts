// Take records (MPR-101): how one take was made, as an immutable document of its own
// that the take names by hash. The story holds the hash only, so it stays small; the
// service writes every record from its own rows, except a declared one, which is a
// person's receipt file and says so. Nothing here reaches a model or a network.
import { z } from "zod";
import { CommandError } from "./command/errors.ts";
import {
  ENGINE_V2_LIMITS,
  EngineReportSchema,
  Operation,
} from "./engines/contract-v2.ts";
import type { GenerationRecord } from "./engines/generation.ts";
import { BLENDER_PIN } from "./blender/runtime.ts";
import { LIGHTING } from "./blender/scene.ts";
import type { BlenderPayload } from "./jobs.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import { Id } from "./project.ts";

export const TAKE_RECORD_LIMITS = Object.freeze({
  // Room for the largest record the schema below allows, a prompt of any characters included.
  recordBytes: 40 * 1024,
  inputs: 8,
  changedFields: 16,
  revisionNote: 500,
  recordsPerSave: 8,
});

/**
 * Whether a record holds the prompt's words, or only their hash. The founder accepted FD-2 for
 * the project and its backups (docs/FOUNDER_DECISION_RECORD.md); an export is not that. Both
 * are valid version 1 records, and one made before then keeps its hash alone.
 */
export const RECORD_HOLDS_PROMPT = true;

// What a revision may change from the take it was made from.
export const REVISION_FIELDS = [
  "recipe",
  "model",
  "prompt",
  "seed",
  "width",
  "height",
  "durationFrames",
  "fps",
  "steps",
  "firstFrame",
  "inputs",
] as const;

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const Whole = z.number().int().nonnegative();
const Finite = z.number().finite();
const Text = (max: number) => z.string().min(1).max(max);
// A receipt file may name an empty prompt.
const Prompt = z.string().max(ENGINE_V2_LIMITS.promptChars);

const GenerationRequestSchema = z
  .object({
    kind: z.literal("generation"),
    prompt: Prompt.optional(),
    promptHash: Sha256.nullable(),
    seed: Whole.nullable(),
    width: Whole.nullable(),
    height: Whole.nullable(),
    durationFrames: Whole.nullable(),
    fps: Finite.positive().nullable(),
    steps: Whole.nullable(),
  })
  .strict();

const RenderRequestSchema = z
  .object({
    kind: z.literal("render"),
    blenderVersion: Text(40),
    sceneFormat: Text(80),
    sceneHash: Sha256,
    width: Whole,
    height: Whole,
    fps: Finite.positive(),
    frames: Whole,
    samples: Whole,
    camera: z.object({ focalLengthMm: Finite, sensorWidthMm: Finite }).strict(),
    moves: z
      .object({
        orbitDegrees: Finite,
        dolly: Finite.optional(),
        panDegrees: Finite.optional(),
        shake: Finite.optional(),
      })
      .strict(),
    lighting: Text(40).optional(),
    view: Text(40).optional(),
    direction: z
      .array(z.object({ kind: Text(40), choice: Text(40) }).strict())
      .max(4)
      .optional(),
  })
  .strict();

export const TakeRecordSchema = z
  .object({
    format: z.literal("yamakan.take-record"),
    formatVersion: z.literal(1),
    origin: z.enum(["generation", "render", "declared"]),
    route: z.enum(["kaggle", "comfyui", "blender", "receiptFile"]),
    source: z
      .union([
        z.object({ generationId: Id }).strict(),
        z.object({ jobId: Id }).strict(),
      ])
      .nullable(),
    recipe: z
      .object({ id: Text(80), hash: Sha256 })
      .strict()
      .nullable(),
    model: z
      .object({
        id: Text(200),
        revision: Text(80).nullable(),
        manifestHash: Sha256.nullable(),
        licence: Text(80).nullable(),
      })
      .strict()
      .nullable(),
    operation: z.union([Operation, z.literal("render")]),
    request: z.discriminatedUnion("kind", [
      GenerationRequestSchema,
      RenderRequestSchema,
    ]),
    inputs: z
      .array(
        z
          .object({
            assetId: Id,
            assetHash: Sha256,
            role: z.enum([
              "firstFrame",
              "lastFrame",
              "source",
              "mask",
              "audio",
              "reference",
              "plate",
            ]),
          })
          .strict(),
      )
      .max(TAKE_RECORD_LIMITS.inputs),
    output: z.object({ sha256: Sha256 }).strict(),
    // What the run itself said (OA-16), beside what was asked for above: its runtime, the
    // provider's model id and version, and its seed. Null: it said nothing.
    reported: EngineReportSchema.nullable(),
    // Epoch milliseconds; null is not known.
    timings: z
      .object({
        startedAt: Whole.nullable(),
        endedAt: Whole.nullable(),
        importedAt: Whole.nullable(),
      })
      .strict(),
    // null: not reported.
    usage: z
      .object({
        wallMs: Whole.nullable(),
        quotaSeconds: Finite.nonnegative().nullable(),
      })
      .strict(),
    // The take this one revises, and that take's record, so the chain outlives the take.
    derivedFromTakeId: Id.nullable(),
    derivedFromRecordHash: Sha256.nullable(),
    // Why this take revises that one, in the person's words (OA-5).
    revisionNote: Text(TAKE_RECORD_LIMITS.revisionNote).nullable(),
    changedFields: z
      .array(z.enum(REVISION_FIELDS))
      .max(TAKE_RECORD_LIMITS.changedFields),
  })
  .strict()
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const render = r.origin === "render";
    if (
      render !== (r.request.kind === "render") ||
      render !== (r.operation === "render") ||
      render !== (r.route === "blender")
    )
      fail("Only a render's record holds a render request.");
    if ((r.origin === "declared") !== (r.route === "receiptFile"))
      fail("Only a declared record comes from a receipt file.");
    if (
      (r.source !== null && "jobId" in r.source) !== render ||
      (r.source === null) !== (r.origin === "declared")
    )
      fail("A take record names what it was made from.");
    if (r.derivedFromRecordHash !== null && r.derivedFromTakeId === null)
      fail("A record names the take it revises with its record.");
    if (r.revisionNote !== null && r.derivedFromTakeId === null)
      fail("A revision note is of a take that revises another.");
    if (r.origin !== "generation" && r.reported !== null)
      fail("Only a generation's run reports on itself.");
    if (new Set(r.changedFields).size !== r.changedFields.length)
      fail("A record names each changed field once.");
  });
export type TakeRecord = z.infer<typeof TakeRecordSchema>;

/** A record's name: the SHA-256 of its canonical JSON, which is what is stored. */
export const recordHashOf = (record: TakeRecord) =>
  sha256Hex(canonicalJson(record));

/** Pure validation of a parsed record (core/documents.ts bounds it first). */
export function validateTakeRecord(value: unknown) {
  const parsed = TakeRecordSchema.safeParse(value);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues.map((i) => i.message).join("; ") ||
        "Invalid take record.",
    );
  const content = parsed.data;
  return {
    content,
    assetIds: [...new Set(content.inputs.map((i) => i.assetId))].sort(),
    objectDigests: [],
  };
}

// What the service knows of a recipe beside its ledger row.
export type RecipeFacts = {
  route: "kaggle" | "comfyui";
  model: { id: string; revision: string | null; licence: string | null } | null;
  fps: number | null;
  steps: number | null;
};

/**
 * What differs between the requests of two records of generations, in the order of
 * REVISION_FIELDS; nothing, for an exact repeat. What only one of them says differs.
 */
export function diffRequests(
  base: TakeRecord,
  next: TakeRecord,
): (typeof REVISION_FIELDS)[number][] {
  const said = (r: TakeRecord) =>
    r.request as Partial<z.output<typeof GenerationRequestSchema>>;
  const of = (
    r: TakeRecord,
    other: TakeRecord,
  ): Record<(typeof REVISION_FIELDS)[number], unknown> => {
    const request = said(r);
    const pins = (first: boolean) =>
      r.inputs
        .filter((i) => (i.role === "firstFrame") === first)
        .map((i) => `${i.role} ${i.assetHash}`)
        .sort();
    return {
      recipe: r.recipe && [r.recipe.id, r.recipe.hash],
      model: r.model && [r.model.id, r.model.revision, r.model.manifestHash],
      // One of them may hold the hash alone.
      prompt:
        request.prompt !== undefined && said(other).prompt !== undefined
          ? request.prompt
          : request.promptHash,
      seed: request.seed,
      width: request.width,
      height: request.height,
      durationFrames: request.durationFrames,
      fps: request.fps,
      steps: request.steps,
      firstFrame: pins(true),
      inputs: pins(false),
    };
  };
  const was = of(base, next);
  const is = of(next, base);
  return REVISION_FIELDS.filter(
    (field) =>
      canonicalJson([was[field] ?? null]) !==
      canonicalJson([is[field] ?? null]),
  );
}

/**
 * The record of a generation whose video was imported, from its ledger row. `base` is the
 * record of the take it revises, when it revises one and that record can be read.
 */
export function buildGenerationRecord(
  row: GenerationRecord,
  facts: RecipeFacts,
  holdsPrompt: boolean = RECORD_HOLDS_PROMPT,
  base: TakeRecord | null = null,
): TakeRecord {
  if (!row.imported)
    throw new CommandError("VALIDATION", "This generation is not imported.");
  const { lineage } = row.imported;
  const endedAt = row.endedAt ?? null;
  const made = TakeRecordSchema.parse({
    format: "yamakan.take-record",
    formatVersion: 1,
    origin: "generation",
    route: facts.route,
    source: { generationId: row.generationId },
    recipe: { id: row.recipe.id, hash: row.recipe.hash },
    // Where nothing names the model, its recipe does.
    model: {
      id: facts.model?.id ?? row.recipe.id,
      revision: facts.model?.revision ?? null,
      manifestHash: row.recipe.modelManifestHash,
      licence: facts.model?.licence ?? null,
    },
    operation: row.recipe.operation,
    request: {
      kind: "generation",
      ...(holdsPrompt && row.prompt ? { prompt: row.prompt } : {}),
      promptHash: lineage.promptHash,
      seed: row.seed,
      width: row.width,
      height: row.height,
      durationFrames: row.durationFrames,
      fps: facts.fps,
      steps: facts.steps,
    },
    inputs: row.inputs.map((i) => ({
      assetId: i.assetId,
      assetHash: i.assetHash,
      // A first frame is the only input a run here takes today.
      role: i.assetId === row.firstFrameAssetId ? "firstFrame" : "source",
    })),
    output: { sha256: lineage.outputHash },
    reported: row.reported ?? null,
    timings: {
      startedAt: row.startedAt,
      endedAt,
      importedAt: row.importedAt ?? null,
    },
    usage: {
      wallMs: endedAt === null ? null : Math.max(0, endedAt - row.startedAt),
      // No route reports its quota today.
      quotaSeconds: null,
    },
    derivedFromTakeId: row.derivedFrom?.takeId ?? null,
    derivedFromRecordHash: row.derivedFrom?.recordHash ?? null,
    revisionNote: row.derivedFrom?.revisionNote ?? null,
    changedFields: [],
  });
  return row.derivedFrom && base
    ? { ...made, changedFields: diffRequests(base, made) }
    : made;
}

export const DeclaredSchema = z
  .object({
    model: Text(200),
    revision: Text(80).optional(),
    prompt: Prompt,
    seed: Whole,
    steps: Whole.optional(),
    licence: Text(80).optional(),
  })
  .strict();
export type Declared = z.infer<typeof DeclaredSchema>;

/** The record of a video brought in with a receipt file: its claims, not facts checked here. */
export function buildDeclaredRecord(
  declared: Declared,
  outputHash: string,
  inputs: readonly { assetId: string; assetHash: string }[],
  holdsPrompt: boolean = RECORD_HOLDS_PROMPT,
): TakeRecord {
  return TakeRecordSchema.parse({
    format: "yamakan.take-record",
    formatVersion: 1,
    origin: "declared",
    route: "receiptFile",
    source: null,
    recipe: null,
    model: {
      id: declared.model,
      revision: declared.revision ?? null,
      manifestHash: null,
      licence: declared.licence ?? null,
    },
    // A receipt file does not say; a take that names inputs was made from them.
    operation: inputs.length ? "imageToVideo" : "textToVideo",
    request: {
      kind: "generation",
      ...(holdsPrompt ? { prompt: declared.prompt } : {}),
      promptHash: sha256Hex(declared.prompt),
      seed: declared.seed,
      width: null,
      height: null,
      durationFrames: null,
      fps: null,
      steps: declared.steps ?? null,
    },
    inputs: inputs.map((i) => ({
      assetId: i.assetId,
      assetHash: i.assetHash,
      role: "source",
    })),
    output: { sha256: outputHash },
    // Its claims are the request above.
    reported: null,
    timings: { startedAt: null, endedAt: null, importedAt: null },
    usage: { wallMs: null, quotaSeconds: null },
    derivedFromTakeId: null,
    derivedFromRecordHash: null,
    revisionNote: null,
    changedFields: [],
  });
}

/** The record of a finished Blender render, from its job row. The scene itself stays there. */
export function buildRenderRecord(
  render: {
    jobId: string;
    payload: z.output<typeof BlenderPayload>;
    sceneHash: string;
  },
  outputHash: string,
): TakeRecord {
  const { scene, direction, plateAssetId, plateAssetHash } = render.payload;
  const { camera } = scene;
  const light = direction?.light;
  return TakeRecordSchema.parse({
    format: "yamakan.take-record",
    formatVersion: 1,
    origin: "render",
    route: "blender",
    source: { jobId: render.jobId },
    recipe: null,
    model: null,
    operation: "render",
    request: {
      kind: "render",
      // The only version a render here runs on.
      blenderVersion: BLENDER_PIN.version,
      sceneFormat: scene.format,
      sceneHash: render.sceneHash,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      frames: scene.frames,
      samples: scene.samples,
      camera: {
        focalLengthMm: camera.focalLengthMm,
        sensorWidthMm: camera.sensorWidthMm,
      },
      moves: {
        orbitDegrees: camera.orbitDegrees,
        dolly: camera.dolly,
        panDegrees: camera.panDegrees,
        shake: camera.shake,
      },
      // As the planner reads the direction (core/director/cinema-shot.ts).
      ...(light && Object.hasOwn(LIGHTING, light) ? { lighting: light } : {}),
      ...(direction?.shot === "aerial" ? { view: "aerial" } : {}),
      ...(direction && Object.keys(direction).length
        ? {
            direction: Object.entries(direction).map(([kind, choice]) => ({
              kind,
              choice,
            })),
          }
        : {}),
    },
    inputs:
      plateAssetId && plateAssetHash
        ? [{ assetId: plateAssetId, assetHash: plateAssetHash, role: "plate" }]
        : [],
    output: { sha256: outputHash },
    reported: null,
    // The job path keeps no times.
    timings: { startedAt: null, endedAt: null, importedAt: null },
    usage: { wallMs: null, quotaSeconds: null },
    derivedFromTakeId: null,
    derivedFromRecordHash: null,
    revisionNote: null,
    changedFields: [],
  });
}

/** A note's canonical bytes, at most (MPR-107). */
export const TAKE_REPLACEMENT_BYTES = 512;

/** One take replacement as it was applied. Written by the apply, never changed, held by its story. */
export const TakeReplacementSchema = z
  .object({
    format: z.literal("yamakan.take-replacement"),
    formatVersion: z.literal(1),
    documentId: Id,
    shotId: Id,
    // The take the shot showed, or null when its clips showed no one take.
    fromTakeId: Id.nullable(),
    toTakeId: Id,
    clips: z.number().int().positive().max(64),
    revision: z.number().int().nonnegative(),
    // As long as the workspace's own column for it.
    principalId: z.string().min(1).max(64),
  })
  .strict();
export type TakeReplacement = z.infer<typeof TakeReplacementSchema>;

export function validateTakeReplacement(value: unknown) {
  const parsed = TakeReplacementSchema.safeParse(value);
  if (!parsed.success)
    throw new CommandError("VALIDATION", "Invalid take replacement note.");
  return { content: parsed.data, assetIds: [], objectDigests: [] };
}
