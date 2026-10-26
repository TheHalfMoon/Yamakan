// EngineAdapter v2 (YU-040): operation-based, model-independent requests
// with immutable asset handles. Engines stay off (ENGINE_ENABLED); this is
// the contract a qualified worker or provider adapter will implement.
//
// Each operation has its own strict schema: no graph, model class, plugin,
// URL or file path ever crosses it, and inputs name immutable asset
// versions by id and hash. Capability constraints enumerate what an engine
// actually supports, and a request is checked against them before any
// worker is spawned. Media never travels as whole-file byte arrays: the
// service resolves handles to streams, and outputs are named artifacts the
// service reads back in bounded chunks, re-hashing before it publishes.
import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../hash/canonical.ts";

export const ENGINE_CONTRACT_V2 = "yamakan.engine-adapter/v2";

// Bounds on everything an adapter returns or accepts.
export const ENGINE_V2_LIMITS = Object.freeze({
  promptChars: 4000,
  diagnosticChars: 500,
  artifacts: 32,
  artifactBytes: 4 * 1024 * 1024 * 1024,
  // Artifact reads arrive in chunks of at most this size.
  chunkBytes: 1024 * 1024,
  deadlineMs: 6 * 60 * 60 * 1000,
  dimension: 8192,
  durationTicks: 705_600_000 * 60 * 10,
});

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
// Server-assigned ids: never paths, URLs or class names.
const Ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
export const Operation = z.enum([
  "textToVideo",
  "imageToVideo",
  "videoEdit",
  "transcribe",
  "enhance",
]);
export type Operation = z.infer<typeof Operation>;
const MediaType = z.enum([
  "image/png",
  "image/jpeg",
  "video/mp4",
  "audio/wav",
  "text/vtt",
]);

// An immutable asset version of the project, by id and content hash.
export const AssetRefSchema = z
  .object({ assetVersionId: Ref, sha256: Sha256, mediaType: MediaType })
  .strict();
export type AssetRef = z.infer<typeof AssetRefSchema>;

const Fps = z
  .object({
    num: z.number().int().min(1).max(240_000),
    den: z.number().int().min(1).max(1001),
  })
  .strict();
const VideoOutput = z
  .object({
    kind: z.literal("video"),
    width: z
      .number()
      .int()
      .min(16)
      .max(ENGINE_V2_LIMITS.dimension)
      .multipleOf(2),
    height: z
      .number()
      .int()
      .min(16)
      .max(ENGINE_V2_LIMITS.dimension)
      .multipleOf(2),
    fps: Fps,
    durationTicks: z
      .number()
      .int()
      .positive()
      .max(ENGINE_V2_LIMITS.durationTicks),
    audio: z.boolean(),
  })
  .strict();
const TranscriptOutput = z
  .object({
    kind: z.literal("transcript"),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)
      .optional(),
  })
  .strict();

// Named, bounded controls; which ones an engine honours is part of its
// capability, never assumed from the request.
const RESERVED_KEYS = new Set(
  Object.getOwnPropertyNames(Object.prototype).concat("prototype"),
);
const Controls = z
  .record(
    z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]{0,39}$/)
      .refine((k) => !RESERVED_KEYS.has(k), "Reserved control name."),
    z.union([
      z.number().finite().min(-1e6).max(1e6),
      z.boolean(),
      // An enumerated choice, never a path, URL or name of code.
      z.string().regex(/^[a-z0-9_-]{1,40}$/),
    ]),
  )
  .refine((c) => Object.keys(c).length <= 32, "At most 32 controls.");

const common = {
  contract: z.literal(ENGINE_CONTRACT_V2),
  // A server-owned recipe and the exact manifest it was qualified with.
  recipeId: Ref,
  recipeHash: Sha256,
  modelManifestHash: Sha256,
  seed: z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 32 - 1)
    .optional(),
  controls: Controls.optional(),
  // The durable attempt this execution belongs to, fenced by generation.
  attemptKey: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  leaseGeneration: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  deadlineMs: z.number().int().positive().max(ENGINE_V2_LIMITS.deadlineMs),
  resourcePolicyHash: Sha256,
};
const Prompt = z.string().min(1).max(ENGINE_V2_LIMITS.promptChars);
const input = <R extends string>(
  role: R,
  media: readonly z.infer<typeof MediaType>[],
) =>
  z
    .object({
      role: z.literal(role),
      asset: AssetRefSchema.refine((a) => media.includes(a.mediaType), {
        message: `A ${role} input is ${media.join(" or ")}.`,
      }),
      atTicks: z
        .number()
        .int()
        .nonnegative()
        .max(ENGINE_V2_LIMITS.durationTicks)
        .optional(),
    })
    .strict();

