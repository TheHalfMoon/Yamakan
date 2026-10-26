// Engine capability discovery (YU-042): which operations could run here,
// decided from pinned local model manifests only. Nothing is imported,
// installed or downloaded, and no directory is listed or scanned: each
// pinned manifest is read at its one exact path, every file it names is
// checked for size, link and hash, then its rights and the host's
// qualification. Engines stay off (ENGINE_ENABLED): discovery then does no
// IO and every operation reports ENGINE_DISABLED.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { totalmem } from "node:os";
import path from "node:path";
import { z } from "zod";
import { ENGINE_ENABLED } from "./contract.ts";
import {
  CapabilityV2Schema,
  ConstraintsSchema,
  Operation,
  constraintsHash,
  type CapabilityV2,
  type RefusalReason,
} from "./contract-v2.ts";
import { engineReasonMessage } from "./reasons.ts";

export const MODEL_MANIFEST_FORMAT = "yamakan.model-manifest/v1";
export const MANIFEST_LIMITS = Object.freeze({
  manifestBytes: 64 * 1024,
  pins: 16,
  files: 16,
  fileBytes: 64 * 1024 * 1024 * 1024,
});
// Licenses a model may carry and be used under (commercial use included).
export const ACCEPTED_MODEL_LICENSES: readonly string[] = Object.freeze([
  "apache-2.0",
  "mit",
  "bsd-2-clause",
  "bsd-3-clause",
]);

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
// A model folder name: never a path, URL or package name with a scope.
const ModelId = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
// A file directly inside the model folder: no separator, no leading dot.
const FileName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);

export const ModelManifestSchema = z
  .object({
    format: z.literal(MODEL_MANIFEST_FORMAT),
    id: ModelId,
    version: z.string().regex(/^\d{1,6}\.\d{1,6}\.\d{1,6}$/),
    operation: Operation,
    files: z
      .array(
        z
          .object({
            name: FileName,
            bytes: z.number().int().positive().max(MANIFEST_LIMITS.fileBytes),
            sha256: Sha256,
          })
          .strict(),
      )
      .min(1)
      .max(MANIFEST_LIMITS.files)
      .refine(
        (files) =>
          new Set(files.map((f) => f.name.toLowerCase())).size === files.length,
        "File names are unique.",
      ),
    rights: z
      .object({
        license: z.string().regex(/^[a-z0-9.+-]{1,40}$/),
        commercialUse: z.boolean(),
        noticeSha256: Sha256,
      })
      .strict(),
    qualification: z
      .object({
        qualificationHash: Sha256,
        minMemoryBytes: z.number().int().nonnegative(),
        gpu: z.enum(["none", "required"]),
        expiresAt: z.iso.datetime(),
      })
      .strict(),
    constraints: ConstraintsSchema,
  })
  .strict();
export type ModelManifest = z.infer<typeof ModelManifestSchema>;

// A manifest the build trusts: its folder, operation and exact hash.
export type ModelPin = {
  id: string;
  operation: Operation;
  manifestSha256: string;
};
// No model is pinned in this build.
export const PINNED_MODEL_MANIFESTS: readonly ModelPin[] = Object.freeze([]);

export type HostProfile = { memoryBytes: number; gpu: boolean };

// Which check decided, for support and tests; people see the reason's
// plain message.
export type DiscoveryDetail =
  | "ENGINE_OFF"
  | "NO_MODEL_ROOT"
  | "NOT_PINNED"
  | "MANIFEST_MISSING"
  | "MANIFEST_MISMATCH"
  | "MANIFEST_INVALID"
  | "LINK_REFUSED"
  | "FILE_MISSING"
  | "FILE_SIZE_MISMATCH"
  | "FILE_HASH_MISMATCH"
  | "LICENSE_UNACCEPTED"
  | "QUALIFICATION_EXPIRED"
  | "MEMORY_BELOW"
  | "GPU_REQUIRED"
  | "QUALIFIED";

export type OperationDiscovery = {
  operation: Operation;
  capability: CapabilityV2;
  detail: DiscoveryDetail;
  message: string;
  manifestId?: string;
  version?: string;
  // When the host's qualification for this operation lapses.
  expiresAt?: string;
};

const unavailable = (
  operation: Operation,
  reason: RefusalReason,
  detail: DiscoveryDetail,
  manifest?: ModelManifest,
): OperationDiscovery => ({
  operation,
  capability: CapabilityV2Schema.parse({
    operation,
    available: false,
    reason,
    constraintsHash: constraintsHash(null),
  }),
  detail,
  message: engineReasonMessage(reason),
  ...(manifest
    ? {
        manifestId: manifest.id,
        version: manifest.version,
        expiresAt: manifest.qualification.expiresAt,
      }
    : {}),
});

const sameFile = (a: string, b: string) =>
  process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;

// A regular file at exactly this path: no link, junction or other
// redirection anywhere under the model root.
async function regularFile(
  file: string,
): Promise<{ bytes: number } | "missing" | "link"> {
  let info;
  try {
    info = await lstat(file);
  } catch {
    return "missing";
  }
  if (info.isSymbolicLink()) return "link";
  if (!info.isFile()) return "missing";
  const real = await realpath(file).catch(() => null);
  if (!real || !sameFile(real, file)) return "link";
  return { bytes: info.size };
}

async function readBounded(file: string, limit: number) {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length <= limit) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    return length > limit ? null : buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}

