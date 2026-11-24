// A story's shots as cards (MPR-104): the takes of each, how one was made and what was tried for
// the shot, read from what `yamakan.take.list`, `yamakan.take.record` and `yamakan.shot.history`
// answer. Only a well-formed answer is shown; anything else is "not known".
import type { MessageKey } from "../i18n.ts";

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : null);
const count = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
// The last moment a date can hold.
const moment = (v: unknown) => {
  const ms = count(v);
  return ms !== null && ms <= 8_640_000_000_000_000 ? ms : null;
};

export type CardTake = {
  takeId: string;
  kind: string | null;
  assetId: string | null;
  // Whether the timeline shows it.
  shown: boolean;
  // Null: it has none. Undefined: a service older than the page does not say.
  recordHash: string | null | undefined;
};
export type ShotCard = {
  documentId: string;
  shotId: string;
  name: string;
  durationTicks: number;
  // Why its clips cannot be replaced as they are.
  problem: string | null;
  takes: CardTake[];
};

export function shotCards(takeList: unknown): ShotCard[] | null {
  const list = takeList as { documentId?: unknown; shots?: unknown } | null;
  if (typeof list?.documentId !== "string" || !Array.isArray(list.shots))
    return null;
  const cards: ShotCard[] = [];
  for (const shot of list.shots as Row[]) {
    if (
      typeof shot?.shotId !== "string" ||
      typeof shot.name !== "string" ||
      count(shot.durationTicks) === null ||
      !Array.isArray(shot.takes)
    )
      return null;
    const timeline = shot.timeline as { currentTakeId?: unknown } | null;
    const takes: CardTake[] = [];
    for (const take of shot.takes as Row[]) {
      if (typeof take?.id !== "string") return null;
      takes.push({
        takeId: take.id,
        kind: text(take.kind),
        assetId: text(take.assetId),
        shown: timeline?.currentTakeId === take.id,
        recordHash:
          take.recordHash === null
            ? null
            : (text(take.recordHash) ?? undefined),
      });
    }
    cards.push({
      documentId: list.documentId,
      shotId: shot.shotId,
      name: shot.name,
      durationTicks: shot.durationTicks as number,
      problem: text(shot.problem),
      takes,
    });
  }
  return cards;
}

/**
 * Where an arrow, Home or End takes the focus in a row of so many; null for any other key. Arrows
 * follow the page's direction, and stop at the ends.
 */
export function moveFocus(
  index: number,
  key: string,
  rtl: boolean,
  of: number,
): number | null {
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  const to =
    key === forward
      ? index + 1
      : key === back
        ? index - 1
        : key === "Home"
          ? 0
          : key === "End"
            ? of - 1
            : null;
  return to === null ? null : Math.max(0, Math.min(of - 1, to));
}

export type TakeFacts = {
  // What could be made again from its record, in the plan's words.
  level: "L0" | "L1" | "L3";
  origin: string | null;
  model: string | null;
  seed: number | null;
  width: number | null;
  height: number | null;
  derivedFromTakeId: string | null;
  changedFields: string[];
  revisionNote: string | null;
};
const LEVELS = { generation: "L1", render: "L3" } as const;

/** The answer of `yamakan.take.record`. */
export function takeFacts(value: unknown): TakeFacts | null {
  const record = (value as { record?: unknown } | null)?.record as Row | null;
  const request = record?.request as Row | null | undefined;
  if (!record || typeof record.origin !== "string" || !request) return null;
  const { origin } = record;
  return {
    level: Object.hasOwn(LEVELS, origin)
      ? LEVELS[origin as keyof typeof LEVELS]
      : "L0",
    origin,
    model: text((record.model as Row | null)?.id),
    seed: count(request.seed),
    width: count(request.width),
    height: count(request.height),
    derivedFromTakeId: text(record.derivedFromTakeId),
    changedFields: Array.isArray(record.changedFields)
      ? record.changedFields.filter((f): f is string => typeof f === "string")
      : [],
    revisionNote: text(record.revisionNote),
  };
}

const OUTCOMES = [
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "uncertain",
] as const;
type Outcome = (typeof OUTCOMES)[number];
const GAPS = [
  "untargeted-attempts",
  "unlinked-renders",
  "earlier-replacements",
  "scan-limit",
] as const;
// "other": one this page has no words for, which is still one.
export type Gap = (typeof GAPS)[number] | "other";

