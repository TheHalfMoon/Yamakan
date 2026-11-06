// The Create workspace: write the shot, see exactly what a model would be given and
// what can run here, bring a made video in with its receipt, and place it. Starting
// a model from here appears only once something can really run; until then this
// says so, and how a tested model has been run.
import React, { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  GeneratePanel,
  type GenerateModel,
  type GenerationApi,
} from "./GeneratePanel.tsx";
import { mediaUrl } from "../session.ts";
import {
  CREATE_MODELS,
  DIRECTIONS,
  DIRECTION_KINDS,
  PROMPT_LIMIT,
  RECEIPT_BYTE_LIMIT,
  VIDEO_CHECK_BYTE_LIMIT,
  composePrompt,
  parseReceipt,
  readBrief,
  readCopies,
  readReceipts,
  sha256Of,
  validSeed,
  type CreateBrief,
  type DirectionKind,
  type RunReceipt,
} from "./create-model.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

type Asset = {
  id: string;
  kind: string;
  name: string;
  hash: string;
  bytes: number;
};

export type EngineAnswer = {
  available: boolean;
  reason: string | null;
};
type EngineState = "checking" | "unknown" | EngineAnswer;

type Said = { key: MessageKey; vars?: Record<string, string | number> };

const REASONS: Record<string, MessageKey> = {
  ENGINE_DISABLED: "engine.reason.ENGINE_DISABLED",
  WEIGHTS_ABSENT: "engine.reason.WEIGHTS_ABSENT",
  HARDWARE_UNQUALIFIED: "engine.reason.HARDWARE_UNQUALIFIED",
  RIGHTS_UNQUALIFIED: "engine.reason.RIGHTS_UNQUALIFIED",
};

