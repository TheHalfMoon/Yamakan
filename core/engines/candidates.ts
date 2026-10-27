// First-engine candidates (YU-043): the exact source, runtime, Python
// closure and model files each candidate would load, frozen from source
// inspection with no weights downloaded. A candidate may be qualified only
// when nothing blocks selection; the status a manifest declares must equal
// what these rules compute, so no candidate is hand-marked eligible. No
// winner is chosen here: the comparison is predeclared and runs only on
// evidence.
import { z } from "zod";
import { Operation } from "./contract-v2.ts";
import { ACCEPTED_MODEL_LICENSES } from "./manifests.ts";

export const ENGINE_CANDIDATES_FORMAT = "yamakan.engine-candidates";

// The engine contract's input roles (EngineRequestV2Schema's inputs).
const Role = z.enum(["firstFrame", "lastFrame", "source", "mask", "audio"]);

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
// Any revision is written down as given; only a full commit id is pinned.
const Revision = z.string().min(1).max(64);
const Repo = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/);
const RelPath = z
  .string()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9._/-]{0,199}$/)
  .refine(
    (p) => !p.split("/").some((s) => s === ".." || s === ""),
    "A relative path.",
  );
const Evidence = z
  .object({
    path: RelPath,
    sha256: Sha256.optional(),
    line: z.number().int().positive().optional(),
    text: z.string().max(200).optional(),
  })
  .strict();
const License = z.string().min(1).max(120).nullable();

const Package = z
  .object({
    name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/),
    // An exact release; null when a candidate only states a range.
    version: z.string().max(40).nullable(),
    wheel: z.string().max(200).nullable(),
    sha256: Sha256.nullable(),
    license: License,
    licenseSource: z.enum(["expression", "license", "classifier"]).nullable(),
  })
  .strict();

const Lock = z
  .object({
    interpreter: z
      .object({
        implementation: z.literal("cpython"),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
        platform: z.string().max(40),
      })
      .strict(),
    resolver: z.string().max(200),
    accelerator: z.enum(["cpu", "cuda"]),
    packages: z.array(Package).min(1).max(400),
  })
  .strict();

const ModelFile = z
  .object({
    path: RelPath,
    bytes: z.number().int().nonnegative(),
    format: z.enum(["safetensors", "pickle", "json", "tokenizer", "other"]),
    sha256: Sha256.optional(),
    gitOid: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
  })
  .strict()
  .refine(
    (f) => (f.sha256 === undefined) !== (f.gitOid === undefined),
    "One content id.",
  );

