// POST /api/v1/projects/:projectId/documents/stage (YU-010b): streams one
// creative document into a sealed, project- and principal-bound staged
// upload. Separate from command ingress so the 2 MiB command cap stays.
// Order: flag, authorization, headers, reservation, then the body; a
// retry of a sealed upload is answered from its receipt without a body.
import type { IncomingMessage } from "node:http";
import { RESOURCE_POLICY } from "../core/command/policy.ts";
import { CommandError } from "../core/command/errors.ts";
import { authorize } from "../core/command/registry.ts";
import type { Principal } from "../core/command/registry.ts";
import {
  CREATIVE_DOCUMENTS_ENABLED,
  DOCUMENT_LIMITS,
  DocumentKind,
} from "../core/documents.ts";
import type { ProjectStore, StagedDocumentReceipt } from "../core/store.ts";

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;

const header = (req: IncomingMessage, name: string) => {
  const value = req.headers[name];
  return typeof value === "string" ? value : "";
};

// The whole body must arrive at the slowest accepted upload rate plus a
// short grace, so a dripped body cannot hold its reservation or memory.
export const stageDeadlineMs = (length: number) =>
  10_000 +
  Math.ceil(length / RESOURCE_POLICY.enforced.minUploadBytesPerSecond) * 1000;

async function exactBody(
  req: IncomingMessage,
  length: number,
  deadlineMs: number,
) {
  const chunks: Buffer[] = [];
  let size = 0;
  const timer = setTimeout(
    () =>
      req.destroy(
        new CommandError("LIMIT_EXCEEDED", "The upload was too slow."),
      ),
    deadlineMs,
  );
  try {
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > length)
        throw new CommandError(
          "VALIDATION",
          "The upload is longer than its Content-Length.",
        );
      chunks.push(chunk);
    }
  } finally {
    clearTimeout(timer);
  }
  return Buffer.concat(chunks, size);
}

export async function stageDocument(
  store: ProjectStore,
  principal: Principal,
  projectId: string,
  req: IncomingMessage,
  // Test seams only: production passes neither and gets the AG-DOCS flag
  // and the policy deadline.
  enabled: boolean = CREATIVE_DOCUMENTS_ENABLED,
  deadlineMs?: number,
): Promise<StagedDocumentReceipt> {
  if (!enabled)
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      "Creative document persistence is not enabled in this build.",
    );
  authorize(principal, "yamakan.document.commit");
  if (!header(req, "content-type").startsWith("application/json"))
    throw new CommandError("VALIDATION", "JSON content type required.");
  const length = header(req, "content-length");
  if (!/^\d{1,9}$/.test(length) || Number(length) === 0)
    throw new CommandError(
      "VALIDATION",
      "Staged uploads require a Content-Length header.",
    );
  const requestId = header(req, "x-request-id");
  const bodySha256 = header(req, "x-content-sha256").toLowerCase();
  const version = header(req, "x-document-schema-version");
  const kind = DocumentKind.safeParse(header(req, "x-document-kind"));
  if (
    !REQUEST_ID.test(requestId) ||
    !SHA256.test(bodySha256) ||
    !/^\d{1,4}$/.test(version) ||
    !kind.success
  )
    throw new CommandError(
      "VALIDATION",
      "Staged uploads require X-Request-Id, X-Content-SHA256, X-Document-Kind and X-Document-Schema-Version.",
    );
  if (Number(length) > DOCUMENT_LIMITS.documentBytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `A staged document is at most ${DOCUMENT_LIMITS.documentBytes} bytes.`,
    );
  const reservation = store.reserveDocumentUpload({
    projectId,
    principalId: principal.id,
    requestId,
    kind: kind.data,
    schemaVersion: Number(version),
    declaredBytes: Number(length),
    bodySha256,
  });
  if ("receipt" in reservation) return reservation.receipt;
  let body: Buffer;
  try {
    body = await exactBody(
      req,
      Number(length),
      deadlineMs ?? stageDeadlineMs(Number(length)),
    );
  } catch (e) {
    store.abandonDocumentUpload(reservation.reserved);
    throw e instanceof CommandError
      ? e
      : new CommandError("VALIDATION", "The upload was interrupted.");
  }
  return store.sealDocumentUpload(reservation.reserved, body);
}
