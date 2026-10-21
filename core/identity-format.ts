// M11 / W15: Deterministic identity text formatters translated from
// OpenVideoStudio studio/creative/identity.py @ 175da996
// (format_character_identity / format_environment_identity).

type FieldMap = Record<string, string>;

export function formatCharacterIdentity(
  characterIdentity: FieldMap | null | undefined,
): string {
  if (!characterIdentity) return "";
  const c = characterIdentity;
  const parts = [
    c.name_or_role ?? "",
    `${c.approx_age ?? ""} ${c.gender_presentation ?? ""}`.trim(),
    c.hair ? `${c.hair} hair` : "",
    c.face_shape ?? "",
    c.skin_tone ?? "",
    c.eye_features ?? "",
    c.distinctive_features ?? "",
    c.wardrobe ? `wearing ${c.wardrobe}` : "",
    c.accessories ? `with ${c.accessories}` : "",
    c.body_build ?? "",
    c.visual_style ?? "",
  ];
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(", ");
}

export function formatEnvironmentIdentity(
  environmentIdentity: FieldMap | null | undefined,
): string {
  if (!environmentIdentity) return "";
  const e = environmentIdentity;
  const parts = [
    e.architecture ?? "",
    e.materials ?? "",
    e.lighting ?? "",
    e.weather ?? "",
    e.time_of_day ?? "",
    e.color_palette ? `color palette: ${e.color_palette}` : "",
    e.landmarks ?? "",
    e.props ?? "",
    e.camera_language ?? "",
  ];
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(", ");
}

export const ANTI_TEXT_NEGATIVE_PROMPT =
  "text, letters, words, caption, logo, watermark, signage, garbled writing, " +
  "unreadable typography, random symbols";

/** Validate OpenVideoStudio-shaped identity JSON (no LLM). */
export function validateIdentityPayload(data: unknown): {
  character_identity: FieldMap | null;
  environment_identity: FieldMap;
} {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("identities response is not a JSON object");
  const doc = data as Record<string, unknown>;
  const hasCharacter = doc.has_recurring_character;
  if (typeof hasCharacter !== "boolean")
    throw new Error(
      `has_recurring_character must be a JSON boolean, got ${String(hasCharacter)}`,
    );
  let character: FieldMap | null = null;
  if (hasCharacter) {
    const raw = doc.character_identity;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(
        "character_identity must be a populated object with name_or_role when has_recurring_character is true",
      );
    const c = raw as FieldMap;
    if (!(c.name_or_role ?? "").trim())
      throw new Error(
        "character_identity must be a populated object with name_or_role when has_recurring_character is true",
      );
    character = c;
  }
  const envRaw = doc.environment_identity;
  if (!envRaw || typeof envRaw !== "object" || Array.isArray(envRaw))
    throw new Error(
      "environment_identity must be a populated object with at least one concrete field",
    );
  const environment = envRaw as FieldMap;
  if (!Object.values(environment).some((v) => (v ?? "").trim()))
    throw new Error(
      "environment_identity must be a populated object with at least one concrete field",
    );
  return {
    character_identity: character,
    environment_identity: environment,
  };
}
