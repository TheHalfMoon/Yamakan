// Continuity references and per-stage consent (YU-051). A take records
// the exact reference entries it was made with: one entry of one immutable
// reference pack version (core/story.ts), and the identity encoding it
// used by id and payload hash. Each stage checks what it must:
// - record (a story is saved): the references are traceable, meaning the
//   project holds that pack version, the entry is in it, its media is the
//   pinned version and a named encoding is the recorded one. Consent is not
//   required, so a revocation never erases the history of old takes.
// - attempt (before a generation is submitted) and attach (before a take
//   is put on the timeline): as record, and every consent the references
//   rely on is usable now (purpose, expiry, revocation, restore epoch),
//   read inside the caller's transaction. A check at one stage is never an
//   approval for a later one: attach checks again.
// Matching hashes show which references were named, never that a take
// resembles them, so the continuity score stays unmeasured until a
// measurement exists.
import type { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import type { Project } from "./project.ts";
import type { DocumentKind } from "./document-ref.ts";
import { sha256Hex } from "./hash/canonical.ts";
import { assertConsentUsable } from "./director/runtime.ts";
import {
  ReferencePackSchema,
  consentPurposeOf,
  type ContinuityRef,
  type ReferencePack,
} from "./story.ts";

export const CONTINUITY_STAGES = ["record", "attempt", "attach"] as const;
export type ContinuityStage = (typeof CONTINUITY_STAGES)[number];

export type ContinuityContext = {
  db: DatabaseSync;
  project: Project;
  // Whether a revision of this project named this document version.
  held: (
    documentId: string,
    contentHash: string,
    kind: DocumentKind,
  ) => boolean;
  nowMs: number;
};

const invalid = (message: string) => new CommandError("VALIDATION", message);

// A pack version this project held, read from its stored bytes and
// checked against its name before it is trusted.
function packVersion(c: ContinuityContext, ref: ContinuityRef) {
  if (!c.held(ref.packDocumentId, ref.packContentHash, "referencePack"))
    throw invalid(
      "A continuity reference names a reference pack version this project does not hold.",
    );
  const row = c.db
    .prepare(
      "SELECT bytes FROM creative_documents WHERE hash = ? AND kind = 'referencePack'",
    )
    .get(ref.packContentHash) as { bytes: Uint8Array } | undefined;
  const damaged = () =>
    new CommandError(
      "RECOVERY_REQUIRED",
      "A referenced pack version is missing or damaged in the workspace; restore a verified backup.",
    );
  if (!row || sha256Hex(Buffer.from(row.bytes)) !== ref.packContentHash)
    throw damaged();
  try {
    return ReferencePackSchema.parse(
      JSON.parse(Buffer.from(row.bytes).toString("utf8")),
    );
  } catch {
    throw damaged();
  }
}

type EncodingRow = {
  character_id: string;
  consent_id: string;
  payload_hash: string;
};

export type ResolvedReference = ContinuityRef & {
  role: ReferencePack["entries"][number]["role"];
  label: string;
  assetId: string;
  assetHash: string;
  characterId: string | null;
  // Which consents were checked usable at this stage (none at record).
  consentsChecked: string[];
};

/**
 * Resolves a take's continuity references for one stage, inside the
 * caller's transaction, or refuses naming the first that fails.
 */
export function resolveContinuity(
  c: ContinuityContext,
  refs: readonly ContinuityRef[],
  stage: ContinuityStage,
) {
  const keys = refs.map(
    (r) => `${r.packDocumentId}:${r.packContentHash}:${r.entryId}`,
  );
  if (new Set(keys).size !== keys.length)
    throw invalid("A take names each reference entry once.");
  const packs = new Map<string, ReferencePack>();
  const references: ResolvedReference[] = refs.map((ref) => {
    const pack =
      packs.get(ref.packContentHash) ??
      packs
        .set(ref.packContentHash, packVersion(c, ref))
        .get(ref.packContentHash)!;
    const entry = pack.entries.find((e) => e.id === ref.entryId);
    if (!entry)
      throw invalid(
        `A continuity reference names an entry that pack "${pack.name}" does not have in that version.`,
      );
    const asset = c.project.assets.find((a) => a.id === entry.assetId);
    if (!asset || asset.hash !== entry.assetHash)
      throw invalid(
        `Reference "${entry.label}" no longer matches its media version in this project.`,
      );
    let encoding: EncodingRow | undefined;
    if (ref.encoding) {
      if (entry.role !== "character")
        throw invalid("Only a character reference names an identity encoding.");
      encoding = c.db
        .prepare(
          "SELECT character_id, consent_id, payload_hash FROM identity_encodings WHERE id = ?",
        )
        .get(ref.encoding.id) as EncodingRow | undefined;
      // A forged or altered hash, or another character's encoding.
      if (
        !encoding ||
        encoding.payload_hash !== ref.encoding.payloadHash ||
        encoding.character_id !== entry.characterId
      )
        throw invalid(
          `Reference "${entry.label}" names an identity encoding that does not match a recorded one for its character.`,
        );
    }
    const consentsChecked: string[] = [];
    if (stage !== "record") {
      if (entry.consentId !== null && entry.characterId !== null) {
        assertConsentUsable(c.db, entry.consentId, {
          characterId: entry.characterId,
          purpose: consentPurposeOf(entry.role),
          nowMs: c.nowMs,
        });
        consentsChecked.push(entry.consentId);
      }
      // An encoding is usable only while its own consent is.
      if (encoding) {
        assertConsentUsable(c.db, encoding.consent_id, {
          characterId: encoding.character_id,
          purpose: "identity-encode",
          nowMs: c.nowMs,
        });
        consentsChecked.push(encoding.consent_id);
      }
    }
    return {
      ...ref,
      role: entry.role,
      label: entry.label,
      assetId: asset.id,
      assetHash: asset.hash,
      characterId: entry.characterId,
      consentsChecked,
    };
  });
  return {
    stage,
    // The references are what they say: held versions, real entries, the
    // pinned media and the recorded encodings.
    metadataValid: true as const,
    consentChecked: stage !== "record",
    references,
    // Kept apart from metadata: no measurement of resemblance exists.
    continuity: {
      score: null,
      status: "unmeasured" as const,
      basis:
        "Matching hashes show which references a take named, not that it resembles them.",
    },
  };
}

/** Every take's continuity references in a story, checked as traceable. */
export function verifyStoryContinuity(
  story: {
    scenes: {
      shots: {
        takes: { lineage?: { continuity?: ContinuityRef[] } }[];
      }[];
    }[];
  },
  c: ContinuityContext,
) {
  for (const scene of story.scenes)
    for (const shot of scene.shots)
      for (const take of shot.takes)
        if (take.lineage?.continuity?.length)
          resolveContinuity(c, take.lineage.continuity, "record");
}
