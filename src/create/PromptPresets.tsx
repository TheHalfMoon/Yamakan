import { useEffect, useId, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  PROMPT_PRESET_LIMITS,
  emptyPromptPresets,
  withoutMissingTemplates,
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
  revision,
  busy,
}: {
  t: Translate;
  host: PresetsHost;
  candidate: PresetCandidate | null;
  use: (prompt: string) => void;
  // The project's revision: an undo, a restore or another writer's save can change the
  // presets, so they are read again when it moves.
  revision: number;
  // The editor is busy: nothing is saved until it is done.
  busy: boolean;
}) {
  const [kept, setKept] = useState<KeptPresets | null>(null);
  const [state, setState] = useState<"reading" | "ready" | "failed">("reading");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const notes = useId();
  // The newest read wins; one started before a save does not overwrite what the save kept.
  const reads = useRef(0);
  const savingRef = useRef(false);
  const reload = async () => {
    const read = ++reads.current;
    try {
      const found = await host.load();
      if (read !== reads.current) return;
      setKept(found);
      setState("ready");
    } catch {
      if (read === reads.current) setState("failed");
    }
  };

  useEffect(() => {
    if (!savingRef.current) void reload();
    return () => {
      // Unmounted or moved on: a read in flight is no longer wanted.
      reads.current++;
    };
    // The page's one host for this project.
  }, [revision]);

  const presets = kept?.presets.presets ?? [];
  const write = async (next: PromptPreset[]) => {
    setSaving(true);
    savingRef.current = true;
    setProblem(null);
    reads.current++;
    try {
      const saved = await host.save({
        documentId: kept?.documentId ?? crypto.randomUUID(),
        expectedContentHash: kept?.contentHash ?? null,
        presets: {
          ...(kept?.presets ?? emptyPromptPresets()),
          presets: withoutMissingTemplates(next),
        },
      });
      if (saved) setKept(saved);
      else {
        // Perhaps another version was saved meanwhile: read it, so the next try is against it.
        setProblem(t("presets.notSaved"));
        await reload();
      }
      return saved !== null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const chosenName = (name.trim() || candidate?.suggestedName || "").slice(
    0,
    PROMPT_PRESET_LIMITS.nameChars,
  );
  // As the service compares names: without regard to case, the same in every locale.
  const taken = presets.some(
    (p) => p.name.trim().toLowerCase() === chosenName.trim().toLowerCase(),
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
                dir="auto"
                lang={p.language}
                title={p.prompt}
              >
                {p.prompt}
              </span>
              <button
                type="button"
                data-testid="prompt-preset-use"
                aria-label={t("presets.useNamed", { name: p.name })}
                onClick={() => use(p.prompt)}
              >
                {t("presets.use")}
              </button>
              <button
                type="button"
                data-testid="prompt-preset-remove"
                disabled={saving || busy || state !== "ready"}
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
              saving ||
              busy ||
              state !== "ready" ||
              !chosenName ||
              taken ||
              full
            }
            aria-describedby={taken || full ? notes : undefined}
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
          {taken || full ? (
            <small id={notes}>
              {taken
                ? t("presets.taken")
                : t("presets.full", { limit: PROMPT_PRESET_LIMITS.presets })}
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
