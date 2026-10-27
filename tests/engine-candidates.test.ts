// YU-043: the first-engine candidate manifests. The checked-in evidence
// parses, every declared status equals the computed one, and each rule
// that must block selection does: a mutable revision, a missing or
// unaccepted licence, remote code, network loading or a remote service,
// undefined requirements and pickle loading. The rules are checked on
// spellings and shapes the data does not happen to contain, and roles are
// checked against the engine contract's own schema.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fileFormatOf,
  modelFootprint,
  normalizePackageName,
  packageLicenseAccepted,
  parseEngineCandidates,
  selectionBlockers,
  selectionCautions,
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
const LOCK = "diffusers-0.42.1-cp312-win_amd64";
const NATIVE = "wan2.2-ti2v-5b-native";
const ELIGIBLE = "wan2.2-ti2v-5b-diffusers";
const byId = (id: string) => manifest.candidates.find((c) => c.id === id)!;
const clone = () => structuredClone(raw) as EngineCandidates;
const blockersOf = (m: EngineCandidates, id: string) =>
  selectionBlockers(
    m.candidates.find((c) => c.id === id)!,
    m.locks,
  ).sort();
const edit = (
  fn: (c: EngineCandidate, m: EngineCandidates) => void,
  id = ELIGIBLE,
) => {
  const m = clone();
  fn(
    m.candidates.find((c) => c.id === id)!,
    m,
  );
  return blockersOf(m, id);
};
const pkg = (m: EngineCandidates, name: string) =>
  m.locks[LOCK]!.packages.find((p) => p.name === name)!;

test("the checked-in manifest parses and declares no winner before evidence", () => {
  assert.deepEqual(
    manifest.candidates.map((c) => [c.id, c.status]),
    [
      [NATIVE, "blocked"],
      [ELIGIBLE, "eligibleForQualification"],
      ["cogvideox-2b-diffusers", "eligibleForQualification"],
    ],
  );
  assert.equal(manifest.comparison.executed, false);
  assert.equal(manifest.comparison.winner, null);
  for (const bad of [
    (m: EngineCandidates) => (m.comparison.winner = ELIGIBLE),
    (m: EngineCandidates) => (m.comparison.executed = true),
    (m: EngineCandidates) => (m.comparison.results = [{ row: 1 }]),
    (m: EngineCandidates) => m.comparison.candidates.push(ELIGIBLE),
    (m: EngineCandidates) => m.comparison.candidates.push(NATIVE),
  ]) {
    const m = clone();
    bad(m);
    assert.throws(() => parseEngineCandidates(m));
  }
});

test("the native Wan2.2 repository is blocked for the reasons its source shows", () => {
  assert.deepEqual(blockersOf(manifest, NATIVE), [
    "REMOTE_SERVICE",
    "UNDEFINED_REQUIREMENTS",
    "UNSAFE_LOADING",
  ]);
  // Each reason stands on its own evidence: without the DashScope code path
  // the requirements file still names dashscope.
  assert.ok(
    edit((c) => (c.remoteServices = []), NATIVE).includes("REMOTE_SERVICE"),
  );
  const m = clone();
  m.candidates[0]!.status = "eligibleForQualification";
  assert.throws(
    () => parseEngineCandidates(m),
    /declares eligibleForQualification but is blocked/,
  );
});

test("eligible candidates have no blockers; cautions stay visible", () => {
  for (const c of manifest.candidates.filter(
    (x) => x.status === "eligibleForQualification",
  )) {
    assert.deepEqual(selectionBlockers(c, manifest.locks), [], c.id);
    assert.ok(modelFootprint(c) > 0);
  }
  // The Wan Diffusers licence is only the card's; some package licences
  // were mapped from prose names. Both are shown, neither blocks.
  assert.deepEqual(selectionCautions(byId(ELIGIBLE), manifest.locks), [
    "MODEL_LICENSE_FROM_CARD_ONLY",
    "PACKAGE_LICENSE_NORMALIZED",
  ]);
  assert.deepEqual(
    selectionCautions(byId("cogvideox-2b-diffusers"), manifest.locks),
    ["PACKAGE_LICENSE_NORMALIZED"],
  );
});

