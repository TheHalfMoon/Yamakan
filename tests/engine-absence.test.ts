// YU-042: honest engine absence. Discovery reads pinned local manifests
// only (never downloads, installs or scans), and each way an operation
// cannot run has its own reason before any inference: engines off, weights
// absent or corrupt, rights, hardware or an expired qualification.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODEL_MANIFEST_FORMAT,
  PINNED_MODEL_MANIFESTS,
  discoverEngineCapabilities,
  type ModelPin,
} from "../core/engines/manifests.ts";
import {
  ENGINE_CONTRACT_V2,
  Operation,
  refusal,
  type EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import { ENGINE_ENABLED } from "../core/engines/contract.ts";
import { ENGINE_REASON_MESSAGES } from "../core/engines/reasons.ts";
import { Scopes, execute } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const handle of handles.reverse()) await handle.close();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});
const temp = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "yamakan-models-"));
  bases.push(dir);
  return dir;
};
const sha = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
const HASH = "a".repeat(64);
const host = { memoryBytes: 16 * 1024 ** 3, gpu: false };
const now = new Date("2026-10-26T00:00:00Z");

// A model folder with two small "weight" files and its manifest; returns
// the pin for it. `over` edits the manifest before it is written.
async function model(
  root: string,
  over: (m: Record<string, any>) => void = () => {},
  id = "tiny-t2v",
) {
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });
  const files = { "weights.bin": "WEIGHTS-0123456789", "config.json": "{}" };
  for (const [name, body] of Object.entries(files))
    await writeFile(path.join(dir, name), body);
  const manifest: Record<string, any> = {
    format: MODEL_MANIFEST_FORMAT,
    id,
    version: "1.0.0",
    operation: "textToVideo",
    files: Object.entries(files).map(([name, body]) => ({
      name,
      bytes: Buffer.byteLength(body),
      sha256: sha(body),
    })),
    rights: { license: "apache-2.0", commercialUse: true, noticeSha256: HASH },
    qualification: {
      qualificationHash: "b".repeat(64),
      minMemoryBytes: 8 * 1024 ** 3,
      gpu: "none",
      expiresAt: "2027-01-01T00:00:00Z",
    },
    constraints: {
      maxWidth: 1280,
      maxHeight: 720,
      fps: [{ num: 24, den: 1 }],
      minDurationTicks: 705_600_000,
      maxDurationTicks: 705_600_000 * 8,
      audio: false,
      controls: [],
      roles: [],
    },
  };
  over(manifest);
  const text = JSON.stringify(manifest);
  await writeFile(path.join(dir, "manifest.json"), text);
  const pin: ModelPin = {
    id,
    operation: manifest.operation,
    manifestSha256: sha(text),
  };
  return { dir, pin };
}
const discover = (
  root: string | null,
  pins: readonly ModelPin[],
  extra: Partial<Parameters<typeof discoverEngineCapabilities>[0]> = {},
) =>
  discoverEngineCapabilities({
    enabled: true,
    modelRoot: root,
    pins,
    host,
    now,
    ...extra,
  });
const t2v = async (...args: Parameters<typeof discover>) =>
  (await discover(...args)).find((d) => d.operation === "textToVideo")!;

test("this build: engines off, nothing pinned, every operation ENGINE_DISABLED with its plain reason", async () => {
  assert.equal(ENGINE_ENABLED, false);
  assert.deepEqual(PINNED_MODEL_MANIFESTS, []);
  const root = await temp();
  const { pin } = await model(root);
  // Even with a valid model in place, discovery does nothing while off.
  const results = await discoverEngineCapabilities({
    modelRoot: root,
    pins: [pin],
  });
  assert.deepEqual(
    results.map((r) => r.operation),
    Operation.options,
  );
  for (const r of results) {
    assert.equal(r.capability.available, false);
    assert.equal(r.capability.reason, "ENGINE_DISABLED");
    assert.equal(r.detail, "ENGINE_OFF");
    assert.equal(r.message, ENGINE_REASON_MESSAGES.ENGINE_DISABLED);
  }
});

