// The Create workspace: write the shot, see exactly what a model would be given and
// what can run here, bring a made video in with its receipt, and place it. Starting
// a model from here appears only once something can really run; until then this
// says so, and how a tested model has been run.
import React, { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import { mediaUrl } from "../session.ts";
import {
  CREATE_MODELS,
  DIRECTIONS,
  DIRECTION_KINDS,
  PROMPT_LIMIT,
  composePrompt,
  parseReceipt,
  readBrief,
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

export type GenerationAnswer = {
  available: boolean;
  message: string;
} | null;

const keep = (key: string, value: unknown) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept: it lasts for this page only.
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
  // Reports whether a generation could run here, from the service.
  checkEngine: () => Promise<GenerationAnswer>;
  // Runs under the editor's busy state; resolves to the new asset.
  importVideo: (file: File) => Promise<Asset | null>;
  place: (assetId: string) => void;
  openEdit: () => void;
}) {
  const { projectId, assets, placedAssetIds, busy, t } = props;
  const briefKey = `yamakan.create.brief.${projectId}`;
  const receiptsKey = `yamakan.create.receipts.${projectId}`;
  const [brief, setBrief] = useState(() => readBrief(kept(briefKey)));
  const [receipts, setReceipts] = useState(() =>
    readReceipts(kept(receiptsKey)),
  );
  const [engine, setEngine] = useState<GenerationAnswer>(null);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Another project's brief is its own.
  const loaded = useRef(projectId);
  useEffect(() => {
    if (loaded.current === projectId) return;
    loaded.current = projectId;
    setBrief(readBrief(kept(briefKey)));
    setReceipts(readReceipts(kept(receiptsKey)));
  }, [projectId, briefKey, receiptsKey]);
  useEffect(() => {
    if (loaded.current === projectId) keep(briefKey, brief);
  }, [brief, briefKey, projectId]);

  useEffect(() => {
    let current = true;
    props
      .checkEngine()
      .then((answer) => current && setEngine(answer))
      .catch(() => current && setEngine(null));
    return () => {
      current = false;
    };
    // Once for each project shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const model =
    CREATE_MODELS.find((m) => m.id === brief.modelId) ?? CREATE_MODELS[0];
  const update = (change: Partial<CreateBrief>) =>
    setBrief((b) => ({ ...b, ...change }));
  const composed = composePrompt(brief);
  const videos = assets.filter((a) => a.kind === "video");

  const receiptProblem = (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    return code === "not-finished"
      ? t("create.receiptNotFinished")
      : t("create.receiptInvalid");
  };

  const bringIn = async (file: File) => {
    setProblem("");
    setNotice("");
    let receipt: RunReceipt | null = null;
    if (receiptFile) {
      try {
        receipt = parseReceipt(await receiptFile.text());
      } catch (error) {
        setProblem(receiptProblem(error));
        return;
      }
      const hash = await sha256Of(await file.arrayBuffer());
      if (hash !== receipt.sha256) {
        setProblem(t("create.receiptMismatch"));
        return;
      }
    }
    const asset = await props.importVideo(file);
    if (!asset) return;
    if (receipt) {
      // The stored file may be a converted copy; the receipt names what was checked.
      const next = { ...receipts, [asset.hash]: receipt };
      if (asset.hash !== receipt.sha256) next[receipt.sha256] = receipt;
      setReceipts(next);
      keep(receiptsKey, next);
    }
    setReceiptFile(null);
    if (receiptInput.current) receiptInput.current.value = "";
    setNotice(
      receipt
        ? t("create.broughtInChecked", { name: asset.name })
        : t("create.broughtIn", { name: asset.name }),
    );
  };

  return (
    <section className="create" data-testid="create-panel">
      <div className="create-composer">
        <h2>{t("workspace.create")}</h2>
        <label className="create-field">
          {t("create.prompt")}
          <textarea
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
        </label>

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
              value={brief.seed}
              data-testid="create-seed"
              aria-invalid={!validSeed(brief.seed)}
              onChange={(e) => update({ seed: Number(e.target.value) })}
            />
          </label>
        </div>
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
          <button
            type="button"
            disabled={!composed}
            data-testid="create-copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(composed);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setProblem(t("create.copyFailed"));
              }
            }}
          >
            {copied ? t("create.copied") : t("create.copy")}
          </button>
        </div>

        <div className="create-engine" data-testid="create-engine">
          <h3>{t("create.engineTitle")}</h3>
          <p>
            {engine?.available
              ? t("create.engineReady")
              : t("create.engineOff")}
          </p>
          {engine && !engine.available && (
            <p className="note" dir="auto">
              {engine.message}
            </p>
          )}
          <p className="note">
            {t("create.outside", { folder: model.folder })}
          </p>
        </div>
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
          {notice}
        </div>
        {problem && (
          <div
            role="alert"
            className="create-problem"
            data-testid="create-problem"
          >
            {problem}
          </div>
        )}

        <h3>{t("create.videos")}</h3>
        {videos.length === 0 ? (
          <p className="note">{t("create.noVideos")}</p>
        ) : (
          <ul className="create-videos">
            {videos.map((video) => {
              const receipt = receipts[video.hash];
              const placed = placedAssetIds.has(video.id);
              return (
                <li key={video.id} data-testid="create-video">
                  <video
                    controls
                    preload="metadata"
                    src={mediaUrl(
                      `/api/v1/projects/${projectId}/assets/${video.id}`,
                    )}
                  />
                  <strong>
                    <bdi>{video.name}</bdi>
                  </strong>
                  {receipt ? (
                    <small dir="auto" data-testid="create-receipt-facts">
                      {t("create.receiptFacts", {
                        model: receipt.model,
                        seed: receipt.seed,
                        steps: receipt.steps,
                      })}
                      <br />
                      {receipt.prompt}
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
                        props.place(video.id);
                        setNotice(t("create.placed", { name: video.name }));
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
