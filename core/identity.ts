// M11 / W15: Character identity contracts translated from OpenVideoStudio
// (mne03005-png/OpenVideoStudio @ 175da996). Paths → asset ids; bible_version →
// canonical revision. Provider implementations (InstantID, Ollama, edge-tts)
// are excluded.
import { z } from "zod";
import { Id } from "./project.ts";
import { CommandError } from "./command/errors.ts";

export {
  DIRECTOR_ENABLED,
  directorCapability,
} from "./director-flags.ts";

export const REFERENCE_VIEWS = [
  "front",
  "45_degree",
  "side",
  "back",
  "full_body",
] as const;
export type ReferenceView = (typeof REFERENCE_VIEWS)[number];

export const CHARACTER_IDENTITY_FIELDS = [
  "character_id",
  "name_or_role",
  "gender_presentation",
  "approx_age",
  "hair",
  "face_shape",
  "skin_tone",
  "eye_features",
  "distinctive_features",
  "wardrobe",
  "accessories",
  "body_build",
  "visual_style",
] as const;

export const ENVIRONMENT_IDENTITY_FIELDS = [
  "location_id",
  "architecture",
  "materials",
  "lighting",
  "weather",
  "time_of_day",
  "color_palette",
  "landmarks",
  "props",
  "camera_language",
] as const;

const Bounded = z.string().max(500);
const FieldMap = z.record(z.string().max(64), Bounded);

export const ReferenceImageSchema = z
  .object({
    assetId: Id,
    view: z.enum(REFERENCE_VIEWS),
  })
  .strict();
export type ReferenceImage = z.infer<typeof ReferenceImageSchema>;

export const CharacterAssetSchema = z
  .object({
    format: z.literal("yamakan.character"),
    formatVersion: z.literal(1),
    characterId: z.string().min(1).max(80),
    /** Canonical project revision that pinned this bible. */
    bibleRevision: z.number().int().nonnegative(),
    description: FieldMap,
    referenceImages: z.array(ReferenceImageSchema).max(64),
    clothingAssetIds: z.array(Id).max(64),
    accessoryAssetIds: z.array(Id).max(64),
    embeddingAssetIds: z.array(Id).max(16),
  })
  .strict();
export type CharacterAsset = z.infer<typeof CharacterAssetSchema>;

export const IdentityEncodingSchema = z
  .object({
    format: z.literal("yamakan.identity-encoding"),
    formatVersion: z.literal(1),
    id: Id,
    characterId: z.string().min(1).max(80),
    provider: z.string().min(1).max(64),
    method: z.string().min(1).max(64),
    /** Content hash of opaque provider payload (bytes never stored here). */
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    consentId: Id,
    metadata: FieldMap.default({}),
    invalidated: z.boolean().default(false),
  })
  .strict();
export type IdentityEncoding = z.infer<typeof IdentityEncodingSchema>;

export const IdentityApplicationSchema = z
  .object({
    format: z.literal("yamakan.identity-application"),
    formatVersion: z.literal(1),
    prompt: z.string().max(8_000),
    controls: FieldMap.default({}),
    metadata: FieldMap.default({}),
  })
  .strict();
export type IdentityApplication = z.infer<typeof IdentityApplicationSchema>;

export const ConsentPurposeSchema = z.enum([
  "identity-encode",
  "likeness-generate",
  "voice-clone",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;

export const ConsentRecordSchema = z
  .object({
    format: z.literal("yamakan.likeness-consent"),
    formatVersion: z.literal(1),
    id: Id,
    characterId: z.string().min(1).max(80),
    purpose: ConsentPurposeSchema,
    version: z.string().min(1).max(40),
    grantedAtMs: z.number().int().nonnegative(),
    expiresAtMs: z.number().int().positive(),
    revokedAtMs: z.number().int().nonnegative().nullable(),
    grantorPrincipalId: z.string().min(1).max(80),
  })
  .strict();
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export function parseCharacterAsset(raw: unknown): CharacterAsset {
  const parsed = CharacterAssetSchema.safeParse(raw);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      `Invalid character asset: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  return parsed.data;
}

export function assertReferenceIsImageAsset(extension: string): void {
  const ok = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);
  if (!ok.has(extension.toLowerCase().replace(/^\./, "")))
    throw new CommandError(
      "VALIDATION",
      "Character reference must be an image asset.",
    );
}

/**
 * Likeness consent must be present, unexpired, unrevoked, and match purpose
 * before any identity encoding job may run.
 */
export function assertConsentForEncoding(
  consent: ConsentRecord | null | undefined,
  opts: { characterId: string; purpose: ConsentPurpose; nowMs: number },
): ConsentRecord {
  if (!consent)
    throw new CommandError(
      "VALIDATION",
      "Likeness consent is required before identity encoding.",
    );
  if (consent.characterId !== opts.characterId)
    throw new CommandError(
      "VALIDATION",
      "Consent character does not match the encoding target.",
    );
  if (consent.purpose !== opts.purpose)
    throw new CommandError(
      "VALIDATION",
      `Consent purpose ${consent.purpose} does not allow ${opts.purpose}.`,
    );
  if (consent.revokedAtMs !== null)
    throw new CommandError("VALIDATION", "Likeness consent was revoked.");
  if (opts.nowMs >= consent.expiresAtMs)
    throw new CommandError("VALIDATION", "Likeness consent has expired.");
  return consent;
}

export function revokeConsent(
  consent: ConsentRecord,
  nowMs: number,
): ConsentRecord {
  if (consent.revokedAtMs !== null) return consent;
  return { ...consent, revokedAtMs: nowMs };
}

/** Mark every encoding derived from a consent as invalidated. */
export function invalidateEncodingsForConsent(
  encodings: readonly IdentityEncoding[],
  consentId: string,
): IdentityEncoding[] {
  return encodings.map((e) =>
    e.consentId === consentId && !e.invalidated
      ? { ...e, invalidated: true }
      : e,
  );
}