test("a mutable revision, missing or unaccepted licence, or remote code blocks selection", () => {
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
    edit((c) => (c.model.licenseEvidence = null)),
    ["MISSING_LICENSE"],
  );
  assert.deepEqual(
    edit((c) => (c.model.license = "cc-by-nc-4.0")),
    ["LICENSE_UNACCEPTED"],
  );
  // Case does not matter for an accepted licence.
  assert.deepEqual(
    edit((c) => (c.model.license = "Apache-2.0")),
    [],
  );
  // A package licence must be accepted SPDX terms, not merely present.
  for (const spdx of [
    "GPL-3.0-only",
    "LGPL-2.1-or-later",
    "MIT AND GPL-2.0-only",
    "Apache-2.0 WITH Classpath-exception-2.0",
    "Proprietary",
    "",
  ])
    assert.deepEqual(
      edit((_c, m) => (pkg(m, "numpy").spdx = spdx)),
      ["LICENSE_UNACCEPTED"],
      spdx,
    );
  assert.deepEqual(
    edit((_c, m) =>
      Object.assign(pkg(m, "numpy"), { license: null, spdx: null }),
    ),
    ["MISSING_LICENSE"],
  );
  assert.equal(
    packageLicenseAccepted(
      "Apache-2.0 AND Apache-2.0 WITH LLVM-exception AND BSD-3-Clause",
    ),
    true,
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
    edit((c) => c.model.repositoryFiles.push("scripts/pipeline.py")),
    ["REMOTE_CODE"],
  );
  // A name Windows would shorten (trailing space or dot) is not a path.
  for (const name of ["scripts/x.py ", "x.bin.", "dir./x.json"]) {
    const m = clone();
    m.candidates[1]!.model.repositoryFiles.push(name);
    assert.throws(() => parseEngineCandidates(m), /repository path/, name);
  }
  // Pickle anywhere in the repository, even unloaded.
  assert.deepEqual(
    edit((c) => c.model.repositoryFiles.push("old/model.bin")),
    ["UNSAFE_LOADING"],
  );
  // A loaded file's format is its name's, whatever the manifest says.
  assert.deepEqual(
    edit((c) =>
      c.model.files.push({
        path: "custom/model.py",
        bytes: 10,
        format: "json",
        gitOid: "0".repeat(40),
      }),
    ),
    ["REMOTE_CODE", "UNSAFE_LOADING"],
  );
  // A loaded file of no known safe format, or not in the repository.
  assert.deepEqual(
    edit((c) => {
      c.model.files.push({
        path: "x.onnx",
        bytes: 10,
        format: "other",
        gitOid: "0".repeat(40),
      });
      c.model.repositoryFiles.push("x.onnx");
    }),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) =>
      c.model.files.push({
        path: "elsewhere.json",
        bytes: 10,
        format: "json",
        gitOid: "0".repeat(40),
      }),
    ),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) => (c.loading.localFilesOnly = false)),
    ["NETWORK_LOAD"],
  );
});

