// The shots of a project's stories as cards (MPR-104): each with its takes as one row that the
// keyboard walks, how a take was made, and what was tried for the shot. It reads, and changes
// nothing: a take is placed through the one take review.
import { memo, useEffect, useId, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import { shortHash } from "../director/take-review.ts";
import { focusIfLost } from "./focus.ts";
import {
  attemptKey,
  attemptsPage,
  morePages,
  moveFocus,
  shotCards,
  takeFacts,
  usedKey,
  type Attempts,
  type ShotCard,
  type TakeFacts,
} from "./shot-cards.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
export type ShotCardsHost = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
  t: Translate;
  // The language its words are in: a card is drawn again when it is another.
  lang: string;
  // In the language's digits.
  seconds: (value: number) => string;
  number: (value: number) => string;
  moment: (ms: number) => string;
  assetName: (assetId: string | null) => string | null;
  onReview: (at: { documentId: string; shotId: string }) => void;
};

const FLICKS_PER_SECOND = 705_600_000;
const PAGE = 20;

export function ShotCards({
  projectId,
  revision,
  host,
}: {
  projectId: string;
  revision: number;
  host: ShotCardsHost;
}) {
  const { t } = host;
  const [stories, setStories] = useState<ShotCard[][] | "unknown" | null>(null);
  const held = useRef(host);
  held.current = host;

  // Once for each story at each revision, whatever the number of cards.
  useEffect(() => {
    let current = true;
    (async () => {
      const { call } = held.current;
      const refs = await call("yamakan.document.list", { projectId });
      if (!Array.isArray(refs)) return "unknown" as const;
      const lists = await Promise.all(
        (refs as { id?: unknown; kind?: unknown }[])
          .filter((r) => typeof r?.id === "string" && r.kind === "story")
          .map((r) =>
            call("yamakan.take.list", { projectId, documentId: r.id }),
          ),
      );
      const cards = lists.map(shotCards);
      return cards.every((c) => c !== null)
        ? (cards as ShotCard[][])
        : ("unknown" as const);
    })()
      .then((next) => {
        if (current) setStories(next);
      })
      .catch(() => {
        if (current) setStories("unknown");
      });
    return () => {
      current = false;
    };
  }, [projectId, revision]);

  if (stories === null) return null;
  return (
    <section
      className="shot-cards"
      data-testid="shot-cards"
      aria-label={t("shot.card.title")}
    >
      <h3>{t("shot.card.title")}</h3>
      {stories === "unknown" ? (
        <p role="status">{t("shot.card.unknown")}</p>
      ) : stories.every((cards) => !cards.length) ? (
        <p>{t("shot.card.none")}</p>
      ) : (
        stories.map((cards, n) =>
          cards.length ? (
            <div
              key={cards[0]!.documentId}
              role="group"
              aria-label={t("shot.card.story", { n: host.number(n + 1) })}
            >
              {stories.length > 1 ? (
                <h4>{t("shot.card.story", { n: host.number(n + 1) })}</h4>
              ) : null}
              <ul className="shot-card-list">
                {cards.map((card) => (
                  <Card
                    key={card.shotId}
                    projectId={projectId}
                    revision={revision}
                    card={card}
                    host={held}
                    t={t}
                    lang={host.lang}
                  />
                ))}
              </ul>
            </div>
          ) : null,
        )
      )}
    </section>
  );
}

