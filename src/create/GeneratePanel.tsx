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

export type GenerationApi = {
  start: (request: {
    recipeId: string;
    prompt: string;
    seed: number;
    width: number;
    height: number;
    durationFrames: number;
  }) => Promise<{ generationId: string }>;
  status: (generationId: string) => Promise<{
    state: string;
    diagnostic?: string;
    imported: unknown;
  }>;
  stop: (generationId: string) => Promise<unknown>;
  // Under the editor's busy state. The output's hash, or null if it did not come in.
  bringIn: (generationId: string) => Promise<string | null>;
};

type Run = {
  generationId: string;
  recipeId: string;
  prompt: string;
  seed: number;
  startedAt: number;
  // Stopped following: Kaggle's public interface cannot stop the run itself.
  stopped?: boolean;
};

const POLL_MS = 20_000;
const FINISHED = new Set(["succeeded", "failed", "cancelled"]);

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function readRun(raw: string | null): Run | null {
  if (!raw) return null;
  try {
    const run = JSON.parse(raw);
    return typeof run?.generationId === "string" &&
      typeof run.recipeId === "string" &&
      typeof run.prompt === "string" &&
      Number.isInteger(run.seed) &&
      Number.isFinite(run.startedAt)
      ? run
      : null;
  } catch {
    return null;
  }
}

export function GeneratePanel(props: {
  storageKey: string;
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
  onMade: (receipt: RunReceipt) => void;
}) {
  const { model, prompt, seed, seedValid, t, api } = props;
  const [run, setRunState] = useState<Run | null>(() => {
    try {
      return readRun(
        globalThis.localStorage?.getItem(props.storageKey) ?? null,
      );
    } catch {
      return null;
    }
  });
  const setRun = (next: Run | null) => {
    setRunState(next);
    try {
      if (next)
        globalThis.localStorage?.setItem(
          props.storageKey,
          JSON.stringify(next),
        );
      else globalThis.localStorage?.removeItem(props.storageKey);
    } catch {
      // Not kept: this run is followed by this page only.
    }
  };
  const [state, setState] = useState("queued");
  const [note, setNote] = useState("");
  const [lost, setLost] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [problem, setProblem] = useState("");
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const finished = FINISHED.has(state);
  const following = Boolean(run) && !run?.stopped && !finished && !lost;
  const runModel =
    (run && props.models.find((m) => m.recipeId === run.recipeId)) ?? model;

  useEffect(() => {
    if (!run || run.stopped || lost) return;
    let current = true;
    const ask = async () => {
      try {
        const answer = await api.status(run.generationId);
        if (!current) return;
        setState(answer.state);
        setNote(answer.diagnostic ?? "");
      } catch (e) {
        if (!current) return;
        // The service restarted, and with it what it knew of this run.
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
      const { generationId } = await api.start({
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
      });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("create.startFailed"));
    } finally {
      setWorking(false);
    }
  };

  const finishedWith = () => {
    setRun(null);
    setState("queued");
    setNote("");
    setLost(false);
  };

  const bringIn = async () => {
    if (!run) return;
    setProblem("");
    setWorking(true);
    const hash = await api.bringIn(run.generationId).catch(() => null);
    setWorking(false);
    if (!hash) {
      setProblem(t("create.bringInFailed"));
      return;
    }
    props.onMade({
      model: runModel.model,
      revision: runModel.revision,
      prompt: run.prompt,
      seed: run.seed,
      steps: runModel.steps,
      sha256: hash,
      licence: runModel.licence,
    });
    finishedWith();
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
    : run.stopped
      ? "create.runStopped"
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
        {state === "succeeded" && !run.stopped && !lost && (
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
        {(finished || run.stopped || lost) && (
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