// One strict schema per operation: roles, counts and media are exact.
export const EngineRequestV2Schema = z.discriminatedUnion("operation", [
  z
    .object({
      ...common,
      operation: z.literal("textToVideo"),
      prompt: Prompt,
      inputs: z.tuple([]),
      output: VideoOutput,
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("imageToVideo"),
      prompt: Prompt.optional(),
      inputs: z.union([
        z.tuple([input("firstFrame", ["image/png", "image/jpeg"])]),
        z.tuple([
          input("firstFrame", ["image/png", "image/jpeg"]),
          input("lastFrame", ["image/png", "image/jpeg"]),
        ]),
      ]),
      output: VideoOutput,
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("videoEdit"),
      prompt: Prompt,
      inputs: z.union([
        z.tuple([input("source", ["video/mp4"])]),
        z.tuple([input("source", ["video/mp4"]), input("mask", ["image/png"])]),
      ]),
      output: VideoOutput,
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("transcribe"),
      inputs: z.tuple([input("audio", ["audio/wav", "video/mp4"])]),
      output: TranscriptOutput,
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("enhance"),
      inputs: z.tuple([input("source", ["video/mp4"])]),
      output: VideoOutput,
    })
    .strict(),
]);
export type EngineRequestV2 = z.infer<typeof EngineRequestV2Schema>;

export const RefusalReason = z.enum([
  "ENGINE_DISABLED",
  "WEIGHTS_ABSENT",
  "HARDWARE_UNQUALIFIED",
  "RIGHTS_UNQUALIFIED",
  "CONTROL_UNSUPPORTED",
  "OUTPUT_UNSUPPORTED",
  "RECIPE_UNKNOWN",
  "INPUT_UNSUPPORTED",
  "STALE_ATTEMPT",
  // The same attempt and generation, with a different request.
  "ATTEMPT_CONFLICT",
  "INVALID_REQUEST",
]);
export type RefusalReason = z.infer<typeof RefusalReason>;

// What one engine supports for one operation, measured, not promised.
export const ConstraintsSchema = z
  .object({
    maxWidth: z.number().int().positive().max(ENGINE_V2_LIMITS.dimension),
    maxHeight: z.number().int().positive().max(ENGINE_V2_LIMITS.dimension),
    fps: z.array(Fps).max(16),
    minDurationTicks: z.number().int().positive(),
    maxDurationTicks: z
      .number()
      .int()
      .positive()
      .max(ENGINE_V2_LIMITS.durationTicks),
    audio: z.boolean(),
    controls: z.array(z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/)).max(32),
    // The input roles this engine honours (a request using another refuses).
    roles: z.array(z.string().regex(/^[a-zA-Z]{1,40}$/)).max(8),
  })
  .strict()
  .refine(
    (c) => c.minDurationTicks <= c.maxDurationTicks,
    "Durations in order.",
  );
export type Constraints = z.infer<typeof ConstraintsSchema>;
export const CapabilityV2Schema = z
  .object({
    operation: Operation,
    available: z.boolean(),
    reason: RefusalReason.optional(),
    qualificationHash: Sha256.optional(),
    constraints: ConstraintsSchema.optional(),
    constraintsHash: Sha256,
  })
  .strict()
  // Available means measured constraints; unavailable means a reason.
  .refine(
    (c) => (c.available ? Boolean(c.constraints) : Boolean(c.reason)),
    "Capability is inconsistent.",
  )
  .refine(
    (c) => c.constraintsHash === constraintsHash(c.constraints ?? null),
    "Constraints hash does not match.",
  );
export type CapabilityV2 = z.infer<typeof CapabilityV2Schema>;

export const constraintsHash = (constraints: Constraints | null) =>
  createHash("sha256")
    .update(canonicalJson(constraints ?? null))
    .digest("hex");

