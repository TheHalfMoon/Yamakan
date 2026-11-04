import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  proposalIsCurrent,
  shortHash,
  takeRows,
  ticksToSeconds,
  type TakeProposal,
  type TakeRow,
} from "./take-review.ts";

type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};
type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

type Notice =
  | { kind: "stale" }
  | { kind: "applied"; revision: number }
  | { kind: "refused"; message: string };

const media = (t: Translate, side: TakeProposal["mappings"][number]["from"]) =>
  side.title !== null
    ? t("take.titleCard", { title: side.title })
    : t("take.media", {
        hash: shortHash(side.assetHash),
        seconds: ticksToSeconds(side.sourceStartTicks),
      });

/**
 * Reviews one take replacement. The proposal comes from
 * `yamakan.take.proposeReplace` and is sent to `yamakan.take.apply` unchanged,
 * where the commit recomputes and compares it. It lives only in this panel and
 * is dropped when the project moves on, so a stale review needs a fresh one.
 * Viewing or applying grants nothing and is not a Director approval.
 */
export function TakeReview({
  projectId,
  revision,
  client,
  t,
  unsaved,
  onApplied,
}: {
  projectId: string;
  revision: number | null;
  client: Client;
  t: Translate;
  // Applying replaces what the editor holds, so unsaved edits come first.
  unsaved: boolean;
  onApplied: (project: unknown) => void;
}) {
  const [rows, setRows] = useState<TakeRow[] | "unknown" | null>(null);
  const [proposal, setProposal] = useState<TakeProposal | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reads, setReads] = useState(0);
  const caller = useRef(client);
  caller.current = client;
  // A proposal answer for an earlier request or revision is dropped.
  const request = useRef(0);

  useEffect(() => {
    let current = true;
    (async () => {
      const refs = (await caller.current.call("yamakan.document.list", {
        projectId,
      })) as { id?: unknown; kind?: unknown }[];
      const stories = (Array.isArray(refs) ? refs : []).filter(
        (r): r is { id: string; kind: string } =>
          typeof r?.id === "string" && r.kind === "story",
      );
      const lists = await Promise.all(
        stories.map((r) =>
          caller.current.call("yamakan.take.list", {
            projectId,
            documentId: r.id,
          }),
        ),
      );
      const parsed = lists.map(takeRows);
      return parsed.every((r) => r !== null)
        ? (parsed as TakeRow[][]).flat()
        : "unknown";
    })()
      .then((next) => {
        if (current) setRows(next);
      })
      .catch(() => {
        if (current) setRows("unknown");
      });
    return () => {
      current = false;
    };
  }, [projectId, revision, reads]);

  // The project moved on: what was reviewed no longer describes it.
  useEffect(() => {
    request.current++;
    setProposal((held) => {
      if (held && !proposalIsCurrent(held, projectId, revision)) {
        setNotice({ kind: "stale" });
        return null;
      }
      return held;
    });
  }, [projectId, revision]);

  const review = async (row: TakeRow) => {
    const ticket = ++request.current;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProposal(null);
    try {
      const made = (await client.call("yamakan.take.proposeReplace", {
        projectId,
        documentId: row.documentId,
        shotId: row.shotId,
        takeId: row.takeId,
      })) as TakeProposal;
      if (ticket === request.current) setProposal(made);
    } catch (e) {
      if (ticket === request.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    const sent = proposal;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProposal(null);
    try {
      const project = (await client.call("yamakan.take.apply", {
        projectId,
        expectedRevision: sent.revision,
        proposal: sent,
      })) as { revision: number };
      setNotice({ kind: "applied", revision: project.revision });
      onApplied(project);
    } catch (e) {
      setNotice({
        kind: "refused",
        message: e instanceof Error ? e.message : String(e),
      });
      setReads((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) return null;
  const mapping = proposal?.mappings[0];
  return (
    <section data-testid="take-review" aria-label={t("take.title")}>
      <h3>{t("take.title")}</h3>
      {rows === "unknown" ? (
        <p>{t("take.unknown")}</p>
      ) : rows.length ? (
        <ul>
          {rows.map((row) => (
            <li
              key={`${row.documentId}:${row.shotId}:${row.takeId}`}
              data-shot={row.shotId}
              data-take={row.takeId}
              data-current={String(row.current)}
            >
              {t("take.row", {
                shot: row.shotName,
                hash: shortHash(row.assetHash),
              })}{" "}
              {row.current ? (
                <span>{t("take.current")}</span>
              ) : row.problem ? (
                <span>{row.problem}</span>
              ) : !row.assembled ? (
                <span>{t("take.notAssembled")}</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="take-review-open"
                  onClick={() => void review(row)}
                >
                  {t("take.review")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("take.none")}</p>
      )}
      {proposal && mapping ? (
        <div data-testid="take-proposal" data-revision={proposal.revision}>
          <dl>
            <dt>{t("take.clip")}</dt>
            <dd dir="ltr" data-testid="take-proposal-clip">
              {mapping.clipId}
            </dd>
            <dt>{t("take.timing")}</dt>
            <dd>
              {t("take.span", {
                start: ticksToSeconds(mapping.startTicks),
                duration: ticksToSeconds(mapping.durationTicks),
              })}
            </dd>
            <dt>{t("take.from")}</dt>
            <dd data-testid="take-proposal-from">{media(t, mapping.from)}</dd>
            <dt>{t("take.to")}</dt>
            <dd data-testid="take-proposal-to">{media(t, mapping.to)}</dd>
            <dt>{t("take.revision")}</dt>
            <dd>{proposal.revision}</dd>
            <dt>{t("take.hash")}</dt>
            <dd dir="ltr" data-testid="take-proposal-hash">
              {proposal.proposalHash}
            </dd>
          </dl>
          {unsaved ? (
            <p data-testid="take-save-first">{t("take.saveFirst")}</p>
          ) : null}
          <button
            type="button"
            disabled={busy || unsaved}
            data-testid="take-proposal-apply"
            onClick={() => void apply()}
          >
            {t("take.apply")}
          </button>{" "}
          <button
            type="button"
            disabled={busy}
            data-testid="take-proposal-dismiss"
            onClick={() => setProposal(null)}
          >
            {t("take.dismiss")}
          </button>
        </div>
      ) : null}
      {notice?.kind === "stale" ? (
        <p role="status" data-testid="take-notice-stale">
          {t("take.stale")}
        </p>
      ) : null}
      {notice?.kind === "applied" ? (
        <p role="status" data-testid="take-notice-applied">
          {t("take.applied", { revision: notice.revision })}
        </p>
      ) : null}
      {notice?.kind === "refused" ? (
        <p role="alert" data-testid="take-notice-refused">
          {t("take.refused", { message: notice.message })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" data-testid="take-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
