// M12 / W15: In-workspace director + consent state. Durable under
// <workspace>/director/ as JSON; Director feature flag stays off for UI.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectStore } from "../store.ts";
import { CommandError } from "../command/errors.ts";
import {
  ConsentRecordSchema,
  IdentityEncodingSchema,
  assertConsentForEncoding,
  invalidateEncodingsForConsent,
  revokeConsent,
  type ConsentPurpose,
  type ConsentRecord,
  type IdentityEncoding,
} from "../identity.ts";
import {
  builtinManifest,
  stageRequiresApproval,
  type PipelineManifest,
} from "./manifest.ts";
import {
  DirectorRunSchema,
  StageReceiptSchema,
  applyApproval,
  enforceStagePrerequisites,
  nextStage,
  type DirectorRun,
  type StageStatus,
} from "./stages.ts";

async function directorDir(store: ProjectStore): Promise<string> {
  const dir = join(store.root, "director");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

async function readJson<T>(
  path: string,
  parse: (raw: unknown) => T,
): Promise<T | null> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    return parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function loadManifestFromAssets(
  name: string,
): Promise<PipelineManifest> {
  return builtinManifest(name);
}

export async function grantConsent(
  store: ProjectStore,
  input: {
    characterId: string;
    purpose: ConsentPurpose;
    version: string;
    ttlMs: number;
    principalId: string;
    nowMs?: number;
  },
): Promise<ConsentRecord> {
  const now = input.nowMs ?? Date.now();
  if (input.ttlMs < 60_000 || input.ttlMs > 366 * 24 * 60 * 60 * 1000)
    throw new CommandError("VALIDATION", "Consent TTL out of range.");
  const record = ConsentRecordSchema.parse({
    format: "yamakan.likeness-consent",
    formatVersion: 1,
    id: randomUUID(),
    characterId: input.characterId,
    purpose: input.purpose,
    version: input.version,
    grantedAtMs: now,
    expiresAtMs: now + input.ttlMs,
    revokedAtMs: null,
    grantorPrincipalId: input.principalId,
  });
  const dir = await directorDir(store);
  await writeJson(join(dir, `consent-${record.id}.json`), record);
  return record;
}

export async function revokeConsentRecord(
  store: ProjectStore,
  consentId: string,
  nowMs = Date.now(),
): Promise<{ consent: ConsentRecord; encodings: IdentityEncoding[] }> {
  const dir = await directorDir(store);
  const path = join(dir, `consent-${consentId}.json`);
  const existing = await readJson(path, (r) => ConsentRecordSchema.parse(r));
  if (!existing) throw new CommandError("NOT_FOUND", "Consent not found.");
  const consent = revokeConsent(existing, nowMs);
  await writeJson(path, consent);
  const encodings = await listEncodings(store);
  const next = invalidateEncodingsForConsent(encodings, consentId);
  for (const enc of next) {
    if (enc.consentId === consentId)
      await writeJson(join(dir, `encoding-${enc.id}.json`), enc);
  }
  return { consent, encodings: next.filter((e) => e.consentId === consentId) };
}

export async function listEncodings(
  store: ProjectStore,
): Promise<IdentityEncoding[]> {
  const dir = await directorDir(store);
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(dir).catch(() => [] as string[]);
  const out: IdentityEncoding[] = [];
  for (const name of names) {
    if (!name.startsWith("encoding-")) continue;
    const row = await readJson(join(dir, name), (r) =>
      IdentityEncodingSchema.parse(r),
    );
    if (row) out.push(row);
  }
  return out;
}

export async function recordEncoding(
  store: ProjectStore,
  input: {
    characterId: string;
    purpose: ConsentPurpose;
    consentId: string;
    provider: string;
    method: string;
    payloadHash: string;
    nowMs?: number;
  },
): Promise<IdentityEncoding> {
  const dir = await directorDir(store);
  const consent = await readJson(
    join(dir, `consent-${input.consentId}.json`),
    (r) => ConsentRecordSchema.parse(r),
  );
  assertConsentForEncoding(consent, {
    characterId: input.characterId,
    purpose: input.purpose,
    nowMs: input.nowMs ?? Date.now(),
  });
  const encoding = IdentityEncodingSchema.parse({
    format: "yamakan.identity-encoding",
    formatVersion: 1,
    id: randomUUID(),
    characterId: input.characterId,
    provider: input.provider,
    method: input.method,
    payloadHash: input.payloadHash,
    consentId: input.consentId,
    metadata: {},
    invalidated: false,
  });
  await writeJson(join(dir, `encoding-${encoding.id}.json`), encoding);
  return encoding;
}

export async function startDirectorRun(
  store: ProjectStore,
  input: { projectId: string; pipelineName: string },
): Promise<DirectorRun> {
  const manifest = await loadManifestFromAssets(input.pipelineName);
  const run = DirectorRunSchema.parse({
    format: "yamakan.director-run",
    formatVersion: 1,
    id: randomUUID(),
    projectId: input.projectId,
    pipelineName: manifest.name,
    receipts: [],
  });
  const dir = await directorDir(store);
  await writeJson(join(dir, `run-${run.id}.json`), run);
  return run;
}

export async function loadRun(
  store: ProjectStore,
  runId: string,
): Promise<DirectorRun> {
  const dir = await directorDir(store);
  const run = await readJson(join(dir, `run-${runId}.json`), (r) =>
    DirectorRunSchema.parse(r),
  );
  if (!run) throw new CommandError("NOT_FOUND", "Director run not found.");
  return run;
}

export async function advanceStage(
  store: ProjectStore,
  input: {
    runId: string;
    stage: string;
    status: StageStatus;
    outputHash: string | null;
    nowMs?: number;
  },
): Promise<DirectorRun> {
  const now = input.nowMs ?? Date.now();
  const run = await loadRun(store, input.runId);
  const manifest = await loadManifestFromAssets(run.pipelineName);
  const existing = run.receipts.find((r) => r.stage === input.stage);
  if (
    existing?.humanApproved &&
    existing.outputHash &&
    existing.outputHash === input.outputHash
  ) {
    throw new CommandError(
      "VALIDATION",
      "Cannot rewrite a stage that already has a valid human approval for this output.",
    );
  }
  if (
    stageRequiresApproval(manifest, input.stage) &&
    input.status === "completed"
  ) {
    throw new CommandError(
      "VALIDATION",
      "Approval-required stages complete only through yamakan.director.approve.",
    );
  }
  enforceStagePrerequisites(
    manifest,
    run,
    input.stage,
    input.status,
    now,
  );
  const receipt = StageReceiptSchema.parse({
    format: "yamakan.stage-receipt",
    formatVersion: 1,
    projectId: run.projectId,
    pipelineName: run.pipelineName,
    stage: input.stage,
    status: input.status,
    outputHash: input.outputHash,
    humanApproved: false,
    approvalExpiresAtMs: null,
    approvedOutputHash: null,
  });
  const receipts = [
    ...run.receipts.filter((r) => r.stage !== input.stage),
    receipt,
  ];
  const next = { ...run, receipts };
  const dir = await directorDir(store);
  await writeJson(join(dir, `run-${run.id}.json`), next);
  return next;
}

export async function approveStage(
  store: ProjectStore,
  input: {
    runId: string;
    stage: string;
    outputHash: string;
    ttlMs: number;
    nowMs?: number;
  },
): Promise<DirectorRun> {
  const now = input.nowMs ?? Date.now();
  const run = await loadRun(store, input.runId);
  const receipt = run.receipts.find((r) => r.stage === input.stage);
  if (!receipt) throw new CommandError("NOT_FOUND", "Stage receipt not found.");
  const approved = applyApproval(receipt, {
    outputHash: input.outputHash,
    nowMs: now,
    expiresAtMs: now + input.ttlMs,
  });
  const next = {
    ...run,
    receipts: run.receipts.map((r) => (r.stage === input.stage ? approved : r)),
  };
  const dir = await directorDir(store);
  await writeJson(join(dir, `run-${run.id}.json`), next);
  return next;
}

export async function directorNext(
  store: ProjectStore,
  runId: string,
  nowMs = Date.now(),
): Promise<ReturnType<typeof nextStage>> {
  const run = await loadRun(store, runId);
  const manifest = await loadManifestFromAssets(run.pipelineName);
  return nextStage(manifest, run, nowMs);
}
