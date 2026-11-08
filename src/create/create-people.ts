// People and their likeness consents, as the Create page shows them. Recording or revoking a
// consent is a person's act, at the browser; nothing here grants anything by itself.

export type ListedConsent = {
  id: string;
  characterId: string;
  purpose: string;
  version: string;
  grantedAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  // Granted or revalidated since the last restore.
  current: boolean;
  // For consent to send: the consent to generate it covers.
  coversConsentId: string | null;
};

export type ConsentState = "standing" | "revoked" | "expired" | "revalidate";

export const consentState = (c: ListedConsent, nowMs: number): ConsentState =>
  c.revokedAtMs !== null
    ? "revoked"
    : c.expiresAtMs <= nowMs
      ? "expired"
      : c.current
        ? "standing"
        : "revalidate";

export type Person = {
  characterId: string;
  // Newest first.
  generate: ListedConsent[];
  send: ListedConsent[];
};

// The people this page deals with: those with a consent to make videos or to send them.
export function peopleOf(consents: readonly ListedConsent[]): Person[] {
  const people = new Map<string, Person>();
  for (const c of consents) {
    if (c.purpose !== "likeness-generate" && c.purpose !== "likeness-send")
      continue;
    const person = people.get(c.characterId) ?? {
      characterId: c.characterId,
      generate: [],
      send: [],
    };
    (c.purpose === "likeness-generate" ? person.generate : person.send).push(c);
    people.set(c.characterId, person);
  }
  const newest = (a: ListedConsent, b: ListedConsent) =>
    b.grantedAtMs - a.grantedAtMs || a.id.localeCompare(b.id);
  return [...people.values()]
    .map((p) => ({
      ...p,
      generate: [...p.generate].sort(newest),
      send: [...p.send].sort(newest),
    }))
    .sort((a, b) => a.characterId.localeCompare(b.characterId));
}

// The consent to send that counts for this consent to generate, as the service judges it:
// the newest that names it. Null if none does, or that newest one no longer stands.
export function sendFor(
  person: Person,
  generateId: string,
  nowMs: number,
): ListedConsent | null {
  const newest = person.send.find((s) => s.coversConsentId === generateId);
  return newest && consentState(newest, nowMs) === "standing" ? newest : null;
}

export const CONSENT_DAYS = [30, 90, 365] as const;
export const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;
export const NAME_LIMIT = 80;
export const VERSION_LIMIT = 40;

// Whether a grant can be asked for: the service checks the same, and more.
export const grantable = (r: {
  name: string;
  version: string;
  attested: boolean;
}) =>
  r.attested &&
  r.name.trim().length > 0 &&
  r.name.trim().length <= NAME_LIMIT &&
  r.version.trim().length > 0 &&
  r.version.trim().length <= VERSION_LIMIT;

// A pack of one still, linked to a person and the consent it rests on.
export function personPack(
  characterId: string,
  still: { id: string; hash: string },
  consentId: string,
  newId: () => string,
) {
  return {
    format: "yamakan.reference-pack" as const,
    formatVersion: 1 as const,
    name: characterId,
    entries: [
      {
        id: newId(),
        role: "character" as const,
        label: characterId,
        assetId: still.id,
        assetHash: still.hash,
        characterId,
        consentId,
      },
    ],
  };
}

// Which stills a pack links to which consent. Anything else in it is left out.
export function characterLinks(
  content: unknown,
): { consentId: string; assetId: string }[] {
  const entries = (content as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((e) =>
    e?.role === "character" &&
    typeof e.consentId === "string" &&
    typeof e.assetId === "string"
      ? [{ consentId: e.consentId, assetId: e.assetId }]
      : [],
  );
}

export const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