// The file's hash, reading no more than it declared (a longer file fails).
async function fileHash(file: string, bytes: number) {
  const hash = createHash("sha256");
  let read = 0;
  for await (const chunk of createReadStream(file, {
    highWaterMark: 1024 * 1024,
  }) as AsyncIterable<Buffer>) {
    read += chunk.length;
    if (read > bytes) return null;
    hash.update(chunk);
  }
  return read === bytes ? hash.digest("hex") : null;
}

async function discoverOne(
  root: string,
  pin: ModelPin,
  host: HostProfile,
  now: Date,
  verifyHashes: boolean,
): Promise<OperationDiscovery> {
  const op = pin.operation;
  const folder = path.join(root, pin.id);
  const manifestFile = path.join(folder, "manifest.json");
  const found = await regularFile(manifestFile);
  if (found === "link")
    return unavailable(op, "WEIGHTS_ABSENT", "LINK_REFUSED");
  if (found === "missing")
    return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_MISSING");
  if (found.bytes > MANIFEST_LIMITS.manifestBytes)
    return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_INVALID");
  const bytes = await readBounded(
    manifestFile,
    MANIFEST_LIMITS.manifestBytes,
  ).catch(() => null);
  if (!bytes) return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_INVALID");
  if (createHash("sha256").update(bytes).digest("hex") !== pin.manifestSha256)
    return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_MISMATCH");
  let manifest: ModelManifest;
  try {
    manifest = ModelManifestSchema.parse(JSON.parse(bytes.toString("utf8")));
  } catch {
    return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_INVALID");
  }
  if (manifest.id !== pin.id || manifest.operation !== op)
    return unavailable(op, "WEIGHTS_ABSENT", "MANIFEST_INVALID");
  // Every file present at its exact path and size (cheap checks first).
  for (const file of manifest.files) {
    const at = await regularFile(path.join(folder, file.name));
    if (at === "link")
      return unavailable(op, "WEIGHTS_ABSENT", "LINK_REFUSED", manifest);
    if (at === "missing")
      return unavailable(op, "WEIGHTS_ABSENT", "FILE_MISSING", manifest);
    if (at.bytes !== file.bytes)
      return unavailable(op, "WEIGHTS_ABSENT", "FILE_SIZE_MISMATCH", manifest);
  }
  if (
    !ACCEPTED_MODEL_LICENSES.includes(manifest.rights.license) ||
    !manifest.rights.commercialUse
  )
    return unavailable(
      op,
      "RIGHTS_UNQUALIFIED",
      "LICENSE_UNACCEPTED",
      manifest,
    );
  const q = manifest.qualification;
  if (Date.parse(q.expiresAt) <= now.getTime())
    return unavailable(
      op,
      "HARDWARE_UNQUALIFIED",
      "QUALIFICATION_EXPIRED",
      manifest,
    );
  if (host.memoryBytes < q.minMemoryBytes)
    return unavailable(op, "HARDWARE_UNQUALIFIED", "MEMORY_BELOW", manifest);
  if (q.gpu === "required" && !host.gpu)
    return unavailable(op, "HARDWARE_UNQUALIFIED", "GPU_REQUIRED", manifest);
  // Last, the costly check: every file's content.
  if (verifyHashes)
    for (const file of manifest.files) {
      const hash = await fileHash(
        path.join(folder, file.name),
        file.bytes,
      ).catch(() => null);
      if (hash !== file.sha256)
        return unavailable(
          op,
          "WEIGHTS_ABSENT",
          "FILE_HASH_MISMATCH",
          manifest,
        );
    }
  return {
    operation: op,
    capability: CapabilityV2Schema.parse({
      operation: op,
      available: true,
      qualificationHash: q.qualificationHash,
      constraints: manifest.constraints,
      constraintsHash: constraintsHash(manifest.constraints),
    }),
    detail: "QUALIFIED",
    message: "Available.",
    manifestId: manifest.id,
    version: manifest.version,
    expiresAt: q.expiresAt,
  };
}

// One result per operation, in the contract's order.
export async function discoverEngineCapabilities(
  options: {
    enabled?: boolean;
    // Chosen by the service, never by a request.
    modelRoot?: string | null;
    pins?: readonly ModelPin[];
    host?: HostProfile;
    now?: Date;
    verifyHashes?: boolean;
  } = {},
): Promise<OperationDiscovery[]> {
  const operations = Operation.options;
  if (!(options.enabled ?? ENGINE_ENABLED))
    return operations.map((op) =>
      unavailable(op, "ENGINE_DISABLED", "ENGINE_OFF"),
    );
  const pins = options.pins ?? PINNED_MODEL_MANIFESTS;
  if (pins.length > MANIFEST_LIMITS.pins)
    throw new Error("Too many pinned model manifests.");
  for (const pin of pins) {
    ModelId.parse(pin.id);
    Operation.parse(pin.operation);
    Sha256.parse(pin.manifestSha256);
  }
  if (new Set(pins.map((p) => p.operation)).size !== pins.length)
    throw new Error("One pinned manifest per operation.");
  const root = options.modelRoot
    ? await realpath(options.modelRoot).catch(() => null)
    : null;
  const host = options.host ?? { memoryBytes: totalmem(), gpu: false };
  const now = options.now ?? new Date();
  const results: OperationDiscovery[] = [];
  for (const op of operations) {
    const pin = pins.find((p) => p.operation === op);
    if (!pin) results.push(unavailable(op, "WEIGHTS_ABSENT", "NOT_PINNED"));
    else if (!root)
      results.push(unavailable(op, "WEIGHTS_ABSENT", "NO_MODEL_ROOT"));
    else
      results.push(
        await discoverOne(root, pin, host, now, options.verifyHashes ?? true),
      );
  }
  return results;
}