const keep = (key: string, value: unknown) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const kept = (key: string) => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export function CreateWorkspace(props: {
  projectId: string;
  assets: readonly Asset[];
  placedAssetIds: ReadonlySet<string>;
  busy: boolean;
  t: Translate;
  // Whether a generation could run here, from the service.
  checkEngine: () => Promise<EngineAnswer | null>;
  // What can be started from here, and how.
  loadModels: () => Promise<readonly GenerateModel[]>;
  generation: GenerationApi;
  projectFps: number;
  // Under the editor's busy state: `check` runs first and can stop the import.
  // Resolves to the new asset, or null, or "busy" if nothing could start.
  importVideo: (
    file: File,
    check: () => Promise<boolean>,
  ) => Promise<Asset | null | "busy">;
  // The whole video, at the end of the track. A reason if it cannot be placed.
  place: (assetId: string) => string | null;
  openEdit: () => void;
}) {
  const { projectId, assets, placedAssetIds, busy, t } = props;
  const briefKey = `yamakan.create.brief.${projectId}`;
  const receiptsKey = `yamakan.create.receipts.${projectId}`;
  const copiesKey = `yamakan.create.copies.${projectId}`;
  const [brief, setBrief] = useState(() => readBrief(kept(briefKey)));
  const [receipts, setReceipts] = useState(() =>
    readReceipts(kept(receiptsKey)),
  );
  const [copies, setCopies] = useState(() => readCopies(kept(copiesKey)));
  const [engine, setEngine] = useState<EngineState>("checking");
  const [models, setModels] = useState<readonly GenerateModel[]>([]);
  const [notice, setNotice] = useState<Said | null>(null);
  const [problem, setProblem] = useState<Said | string | null>(null);
  const [copied, setCopied] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    keep(briefKey, validSeed(brief.seed) ? brief : { ...brief, seed: 42 });
  }, [brief, briefKey]);

  useEffect(() => {
    let current = true;
    props
      .checkEngine()
      .then((answer) => {
        if (current) setEngine(answer ?? "unknown");
      })
      .catch(() => {
        if (current) setEngine("unknown");
      });
    props
      .loadModels()
      .then((list) => {
        if (current) setModels(list);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
    // Once for this project: the panel is keyed by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const model =
    CREATE_MODELS.find((m) => m.id === brief.modelId) ?? CREATE_MODELS[0];
  const update = (change: Partial<CreateBrief>) =>
    setBrief((b) => ({ ...b, ...change }));
  const composed = composePrompt(brief);
  const videos = assets.filter((a) => a.kind === "video");

  // Read and compared under the import's busy state; the file then goes in.
  const receiptChecker = (file: File, found: { receipt?: RunReceipt }) => {
    return async () => {
      if (!receiptFile) return true;
      if (receiptFile.size > RECEIPT_BYTE_LIMIT) {
        setProblem({ key: "create.receiptInvalid" });
        return false;
      }
      if (file.size > VIDEO_CHECK_BYTE_LIMIT) {
        setProblem({ key: "create.tooLargeToCheck" });
        return false;
      }
      try {
        found.receipt = parseReceipt(await receiptFile.text());
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        setProblem({
          key:
            code === "not-finished"
              ? "create.receiptNotFinished"
              : "create.receiptInvalid",
        });
        return false;
      }
      try {
        if (
          (await sha256Of(await file.arrayBuffer())) !== found.receipt.sha256
        ) {
          setProblem({ key: "create.receiptMismatch" });
          return false;
        }
      } catch {
        setProblem({ key: "create.checkFailed" });
        return false;
      }
      return true;
    };
  };

  const bringIn = async (file: File) => {
    setProblem(null);
    setNotice(null);
    const found: { receipt?: RunReceipt } = {};
    const asset = await props.importVideo(file, receiptChecker(file, found));
    if (asset === "busy") {
      setProblem({ key: "create.busy" });
      return;
    }
    if (!asset) {
      // A refused receipt has said why; otherwise the import failed.
      setProblem((said) => said ?? { key: "create.importFailed" });
      return;
    }
    const { receipt } = found;
    if (!receipt) {
      setNotice({ key: "create.broughtIn", vars: { name: asset.name } });
      return;
    }
    const nextReceipts = { ...receipts, [receipt.sha256]: receipt };
    setReceipts(nextReceipts);
    let saved = keep(receiptsKey, nextReceipts);
    const copy = asset.hash !== receipt.sha256;
    if (copy) {
      // Converted when it came in: what is stored is not the file that was checked.
      const nextCopies = { ...copies, [asset.hash]: receipt.sha256 };
      setCopies(nextCopies);
      saved = keep(copiesKey, nextCopies) && saved;
    }
    setReceiptFile(null);
    if (receiptInput.current) receiptInput.current.value = "";
    setNotice({
      key: copy ? "create.broughtInCopy" : "create.broughtInChecked",
      vars: { name: asset.name },
    });
    if (!saved) setProblem({ key: "create.notKept" });
  };

  const startable = models.find((m) => m.model === brief.modelId);
  const remember = (receipt: RunReceipt) => {
    setNotice({ key: "create.runBroughtIn", vars: { name: receipt.model } });
    const next = { ...receipts, [receipt.sha256]: receipt };
    setReceipts(next);
    if (!keep(receiptsKey, next)) setProblem({ key: "create.notKept" });
  };
  const engineLine: MessageKey =
    engine === "checking"
      ? "create.engineChecking"
      : engine === "unknown"
        ? "create.engineUnknown"
        : engine.available
          ? "create.engineFound"
          : "create.engineOff";
  const reasonKey =
    typeof engine === "object" && !engine.available && engine.reason
      ? REASONS[engine.reason]
      : undefined;
  const seedValid = validSeed(brief.seed);

  return (
    <section className="create" data-testid="create-panel">
      <div className="create-composer">
        <h2>{t("workspace.create")}</h2>
        <div className="create-field">
          <label htmlFor="create-prompt">{t("create.prompt")}</label>
          <textarea
            id="create-prompt"
            dir="auto"
            rows={4}
            maxLength={PROMPT_LIMIT}
            value={brief.prompt}
            placeholder={t("create.promptHint")}
            data-testid="create-prompt"
            onChange={(e) => update({ prompt: e.target.value })}
          />
          <small>
            {t("create.promptCount", {
              count: brief.prompt.length,
              limit: PROMPT_LIMIT,
            })}
          </small>
        </div>

        <fieldset className="create-direction">
          <legend>{t("create.direction")}</legend>
          {DIRECTION_KINDS.map((kind: DirectionKind) => (
            <label key={kind}>
              {t(`create.direction.${kind}`)}
              <select
                data-testid={`create-direction-${kind}`}
                value={brief.direction[kind] ?? ""}
                onChange={(e) => {
                  const { [kind]: _gone, ...others } = brief.direction;
                  update({
                    direction: e.target.value
                      ? { ...others, [kind]: e.target.value }
                      : others,
                  });
                }}
              >
                <option value="">{t("create.direction.none")}</option>
                {Object.entries(DIRECTIONS[kind]).map(([choice, words]) => (
                  <option key={choice} value={choice}>
                    {words}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="note">{t("create.directionNote")}</p>
        </fieldset>

        <div className="create-settings">
          <label>
            {t("create.model")}
            <select
              data-testid="create-model"
              value={brief.modelId}
              onChange={(e) => update({ modelId: e.target.value })}
            >
              {CREATE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("create.seed")}
            <input
              type="number"
              min={0}
              max={2 ** 32 - 1}
              step={1}
              value={Number.isNaN(brief.seed) ? "" : brief.seed}
              data-testid="create-seed"
              aria-invalid={!seedValid}
              aria-describedby={seedValid ? undefined : "create-seed-problem"}
              onChange={(e) => update({ seed: e.target.valueAsNumber })}
            />
          </label>
        </div>
        {!seedValid && (
          <p id="create-seed-problem" className="create-problem">
            {t("create.seedInvalid")}
          </p>
        )}
        <p className="note" data-testid="create-model-facts">
          {t("create.modelFacts", {
            width: model.width,
            height: model.height,
            frames: model.frames,
            fps: model.fps,
            seconds: (model.frames / model.fps).toFixed(1),
            minutes: Math.ceil(model.secondsToMake / 60),
            licence: model.licence,
          })}
        </p>

        <div className="create-final">
          <h3>{t("create.finalPrompt")}</h3>
          <p dir="auto" data-testid="create-final-prompt">
            {composed || t("create.finalPromptEmpty")}
          </p>
          {model.negativePrompt && (
            <p className="note" data-testid="create-negative-prompt">
              {t("create.negativePrompt", { words: model.negativePrompt })}
            </p>
          )}
          <button
            type="button"
            disabled={!composed}
            data-testid="create-copy"
            onClick={async () => {
              setProblem(null);
              try {
                await navigator.clipboard.writeText(composed);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setProblem({ key: "create.copyFailed" });
              }
            }}
          >
            {copied ? t("create.copied") : t("create.copy")}
          </button>
        </div>

        {startable ? (
          <GeneratePanel
            storageKey={`yamakan.create.run.${projectId}`}
            model={startable}
            models={models}
            prompt={composed}
            seed={brief.seed}
            seedValid={seedValid}
            projectFps={props.projectFps}
            busy={busy}
            t={t}
            api={props.generation}
            onMade={remember}
          />
        ) : (
          <div className="create-engine" data-testid="create-engine">
            <h3>{t("create.engineTitle")}</h3>
            <p>{t(engineLine)}</p>
            {reasonKey && <p className="note">{t(reasonKey)}</p>}
            <p className="note">
              {t("create.outside", { folder: model.folder })}
            </p>
            <p className="note">
              {models.length > 0
                ? t("create.notFromHere")
                : t("create.kaggleSetup")}
            </p>
          </div>
        )}
      </div>

      <div className="create-results">
        <h3>{t("create.bringInTitle")}</h3>
        <p className="note">{t("create.bringInNote")}</p>
        <label className="create-field">
          {t("create.receipt")}
          <input
            ref={receiptInput}
            type="file"
            accept="application/json,.json"
            data-testid="create-receipt"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {receiptFile && (
          <button
            type="button"
            data-testid="create-receipt-clear"
            onClick={() => {
              setReceiptFile(null);
              setProblem(null);
              if (receiptInput.current) receiptInput.current.value = "";
            }}
          >
            {t("create.receiptClear")}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          data-testid="create-bring-in"
          onClick={() => videoInput.current?.click()}
        >
          {t("create.bringIn")}
        </button>
        <input
          ref={videoInput}
          type="file"
          hidden
          accept="video/*"
          data-testid="create-video-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void bringIn(file);
          }}
        />
        <div
          role="status"
          className="create-notice"
          data-testid="create-notice"
        >
          {notice && t(notice.key, notice.vars)}
        </div>
        {problem && (
          <div
            role="alert"
            className="create-problem"
            data-testid="create-problem"
          >
            {typeof problem === "string"
              ? problem
              : t(problem.key, problem.vars)}
          </div>
        )}

        <h3>{t("create.videos")}</h3>
        {videos.length === 0 ? (
          <p className="note">{t("create.noVideos")}</p>
        ) : (
          <ul className="create-videos">
            {videos.map((video) => {
              const original = copies[video.hash];
              const receipt = receipts[original ?? video.hash];
              const placed = placedAssetIds.has(video.id);
              return (
                <li key={video.id} data-testid="create-video">
                  <video
                    controls
                    preload="metadata"
                    aria-label={video.name}
                    src={mediaUrl(
                      `/api/v1/projects/${projectId}/assets/${video.id}`,
                    )}
                  />
                  <strong>
                    <bdi>{video.name}</bdi>
                  </strong>
                  {receipt ? (
                    <small data-testid="create-receipt-facts">
                      {t(
                        original
                          ? "create.receiptMatchedOriginal"
                          : "create.receiptMatched",
                      )}{" "}
                      {t("create.receiptSays", {
                        seed: receipt.seed,
                        steps: receipt.steps,
                      })}
                      <br />
                      <bdi>{receipt.model}</bdi>
                      <br />
                      <bdi>{receipt.prompt}</bdi>
                    </small>
                  ) : (
                    <small>{t("create.noReceipt")}</small>
                  )}
                  <div className="create-video-actions">
                    <button
                      type="button"
                      disabled={busy}
                      data-testid="create-place"
                      onClick={() => {
                        setProblem(null);
                        const refused = props.place(video.id);
                        if (refused) {
                          setNotice(null);
                          setProblem(refused);
                        } else
                          setNotice({
                            key: "create.placed",
                            vars: { name: video.name },
                          });
                      }}
                    >
                      {placed ? t("create.placeAgain") : t("create.place")}
                    </button>
                    {placed && (
                      <button
                        type="button"
                        data-testid="create-open-edit"
                        onClick={props.openEdit}
                      >
                        {t("create.openEdit")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