test("the capabilities command reports the plain reason, takes no parameters, and the offline editor still works", async () => {
  const root = await temp();
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: { id: "local-client" as const, scopes: new Set(Scopes) },
    modelRoot: root,
  };
  const { result } = await execute(ctx, "yamakan.engines.capabilities", {});
  const { operations } = result as {
    operations: { reason: string; message: string; available: boolean }[];
  };
  assert.equal(operations.length, Operation.options.length);
  assert.ok(
    operations.every(
      (o) =>
        !o.available &&
        o.reason === "ENGINE_DISABLED" &&
        o.message === ENGINE_REASON_MESSAGES.ENGINE_DISABLED,
    ),
  );
  // No request can name a model, path, URL or source.
  for (const bad of [
    { modelRoot: "C:\\models" },
    { url: "https://huggingface.co/x" },
    { install: true },
  ])
    await assert.rejects(
      execute(ctx, "yamakan.engines.capabilities", bad),
      (e: unknown) =>
        e instanceof Error && toCommandError(e).code === "VALIDATION",
    );
  // Editing works with no engine.
  const created = await execute(ctx, "yamakan.project.create", {
    name: "Offline",
  });
  assert.ok((created.result as { id: string }).id);
  await queue.close();
});

test("a pinned, intact, licensed and qualified model is discovered with its constraints and qualification expiry", async () => {
  const root = await temp();
  const { pin } = await model(root);
  const d = await t2v(root, [pin]);
  assert.equal(d.detail, "QUALIFIED");
  assert.equal(d.capability.available, true);
  assert.equal(d.capability.qualificationHash, "b".repeat(64));
  assert.equal(d.capability.constraints?.maxWidth, 1280);
  assert.equal(d.version, "1.0.0");
  assert.equal(d.expiresAt, "2027-01-01T00:00:00Z");
  // The other operations have nothing pinned.
  const others = (await discover(root, [pin])).filter(
    (r) => r.operation !== "textToVideo",
  );
  assert.ok(others.every((r) => r.detail === "NOT_PINNED"));
});

test("absent and corrupt models are WEIGHTS_ABSENT, each with its own check, before any inference", async () => {
  const cases: [string, (root: string) => Promise<ModelPin[]>, string][] = [
    ["nothing pinned", async () => [], "NOT_PINNED"],
    [
      "no model root",
      async (root) => [(await model(root)).pin],
      "NO_MODEL_ROOT",
    ],
    [
      "manifest missing",
      async (root) => {
        const { dir, pin } = await model(root);
        await rm(path.join(dir, "manifest.json"));
        return [pin];
      },
      "MANIFEST_MISSING",
    ],
    [
      "manifest not the pinned one (an unapproved model)",
      async (root) => {
        const { pin } = await model(root);
        return [{ ...pin, manifestSha256: HASH }];
      },
      "MANIFEST_MISMATCH",
    ],
    [
      "a manifest that names a download source",
      async (root) => [
        (
          await model(root, (m) => {
            m.source = "https://huggingface.co/org/model";
          })
        ).pin,
      ],
      "MANIFEST_INVALID",
    ],
    [
      "a manifest file outside the model folder",
      async (root) => [
        (
          await model(root, (m) => {
            m.files[0].name = "../weights.bin";
          })
        ).pin,
      ],
      "MANIFEST_INVALID",
    ],
    [
      "a manifest for another operation",
      async (root) => {
        const { pin } = await model(root, (m) => {
          m.operation = "enhance";
        });
        return [{ ...pin, operation: "textToVideo" }];
      },
      "MANIFEST_INVALID",
    ],
    [
      "a weight file missing",
      async (root) => {
        const { dir, pin } = await model(root);
        await rm(path.join(dir, "weights.bin"));
        return [pin];
      },
      "FILE_MISSING",
    ],
    [
      "a truncated weight file",
      async (root) => {
        const { dir, pin } = await model(root);
        await writeFile(path.join(dir, "weights.bin"), "WEIGHTS");
        return [pin];
      },
      "FILE_SIZE_MISMATCH",
    ],
    [
      "a corrupted weight file (same size)",
      async (root) => {
        const { dir, pin } = await model(root);
        await writeFile(path.join(dir, "weights.bin"), "WEIGHTS-XXXXXXXXXX");
        return [pin];
      },
      "FILE_HASH_MISMATCH",
    ],
  ];
  for (const [name, setup, detail] of cases) {
    const root = await temp();
    const pins = await setup(root);
    const d = await t2v(detail === "NO_MODEL_ROOT" ? null : root, pins);
    assert.equal(d.detail, detail, name);
    assert.equal(d.capability.reason, "WEIGHTS_ABSENT", name);
    assert.equal(d.message, ENGINE_REASON_MESSAGES.WEIGHTS_ABSENT, name);
    // The contract refuses a request on it before any worker is spawned.
    const request = {
      contract: ENGINE_CONTRACT_V2,
      operation: "textToVideo",
      recipeId: "r1",
      recipeHash: HASH,
      modelManifestHash: HASH,
      attemptKey: "a1",
      leaseGeneration: 1,
      deadlineMs: 1000,
      resourcePolicyHash: HASH,
      prompt: "a lighthouse",
      inputs: [],
      output: {
        kind: "video",
        width: 640,
        height: 360,
        fps: { num: 24, den: 1 },
        durationTicks: 705_600_000,
        audio: false,
      },
    } as EngineRequestV2;
    assert.equal(refusal(request, d.capability), "WEIGHTS_ABSENT", name);
  }
  // A root that does not exist is no root.
  const missing = path.join(await temp(), "gone");
  const { pin } = await model(await temp());
  assert.equal((await t2v(missing, [pin])).detail, "NO_MODEL_ROOT");
});

