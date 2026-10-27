// YU-043: the first-engine candidate manifests. The checked-in evidence
// parses, every declared status equals the computed one, and each rule
// that must block selection does: a mutable revision, a missing licence,
// remote code or a remote service, undefined requirements and pickle
// loading. Roles are checked against the engine contract's own schema.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  modelFootprint,
  parseEngineCandidates,
  selectionBlockers,
  type EngineCandidate,
  type EngineCandidates,
} from "../core/engines/candidates.ts";
import {
  ENGINE_CONTRACT_V2,
  EngineRequestV2Schema,
} from "../core/engines/contract-v2.ts";

const raw = JSON.parse(
  await readFile(
    new URL(
      "../docs/evidence/ultimate/engine-candidate-manifests.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const manifest = parseEngineCandidates(raw);
const byId = (id: string) => manifest.candidates.find((c) => c.id === id)!;
const clone = () => structuredClone(raw) as EngineCandidates;
const blockersOf = (m: EngineCandidates, id: string) =>
  selectionBlockers(
    m.candidates.find((c) => c.id === id)!,
    m.locks,
  );
const ELIGIBLE = "wan2.2-ti2v-5b-diffusers";
const edit = (fn: (c: EngineCandidate, m: EngineCandidates) => void) => {
  const m = clone();
  fn(
    m.candidates.find((c) => c.id === ELIGIBLE)!,
    m,
  );
  return blockersOf(m, ELIGIBLE);
};

test("the checked-in manifest parses and declares no winner before evidence", () => {
  assert.deepEqual(
    manifest.candidates.map((c) => [c.id, c.status]),
    [
      ["wan2.2-ti2v-5b-native", "blocked"],
      ["wan2.2-ti2v-5b-diffusers", "eligibleForQualification"],
      ["cogvideox-2b-diffusers", "eligibleForQualification"],
    ],
  );
  assert.equal(manifest.comparison.executed, false);
  assert.equal(manifest.comparison.winner, null);
  assert.ok(manifest.comparison.criteria.length >= 5);
  // A winner without executed evidence is refused.
  const m = clone();
  m.comparison.winner = ELIGIBLE;
  assert.throws(() => parseEngineCandidates(m), /executed comparison/);
});

test("the native Wan2.2 repository is blocked for the reasons its source shows", () => {
  assert.deepEqual(blockersOf(manifest, "wan2.2-ti2v-5b-native").sort(), [
    "REMOTE_SERVICE",
    "UNDEFINED_REQUIREMENTS",
    "UNSAFE_LOADING",
  ]);
  const native = byId("wan2.2-ti2v-5b-native");
  assert.ok(native.model.files.some((f) => f.format === "pickle"));
  assert.ok(
    native.loading.unsafeLoads.every(
      (u) => /torch\.load/.test(u.call) && !u.weightsOnly,
    ),
  );
  assert.ok(
    native.runtime.declaredRequirements!.requirements.some(
      (r) => r.name === "dashscope",
    ),
  );
  // Hand-marking it eligible is refused.
  const m = clone();
  m.candidates[0]!.status = "eligibleForQualification";
  assert.throws(
    () => parseEngineCandidates(m),
    /declares eligibleForQualification but is blocked/,
  );
});

test("eligible candidates are fully pinned: commits, licences, an exact hashed closure, safetensors only", () => {
  for (const c of manifest.candidates.filter(
    (x) => x.status === "eligibleForQualification",
  )) {
    assert.deepEqual(selectionBlockers(c, manifest.locks), [], c.id);
    assert.match(c.runtime.source.commit, /^[0-9a-f]{40}$/);
    assert.match(c.model.commit, /^[0-9a-f]{40}$/);
    assert.equal(c.model.codeFiles.length, 0);
    assert.ok(
      c.model.files
        .filter((f) => f.bytes > 100_000_000)
        .every((f) => f.format === "safetensors"),
    );
    const lock = manifest.locks[c.lock!]!;
    assert.equal(lock.interpreter.version, "3.12.13");
    for (const p of lock.packages) {
      assert.match(p.version!, /^\d/, p.name);
      assert.match(p.sha256!, /^[0-9a-f]{64}$/, p.name);
      assert.ok(p.license, p.name);
    }
    assert.ok(
      modelFootprint(c) > 1e9,
      "footprint computed from the pinned files",
    );
  }
  // The closure contains what the pipelines import.
  const names = manifest.locks[
    "diffusers-0.42.1-cp312-win_amd64"
  ]!.packages.map((p) => p.name.toLowerCase());
  for (const n of [
    "diffusers",
    "transformers",
    "torch",
    "safetensors",
    "sentencepiece",
    "ftfy",
  ])
    assert.ok(names.includes(n), n);
});

test("a mutable revision, missing licence, remote code or service, undefined requirement or pickle load blocks selection", () => {
  assert.deepEqual(
    edit(() => {}),
    [],
  );
  assert.deepEqual(
    edit((c) => (c.model.commit = "main")),
    ["MUTABLE_REVISION"],
  );
  assert.deepEqual(
    edit((c) => (c.runtime.source.commit = "v0.42.1")),
    ["MUTABLE_REVISION"],
  );
  assert.deepEqual(
    edit((c) => (c.model.license = null)),
    ["MISSING_LICENSE"],
  );
  assert.deepEqual(
    edit((c) => (c.model.license = "other")),
    ["MISSING_LICENSE"],
  );
  assert.deepEqual(
    edit((c) => (c.model.licenseEvidence = null)),
    ["MISSING_LICENSE"],
  );
  assert.deepEqual(
    edit(
      (_c, m) =>
        (m.locks["diffusers-0.42.1-cp312-win_amd64"]!.packages[3]!.license =
          null),
    ),
    ["MISSING_LICENSE"],
  );
  assert.deepEqual(
    edit((c) => (c.model.gated = true)),
    ["GATED_MODEL"],
  );
  assert.deepEqual(
    edit((c) => (c.loading.trustRemoteCode = true)),
    ["REMOTE_CODE"],
  );
  assert.deepEqual(
    edit((c) => (c.loading.customPipeline = "someone/pipeline")),
    ["REMOTE_CODE"],
  );
  assert.deepEqual(
    edit((c) => c.model.codeFiles.push("pipeline.py")),
    ["REMOTE_CODE"],
  );
  assert.deepEqual(
    edit((c) => (c.loading.localFilesOnly = false)),
    ["REMOTE_CODE"],
  );
  assert.deepEqual(
    edit((_c, m) =>
      m.locks["diffusers-0.42.1-cp312-win_amd64"]!.packages.push({
        name: "dashscope",
        version: "1.0.0",
        wheel: "dashscope-1.0.0-py3-none-any.whl",
        sha256: "e".repeat(64),
        license: "Apache-2.0",
        licenseSource: "expression",
      }),
    ),
    ["REMOTE_SERVICE"],
  );
  assert.deepEqual(
    edit((c) => (c.lock = null)),
    ["UNDEFINED_REQUIREMENTS"],
  );
  for (const bad of [
    { version: ">=2.4" },
    { version: "2.*" },
    { version: null },
    { sha256: null },
  ])
    assert.deepEqual(
      edit((_c, m) =>
        Object.assign(
          m.locks["diffusers-0.42.1-cp312-win_amd64"]!.packages[0]!,
          bad,
        ),
      ),
      ["UNDEFINED_REQUIREMENTS"],
      JSON.stringify(bad),
    );
  assert.deepEqual(
    edit((c) => (c.loading.useSafetensors = false)),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) => (c.model.files[0]!.format = "pickle")),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) =>
      c.loading.unsafeLoads.push({
        path: "x.py",
        call: "torch.load(p)",
        weightsOnly: false,
      }),
    ),
    ["UNSAFE_LOADING"],
  );
  // weights_only=True is the safe form.
  assert.deepEqual(
    edit((c) =>
      c.loading.unsafeLoads.push({
        path: "x.py",
        call: "torch.load(p, weights_only=True)",
        weightsOnly: true,
      }),
    ),
    [],
  );
});

