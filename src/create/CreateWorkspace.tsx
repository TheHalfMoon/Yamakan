// The Create workspace: write the shot, see exactly what a model would be given and
// what can run here, bring a made video in with its receipt, and place it. Starting
// a model from here appears only once something can really run; until then this
// says so, and how a tested model has been run.
import React, { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  addMadeVideo,
  madeRecords,
  type CreateStory,
  type TakeRecordRequest,
  recordRequests,
  type MadeRecord,
} from "./create-story.ts";
import {
  GeneratePanel,
  type GenerateModel,
  type GenerationApi,
} from "./GeneratePanel.tsx";
import { mediaUrl } from "../session.ts";
import { focusIfLost } from "../story/focus.ts";
import { saveStory, type StoryClient } from "../story/save-story.ts";
import {
  directionText,
  draftOffer,
  draftToIntent,
  fullness,
  withIntent,
  type TextStory,
} from "../story/story-text.ts";
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
  sha256Of,
  startingStills,
  validSeed,
  type CreateBrief,
  type DirectionKind,
  type RunReceipt,
} from "./create-model.ts";

import { ElementsPanel, type ElementsApi } from "./ElementsPanel.tsx";
import { PeoplePanel, type PeopleApi } from "./PeoplePanel.tsx";
import { PromptLibrary } from "./PromptLibrary.tsx";
import type { PresetsHost } from "./PromptPresets.tsx";
import type { Lang } from "../i18n.ts";

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

export type KeptStory = {
  documentId: string;
  contentHash: string;
  story: CreateStory;
};
// A story of the project, as it is stored.
export type ProjectStory = {
  documentId: string;
  contentHash: string;
  story: TextStory & { title?: string };
};

// What Create needs to keep a draft in the project's story.
export type StoryHost = {
  client: StoryClient;
  // The editor's own edits come first: saving moves the project on, and reopening replaces them.
  unsaved: boolean;
  onSaved: (projectId: string, from: number, to: number) => void;
  onReload: () => Promise<void>;
};

