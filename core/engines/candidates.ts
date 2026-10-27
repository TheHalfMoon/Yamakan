// First-engine candidates (YU-043): the exact source, runtime, Python
// closure and model files each candidate would load, frozen from source
// inspection with no weights downloaded. A candidate may be qualified only
// when nothing blocks selection; the status a manifest declares must equal
// what these rules compute, so no candidate is hand-marked eligible. The
// rules derive what they can from the data itself (a file's format from its
// name, a wheel's name and tags from its file name, a licence from its SPDX
// terms) rather than trusting a flag. No winner is chosen here: the
// comparison is predeclared and runs only on evidence.
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
// A line of the inspected file, quoted as it is there (trimmed). A file of
// another repository than the candidate's runtime names it, at a commit.
const Evidence = z
  .object({
    source: z
      .string()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*@[0-9a-f]{40}$/,
      )
      .optional(),
    path: RelPath,
    sha256: Sha256,
    line: z.number().int().positive(),
    text: z.string().min(1).max(200),
  })
  .strict();
const DocEvidence = z.object({ path: RelPath, sha256: Sha256 }).strict();

// A package licence, as its metadata states it and as SPDX terms.
const Package = z
  .object({
    name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/),
    version: z.string().max(40).nullable(),
    wheel: z.string().max(200).nullable(),
    sha256: Sha256.nullable(),
    license: z.string().max(200).nullable(),
    licenseSource: z.enum(["expression", "license", "classifier"]).nullable(),
    spdx: z.string().max(200).nullable(),
    // "metadata" when the package states SPDX terms itself; "normalized"
    // when a prose or classifier name was mapped to them (to be checked
    // against the licence file before release).
    spdxBasis: z.enum(["metadata", "normalized"]).nullable(),
  })
  .strict();

const Lock = z
  .object({
    interpreter: z
      .object({
        implementation: z.literal("cpython"),
        version: z.string().regex(/^3\.\d+\.\d+$/),
        platform: z.literal("win_amd64"),
      })
      .strict(),
    resolver: z.string().max(200),
    accelerator: z.enum(["cpu", "cuda"]),
    packages: z.array(Package).min(1).max(400),
  })
  .strict();