export type Attempt = {
  seq: number;
  id: string;
  kind: "generation" | "render";
  outcome: Outcome;
  sent: boolean;
  // Whether something it made came in; null when the service does not say.
  imported: boolean | null;
  startedAt: number | null;
  wallMs: number | null;
  quotaSeconds: number | null;
  takeId: string | null;
  takeInShot: boolean;
  diagnostic: string | null;
};
export type Attempts = {
  attempts: Attempt[];
  // Where the next page begins, or null when this is the last.
  next: number | null;
  totals: {
    attempts: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    running: number;
    uncertain: number;
    wallMs: number;
    wallMsUnknown: number;
    quotaSeconds: number;
    quotaUnknown: number;
  };
  gaps: Gap[];
};

/** The answer of `yamakan.shot.history`, as far as a card shows it. */
export function attemptsPage(value: unknown): Attempts | null {
  const answer = value as Row | null;
  const totals = answer?.totals as Row | null | undefined;
  if (!answer || !totals || !Array.isArray(answer.attempts)) return null;
  // Without these, an incomplete history would look like a whole one.
  const { next, gaps } = answer;
  if (!Array.isArray(gaps) || (next !== null && count(next) === null))
    return null;
  const attempts: Attempt[] = [];
  for (const a of answer.attempts as Row[]) {
    const seq = count(a?.seq);
    if (
      seq === null ||
      typeof a.id !== "string" ||
      (a.kind !== "generation" && a.kind !== "render") ||
      !OUTCOMES.includes(a.outcome as Outcome) ||
      typeof a.sent !== "boolean"
    )
      return null;
    attempts.push({
      seq,
      id: a.id,
      kind: a.kind,
      outcome: a.outcome as Outcome,
      sent: a.sent,
      imported: typeof a.imported === "boolean" ? a.imported : null,
      startedAt: moment(a.startedAt),
      wallMs: count(a.wallMs),
      quotaSeconds: count(a.quotaSeconds),
      takeId: text(a.takeId),
      takeInShot: a.takeInShot === true,
      diagnostic: text(a.diagnostic),
    });
  }
  const known = {} as Attempts["totals"];
  for (const name of [
    "attempts",
    ...OUTCOMES,
    "wallMs",
    "wallMsUnknown",
    "quotaSeconds",
    "quotaUnknown",
  ] as const) {
    const n = count(totals[name]);
    if (n === null) return null;
    known[name] = n;
  }
  return {
    attempts,
    next: count(next),
    totals: known,
    gaps: [
      ...GAPS.filter((g) => gaps.includes(g)),
      ...(gaps.some((g) => !GAPS.includes(g)) ? ["other" as const] : []),
    ],
  };
}

/** One page after another, each attempt once, newest first. */
export const morePages = (held: Attempts, page: Attempts): Attempts => ({
  ...page,
  attempts: [
    ...held.attempts,
    ...page.attempts.filter((a) => !held.attempts.some((h) => h.seq === a.seq)),
  ],
});

/** How an attempt stands, in words: one refused before it was sent is told from one that failed. */
export const attemptKey = (a: Attempt): MessageKey =>
  a.outcome === "failed" && !a.sent
    ? "shot.attempt.refused"
    : `shot.attempt.${a.outcome}`;

/** Which take of a card an attempt made: its number, or in words why there is none to name. */
export function madeTake(
  a: Attempt,
  takes: readonly CardTake[],
): { n: number } | MessageKey {
  if (a.takeId !== null) {
    if (!a.takeInShot) return "shot.take.gone";
    const n = takes.findIndex((x) => x.takeId === a.takeId);
    // The history was read after the card.
    return n < 0 ? "shot.attempt.takeLater" : { n: n + 1 };
  }
  // What came in may have become a take that was taken out again since.
  return a.imported === false ? "shot.attempt.noTake" : "shot.attempt.notKnown";
}

/** What an attempt used, never as nothing when it is not known. */
export const usedKey = (known: number | null): MessageKey =>
  known === null ? "shot.attempt.notKnown" : "shot.attempt.seconds";