// A draft that only this browser holds, offered once to be kept in the project's story. Nothing
// is saved until the person picks a shot and says so.
function DraftOffer(props: {
  projectId: string;
  stored: string | null;
  draft: CreateBrief;
  revision: number;
  busy: boolean;
  t: Translate;
  loadStories: () => Promise<ProjectStory[]>;
  host: StoryHost;
}) {
  const { t, draft, host } = props;
  const markerKey = `yamakan.create.brief.offered.${props.projectId}`;
  const [answered, setAnswered] = useState(() => kept(markerKey) !== null);
  const [later, setLater] = useState(false);
  const [picking, setPicking] = useState(false);
  const [stories, setStories] = useState<ProjectStory[]>([]);
  const [shotId, setShotId] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reads, setReads] = useState(0);
  const savedShown = useRef<HTMLParagraphElement | null>(null);
  const possible = !answered && !later && Boolean(props.stored);
  useEffect(() => {
    if (!possible) return;
    let current = true;
    props
      .loadStories()
      .then((found) => {
        if (current) setStories(found);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [possible, props.revision, reads]);
  // The button that held focus is gone: what came of it takes it.
  useEffect(() => {
    if (saved) focusIfLost(savedShown.current, null);
  }, [saved]);
  if (saved)
    return (
      <p
        role="status"
        tabIndex={-1}
        ref={savedShown}
        data-testid="create-draft-saved"
      >
        {t("create.draftSaved")}
      </p>
    );
  const offered =
    possible &&
    draftOffer(
      props.stored,
      stories.map((s) => s.story),
      false,
    );
  if (!offered) return null;
  const shots = stories.flatMap((s) =>
    s.story.scenes.flatMap((scene) =>
      scene.shots.map((shot) => ({ ...s, scene, shot })),
    ),
  );
  const chosen = shots.find((s) => s.shot.id === shotId);
  const intent = draftToIntent(draft);
  const answer = () => {
    keep(markerKey, true);
    setAnswered(true);
  };
  const toPrompt = () => document.getElementById("create-prompt")?.focus();
  const directions = directionText(intent.direction);
  const held = chosen?.shot.intent;
  // What saving would write over.
  const replaced = [
    held?.action,
    ...(directions.length > 0 ? directionText(held?.direction) : []),
  ].filter((words) => words);
  // What the shot's intent says besides stays.
  const next = chosen
    ? withIntent(chosen.story, chosen.shot.id, { ...held, ...intent })
    : null;
  const full = next ? fullness(next) : null;
  const save = async () => {
    if (!chosen || !next || !full) return;
    setSaid(null);
    if (full.tooFull)
      return setSaid(t("words.refused.full", { percent: full.percent }));
    setSaving(true);
    const outcome = await saveStory(host.client, {
      projectId: props.projectId,
      expectedRevision: props.revision,
      documentId: chosen.documentId,
      expectedContentHash: chosen.contentHash,
      story: next,
    });
    if (outcome.kind === "saved") {
      answer();
      setSaved(true);
      host.onSaved(props.projectId, props.revision, outcome.revision);
    } else {
      setSaid(
        outcome.kind === "conflict"
          ? t("create.draftConflict")
          : outcome.kind === "unknown"
            ? t("create.draftUnknown")
            : outcome.kind === "full"
              ? t("words.refused.full", { percent: full.percent })
              : outcome.message
                ? t("words.refused.said", { message: outcome.message })
                : t("create.draftNotSaved"),
      );
      if (outcome.kind === "conflict" || outcome.kind === "unknown") {
        // Read again, so that a person who tries again sees what is there now.
        setShotId("");
        await host.onReload().catch(() => {});
        setReads((n) => n + 1);
      }
    }
    setSaving(false);
  };
  return (
    <div className="create-draft" data-testid="create-draft-offer">
      <h3>{t("create.draftTitle")}</h3>
      <p className="note">{t("create.draftNote")}</p>
      <p
        dir="auto"
        className="create-draft-text"
        data-testid="create-draft-text"
      >
        {intent.action ?? ""}
      </p>
      {picking && (
        <>
          <label className="create-field">
            {t("create.draftShot")}
            <select
              autoFocus
              data-testid="create-draft-shot"
              value={shotId}
              disabled={saving}
              onChange={(e) => {
                setShotId(e.target.value);
                setSaid(null);
              }}
            >
              <option value="">{t("create.draftChoose")}</option>
              {shots.map(({ shot, scene, story }) => (
                <option key={shot.id} value={shot.id}>
                  {[story.title, scene.name, shot.name]
                    .filter(Boolean)
                    .join(" / ")}
                </option>
              ))}
            </select>
          </label>
          {directions.length > 0 && (
            <p className="note" data-testid="create-draft-direction">
              {t("create.draftDirection", { choices: directions.join(", ") })}
            </p>
          )}
          <p className="note">{t("create.draftNotKept")}</p>
          {replaced.length > 0 && (
            <p className="note" data-testid="create-draft-replaces" dir="auto">
              {t("create.draftReplaces", { text: replaced.join(" · ") })}
            </p>
          )}
          {full && (
            <p className="note" data-testid="create-draft-used">
              {t("words.used", { percent: full.percent })}
            </p>
          )}
          <p className="note">{t("create.draftUndo")}</p>
          {host.unsaved && <p>{t("words.saveFirst")}</p>}
        </>
      )}
      {said && (
        <p role="alert" data-testid="create-draft-said">
          {said}
        </p>
      )}
      <div className="create-draft-actions">
        {picking ? (
          <button
            type="button"
            data-testid="create-draft-save"
            disabled={
              props.busy ||
              saving ||
              host.unsaved ||
              !chosen ||
              !intent.action?.trim()
            }
            onClick={() => void save()}
          >
            {t("create.draftSave")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="create-draft-keep"
            onClick={() => setPicking(true)}
          >
            {t("create.draftKeep")}
          </button>
        )}
        <button
          type="button"
          data-testid="create-draft-later"
          disabled={saving}
          onClick={() => {
            setLater(true);
            toPrompt();
          }}
        >
          {t("create.draftLater")}
        </button>
        <button
          type="button"
          data-testid="create-draft-never"
          disabled={saving}
          onClick={() => {
            answer();
            toPrompt();
          }}
        >
          {t("create.draftNever")}
        </button>
      </div>
    </div>
  );
}

export function CreateWorkspace(props: {
  projectId: string;
  assets: readonly Asset[];
  placedAssetIds: ReadonlySet<string>;
  busy: boolean;
  t: Translate;
  // The page's language: the prompt library shows its titles in it.
  lang: Lang;
  // The project's prompt presets.
  presets?: PresetsHost;
  // Whether a generation could run here, from the service.
  checkEngine: () => Promise<EngineAnswer | null>;
  // What can be started from here, and how.
  loadModels: () => Promise<readonly GenerateModel[]>;
  generation: GenerationApi;
  elements: ElementsApi;
  people: PeopleApi;
  projectFps: number;
  // A restore or undo can change what the project holds, with the same videos.
  revision: number;
  // Under the editor's busy state: `check` runs first and can stop the import.
  // Resolves to the new asset, or null, or "busy" if nothing could start.
  importVideo: (
    file: File,
    check: () => Promise<boolean>,
  ) => Promise<Asset | null | "busy">;
  // The project's Create story, and saving a new version of it.
  loadStory: () => Promise<KeptStory | null>;
  // Every story of the project, for a draft to be kept in.
  loadStories: () => Promise<ProjectStory[]>;
  storyHost: StoryHost;
  saveStory: (next: {
    documentId: string;
    expectedContentHash: string | null;
    story: CreateStory;
    records?: TakeRecordRequest[];
  }) => Promise<KeptStory | null>;
  ticksOf: (asset: Asset) => number;
  reopenProject: () => Promise<void>;
  // The whole video, at the end of the track. A reason if it cannot be placed.
  place: (assetId: string) => string | null;
  openEdit: () => void;
}) {
  const { projectId, assets, placedAssetIds, busy, t } = props;
  const briefKey = `yamakan.create.brief.${projectId}`;
  // As the browser held it when this was opened: what is typed from here on is not a draft left
  // behind.
  const [storedDraft] = useState(() => kept(briefKey));
  const [brief, setBrief] = useState(() => readBrief(storedDraft));
  const [keptStory, setKeptStory] = useState<KeptStory | null>(null);
  const [storyRead, setStoryRead] = useState<"reading" | "read" | "failed">(
    "reading",
  );
  const records: Record<string, MadeRecord> = keptStory
    ? madeRecords(keptStory.story)
    : {};
  const [engine, setEngine] = useState<EngineState>("checking");
  const [models, setModels] = useState<readonly GenerateModel[]>([]);
  const [notice, setNotice] = useState<Said | null>(null);
  const [problem, setProblem] = useState<Said | string | null>(null);
  const [copied, setCopied] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  // A video that came in, whose record could not be saved: trying again needs only
  // the record, since bringing the file in again would make a second asset.
  const [unsaved, setUnsaved] = useState<
    { asset: Asset; receipt: RunReceipt }[]
  >([]);

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

  // What the project holds now, whenever it changes.
  const videoHashes = assets
    .filter((a) => a.kind === "video")
    .map((a) => a.hash)
    .join();
  useEffect(() => {
    let current = true;
    props
      .loadStory()
      .then((found) => {
        if (!current) return;
        setKeptStory(found);
        setStoryRead("read");
      })
      .catch(() => {
        if (current) setStoryRead("failed");
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoHashes, props.revision]);

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
    setReceiptFile(null);
    if (receiptInput.current) receiptInput.current.value = "";
    // Said once what it says is saved, so the card below already shows it.
    if (await record(asset, receipt)) announce(asset, receipt);
  };

  const announce = (asset: Asset, receipt: RunReceipt) =>
    setNotice({
      key:
        asset.hash === receipt.sha256
          ? "create.broughtInChecked"
          : "create.broughtInCopy",
      vars: { name: asset.name },
    });

  // Kept with the project. The video is in either way, so failing here says so.
  const record = async (
    asset: Asset,
    receipt: RunReceipt,
    // A generated video's panel has its own way to try again.
    offerRetry = true,
    // The run that made it, when it came from one.
    generationId?: string,
  ) => {
    const missed = () => {
      if (offerRetry)
        setUnsaved((all) => [
          ...all.filter((u) => u.asset.id !== asset.id),
          { asset, receipt },
        ]);
      setProblem({ key: "create.notKept" });
      return false;
    };
    const saved = () => {
      setUnsaved((all) => all.filter((u) => u.asset.id !== asset.id));
      return true;
    };
    try {
      const latest = await props.loadStory();
      const next = addMadeVideo(
        latest?.story ?? null,
        {
          assetId: asset.id,
          assetHash: asset.hash,
          durationTicks: props.ticksOf(asset),
          receipt,
        },
        () => crypto.randomUUID(),
      );
      // A save whose answer was lost got through, so this is what the card shows.
      if (next === "already-there") {
        if (latest) setKeptStory(latest);
        // That save moved the project on, unseen by the editor.
        await props.reopenProject();
        return saved();
      }
      if (next === "full") {
        setProblem({ key: "create.storyFull" });
        return false;
      }
      const kept = await props.saveStory({
        documentId: latest?.documentId ?? crypto.randomUUID(),
        expectedContentHash: latest?.contentHash ?? null,
        story: next,
        records: recordRequests(next, asset.id, receipt, generationId),
      });
      if (!kept) return missed();
      setKeptStory(kept);
      return saved();
    } catch {
      return missed();
    }
  };

  const startable = models.find(
    (m) => m.model === brief.modelId && m.operation !== "imageToVideo",
  );
  // Listed only once that recipe is offered, which needs its own real run first.
  const fromPicture = models.find(
    (m) => m.model === brief.modelId && m.operation === "imageToVideo",
  );
  // Awaited by the panel, under nothing else: the video has come in by now.
  const remember = async (
    receipt: RunReceipt,
    asset: Asset,
    generationId: string,
  ) => {
    // A retry: an earlier failure to save is no longer true.
    setProblem(null);
    const saved = await record(asset, receipt, false, generationId);
    if (saved)
      setNotice({ key: "create.runBroughtIn", vars: { name: receipt.model } });
    return saved;
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
        <DraftOffer
          projectId={projectId}
          stored={storedDraft}
          draft={brief}
          revision={props.revision}
          busy={busy}
          t={t}
          loadStories={props.loadStories}
          host={props.storyHost}
        />
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
        <PromptLibrary
          lang={props.lang}
          t={t}
          brief={brief.prompt}
          presets={props.presets}
          revision={props.revision}
          busy={busy}
          use={(prompt, how) => {
            const base = brief.prompt
              .trim()
              .replace(/[.,;:!?\u060C\u061B\u061F\s]+$/, "");
            const next = how === "add" && base ? `${base}. ${prompt}` : prompt;
            if (next.length > PROMPT_LIMIT) {
              setProblem({
                key: "library.tooLong",
                vars: { limit: PROMPT_LIMIT },
              });
              return;
            }
            setProblem(null);
            update({ prompt: next });
          }}
        />

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
          {model.readsAboutWords !== null && (
            <p className="note" data-testid="create-reads-little">
              {t("create.readsLittle", { words: model.readsAboutWords })}
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

        <ElementsPanel
          projectId={projectId}
          busy={busy}
          revision={props.revision}
          t={t}
          api={props.elements}
          story={keptStory?.story ?? null}
          saveStory={async (story) => {
            if (!keptStory) return false;
            const kept = await props.saveStory({
              documentId: keptStory.documentId,
              expectedContentHash: keptStory.contentHash,
              story,
            });
            if (kept) setKeptStory(kept);
            return Boolean(kept);
          }}
        />

        <PeoplePanel
          busy={busy}
          revision={props.revision}
          t={t}
          api={props.people}
          stills={startingStills(assets).map((still) => ({
            ...still,
            hash: assets.find((a) => a.id === still.id)?.hash ?? "",
          }))}
        />

        {models.length > 0 ? (
          <GeneratePanel
            model={startable ?? models[0]}
            offered={Boolean(startable)}
            models={models}
            prompt={composed}
            seed={brief.seed}
            seedValid={seedValid}
            projectFps={props.projectFps}
            busy={busy}
            t={t}
            api={props.generation}
            onMade={remember}
            findAsset={(id) => assets.find((x) => x.id === id)}
            fromPicture={fromPicture}
            stills={startingStills(assets)}
          />
        ) : (
          <div className="create-engine" data-testid="create-engine">
            <h3>{t("create.engineTitle")}</h3>
            <p>{t(engineLine)}</p>
            {reasonKey && <p className="note">{t(reasonKey)}</p>}
            <p className="note">
              {t("create.outside", { folder: model.folder })}
            </p>
            <p className="note">{t("create.kaggleSetup")}</p>
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
        {unsaved.length > 0 && (
          <button
            type="button"
            disabled={busy}
            data-testid="create-record-retry"
            onClick={async () => {
              setProblem(null);
              for (const { asset, receipt } of unsaved)
                if (await record(asset, receipt)) announce(asset, receipt);
            }}
          >
            {t("create.recordRetry")}
          </button>
        )}

        <h3>{t("create.videos")}</h3>
        {videos.length === 0 ? (
          <p className="note">{t("create.noVideos")}</p>
        ) : (
          <ul className="create-videos">
            {videos.map((video) => {
              const made = records[video.hash];
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
                  {made ? (
                    <small data-testid="create-receipt-facts">
                      {t(
                        made.converted
                          ? "create.receiptMatchedOriginal"
                          : "create.receiptMatched",
                      )}{" "}
                      {t("create.receiptSays")}
                      <br />
                      <bdi>{made.label}</bdi>
                      {made.prompt && (
                        <>
                          <br />
                          {t("create.shotSays")}
                          <br />
                          <bdi>{made.prompt}</bdi>
                        </>
                      )}
                    </small>
                  ) : (
                    <small data-testid="create-no-record">
                      {storyRead === "read"
                        ? t("create.noReceipt")
                        : storyRead === "failed"
                          ? t("create.storyUnread")
                          : ""}
                    </small>
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