// Redrawn only when its own shot changes, so a long story stays quick.
const Card = memo(
  function Card({
    projectId,
    revision,
    card,
    host,
    t,
  }: {
    projectId: string;
    revision: number;
    card: ShotCard;
    host: { current: ShotCardsHost };
    t: Translate;
    lang: string;
  }) {
    const { seconds } = host.current;
    const headingId = useId();
    return (
      <li
        className="shot-card"
        data-testid="shot-card"
        data-shot={card.shotId}
        aria-labelledby={headingId}
      >
        <h5 id={headingId} data-testid="shot-card-name">
          <bdi>{card.name}</bdi>
        </h5>
        <p data-testid="shot-card-duration">
          {t("shot.card.duration", {
            seconds: seconds(card.durationTicks / FLICKS_PER_SECOND),
          })}
        </p>
        {card.problem ? (
          <p className="note" data-testid="shot-card-problem" dir="auto">
            {card.problem}
          </p>
        ) : null}
        <TakeStack
          projectId={projectId}
          revision={revision}
          card={card}
          host={host}
          t={t}
          labelledBy={headingId}
        />
        <div className="shot-card-actions">
          <button
            type="button"
            data-testid="shot-review"
            onClick={() =>
              host.current.onReview({
                documentId: card.documentId,
                shotId: card.shotId,
              })
            }
          >
            {t("shot.card.review")}
          </button>
        </div>
        <ShotAttempts
          projectId={projectId}
          revision={revision}
          card={card}
          host={host}
          t={t}
        />
      </li>
    );
  },
  (a, b) =>
    a.projectId === b.projectId &&
    a.revision === b.revision &&
    a.card === b.card &&
    a.lang === b.lang,
);

