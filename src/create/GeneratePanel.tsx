// Starting a model on the person's own Kaggle GPU, and following it. Nothing runs
// until they tick that their prompt may leave this machine and press the button, each
// time. There is no percentage because Kaggle gives none: only a state and the time.
import React, { useEffect, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import type { RunReceipt } from "./create-model.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export type GenerateModel = {
  recipeId: string;
  name: string;
  model: string;
  revision: string;
  licence: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  steps: number;
  expectedSeconds: number;
  timeoutSeconds: number;
  notebook: string;
};

export type MadeAsset = {
  id: string;
  kind: string;
  name: string;
  hash: string;
  bytes: number;
};

export type RunRecord = {
  generationId: string;
  recipeId: string;
  prompt: string | null;
  seed: number | null;
  startedAt: number;
  state: string;
  uncertain: boolean;
  stopped: boolean;
  held: boolean;
  diagnostic: string | null;
  imported: { assetId: string } | null;
};

export type GenerationApi = {
  start: (request: {
    recipeId: string;
    prompt: string;
    seed: number;
    width: number;
    height: number;
    durationFrames: number;
  }) => Promise<{ generationId: string; uncertain?: string }>;
  status: (generationId: string) => Promise<{
    state: string;
    diagnostic?: string;
    imported: unknown;
  }>;
  stop: (generationId: string) => Promise<unknown>;
  // Under the editor's busy state. The new asset, or null if it did not come in.
  bringIn: (generationId: string) => Promise<MadeAsset | null>;
  // What this project has under way, newest first, whatever has restarted since.
  list: () => Promise<readonly RunRecord[]>;
  dismiss: (generationId: string) => Promise<unknown>;
};

type Run = {
  generationId: string;
  recipeId: string;
  prompt: string;
  seed: number;
  startedAt: number;
  // Stopped following: Kaggle's public interface cannot stop the run itself.
  stopped?: boolean;
  // Not known to have reached Kaggle, and never sent again.
  uncertain?: boolean;
  // A restored copy of a workspace: the run belongs to the original.
  held?: boolean;
};

const asRun = (r: RunRecord): Run => ({
  generationId: r.generationId,
  recipeId: r.recipeId,
  prompt: r.prompt ?? "",
  seed: r.seed ?? 0,
  startedAt: r.startedAt,
  stopped: r.stopped,
  uncertain: r.uncertain,
  held: r.held,
});