test("links are refused: a junctioned model folder and a symlinked weight file", async (t) => {
  const real = await temp();
  const { pin } = await model(real);
  const root = await temp();
  await symlink(path.join(real, pin.id), path.join(root, pin.id), "junction");
  const viaJunction = await t2v(root, [pin]);
  assert.equal(viaJunction.detail, "LINK_REFUSED");
  assert.equal(viaJunction.capability.reason, "WEIGHTS_ABSENT");
  // A file symlink (needs Developer Mode or elevation on Windows).
  const other = await temp();
  const { dir, pin: pin2 } = await model(other);
  const target = path.join(await temp(), "weights.bin");
  await writeFile(target, "WEIGHTS-0123456789");
  await rm(path.join(dir, "weights.bin"));
  try {
    await symlink(target, path.join(dir, "weights.bin"), "file");
  } catch (e) {
    t.diagnostic(
      `file symlink not creatable here (${(e as NodeJS.ErrnoException).code}): not qualified`,
    );
    return;
  }
  assert.equal((await t2v(other, [pin2])).detail, "LINK_REFUSED");
});

test("rights and hardware refuse with their own reasons, distinct from absence", async () => {
  const check = async (
    over: (m: Record<string, any>) => void,
    reason: string,
    detail: string,
    hostOver = host,
  ) => {
    const root = await temp();
    const { pin } = await model(root, over);
    const d = await t2v(root, [pin], { host: hostOver });
    assert.equal(d.capability.reason, reason, detail);
    assert.equal(d.detail, detail);
    assert.equal(d.message, ENGINE_REASON_MESSAGES[reason]);
    assert.equal(d.capability.available, false);
  };
  await check(
    (m) => {
      m.rights.license = "cc-by-nc-4.0";
    },
    "RIGHTS_UNQUALIFIED",
    "LICENSE_UNACCEPTED",
  );
  await check(
    (m) => {
      m.rights.commercialUse = false;
    },
    "RIGHTS_UNQUALIFIED",
    "LICENSE_UNACCEPTED",
  );
  await check(
    (m) => {
      m.qualification.expiresAt = "2026-10-01T00:00:00Z";
    },
    "HARDWARE_UNQUALIFIED",
    "QUALIFICATION_EXPIRED",
  );
  await check(() => {}, "HARDWARE_UNQUALIFIED", "MEMORY_BELOW", {
    memoryBytes: 4 * 1024 ** 3,
    gpu: false,
  });
  await check(
    (m) => {
      m.qualification.gpu = "required";
    },
    "HARDWARE_UNQUALIFIED",
    "GPU_REQUIRED",
  );
});

test("pins are bounded and validated; one per operation", async () => {
  const root = await temp();
  const { pin } = await model(root);
  await assert.rejects(discover(root, [{ ...pin, id: "../evil" }]));
  await assert.rejects(discover(root, [pin, { ...pin, id: "other" }]));
  await assert.rejects(
    discover(
      root,
      Array.from({ length: 17 }, (_, i) => ({ ...pin, id: `m${i}` })),
    ),
  );
});

test("discovery has no network, install, process or scan path", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../core/engines/manifests.ts", import.meta.url)),
    "utf8",
  );
  const code = source.replace(/\/\/.*$/gm, "");
  for (const forbidden of [
    /\bfetch\s*\(/,
    /node:(https?|net|dgram|dns|tls|child_process|worker_threads)/,
    /\breaddir\b|\bopendir\b|\bglob\b|\bwatch\b/,
    /\bspawn\b|\bexec\b/,
    /huggingface|\bpip\b|npm install|download/i,
  ])
    assert.doesNotMatch(code, forbidden, String(forbidden));
});