const FileFormat = z.enum([
  "safetensors",
  "pickle",
  "code",
  "json",
  "tokenizer",
  "other",
]);
const ModelFile = z
  .object({
    path: RelPath,
    bytes: z.number().int().nonnegative(),
    format: FileFormat,
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
            // The package version the tag is (a Diffusers runtime).
            version: z.string().max(40).optional(),
            commit: Revision,
            license: z.string().max(40).nullable(),
            licenseEvidence: DocEvidence.nullable(),
          })
          .strict(),
        entry: z
          .array(
            z
              .object({
                path: RelPath,
                sha256: Sha256,
                symbol: z.string().max(80),
              })
              .strict(),
          )
          .min(1),
        // Where the inspected loaders read weights: the safetensors path,
        // the pickle fallback and its weights_only, offline loading.
        loaderEvidence: z.array(Evidence),
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
        license: z.string().max(40).nullable(),
        licenseEvidence: DocEvidence.extend({
          kind: z.enum(["file", "card"]),
        }).nullable(),
        gated: z.boolean(),
        modelIndex: DocEvidence.optional(),
        files: z.array(ModelFile).min(1).max(64),
        // Every path in the repository at the commit that is code.
        codeFiles: z.array(RelPath),
      })
      .strict(),
    loading: z
      .object({
        trustRemoteCode: z.boolean(),
        customPipeline: z.string().max(200).nullable(),
        // The from_pretrained arguments a runner must pass; null where the
        // candidate has no from_pretrained loader (native).
        useSafetensors: z.boolean().nullable(),
        localFilesOnly: z.boolean().nullable(),
        unsafeLoads: z.array(Evidence.extend({ weightsOnly: z.boolean() })),
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
          // refuse the role, never pass it through. The evidence names the
          // pipeline code and the model setting that makes it so.
          ignoredInputs: z.array(
            z
              .object({
                parameter: z.string().max(60),
                role: Role,
                evidence: z.array(Evidence).min(2),
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
    controls: z
      .object({
        // The engine contract's style controls a candidate takes: none.
        supported: z.array(z.string().max(40)),
        reason: z.string().max(300),
        // What the pipelines' __call__ does take (not controls).
        examinedParameters: z.array(z.string().max(40)),
        // How the contract answers a request control a recipe lacks.
        requestControlRefusal: z.literal("CONTROL_UNSUPPORTED"),
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
        // Measured rows; none until the comparison runs.
        results: z.array(z.record(z.string(), z.unknown())).nullable(),
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
  | "LICENSE_UNACCEPTED"
  | "GATED_MODEL"
  | "REMOTE_CODE"
  | "NETWORK_LOAD"
  | "REMOTE_SERVICE"
  | "UNDEFINED_REQUIREMENTS"
  | "UNSAFE_LOADING";
// Visible, never blocking: what a human checks before release.
export type SelectionCaution =
  "MODEL_LICENSE_FROM_CARD_ONLY" | "PACKAGE_LICENSE_NORMALIZED";

const COMMIT = /^[0-9a-f]{40}$/;
// An exact release: digits, dots and an optional PEP 440 pre or post
// suffix; never a range, wildcard, list, marker or local build (+cpu).
const EXACT = /^\d+(\.\d+)*((a|b|rc)\d+)?(\.post\d+)?$/;

/** PEP 503: lowercase, runs of -, _ and . become one -. */
export const normalizePackageName = (name: string) =>
  name.toLowerCase().replace(/[-_.]+/g, "-");
// A requirement line's project name: before any extras, version or marker.
const requirementName = (line: string) =>
  normalizePackageName(
    /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line)?.[1] ?? "",
  );

// Packages whose purpose is calling a hosted model or inference service.
export const REMOTE_SERVICE_PACKAGES: readonly string[] = Object.freeze([
  "dashscope",
  "openai",
  "anthropic",
  "google-generativeai",
  "google-genai",
  "replicate",
  "together",
  "fal-client",
  "groq",
  "cohere",
  "mistralai",
]);

// Package licences a bundled runtime may carry: permissive, or file-level
// copyleft (MPL-2.0, unmodified). Anything else, GPL and LGPL included,
// is refused until reviewed.
export const ACCEPTED_PACKAGE_LICENSES: readonly string[] = Object.freeze([
  "Apache-2.0",
  "MIT",
  "MIT-CMU",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "ISC",
  "Zlib",
  "BSL-1.0",
  "CC0-1.0",
  "PSF-2.0",
  "CNRI-Python",
  "MPL-2.0",
]);
const ACCEPTED_EXCEPTIONS = new Set(["LLVM-exception"]);

/** Whether every term of an SPDX expression is an accepted licence. */
export function packageLicenseAccepted(spdx: string | null) {
  if (!spdx) return false;
  const terms = spdx.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  let expectException = false;
  let sawLicense = false;
  for (const t of terms) {
    if (t === "AND" || t === "OR") continue;
    if (t === "WITH") {
      expectException = true;
      continue;
    }
    if (expectException) {
      if (!ACCEPTED_EXCEPTIONS.has(t)) return false;
      expectException = false;
    } else if (!ACCEPTED_PACKAGE_LICENSES.includes(t)) return false;
    else sawLicense = true;
  }
  return sawLicense && !expectException;
}

/** A file's format from its name; a manifest must say the same. */
export function fileFormatOf(path: string): z.infer<typeof FileFormat> {
  const p = path.toLowerCase();
  if (p.endsWith(".safetensors")) return "safetensors";
  if (/\.(pth|pt|bin|ckpt|pkl|pickle|npy|npz|joblib)$/.test(p)) return "pickle";
  if (/\.(py|pyc|pyo|pyd|so|dll|dylib|exe|sh|bat|ps1|ipynb)$/.test(p))
    return "code";
  if (p.endsWith(".json")) return "json";
  if (/\.(model|tiktoken|txt)$/.test(p)) return "tokenizer";
  return "other";
}

// A wheel's file name: name-version(-build)?-python-abi-platform.whl.
function wheelMatches(
  p: z.infer<typeof Package>,
  interpreter: z.infer<typeof Lock>["interpreter"],
) {
  if (!p.wheel?.endsWith(".whl")) return false;
  const parts = p.wheel.slice(0, -4).split("-");
  if (parts.length !== 5 && parts.length !== 6) return false;
  const [name, version] = parts;
  const [python, abi, platform] = parts.slice(-3);
  if (normalizePackageName(name!) !== normalizePackageName(p.name))
    return false;
  if (version !== p.version) return false;
  const minor = Number(interpreter.version.split(".")[1]);
  const pythonOk = python!.split(".").some((t) => {
    if (t === "py3" || t === `cp3${minor}`) return true;
    // The stable ABI: a cp3N-abi3 wheel runs on any later 3.x.
    const m = /^cp3(\d+)$/.exec(t);
    return m !== null && abi === "abi3" && Number(m[1]) <= minor;
  });
  const platformOk = platform!
    .split(".")
    .some((t) => t === "any" || t === interpreter.platform);
  return pythonOk && platformOk;
}

/** Every reason this candidate cannot be selected; empty when it may be qualified. */
export function selectionBlockers(
  c: EngineCandidate,
  locks: EngineCandidates["locks"],
): SelectionBlocker[] {
  const out = new Set<SelectionBlocker>();
  if (!COMMIT.test(c.runtime.source.commit) || !COMMIT.test(c.model.commit))
    out.add("MUTABLE_REVISION");
  for (const { license, licenseEvidence } of [c.model, c.runtime.source]) {
    if (license === null || !licenseEvidence) out.add("MISSING_LICENSE");
    else if (!ACCEPTED_MODEL_LICENSES.includes(license.toLowerCase()))
      out.add("LICENSE_UNACCEPTED");
  }
  if (c.model.gated) out.add("GATED_MODEL");
  // Code anywhere in the model repository, or loaded from it.
  if (
    c.loading.trustRemoteCode ||
    c.loading.customPipeline !== null ||
    c.model.codeFiles.length ||
    c.model.files.some((f) => fileFormatOf(f.path) === "code")
  )
    out.add("REMOTE_CODE");
  if (c.loading.localFilesOnly === false) out.add("NETWORK_LOAD");
  const lock = c.lock === null ? null : locks[c.lock];
  const declared = c.runtime.declaredRequirements?.requirements ?? [];
  const names = [
    ...(lock?.packages.map((p) => normalizePackageName(p.name)) ?? []),
    ...declared.map((r) => requirementName(r.name)),
  ];
  if (
    c.remoteServices.length ||
    names.some((n) => REMOTE_SERVICE_PACKAGES.includes(n))
  )
    out.add("REMOTE_SERVICE");
  // A declared requirement is pinned only as ==<exact release>, nothing more.
  if (
    declared.some((r) => {
      const m = /^==\s*(\S+)$/.exec(r.spec.trim());
      return !m || !EXACT.test(m[1]!) || /[[\]]/.test(r.name);
    })
  )
    out.add("UNDEFINED_REQUIREMENTS");
  if (!lock) out.add("UNDEFINED_REQUIREMENTS");
  else {
    const seen = new Set<string>();
    for (const p of lock.packages) {
      const n = normalizePackageName(p.name);
      if (
        seen.has(n) ||
        p.version === null ||
        !EXACT.test(p.version) ||
        p.sha256 === null ||
        !wheelMatches(p, lock.interpreter)
      )
        out.add("UNDEFINED_REQUIREMENTS");
      seen.add(n);
      if (p.license === null && p.spdx === null) out.add("MISSING_LICENSE");
      else if (!packageLicenseAccepted(p.spdx)) out.add("LICENSE_UNACCEPTED");
    }
    // A Diffusers runtime is the locked diffusers release it was inspected
    // at, with the loaders it relies on.
    if (c.runtime.kind === "diffusers") {
      const version = (name: string) =>
        lock.packages.find((p) => normalizePackageName(p.name) === name)
          ?.version;
      if (
        !c.runtime.source.version ||
        version("diffusers") !== c.runtime.source.version ||
        ["torch", "transformers", "safetensors"].some((n) => !version(n))
      )
        out.add("UNDEFINED_REQUIREMENTS");
    }
  }
  // Pickle anywhere, a torch.load without weights_only, a loader that may
  // fall back to pickle, or a manifest whose formats disagree with names.
  if (
    c.model.files.some(
      (f) =>
        f.format !== fileFormatOf(f.path) || fileFormatOf(f.path) === "pickle",
    ) ||
    c.loading.unsafeLoads.some((u) => !u.weightsOnly) ||
    (c.runtime.kind === "diffusers" &&
      (c.loading.useSafetensors !== true || !c.runtime.loaderEvidence.length))
  )
    out.add("UNSAFE_LOADING");
  return [...out];
}

/** What a human checks before release; never blocks selection. */
export function selectionCautions(
  c: EngineCandidate,
  locks: EngineCandidates["locks"],
): SelectionCaution[] {
  const out: SelectionCaution[] = [];
  if (c.model.licenseEvidence?.kind === "card")
    out.push("MODEL_LICENSE_FROM_CARD_ONLY");
  const lock = c.lock === null ? null : locks[c.lock];
  if (lock?.packages.some((p) => p.spdxBasis === "normalized"))
    out.push("PACKAGE_LICENSE_NORMALIZED");
  return out;
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
      for (const ignored of op.ignoredInputs) {
        if (op.roles.includes(ignored.role))
          throw new Error(
            `${c.id} claims ${ignored.role}, which its pipeline ignores.`,
          );
        // The model setting that makes the pipeline ignore it is cited.
        const index = c.model.modelIndex;
        if (!index || !ignored.evidence.some((e) => e.path === index.path))
          throw new Error(
            `${c.id}: the ignored ${ignored.role} cites no model setting.`,
          );
      }
    if (c.status === "eligibleForQualification" && !c.cancellation)
      throw new Error(`${c.id} has no stated cancellation.`);
  }
  const cmp = m.comparison;
  if (new Set(cmp.candidates).size !== cmp.candidates.length)
    throw new Error("The comparison names a candidate twice.");
  for (const id of cmp.candidates) {
    const c = m.candidates.find((x) => x.id === id);
    if (!c)
      throw new Error(`The comparison names ${id}, which is not a candidate.`);
    if (c.status !== "eligibleForQualification")
      throw new Error(`The comparison names blocked ${id}.`);
    if (!c.operations.some((o) => o.operation === cmp.operation))
      throw new Error(`${id} does not implement ${cmp.operation}.`);
  }
  if (cmp.executed !== (cmp.results !== null && cmp.results.length > 0))
    throw new Error("An executed comparison has results, and only then.");
  if (
    cmp.winner !== null &&
    (!cmp.executed || !cmp.candidates.includes(cmp.winner))
  )
    throw new Error(
      "A winner needs an executed comparison among its candidates.",
    );
  return m;
}

/** Bytes of the model files a candidate loads. */
export const modelFootprint = (c: EngineCandidate) =>
  c.model.files.reduce((n, f) => n + f.bytes, 0);