const Candidate = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
    status: z.enum(["blocked", "eligibleForQualification"]),
    runtime: z
      .object({
        kind: z.enum(["native", "diffusers"]),
        source: z
          .object({
            repo: Repo,
            tag: z.string().max(40).optional(),
            commit: Revision,
            license: License,
            licenseEvidence: Evidence.nullable(),
          })
          .strict(),
        entry: z.array(Evidence.extend({ symbol: z.string().max(80) })).min(1),
        // What the upstream itself declares (a native repository's
        // requirements file), as written there.
        declaredRequirements: z
          .object({
            path: RelPath,
            sha256: Sha256,
            requirements: z.array(
              z
                .object({
                  name: z.string().max(100),
                  spec: z.string().max(100),
                })
                .strict(),
            ),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    lock: z.string().max(80).nullable(),
    model: z
      .object({
        repo: Repo,
        commit: Revision,
        license: License,
        licenseEvidence: Evidence.extend({
          kind: z.enum(["file", "card"]),
        }).nullable(),
        gated: z.boolean(),
        modelIndex: Evidence.optional(),
        files: z.array(ModelFile).min(1).max(64),
        codeFiles: z.array(RelPath),
      })
      .strict(),
    loading: z
      .object({
        trustRemoteCode: z.boolean(),
        customPipeline: z.string().max(200).nullable(),
        useSafetensors: z.boolean(),
        localFilesOnly: z.boolean(),
        unsafeLoads: z.array(
          Evidence.extend({
            call: z.string().max(200),
            weightsOnly: z.boolean(),
          }),
        ),
      })
      .strict(),
    remoteServices: z.array(
      z.object({ name: z.string().max(60), evidence: Evidence }).strict(),
    ),
    operations: z.array(
      z
        .object({
          operation: Operation,
          pipelineClass: z.string().max(80),
          roles: z.array(Role),
          // Inputs the pipeline accepts but does not use: a recipe must
          // refuse the role, never pass it through.
          ignoredInputs: z.array(
            z
              .object({
                parameter: z.string().max(60),
                role: Role,
                evidence: Evidence,
              })
              .strict(),
          ),
          controls: z.array(z.string().max(40)),
        })
        .strict(),
    ),
    cancellation: z
      .object({
        mechanism: z.string().max(300),
        granularity: z.enum(["denoisingStep", "none"]),
        evidence: z.array(Evidence).min(1),
        decodesAfterInterrupt: z.boolean(),
        containment: z.literal("processKill"),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type EngineCandidate = z.infer<typeof Candidate>;

export const EngineCandidatesSchema = z
  .object({
    format: z.literal(ENGINE_CANDIDATES_FORMAT),
    formatVersion: z.literal(1),
    task: z.literal("YU-043"),
    inspectedAt: z.iso.date(),
    method: z.array(z.string().max(600)).min(1),
    locks: z.record(z.string().max(80), Lock),
    candidates: z.array(Candidate).min(1).max(16),
    unsupportedControls: z
      .object({
        reason: z.string().max(300),
        pipelineParameters: z.array(z.string().max(40)),
      })
      .strict(),
    interfaceGaps: z.array(z.string().max(600)),
    comparison: z
      .object({
        operation: Operation,
        candidates: z.array(z.string()).min(2),
        sameOperation: z.string().max(400),
        criteria: z
          .array(
            z
              .object({ id: z.string().max(40), rule: z.string().max(300) })
              .strict(),
          )
          .min(1),
        executed: z.boolean(),
        blockedBy: z.string().max(300).nullable(),
        // Chosen only from executed evidence.
        winner: z.string().nullable(),
      })
      .strict(),
  })
  .strict();
export type EngineCandidates = z.infer<typeof EngineCandidatesSchema>;

export type SelectionBlocker =
  | "MUTABLE_REVISION"
  | "MISSING_LICENSE"
  | "GATED_MODEL"
  | "REMOTE_CODE"
  | "REMOTE_SERVICE"
  | "UNDEFINED_REQUIREMENTS"
  | "UNSAFE_LOADING";

const COMMIT = /^[0-9a-f]{40}$/;
// An exact release: digits, dots and an optional PEP 440 suffix, never a
// range, wildcard or local build.
const EXACT = /^\d+(\.\d+)*((a|b|rc)\d+)?(\.post\d+)?$/;
// Packages whose purpose is calling a hosted inference service.
export const REMOTE_SERVICE_PACKAGES: readonly string[] = Object.freeze([
  "dashscope",
  "openai",
  "replicate",
  "fal-client",
]);

/** Every reason this candidate cannot be selected; empty when it may be qualified. */
export function selectionBlockers(
  c: EngineCandidate,
  locks: EngineCandidates["locks"],
): SelectionBlocker[] {
  const out = new Set<SelectionBlocker>();
  if (!COMMIT.test(c.runtime.source.commit) || !COMMIT.test(c.model.commit))
    out.add("MUTABLE_REVISION");
  const accepted = (l: string | null) =>
    l !== null && ACCEPTED_MODEL_LICENSES.includes(l);
  if (!accepted(c.model.license) || !c.model.licenseEvidence)
    out.add("MISSING_LICENSE");
  if (!accepted(c.runtime.source.license) || !c.runtime.source.licenseEvidence)
    out.add("MISSING_LICENSE");
  if (c.model.gated) out.add("GATED_MODEL");
  if (
    c.loading.trustRemoteCode ||
    c.loading.customPipeline !== null ||
    c.model.codeFiles.length
  )
    out.add("REMOTE_CODE");
  if (!c.loading.localFilesOnly) out.add("REMOTE_CODE");
  const lock = c.lock === null ? null : locks[c.lock];
  const names = [
    ...(lock?.packages.map((p) => p.name) ?? []),
    ...(c.runtime.declaredRequirements?.requirements.map((r) => r.name) ?? []),
  ].map((n) => n.toLowerCase().replace(/[_.]/g, "-"));
  if (
    c.remoteServices.length ||
    names.some((n) => REMOTE_SERVICE_PACKAGES.includes(n))
  )
    out.add("REMOTE_SERVICE");
  if (!lock) out.add("UNDEFINED_REQUIREMENTS");
  else {
    for (const p of lock.packages) {
      if (
        p.version === null ||
        !EXACT.test(p.version) ||
        p.sha256 === null ||
        p.wheel === null
      )
        out.add("UNDEFINED_REQUIREMENTS");
      if (p.license === null) out.add("MISSING_LICENSE");
    }
  }
  if (
    c.runtime.declaredRequirements?.requirements.some(
      (r) => !/^==\d/.test(r.spec),
    )
  )
    out.add("UNDEFINED_REQUIREMENTS");
  if (
    !c.loading.useSafetensors ||
    c.loading.unsafeLoads.some((u) => !u.weightsOnly) ||
    c.model.files.some((f) => f.format === "pickle")
  )
    out.add("UNSAFE_LOADING");
  return [...out];
}

/** Parses the manifest and checks every rule that is not a plain shape. */
export function parseEngineCandidates(input: unknown) {
  const m = EngineCandidatesSchema.parse(input);
  const ids = new Set<string>();
  for (const c of m.candidates) {
    if (ids.has(c.id)) throw new Error(`Duplicate candidate ${c.id}.`);
    ids.add(c.id);
    if (c.lock !== null && !m.locks[c.lock])
      throw new Error(`${c.id} names a lock that is not here.`);
    const blockers = selectionBlockers(c, m.locks);
    const computed = blockers.length ? "blocked" : "eligibleForQualification";
    if (c.status !== computed)
      throw new Error(
        `${c.id} declares ${c.status} but is ${computed}${blockers.length ? ` (${blockers.join(", ")})` : ""}.`,
      );
    for (const op of c.operations)
      for (const ignored of op.ignoredInputs)
        if (op.roles.includes(ignored.role))
          throw new Error(
            `${c.id} claims ${ignored.role}, which its pipeline ignores.`,
          );
    if (c.status === "eligibleForQualification" && !c.cancellation)
      throw new Error(`${c.id} has no stated cancellation.`);
  }
  const cmp = m.comparison;
  for (const id of cmp.candidates) {
    const c = m.candidates.find((x) => x.id === id);
    if (!c)
      throw new Error(`The comparison names ${id}, which is not a candidate.`);
    if (c.status !== "eligibleForQualification")
      throw new Error(`The comparison names blocked ${id}.`);
    if (!c.operations.some((o) => o.operation === cmp.operation))
      throw new Error(`${id} does not implement ${cmp.operation}.`);
  }
  if (cmp.winner !== null && !cmp.executed)
    throw new Error("A winner needs an executed comparison.");
  return m;
}

/** Bytes of the model files a candidate loads. */
export const modelFootprint = (c: EngineCandidate) =>
  c.model.files.reduce((n, f) => n + f.bytes, 0);
