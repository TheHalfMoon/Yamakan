import { useEffect, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  PROMPT_PRESET_LIMITS,
  emptyPromptPresets,
  type PromptPreset,
  type PromptPresetsDocument,
} from "../../core/prompts/presets.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

/** The project's presets as last read or saved: their document, its hash, and the presets. */
export type KeptPresets = {
  documentId: string;
  contentHash: string;
  presets: PromptPresetsDocument;
};

/** What the page gives the panel: reading the project's presets, and saving a new version. */
export type PresetsHost = {
  load(): Promise<KeptPresets | null>;
  // Under the editor's busy state; the new version, or null when it was not saved (the
  // reason is on the status line).
  save(next: {
    documentId: string;
    expectedContentHash: string | null;
    presets: PromptPresetsDocument;
  }): Promise<KeptPresets | null>;
};

/** A prompt that can be kept: the filled template, or the brief's own words. */
export type PresetCandidate = Omit<PromptPreset, "id" | "name"> & {
  suggestedName: string;
};

/**
 * Presets kept with the project: a filled library template or the brief's own prompt, saved by
 * name, used again later, or removed. Saved as one document of the project, so they are undone,
 * restored and backed up with it.
 */
export function PromptPresets({
  t,
  host,
  candidate,
  use,
}: {
  t: Translate;
  host: PresetsHost;
  candidate: PresetCandidate | null;
  use: (prompt: string) => void;
}) {
  const [kept, setKept] = useState<KeptPresets | null>(null);
  const [state, setState] = useState<"reading" | "ready" | "failed">("reading");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    host
      .load()
      .then((found) => {
        if (!current) return;
        setKept(found);
        setState("ready");
      })
      .catch(() => current && setState("failed"));
    return () => {
      current = false;
    };
    // The page's one host for this project; read once.
  }, []);

  const presets = kept?.presets.presets ?? [];
  const write = async (next: PromptPreset[]) => {
    setSaving(true);
    setProblem(null);
    try {
      const saved = await host.save({
        documentId: kept?.documentId ?? crypto.randomUUID(),
        expectedContentHash: kept?.contentHash ?? null,
        presets: { ...(kept?.presets ?? emptyPromptPresets()), presets: next },
      });
      if (saved) setKept(saved);
      else setProblem(t("presets.notSaved"));
      return saved !== null;
    } finally {
      setSaving(false);
    }
  };
  const chosenName = (name.trim() || candidate?.suggestedName || "").slice(
    0,
    PROMPT_PRESET_LIMITS.nameChars,
  );
  const taken = presets.some(
    (p) => p.name.toLocaleLowerCase() === chosenName.toLocaleLowerCase(),
  );
  const full = presets.length >= PROMPT_PRESET_LIMITS.presets;

  if (state === "failed")
    return (
      <p className="note" role="alert" data-testid="presets-unreadable">
        {t("presets.unreadable")}
      </p>
    );

  return (
    <section
      className="prompt-presets"
      aria-labelledby="prompt-presets-title"
      data-testid="prompt-presets"
      data-state={state}
    >
      <strong id="prompt-presets-title">{t("presets.title")}</strong>
      {presets.length ? (
        <ul data-testid="prompt-presets-list">
          {presets.map((p) => (
            <li key={p.id} data-preset-name={p.name}>
              <bdi className="prompt-preset-name">{p.name}</bdi>
              <span
                className="prompt-preset-text"
                dir={p.language === "ar" ? "rtl" : "ltr"}
                lang={p.language}
              >
                {p.prompt}
              </span>
              <button
                type="button"
                data-testid="prompt-preset-use"
                onClick={() => use(p.prompt)}
              >
                {t("presets.use")}
              </button>
              <button
                type="button"
                data-testid="prompt-preset-remove"
                disabled={saving}
                aria-label={t("presets.removeNamed", { name: p.name })}
                onClick={() => void write(presets.filter((q) => q.id !== p.id))}
              >
                {t("presets.remove")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">
          {state === "reading" ? t("presets.reading") : t("presets.none")}
        </p>
      )}
      {candidate ? (
        <div className="prompt-presets-save">
          <label>
            {t("presets.name")}
            <input
              dir="auto"
              maxLength={PROMPT_PRESET_LIMITS.nameChars}
              value={name}
              placeholder={candidate.suggestedName}
              data-testid="prompt-preset-name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="button"
            data-testid="prompt-preset-save"
            disabled={
              saving || state !== "ready" || !chosenName || taken || full
            }
            onClick={async () => {
              const { suggestedName: _unused, ...rest } = candidate;
              const ok = await write([
                ...presets,
                { id: crypto.randomUUID(), name: chosenName, ...rest },
              ]);
              if (ok) setName("");
            }}
          >
            {t("presets.save")}
          </button>
          {taken ? <small>{t("presets.taken")}</small> : null}
          {full ? (
            <small>
              {t("presets.full", { limit: PROMPT_PRESET_LIMITS.presets })}
            </small>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p role="alert" data-testid="prompt-presets-problem">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
