// What a person approves before anything is sent to Kaggle (MPR-204): contacting it and using its
// allowance, for so many runs and so long. The service refuses without it, whatever this shows.
import { useEffect, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  GATE_PROPOSAL,
  approvalLines,
  approvalRequests,
  gateReasons,
  gatesOpen,
  validHours,
  validRuns,
  type GateAnswer,
} from "./create-model.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export type GatesApi = {
  list: () => Promise<GateAnswer>;
  approve: (
    request: ReturnType<typeof approvalRequests>[number],
  ) => Promise<unknown>;
  revoke: (approvalId: string) => Promise<unknown>;
};

export function Approvals(props: {
  api: GatesApi;
  t: Translate;
  // A moment in the language's digits.
  moment: (ms: number) => string;
  busy: boolean;
  // Something was sent, or refused: how the approvals stand may have changed.
  asked: number;
}) {
  const { api, t } = props;
  const [answer, setAnswer] = useState<GateAnswer | "unknown" | null>(null);
  const [runs, setRuns] = useState<number>(GATE_PROPOSAL.runs);
  const [hours, setHours] = useState<number>(GATE_PROPOSAL.hours);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let current = true;
    api
      .list()
      .then((found) => {
        if (current) setAnswer(found);
      })
      .catch(() => {
        if (current) setAnswer("unknown");
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.asked, reads]);
  if (answer === null) return null;
  if (answer === "unknown")
    return (
      <p className="note" data-testid="create-gates-unknown">
        {t("create.gatesUnknown")}
      </p>
    );
  const { route } = answer;
  if (!route) return null;
  const open = gatesOpen(route);
  const valid = validRuns(runs) && validHours(hours);
  const doing = async (what: () => Promise<unknown>) => {
    setProblem("");
    setWorking(true);
    try {
      await what();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("create.startFailed"));
    } finally {
      setWorking(false);
      setReads((n) => n + 1);
    }
  };
  // Those that still allow anything, and the newest of each kind that does not.
  const shown = answer.approvals.filter(
    (a) => a.state === "approved" || a.state === "changed",
  );
  return (
    <section
      className="create-gates"
      data-testid="create-gates"
      data-open={String(open)}
      aria-label={t("create.gatesTitle")}
    >
      <h4>{t("create.gatesTitle")}</h4>
      {open ? (
        <p className="note" data-testid="create-gates-open">
          {t("create.gatesOpen", {
            runs: Math.min(...route.gates.map((g) => g.runsLeft)),
          })}
        </p>
      ) : (
        <>
          {gateReasons(route).map((key) => (
            <p key={key} data-testid="create-gates-why">
              {t(key)}
            </p>
          ))}
          <ul data-testid="create-gates-what">
            {valid &&
              approvalLines(route, { runs, hours }).map(({ key, vars }) => (
                <li key={key}>{t(key, vars)}</li>
              ))}
          </ul>
          <div className="create-settings">
            <label>
              {t("create.gateRuns")}
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={Number.isNaN(runs) ? "" : runs}
                data-testid="create-gates-runs"
                onChange={(e) => setRuns(e.target.valueAsNumber)}
              />
            </label>
            <label>
              {t("create.gateHours")}
              <input
                type="number"
                min={1}
                max={366 * 24}
                step={1}
                value={Number.isNaN(hours) ? "" : hours}
                data-testid="create-gates-hours"
                onChange={(e) => setHours(e.target.valueAsNumber)}
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="create-gates-approve"
            disabled={!valid || working || props.busy}
            onClick={() =>
              void doing(async () => {
                for (const request of approvalRequests(route, { runs, hours }))
                  await api.approve(request);
              })
            }
          >
            {t("create.gateApprove")}
          </button>
        </>
      )}
      {shown.length > 0 && (
        <ul className="create-gates-list" data-testid="create-gates-list">
          {shown.map((a) => (
            <li key={a.id} data-kind={a.kind} data-state={a.state}>
              {t(
                a.kind === "egress"
                  ? "create.gateGivenContact"
                  : "create.gateGivenUse",
                {
                  host: a.host,
                  account: a.account,
                  runs: a.runsLeft,
                  until: props.moment(a.expiresAt),
                },
              )}{" "}
              {a.state === "changed" && t("create.gateState.changed")}{" "}
              <button
                type="button"
                data-testid="create-gates-revoke"
                disabled={working}
                onClick={() => void doing(() => api.revoke(a.id))}
              >
                {t("create.gateRevoke")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p role="alert" className="create-problem">
          {problem}
        </p>
      )}
    </section>
  );
}