test("a remote service, undefined requirement or pickle load blocks selection", () => {
  // Remote services by any spelling, in a pinned requirements file (only
  // the remote rule trips) or in the lock.
  const declare = (c: EngineCandidate, name: string, spec = "==1.0.0") =>
    (c.runtime.declaredRequirements = {
      path: "requirements.txt",
      sha256: "e".repeat(64),
      requirements: [{ name, spec }],
    });
  for (const name of [
    "dashscope",
    "DashScope",
    "openai",
    "fal_client",
    "Google_GenAI",
    "boto3",
  ])
    assert.deepEqual(
      edit((c) => declare(c, name)),
      ["REMOTE_SERVICE"],
      name,
    );
  assert.deepEqual(
    edit((c) => declare(c, "numpy")),
    [],
  );
  assert.ok(
    edit((_c, m) => (pkg(m, "tqdm").name = "dashscope")).includes(
      "REMOTE_SERVICE",
    ),
  );
  // Not plain names: a direct URL or an editable install is undefined,
  // and still names the service it pulls in.
  for (const name of [
    "foo @ https://example.invalid/foo.zip",
    "-e git+https://example.invalid/x/dashscope",
  ])
    assert.ok(
      edit((c) => declare(c, name)).includes("UNDEFINED_REQUIREMENTS"),
      name,
    );
  assert.ok(
    edit((c) =>
      declare(c, "-e git+https://example.invalid/x/dashscope"),
    ).includes("REMOTE_SERVICE"),
  );
  assert.equal(normalizePackageName("Dash_Scope.x"), "dash-scope-x");
  for (const line of [
    "Dashscope",
    "dashscope[cli]",
    "dashscope ; os_name=='nt'",
  ])
    assert.ok(
      edit(
        (c) =>
          (c.runtime.declaredRequirements = {
            path: "requirements.txt",
            sha256: "e".repeat(64),
            requirements: [{ name: line, spec: "==1.0.0" }],
          }),
      ).includes("REMOTE_SERVICE"),
      line,
    );
  // A declared requirement is pinned only as ==<exact release>.
  for (const spec of [
    "==2.*",
    "==1.0,<2",
    '==1.0 ; python_version<"3"',
    ">=2.4",
    "",
    "==2.4.0+cpu",
  ])
    assert.deepEqual(
      edit(
        (c) =>
          (c.runtime.declaredRequirements = {
            path: "requirements.txt",
            sha256: "e".repeat(64),
            requirements: [{ name: "numpy", spec }],
          }),
      ),
      ["UNDEFINED_REQUIREMENTS"],
      spec,
    );
  assert.deepEqual(
    edit(
      (c) =>
        (c.runtime.declaredRequirements = {
          path: "requirements.txt",
          sha256: "e".repeat(64),
          requirements: [{ name: "numpy", spec: "==2.5.4" }],
        }),
    ),
    [],
  );
  // The lock: exact, hashed, one wheel per package that names it and fits
  // the interpreter, with the runtime's own diffusers release.
  assert.deepEqual(
    edit((c) => (c.lock = null)),
    ["UNDEFINED_REQUIREMENTS"],
  );
  for (const bad of [
    { version: ">=2.4" },
    { version: "2.*" },
    { version: "2.5.4+cpu" },
    { version: null },
    { sha256: null },
    { wheel: null },
    { wheel: "numpy-2.5.4.tar.gz" },
    { wheel: "numpy-2.5.3-cp312-cp312-win_amd64.whl" },
    { wheel: "numpy-2.5.4-cp313-cp313-win_amd64.whl" },
    { wheel: "numpy-2.5.4-cp312-cp312-manylinux_2_28_x86_64.whl" },
  ])
    assert.deepEqual(
      edit((_c, m) => Object.assign(pkg(m, "numpy"), bad)),
      ["UNDEFINED_REQUIREMENTS"],
      JSON.stringify(bad),
    );
  assert.deepEqual(
    edit((_c, m) => m.locks[LOCK]!.packages.push({ ...pkg(m, "numpy") })),
    ["UNDEFINED_REQUIREMENTS"],
  );
  assert.deepEqual(
    edit((_c, m) => (pkg(m, "diffusers").version = "0.42.0")),
    ["UNDEFINED_REQUIREMENTS"],
  );
  assert.deepEqual(
    edit((_c, m) => {
      m.locks[LOCK]!.packages = m.locks[LOCK]!.packages.filter(
        (p) => p.name !== "safetensors",
      );
    }),
    ["UNDEFINED_REQUIREMENTS"],
  );
  // Pickle by name or by load.
  for (const path of ["vae/model.bin", "x.pt", "x.pth", "x.ckpt", "x.pkl"])
    assert.deepEqual(
      edit((c) => (c.model.files[0]!.path = path)),
      ["UNSAFE_LOADING"],
      path,
    );
  assert.equal(fileFormatOf("a/b.SAFETENSORS"), "safetensors");
  assert.deepEqual(
    edit((c) => (c.loading.useSafetensors = null)),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) => (c.runtime.loaderEvidence = [])),
    ["UNSAFE_LOADING"],
  );
  const load = {
    path: "x.py",
    sha256: "e".repeat(64),
    line: 1,
    text: "torch.load(p)",
  };
  assert.deepEqual(
    edit((c) => c.loading.unsafeLoads.push({ ...load, weightsOnly: false })),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((c) => c.loading.unsafeLoads.push({ ...load, weightsOnly: true })),
    [],
  );
});

