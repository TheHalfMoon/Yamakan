// Pure constants and schemas for creative document references (YU-010):
// imported by core/canonical.ts, which the browser bundle includes, so no
// Node APIs and no document validators here (those are core/documents.ts).
import { z } from "zod";
import { Id } from "./project.ts";

// Route-specific ceilings for one whole document (docs/OPERATIONAL_CONTRACTS.md,
// "Creative documents"). They apply to the raw bytes received and to the
// canonical bytes stored; the general 2 MiB command and snapshot caps are
// unchanged.
export const DOCUMENT_LIMITS = Object.freeze({
  documentBytes: 8 * 1024 * 1024,
  depth: 64,
  nodes: 10_000,
  documentsPerProject: 32,
});

export const DocumentKind = z.enum(["studio", "cinemaScene"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

// The schema version each kind is validated against today.
export const DOCUMENT_SCHEMA_VERSIONS: Readonly<Record<DocumentKind, number>> =
  Object.freeze({ studio: 1, cinemaScene: 1 });

export const DocumentRefSchema = z
  .object({
    id: Id,
    kind: DocumentKind,
    schemaVersion: z.number().int().min(1).max(1000),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type DocumentRef = z.infer<typeof DocumentRefSchema>;