// Why a request cannot run on this capability, decided before any worker
// is spawned; null when it may run.
export function refusal(
  request: EngineRequestV2,
  capability: CapabilityV2 | undefined,
): RefusalReason | null {
  if (!capability || !capability.available)
    return capability?.reason ?? "ENGINE_DISABLED";
  const c = capability.constraints;
  if (!c) return "HARDWARE_UNQUALIFIED";
  if (capability.operation !== request.operation) return "ENGINE_DISABLED";
  const supported = new Set(c.controls);
  if (Object.keys(request.controls ?? {}).some((k) => !supported.has(k)))
    return "CONTROL_UNSUPPORTED";
  const roles = new Set(c.roles);
  if (request.inputs.some((i) => !roles.has(i.role)))
    return "INPUT_UNSUPPORTED";
  const out = request.output;
  if (out.kind === "video") {
    if (out.width > c.maxWidth || out.height > c.maxHeight)
      return "OUTPUT_UNSUPPORTED";
    if (
      out.durationTicks < c.minDurationTicks ||
      out.durationTicks > c.maxDurationTicks
    )
      return "OUTPUT_UNSUPPORTED";
    if (!c.fps.some((f) => f.num * out.fps.den === out.fps.num * f.den))
      return "OUTPUT_UNSUPPORTED";
    if (out.audio && !c.audio) return "OUTPUT_UNSUPPORTED";
  }
  return null;
}

// Observations an adapter reports: bounded, never canonical job state (the
// durable JobSupervisor owns that).
const Diagnostic = z.string().max(ENGINE_V2_LIMITS.diagnosticChars);
export const ExecutionStatusSchema = z
  .object({
    executionRef: Ref,
    state: z.enum([
      "queued",
      "running",
      "succeeded",
      "failed",
      "cancelled",
      "unknown",
    ]),
    progress: z.number().min(0).max(1).optional(),
    diagnostic: Diagnostic.optional(),
  })
  .strict();
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export const CancellationSchema = z
  .object({
    requested: z.boolean(),
    localProcessExited: z.boolean(),
    remoteAcknowledged: z.boolean().optional(),
    remoteOutcome: z.enum(["stopped", "continuing", "unknown"]).optional(),
    billingOutcome: z
      .enum(["notApplicable", "refunded", "charged", "unknown"])
      .optional(),
  })
  .strict();
export type Cancellation = z.infer<typeof CancellationSchema>;
// An output by stage-relative name (never a path), its length and hash.
export const ExecutionRef = Ref;
export const ArtifactSchema = z
  .object({
    handle: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
    mediaType: MediaType,
    byteLength: z.number().int().positive().max(ENGINE_V2_LIMITS.artifactBytes),
    sha256: Sha256,
  })
  .strict();
export type Artifact = z.infer<typeof ArtifactSchema>;

// What the trusted service hands an adapter: assets resolved to streams by
// handle, inside the service; the adapter never sees a path.
export type EngineContextV2 = {
  openAsset(asset: AssetRef): AsyncIterable<Uint8Array>;
};

export type EngineAdapterV2 = {
  readonly contract: typeof ENGINE_CONTRACT_V2;
  capabilities(): CapabilityV2[];
  // An external execution reference tied to the durable attempt, or the
  // reason it cannot run (decided before any worker exists).
  submit(
    request: EngineRequestV2,
    context: EngineContextV2,
  ): Promise<{ executionRef: string } | { refused: RefusalReason }>;
  status(executionRef: string): Promise<ExecutionStatus>;
  requestCancel(executionRef: string): Promise<Cancellation>;
  enumerateArtifacts(executionRef: string): Promise<Artifact[]>;
  // An artifact's bytes in bounded chunks; the service re-hashes them.
  readArtifact(executionRef: string, handle: string): AsyncIterable<Uint8Array>;
  // After a restart: what is known about an execution, never a resubmit.
  reconcile(executionRef: string): Promise<ExecutionStatus>;
};