test("roles are the contract's, an ignored input is never claimed, and cancellation is stated", () => {
  const still = {
    assetVersionId: "v1",
    sha256: "a".repeat(64),
    mediaType: "image/png" as const,
  };
  const base = {
    contract: ENGINE_CONTRACT_V2,
    recipeId: "candidate",
    recipeHash: "b".repeat(64),
    modelManifestHash: "c".repeat(64),
    attemptKey: "attempt-1",
    leaseGeneration: 1,
    deadlineMs: 60_000,
    resourcePolicyHash: "d".repeat(64),
    output: {
      kind: "video",
      width: 1280,
      height: 704,
      fps: { num: 24, den: 1 },
      durationTicks: 705_600_000,
      audio: false,
    },
  };
  for (const c of manifest.candidates)
    for (const op of c.operations) {
      // The roles each candidate claims make a request the contract takes.
      const inputs = op.roles.map((role) => ({ role, asset: still }));
      EngineRequestV2Schema.parse({
        ...base,
        operation: op.operation,
        prompt: "a shot",
        inputs,
      });
      assert.deepEqual(op.controls, [], `${c.id} declares no style control`);
    }
  // Wan2.2 TI2V ignores a last image: lastFrame is recorded as ignored.
  const i2v = byId(ELIGIBLE).operations.find(
    (o) => o.operation === "imageToVideo",
  )!;
  assert.deepEqual(i2v.roles, ["firstFrame"]);
  assert.equal(i2v.ignoredInputs[0]!.role, "lastFrame");
  const m = clone();
  m.candidates[1]!.operations[1]!.roles.push("lastFrame");
  assert.throws(
    () => parseEngineCandidates(m),
    /claims lastFrame, which its pipeline ignores/,
  );
  // The cooperative interrupt still decodes, so containment is a process kill.
  for (const c of manifest.candidates.filter(
    (x) => x.status === "eligibleForQualification",
  )) {
    assert.equal(c.cancellation!.decodesAfterInterrupt, true);
    assert.equal(c.cancellation!.containment, "processKill");
  }
  const noCancel = clone();
  noCancel.candidates[2]!.cancellation = null;
  assert.throws(
    () => parseEngineCandidates(noCancel),
    /no stated cancellation/,
  );
  // The comparison only names eligible candidates of its operation.
  const cmp = clone();
  cmp.comparison.candidates.push("wan2.2-ti2v-5b-native");
  assert.throws(
    () => parseEngineCandidates(cmp),
    /blocked wan2\.2-ti2v-5b-native/,
  );
});
