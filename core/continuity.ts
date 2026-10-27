// Continuity references and per-stage consent (YU-051). A take records
// the exact reference entries it was made with: one entry of one immutable
// reference pack version (core/story.ts), and the identity encoding it
// used by id and payload hash. Each stage checks what it must:
// - record (a story is saved): the references are traceable, meaning the
//   project holds that pack version, the entry is in it and a named
//   encoding is the recorded one. Neither consent nor the entry's media is
//   required, so a revocation or a removed medium never erases the history
//   of old takes.
// - attempt (before a generation is submitted) and attach (before a take
//   is put on the timeline): as record, the pinned media is present, and
//   every consent the references
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
import type { ConsentPurpose } from "./identity.ts";
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
  purpose: ConsentPurpose;
};

export type ResolvedReference = ContinuityRef & {
  role: ReferencePack["entries"][number]["role"];
  label: string;
  assetId: string;
  assetHash: string;
  characterId: string | null;
  // Whether the pinned media version is still in the project (required
  // at attempt and attach).
  mediaPresent: boolean;
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
    // Keyed by document and version: identical bytes held under another
    // document (or by another project) are not this pack.
    const key = `${ref.packDocumentId}:${ref.packContentHash}`;
    const pack =
      packs.get(key) ?? packs.set(key, packVersion(c, ref)).get(key)!;
    const entry = pack.entries.find((e) => e.id === ref.entryId);
    if (!entry)
      throw invalid(
        `A continuity reference names an entry that pack "${pack.name}" does not have in that version.`,
      );
    // The pinned media version must still be this project's to be used;
    // keeping the record of an old take does not need it.
    const asset = c.project.assets.find((a) => a.id === entry.assetId);
    const mediaPresent = Boolean(asset && asset.hash === entry.assetHash);
    if (stage !== "record" && !mediaPresent)
      throw invalid(
        `Reference "${entry.label}" no longer matches its media version in this project.`,
      );
    let encoding: EncodingRow | undefined;
    if (ref.encoding) {
      if (entry.role !== "character")
        throw invalid("Only a character reference names an identity encoding.");
      encoding = c.db
        .prepare(
          "SELECT e.character_id, e.consent_id, e.payload_hash, c.purpose FROM identity_encodings e JOIN likeness_consents c ON c.id = e.consent_id WHERE e.id = ?",
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
      // An encoding is usable only while the consent it was recorded under
      // is (for that consent's own purpose).
      if (encoding) {
        assertConsentUsable(c.db, encoding.consent_id, {
          characterId: encoding.character_id,
          purpose: encoding.purpose,
          nowMs: c.nowMs,
        });
        consentsChecked.push(encoding.consent_id);
      }
    }
    return {
      ...ref,
      role: entry.role,
      label: entry.label,
      assetId: entry.assetId,
      assetHash: entry.assetHash,
      mediaPresent,
      characterId: entry.characterId,
      consentsChecked,
    };
  });
  return {
    stage,
    // The references are what they say: held versions, real entries and
    // the recorded encodings (and, at attempt and attach, present media).
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

/**
 * Assembly attaches each shot's selected take: its continuity references
 * are checked at the attach stage, consents usable now.
 */
export function verifySelectedContinuity(
  story: {
    scenes: {
      shots: {
        selectedTakeId: string | null;
        takes: { id: string; lineage?: { continuity?: ContinuityRef[] } }[];
      }[];
    }[];
  },
  c: ContinuityContext,
) {
  for (const scene of story.scenes)
    for (const shot of scene.shots) {
      const take = shot.takes.find((t) => t.id === shot.selectedTakeId);
      if (take?.lineage?.continuity?.length)
        resolveContinuity(c, take.lineage.continuity, "attach");
    }
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
