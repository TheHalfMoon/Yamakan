// What a person approves before anything is sent to Kaggle (MPR-204): contacting it and using its
// allowance, for so many runs and so long. The service refuses without it, whatever this shows.
import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import { focusIfLost } from "../story/focus.ts";
import {
  GATE_PROPOSAL,
  approvalLines,
  approvalRequests,
  approvalsInForce,
  contactOpen,
  gateReasons,
  gatesOpen,
  validHours,
  validRuns,
  type GateAnswer,
  type GateKind,
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
  // A run is being followed: only contacting is needed for that.
  following: boolean;
  // Something was sent, or refused: how the approvals stand may have changed.
  asked: number;
}) {
  const { api, t, following } = props;
  const [answer, setAnswer] = useState<GateAnswer | "unknown" | null>(null);
  const [runs, setRuns] = useState<number>(GATE_PROPOSAL.runs);
  const [hours, setHours] = useState<number>(GATE_PROPOSAL.hours);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState<MessageKey | null>(null);
  const [reads, setReads] = useState(0);
  const shown = useRef<HTMLDivElement | null>(null);
  const section = useRef<HTMLElement | null>(null);
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
  // The button that was pressed may be gone: what came of it takes the focus.
  useEffect(() => {
    if (done) focusIfLost(shown.current, section.current);
  }, [done, reads]);
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
  // While a run is followed only contacting is needed: no other run is asked for.
  const kinds: readonly GateKind[] = following
    ? ["egress"]
    : ["egress", "spend"];
  const needed = following ? !contactOpen(route) : !open;
  const valid = validRuns(runs) && validHours(hours);
  const doing = async (what: () => Promise<unknown>, said: MessageKey) => {
    setProblem("");
    setDone(null);
    setWorking(true);
    try {
      await what();
      setDone(said);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("create.startFailed"));
    } finally {
      setWorking(false);
      setReads((n) => n + 1);
    }
  };
  return (
    <section
      ref={section}
      className="create-gates"
      data-testid="create-gates"
      data-open={String(open)}
      data-needed={String(needed)}
      aria-label={t("create.gatesTitle")}
    >
      <h4>{t("create.gatesTitle")}</h4>
      {open && (
        <p className="note" data-testid="create-gates-open">
          {t("create.gatesOpen", {
            runs: Math.min(...route.gates.map((g) => g.runsLeft)),
          })}
        </p>
      )}
      {needed && (
        <>
          {gateReasons(route, kinds).map((key) => (
            <p key={key} data-testid="create-gates-why">
              {t(key)}
            </p>
          ))}
          <ul data-testid="create-gates-what">
            {valid &&
              approvalLines(route, { runs, hours }, kinds).map(
                ({ key, vars }) => <li key={key}>{t(key, vars)}</li>,
              )}
          </ul>
          <div className="create-settings">
            {!following && (
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
            )}
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
                for (const request of approvalRequests(
                  route,
                  { runs, hours },
                  kinds,
                ))
                  await api.approve(request);
              }, "create.gatesGiven")
            }
          >
            {t(following ? "create.gateApproveContact" : "create.gateApprove")}
          </button>
        </>
      )}
      <ul className="create-gates-list" data-testid="create-gates-list">
        {approvalsInForce(answer).map((a) => (
          <li key={a.id} data-kind={a.kind} data-state={a.state}>
            <span id={`create-gate-${a.id}`}>
              {t(
                a.kind === "egress"
                  ? "create.gateGivenContact"
                  : "create.gateGivenUse",
                {
                  host: a.host,
                  account: a.account,
                  runs: a.state === "exhausted" ? 0 : a.runsLeft,
                  until: props.moment(a.expiresAt),
                },
              )}{" "}
              {a.state !== "approved" && t(`create.gateState.${a.state}`)}{" "}
              {a.kind === "egress" &&
                a.state === "exhausted" &&
                t("create.gateFollows")}
            </span>{" "}
            <button
              type="button"
              data-testid="create-gates-revoke"
              aria-describedby={`create-gate-${a.id}`}
              disabled={working}
              onClick={() =>
                void doing(() => api.revoke(a.id), "create.gatesTaken")
              }
            >
              {t("create.gateRevoke")}
            </button>
          </li>
        ))}
      </ul>
      <div ref={shown} tabIndex={-1}>
        {done && (
          <p role="status" data-testid="create-gates-done">
            {t(done)}
          </p>
        )}
      </div>
      {problem && (
        <p role="alert" className="create-problem">
          {problem}
        </p>
      )}
    </section>
  );
}
