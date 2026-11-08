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

// The newest consents to send naming this consent to generate, whatever their state: more
// than one only on an exact tie of the time they were granted.
export function newestSends(person: Person, generateId: string) {
  const naming = person.send.filter((s) => s.coversConsentId === generateId);
  const at = naming[0]?.grantedAtMs;
  return naming.filter((s) => s.grantedAtMs === at);
}

// The consent to send that counts for this consent to generate, as the service judges it:
// the newest that names it, and on a tie every one of them must stand. Null otherwise.
export function sendFor(
  person: Person,
  generateId: string,
  nowMs: number,
): ListedConsent | null {
  const newest = newestSends(person, generateId);
  return newest.length > 0 &&
    newest.every((s) => consentState(s, nowMs) === "standing")
    ? newest[0]
    : null;
}

// The service takes no consent shorter than a minute.
export const SHORTEST_MS = 60_000;

// How long consent to send may last, from now: no longer than the consent to make videos it
// covers, while that stands. One that has expired still says who a linked still shows, and
// sending that still needs it covered, so then it is the time chosen.
export function sendTtl(
  covered: ListedConsent,
  chosenMs: number,
  nowMs: number,
): number | null {
  const ttl =
    consentState(covered, nowMs) === "expired"
      ? chosenMs
      : Math.min(chosenMs, covered.expiresAtMs - nowMs);
  return ttl >= SHORTEST_MS ? ttl : null;
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

export type PersonPack = ReturnType<typeof personPack>;

// The packs this page keeps for one person: every entry a still of them. Others are left be.
export function asPersonPack(content: unknown): PersonPack | null {
  const pack = content as Partial<PersonPack> | null;
  if (pack?.format !== "yamakan.reference-pack" || !Array.isArray(pack.entries))
    return null;
  const [first] = pack.entries;
  return first &&
    pack.entries.every(
      (e) => e?.role === "character" && e.characterId === first.characterId,
    )
    ? (pack as PersonPack)
    : null;
}

export const PACK_ENTRY_LIMIT = 64;

// A person's pack with one more still linked: one pack per person, so linking does not use up
// the project's documents. The same still on the same consent is already there.
export function withLink(
  pack: PersonPack,
  still: { id: string; hash: string },
  consentId: string,
  newId: () => string,
): PersonPack | "already" | "full" {
  if (
    pack.entries.some(
      (e) => e.assetId === still.id && e.consentId === consentId,
    )
  )
    return "already";
  if (pack.entries.length >= PACK_ENTRY_LIMIT) return "full";
  const characterId = pack.entries[0].characterId;
  return {
    ...pack,
    entries: [
      ...pack.entries,
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