const POLL_MS = 20_000;
const FINISHED = new Set(["succeeded", "failed", "cancelled"]);

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function GeneratePanel(props: {
  model: GenerateModel;
  // Whether the model chosen on the page is one that can start from here.
  offered: boolean;
  models: readonly GenerateModel[];
  prompt: string;
  seed: number;
  seedValid: boolean;
  projectFps: number;
  busy: boolean;
  t: Translate;
  api: GenerationApi;
  // Whether its record was saved. Bringing it in again is safe, and tries again.
  onMade: (receipt: RunReceipt, asset: MadeAsset) => Promise<boolean>;
  findAsset: (id: string) => MadeAsset | undefined;
}) {
  const { model, prompt, seed, seedValid, t, api } = props;
  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState("queued");
  const [note, setNote] = useState("");
  const [lost, setLost] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [problem, setProblem] = useState("");
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const finished = FINISHED.has(state);
  const receiptOf = (
    r: { recipeId: string; prompt: string | null; seed: number | null },
    sha256: string,
  ): RunReceipt => {
    const m = props.models.find((x) => x.recipeId === r.recipeId) ?? model;
    return {
      model: m.model,
      revision: m.revision,
      prompt: r.prompt ?? "",
      seed: r.seed ?? 0,
      steps: m.steps,
      sha256,
      licence: m.licence,
    };
  };
  const following =
    Boolean(run) && !run?.stopped && !run?.held && !finished && !lost;
  const runModel =
    (run && props.models.find((m) => m.recipeId === run.recipeId)) ?? model;

  // What this project has under way lives in the project: a run started before a
  // restart comes back here, and one that came in unrecorded gets its record.
  useEffect(() => {
    let current = true;
    api
      .list()
      .then(async (records) => {
        if (!current) return;
        const [latest] = records;
        if (!latest) return;
        const asset = latest.imported
          ? props.findAsset(latest.imported.assetId)
          : undefined;
        if (asset && latest.prompt !== null && latest.seed !== null) {
          const saved = await props.onMade(
            receiptOf(latest, asset.hash),
            asset,
          );
          if (saved) await api.dismiss(latest.generationId);
          else if (current) setRun(asRun(latest));
          return;
        }
        if (current) {
          setRun(asRun(latest));
          setState(latest.state);
          setNote(latest.diagnostic ?? "");
        }
      })
      .catch(() => {
        // Nothing can be started here either, then: the page says so elsewhere.
      });
    return () => {
      current = false;
    };
    // Once for this project: the panel is keyed by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!run || run.stopped || run.held || lost) return;
    let current = true;
    const ask = async () => {
      try {
        const answer = await api.status(run.generationId);
        if (!current) return;
        setState(answer.state);
        setNote(answer.diagnostic ?? "");
        // Its own result proves it arrived; a notebook's state does not.
        if (answer.state === "succeeded" || answer.state === "failed")
          setRun((r) => (r?.uncertain ? { ...r, uncertain: false } : r));
      } catch (e) {
        if (!current) return;
        if ((e as { code?: string }).code === "NOT_FOUND") setLost(true);
        else setNote(e instanceof Error ? e.message : "");
      }
    };
    void ask();
    const timer = setInterval(() => void ask(), POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.generationId, run?.stopped, lost]);

  useEffect(() => {
    if (!following) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [following]);

  useEffect(() => {
    if (finished) setNow(Date.now());
  }, [finished]);

  const start = async () => {
    setProblem("");
    setWorking(true);
    try {
      const { generationId, uncertain } = await api.start({
        recipeId: model.recipeId,
        prompt,
        seed,
        width: model.width,
        height: model.height,
        durationFrames: Math.max(
          1,
          Math.floor((model.frames / model.fps) * props.projectFps),
        ),
      });
      setState("queued");
      setNote("");
      setLost(false);
      setAgreed(false);
      setRun({
        generationId,
        recipeId: model.recipeId,
        prompt,
        seed,
        startedAt: Date.now(),
        uncertain: Boolean(uncertain),
      });
    } catch (e) {
      setAgreed(false);
      // The answer can be lost with the run on its way. A refused one is not listed.
      const [latest] = await api.list().catch(() => [] as RunRecord[]);
      if (
        latest &&
        !latest.stopped &&
        !["succeeded", "failed", "cancelled"].includes(latest.state)
      ) {
        setRun(asRun(latest));
        setState(latest.state);
        setNote(latest.diagnostic ?? "");
        return;
      }
      setProblem(e instanceof Error ? e.message : t("create.startFailed"));
    } finally {
      setWorking(false);
    }
  };

  const finishedWith = () => {
    if (run) void api.dismiss(run.generationId).catch(() => {});
    setRun(null);
    setState("queued");
    setNote("");
    setLost(false);
  };

  const bringIn = async () => {
    if (!run) return;
    setProblem("");
    setWorking(true);
    const asset = await api.bringIn(run.generationId).catch(() => null);
    if (!asset) {
      setWorking(false);
      setProblem(t("create.bringInFailed"));
      return;
    }
    const saved = await props.onMade(receiptOf(run, asset.hash), asset);
    setWorking(false);
    if (saved) finishedWith();
  };

  const blocked = !prompt
    ? t("create.needPrompt")
    : !seedValid
      ? t("create.seedInvalid")
      : null;
  const notebookLink = (
    <a href={runModel.notebook} target="_blank" rel="noreferrer noopener">
      {t("create.openNotebook")}
    </a>
  );

  if (!run && !props.offered)
    return (
      <div className="create-generate" data-testid="create-generate">
        <h3>{t("create.engineTitle")}</h3>
        <p className="note" data-testid="create-not-from-here">
          {t("create.notFromHere")}
        </p>
      </div>
    );

  if (!run)
    return (
      <div className="create-generate" data-testid="create-generate">
        <h3>{t("create.engineTitle")}</h3>
        <label className="create-agree">
          <input
            type="checkbox"
            checked={agreed}
            data-testid="create-agree"
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            {t("create.agree", {
              minutes: Math.ceil(model.expectedSeconds / 60),
            })}
          </span>
        </label>
        {blocked && <p className="note">{blocked}</p>}
        <button
          type="button"
          className="create-primary"
          disabled={!agreed || Boolean(blocked) || working || props.busy}
          data-testid="create-generate-start"
          onClick={() => void start()}
        >
          {working ? t("create.starting") : t("create.generate")}
        </button>
        {problem && (
          <p role="alert" className="create-problem">
            {problem}
          </p>
        )}
      </div>
    );

  const line: MessageKey = lost
    ? "create.runLost"
    : run.held
      ? "create.runHeld"
      : run.stopped
        ? "create.runStopped"
        : run.uncertain
          ? "create.runUncertain"
          : state === "running"
            ? "create.runRunning"
            : state === "succeeded"
              ? "create.runDone"
              : state === "failed"
                ? "create.runFailed"
                : state === "cancelled"
                  ? "create.runCancelled"
                  : state === "unknown"
                    ? "create.runUnknown"
                    : "create.runQueued";
  return (
    <div className="create-generate" data-testid="create-generate">
      <h3>{t("create.engineTitle")}</h3>
      <p role="status" data-testid="create-run-state" data-state={state}>
        {t(line, { name: runModel.name })}
      </p>
      {following && (
        <>
          <progress aria-label={t(line, { name: runModel.name })} />
          <p className="note" aria-hidden="true" data-testid="create-run-clock">
            {t("create.runClock", {
              elapsed: clock(now - run.startedAt),
              minutes: Math.ceil(runModel.expectedSeconds / 60),
            })}
          </p>
        </>
      )}
      {note && (
        <p
          role="status"
          className="note"
          dir="auto"
          data-testid="create-run-note"
        >
          {note}
        </p>
      )}
      {problem && (
        <p role="alert" className="create-problem">
          {problem}
        </p>
      )}
      <div className="create-video-actions">
        {state === "succeeded" && !run.stopped && !run.held && !lost && (
          <button
            type="button"
            className="create-primary"
            disabled={working || props.busy}
            data-testid="create-run-bring-in"
            onClick={() => void bringIn()}
          >
            {t("create.runBringIn")}
          </button>
        )}
        {following && (
          <button
            type="button"
            data-testid="create-run-stop"
            onClick={() => {
              void api.stop(run.generationId).catch(() => {});
              setRun({ ...run, stopped: true });
            }}
          >
            {t("create.runStop")}
          </button>
        )}
        {(finished || run.stopped || run.held || lost) && (
          <button
            type="button"
            data-testid="create-run-done"
            onClick={finishedWith}
          >
            {state === "failed" ? t("create.runRetry") : t("create.runDismiss")}
          </button>
        )}
      </div>
      {(following || run.stopped || lost) && (
        <p className="note">
          {run.stopped || lost
            ? t("create.runGoesOn", {
                minutes: Math.ceil(runModel.timeoutSeconds / 60),
              })
            : t("create.runStopNote", {
                minutes: Math.ceil(runModel.timeoutSeconds / 60),
              })}{" "}
          {notebookLink}
        </p>
      )}
    </div>
  );
}