function TakeStack({
  projectId,
  revision,
  card,
  host,
  t,
  labelledBy,
}: {
  projectId: string;
  revision: number;
  card: ShotCard;
  host: { current: ShotCardsHost };
  t: Translate;
  labelledBy: string;
}) {
  const [at, setAt] = useState(0);
  const [opened, setOpened] = useState<string | null>(null);
  const [facts, setFacts] = useState<TakeFacts | "none" | "unknown" | null>(
    null,
  );
  const options = useRef<(HTMLLIElement | null)[]>([]);
  const index = Math.min(at, Math.max(0, card.takes.length - 1));
  const take = card.takes.find((x) => x.takeId === opened) ?? null;
  const { number } = host.current;

  // One record, and only of the take that was opened.
  useEffect(() => {
    if (!take) return;
    if (take.recordHash === null) {
      setFacts("none");
      return;
    }
    let current = true;
    setFacts(null);
    host.current
      .call("yamakan.take.record", {
        projectId,
        documentId: card.documentId,
        shotId: card.shotId,
        takeId: take.takeId,
      })
      .then((answer) => {
        if (current) setFacts(takeFacts(answer) ?? "unknown");
      })
      .catch(() => {
        if (current) setFacts("unknown");
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, revision, opened, take?.recordHash]);

  if (!card.takes.length)
    return <p data-testid="shot-no-takes">{t("shot.take.none")}</p>;
  const nameOf = (takeId: string) => {
    const n = card.takes.findIndex((x) => x.takeId === takeId);
    return n < 0
      ? t("shot.take.gone")
      : t("shot.take.name", { n: number(n + 1) });
  };
  return (
    <div
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !opened) return;
        e.preventDefault();
        const n = card.takes.findIndex((x) => x.takeId === opened);
        setOpened(null);
        options.current[n]?.focus();
      }}
    >
      <ul
        role="listbox"
        aria-orientation="horizontal"
        aria-labelledby={labelledBy}
        className="shot-take-stack"
        data-testid="shot-take-stack"
      >
        {card.takes.map((x, n) => (
          <li
            key={x.takeId}
            ref={(el) => {
              options.current[n] = el;
            }}
            role="option"
            tabIndex={n === index ? 0 : -1}
            aria-selected={n === index}
            aria-current={x.shown ? "true" : undefined}
            aria-expanded={opened === x.takeId}
            className="shot-take"
            data-testid="shot-take"
            data-take={x.takeId}
            onFocus={() => setAt(n)}
            onClick={(e) => {
              e.currentTarget.focus();
              setOpened(opened === x.takeId ? null : x.takeId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpened(opened === x.takeId ? null : x.takeId);
                return;
              }
              const to = moveFocus(
                n,
                e.key,
                getComputedStyle(e.currentTarget).direction === "rtl",
                card.takes.length,
              );
              if (to === null) return;
              e.preventDefault();
              setAt(to);
              options.current[to]?.focus();
            }}
          >
            {t("shot.take.name", { n: number(n + 1) })}{" "}
            <bdi>{host.current.assetName(x.assetId) ?? t("take.unnamed")}</bdi>{" "}
            {x.shown ? <span>{t("take.current")}</span> : null}
          </li>
        ))}
      </ul>
      {take ? (
        <div
          role="status"
          className="shot-take-facts"
          data-testid="shot-take-facts"
          data-take={take.takeId}
        >
          <p>{t("shot.take.facts", { take: nameOf(take.takeId) })}</p>
          {facts === null ? null : facts === "none" ? (
            <>
              <p>{t("shot.take.noRecord")}</p>
              <p data-testid="shot-take-level">{t("shot.take.level.L0")}</p>
            </>
          ) : facts === "unknown" ? (
            <p>{t("shot.take.unknown")}</p>
          ) : (
            <>
              <p data-testid="shot-take-level">
                {t(`shot.take.level.${facts.level}`)}
              </p>
              <dl>
                <dt>{t("shot.take.origin")}</dt>
                <dd>
                  {facts.origin === "generation" ||
                  facts.origin === "render" ||
                  facts.origin === "declared"
                    ? t(`shot.take.origin.${facts.origin}`)
                    : t("shot.attempt.notKnown")}
                </dd>
                <dt>{t("shot.take.model")}</dt>
                <dd>
                  {facts.model === null ? (
                    t("shot.attempt.notKnown")
                  ) : (
                    <bdi dir="ltr">{facts.model}</bdi>
                  )}
                </dd>
                <dt>{t("shot.take.seed")}</dt>
                <dd>
                  {facts.seed === null ? (
                    t("shot.attempt.notKnown")
                  ) : (
                    <bdi dir="ltr">{facts.seed}</bdi>
                  )}
                </dd>
                <dt>{t("shot.take.size")}</dt>
                <dd>
                  {facts.width === null || facts.height === null ? (
                    t("shot.attempt.notKnown")
                  ) : (
                    <bdi dir="ltr">
                      {facts.width}×{facts.height}
                    </bdi>
                  )}
                </dd>
                {facts.derivedFromTakeId !== null ? (
                  <>
                    <dt>{t("shot.take.derivedFrom")}</dt>
                    <dd data-testid="shot-take-derived">
                      {nameOf(facts.derivedFromTakeId)}
                    </dd>
                    <dt>{t("shot.take.changed")}</dt>
                    <dd data-testid="shot-take-changed">
                      {facts.changedFields.length ? (
                        <bdi dir="ltr">{facts.changedFields.join(", ")}</bdi>
                      ) : (
                        t("shot.take.unchanged")
                      )}
                    </dd>
                  </>
                ) : null}
                {facts.revisionNote !== null ? (
                  <>
                    <dt>{t("shot.take.note")}</dt>
                    <dd dir="auto">{facts.revisionNote}</dd>
                  </>
                ) : null}
                <dt>{t("shot.take.record")}</dt>
                <dd>
                  <bdi dir="ltr">{shortHash(take.recordHash)}</bdi>
                </dd>
              </dl>
            </>
          )}
          <p className="note">
            {t("shot.take.count", { n: number(card.takes.length) })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ShotAttempts({
  projectId,
  revision,
  card,
  host,
  t,
}: {
  projectId: string;
  revision: number;
  card: ShotCard;
  host: { current: ShotCardsHost };
  t: Translate;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Attempts | "unknown" | null>(null);
  const [more, setMore] = useState(false);
  const region = useRef<HTMLDivElement | null>(null);
  const status = useRef<HTMLParagraphElement | null>(null);
  // An answer for another time is dropped.
  const ticket = useRef(0);
  const { seconds, number, moment } = host.current;

  const ask = async (before: number | null) => {
    const mine = ++ticket.current;
    let answer: Attempts | null;
    try {
      answer = attemptsPage(
        await host.current.call("yamakan.shot.history", {
          projectId,
          documentId: card.documentId,
          shotId: card.shotId,
          limit: PAGE,
          ...(before === null ? {} : { before }),
        }),
      );
    } catch {
      answer = null;
    }
    if (mine !== ticket.current) return;
    setMore(false);
    setPage((held) =>
      answer === null
        ? "unknown"
        : before !== null && held !== null && held !== "unknown"
          ? morePages(held, answer)
          : answer,
    );
    if (before !== null) focusIfLost(status.current, region.current);
  };
  // Read when it is opened, and again as the project moves on.
  useEffect(() => {
    if (!open) {
      ticket.current++;
      setPage(null);
      return;
    }
    void ask(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, revision]);

  const used = (value: number | null, unit: "ms" | "s") =>
    t(usedKey(value), {
      seconds: seconds((value ?? 0) / (unit === "ms" ? 1000 : 1)),
    });
  return (
    <div ref={region}>
      <button
        type="button"
        data-testid="shot-attempts-open"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t(open ? "shot.attempt.hide" : "shot.attempt.show")}
      </button>
      {open && page !== null ? (
        <div data-testid="shot-attempts" className="shot-attempts">
          {page === "unknown" ? (
            <p role="status">{t("shot.attempt.unread")}</p>
          ) : (
            <>
              <p
                role="status"
                ref={status}
                tabIndex={-1}
                data-testid="shot-attempts-totals"
              >
                {t("shot.attempt.totals", {
                  shown: number(page.attempts.length),
                  all: number(page.totals.attempts),
                  made: number(page.totals.succeeded),
                  failed: number(page.totals.failed),
                  stopped: number(page.totals.cancelled),
                  running: number(page.totals.running),
                  uncertain: number(page.totals.uncertain),
                })}{" "}
                {t("shot.attempt.time", {
                  seconds: seconds(page.totals.wallMs / 1000),
                  unknown: number(page.totals.wallMsUnknown),
                })}{" "}
                {page.totals.attempts > 0 &&
                page.totals.quotaUnknown === page.totals.attempts
                  ? t("shot.attempt.useUnknown")
                  : t("shot.attempt.use", {
                      seconds: seconds(page.totals.quotaSeconds),
                      unknown: number(page.totals.quotaUnknown),
                    })}
              </p>
              <ol>
                {page.attempts.map((a) => (
                  <li
                    key={a.seq}
                    data-testid="shot-attempt"
                    data-outcome={a.outcome}
                    data-sent={String(a.sent)}
                  >
                    <span>{t(`shot.attempt.kind.${a.kind}`)}</span>
                    {": "}
                    <strong>{t(attemptKey(a))}</strong>
                    <dl>
                      <dt>{t("shot.attempt.started")}</dt>
                      <dd>
                        {a.startedAt === null
                          ? t("shot.attempt.notKnown")
                          : moment(a.startedAt)}
                      </dd>
                      <dt>{t("shot.attempt.took")}</dt>
                      <dd>{used(a.wallMs, "ms")}</dd>
                      <dt>{t("shot.attempt.used")}</dt>
                      <dd data-testid="shot-attempt-used">
                        {used(a.quotaSeconds, "s")}
                      </dd>
                      <dt>{t("shot.attempt.take")}</dt>
                      <dd>
                        {a.takeId === null
                          ? t("shot.attempt.noTake")
                          : a.takeInShot
                            ? t("shot.take.name", {
                                n: number(
                                  card.takes.findIndex(
                                    (x) => x.takeId === a.takeId,
                                  ) + 1,
                                ),
                              })
                            : t("shot.take.gone")}
                      </dd>
                    </dl>
                    {a.diagnostic ? (
                      <p dir="auto" className="note">
                        {a.diagnostic}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
              {page.gaps.length ? (
                <ul data-testid="shot-attempts-gaps">
                  {page.gaps.map((gap) => (
                    <li key={gap} data-gap={gap}>
                      {t(`shot.attempt.gap.${gap}`)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {page.next !== null ? (
                <button
                  type="button"
                  data-testid="shot-attempts-more"
                  disabled={more}
                  onClick={() => {
                    setMore(true);
                    void ask(page.next);
                  }}
                >
                  {t("shot.attempt.more")}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