// Diagnostics leave an adapter bounded and without paths or URLs.
export function diagnostic(text: string | undefined) {
  if (!text) return undefined;
  // Best effort: URLs, drive paths and multi-segment absolute paths go;
  // ordinary text such as "1/2" stays. Only a bounded prefix is examined.
  const redacted = text
    .slice(0, 4 * ENGINE_V2_LIMITS.diagnosticChars)
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]")
    .replace(/[A-Za-z]:[\\/][^\s"']*/g, "[path]")
    .replace(/(?:[\\/][^\s\\/"']+){2,}[\\/]?/g, "[path]");
  // At most diagnosticChars UTF-16 units, never cut inside a pair.
  let out = "";
  for (const point of redacted) {
    if (out.length + point.length > ENGINE_V2_LIMITS.diagnosticChars) break;
    out += point;
  }
  return out;
}

export const requestHash = (request: EngineRequestV2) =>
  createHash("sha256").update(canonicalJson(request)).digest("hex");

type SubmitResult = { executionRef: string } | { refused: RefusalReason };
// Attempt fencing shared by adapters. A claim is taken synchronously,
// before any await. Per attempt key the highest generation seen only ever
// rises (a refusal never lowers it), so an older generation is always
// stale; the current generation replays its first result for the same
// request, and a refusal or failure frees that generation for a retry.
// The latest live execution per attempt is recorded apart from claims, so
// refusals and failures in between never lose it: on success an adapter
// calls supersede(), which names the older execution to cancel (or its own,
// when a newer generation is already live). Generations are minted by the
// service alone; a refused claim still raises the highest generation. Fences live in memory: once workers exist,
// the durable JobSupervisor fence is authoritative, and publication of an
// artifact is fenced by the service (generation and cancellation), not here.
export class AttemptFence {
  #highest = new Map<string, number>();
  #current = new Map<
    string,
    { generation: number; hash: string; result: Promise<SubmitResult> }
  >();
  #live = new Map<string, { generation: number; executionRef: string }>();
  claim(request: EngineRequestV2):
    | { kind: "done"; result: Promise<SubmitResult> }
    | {
        kind: "fresh";
        supersede(executionRef: string): string | null;
        settle(result: SubmitResult): SubmitResult;
      } {
    const key = request.attemptKey;
    const highest = this.#highest.get(key) ?? 0;
    if (request.leaseGeneration < highest)
      return {
        kind: "done",
        result: Promise.resolve({ refused: "STALE_ATTEMPT" }),
      };
    const hash = requestHash(request);
    const slot = this.#current.get(key);
    if (slot && slot.generation === request.leaseGeneration)
      return {
        kind: "done",
        result:
          slot.hash === hash
            ? slot.result
            : Promise.resolve({ refused: "ATTEMPT_CONFLICT" }),
      };
    let resolve!: (r: SubmitResult) => void;
    const result = new Promise<SubmitResult>((r) => (resolve = r));
    const entry = { generation: request.leaseGeneration, hash, result };
    this.#highest.set(key, request.leaseGeneration);
    this.#current.set(key, entry);
    return {
      kind: "fresh",
      // This generation's execution is live: returns the execution that
      // must now be cancelled (an older live one, or this one if a newer
      // generation went live first), or null.
      supersede: (executionRef) => {
        const live = this.#live.get(key);
        if (live && live.generation > request.leaseGeneration)
          return executionRef;
        this.#live.set(key, {
          generation: request.leaseGeneration,
          executionRef,
        });
        return live && live.executionRef !== executionRef
          ? live.executionRef
          : null;
      },
      settle: (r) => {
        resolve(r);
        if ("refused" in r && this.#current.get(key) === entry)
          this.#current.delete(key);
        return r;
      },
    };
  }
}

// Runs an adapter's work for a fresh claim: whatever it returns settles the
// claim, and a throw releases it (as a refusal) before propagating, so a
// failed submit never leaves its generation waiting forever.
export async function underClaim(
  claim: { settle(result: SubmitResult): SubmitResult },
  work: () => Promise<SubmitResult>,
) {
  let result: SubmitResult;
  try {
    result = await work();
  } catch (e) {
    claim.settle({ refused: "INVALID_REQUEST" });
    throw e;
  }
  return claim.settle(result);
}

// The service reads an artifact through this: chunks bounded, the total
// bounded by the declared length, and the bytes re-hashed. The sink sees
// bytes before the final hash check, so it must stage them and discard
// them if this throws.
export async function readArtifactVerified(
  adapter: EngineAdapterV2,
  executionRef: string,
  artifact: Artifact,
  sink: (chunk: Uint8Array) => void = () => {},
) {
  ArtifactSchema.parse(artifact);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of adapter.readArtifact(
    executionRef,
    artifact.handle,
  )) {
    if (!(chunk instanceof Uint8Array))
      throw new Error("An artifact chunk is not bytes.");
    if (chunk.byteLength > ENGINE_V2_LIMITS.chunkBytes)
      throw new Error("An artifact chunk is larger than allowed.");
    bytes += chunk.byteLength;
    if (bytes > artifact.byteLength)
      throw new Error("An artifact is longer than it declared.");
    hash.update(chunk);
    sink(chunk);
  }
  if (bytes !== artifact.byteLength || hash.digest("hex") !== artifact.sha256)
    throw new Error("An artifact does not match its declared length and hash.");
  return { bytes };
}

// Parses a request from outside the service: any unknown field (a graph,
// URL, path, class or plugin) is refused, as is any wrong role or media.
export function parseRequestV2(value: unknown): EngineRequestV2 {
  return EngineRequestV2Schema.parse(value);
}

// The capability of an engine-less build: every operation disabled.
export function absentCapabilitiesV2(): CapabilityV2[] {
  return Operation.options.map((operation) => ({
    operation,
    available: false,
    reason: "ENGINE_DISABLED" as const,
    constraintsHash: constraintsHash(null),
  }));
}