test("roles are the contract's per operation, an ignored input is never claimed, and cancellation is stated", () => {
  const still = {
    assetVersionId: "v1",
    sha256: "a".repeat(64),
    mediaType: "image/png" as const,
  };
  const request = (operation: string, roles: string[]) =>
    EngineRequestV2Schema.safeParse({
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
      operation,
      prompt: "a shot",
      inputs: roles.map((role) => ({ role, asset: still })),
    }).success;
  // The contract checks roles per operation, so it is a real check.
  assert.equal(request("textToVideo", ["firstFrame"]), false);
  assert.equal(request("imageToVideo", []), false);
  for (const c of manifest.candidates)
    for (const op of c.operations) {
      assert.ok(request(op.operation, op.roles), `${c.id} ${op.operation}`);
      assert.deepEqual(op.controls, [], `${c.id} declares no style control`);
    }
  assert.deepEqual(manifest.controls.supported, []);
  // Wan2.2 TI2V ignores a last image: recorded as ignored, with the model
  // setting that makes it so.
  const i2v = byId(ELIGIBLE).operations.find(
    (o) => o.operation === "imageToVideo",
  )!;
  assert.deepEqual(i2v.roles, ["firstFrame"]);
  assert.equal(i2v.ignoredInputs[0]!.role, "lastFrame");
  const claimed = clone();
  claimed.candidates[1]!.operations[1]!.roles.push("lastFrame");
  assert.throws(
    () => parseEngineCandidates(claimed),
    /claims lastFrame, which its pipeline ignores/,
  );
  const unsupported = clone();
  // The model index evidence must be the pinned version of it.
  const stale = clone();
  for (const e of stale.candidates[1]!.operations[1]!.ignoredInputs[0]!
    .evidence)
    if (e.path === "model_index.json") e.sha256 = "f".repeat(64);
  assert.throws(() => parseEngineCandidates(stale), /cites no model setting/);
  unsupported.candidates[1]!.operations[1]!.ignoredInputs[0]!.evidence =
    unsupported.candidates[1]!.operations[1]!.ignoredInputs[0]!.evidence.filter(
      (e) => e.path !== "model_index.json",
    );
  assert.throws(
    () => parseEngineCandidates(unsupported),
    /cites no model setting/,
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
});

test("licence expressions, wheel tags, loaders and cautions are parsed strictly", () => {
  for (const [spdx, ok] of [
    ["MIT", true],
    ["(MIT OR Apache-2.0) AND BSD-3-Clause", true],
    ["Apache-2.0 WITH LLVM-exception", true],
    ["MIT WITH LLVM-exception", false],
    ["Apache-2.0 WITH LLVM-exception WITH LLVM-exception", false],
    ["WITH LLVM-exception", false],
    ["MIT AND", false],
    ["OR MIT", false],
    ["MIT MIT", false],
    ["(MIT", false],
    ["mit", false],
    ["MIT OR GPL-3.0-only", false],
  ] as const)
    assert.equal(packageLicenseAccepted(spdx), ok, spdx);
  for (const [wheel, ok] of [
    ["numpy-2.5.4-1-cp312-cp312-win_amd64.whl", true],
    ["numpy-2.5.4-x1-cp312-cp312-win_amd64.whl", false],
    ["numpy-2.5.4-py3-cp312-win_amd64.whl", false],
    ["numpy-2.5.4-cp312-cp311-win_amd64.whl", false],
    ["numpy-2.5.4-cp313-abi3-win_amd64.whl", false],
    ["numpy-2.5.4-cp39-abi3-win_amd64.whl", true],
    ["numpy-2.5.4-py2-none-any.whl", false],
    ["numpy-2.5.4-py2.py3-none-any.whl", true],
  ] as const)
    assert.deepEqual(
      edit((_c, m) => (pkg(m, "numpy").wheel = wheel)),
      ok ? [] : ["UNDEFINED_REQUIREMENTS"],
      wheel,
    );
  // Every inspected loader is the locked release, and loader evidence
  // comes only from a pinned loader source.
  assert.deepEqual(
    edit((_c, m) => {
      const t = pkg(m, "transformers");
      t.version = "5.20.0";
      t.wheel = t.wheel!.replace("5.21.0", "5.20.0");
    }),
    ["UNDEFINED_REQUIREMENTS"],
  );
  assert.deepEqual(
    edit((c) => (c.runtime.loaders = [])),
    ["UNSAFE_LOADING"],
  );
  assert.deepEqual(
    edit((_c, m) => {
      m.locks[LOCK]!.packages = m.locks[LOCK]!.packages.filter(
        (p) => p.name !== "ftfy",
      );
    }),
    ["UNDEFINED_REQUIREMENTS"],
  );
  // The normalized-licence caution is derived, not taken from the flag.
  const m = clone();
  for (const p of m.locks[LOCK]!.packages) p.spdxBasis = "metadata";
  assert.ok(
    selectionCautions(m.candidates[2]!, m.locks).includes(
      "PACKAGE_LICENSE_NORMALIZED",
    ),
  );
});
