import { useId, useMemo, useState } from "react";
import type { Lang, MessageKey } from "../i18n.ts";
import {
  PROMPT_CATEGORIES,
  PROMPT_QUERY_LIMIT,
  PROMPT_VALUE_LIMIT,
  YOUMIND_TAXONOMY_SOURCE,
  fillPrompt,
  promptTemplate,
  searchPrompts,
  type PromptLanguage,
} from "../../core/prompts/library.ts";
import {
  PromptPresets,
  type PresetCandidate,
  type PresetsHost,
} from "./PromptPresets.tsx";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

/**
 * The local prompt library on the Create page: search Yamakan's templates in English or
 * Arabic, fill their fields, and put the prompt into the brief. Offline; nothing is sent
 * until the person starts a generation.
 */
export function PromptLibrary({
  lang,
  t,
  brief,
  use,
  presets,
}: {
  lang: Lang;
  t: Translate;
  // The brief's prompt: adding is offered beside replacing when it has words, and it can be
  // kept as a preset.
  brief: string;
  use: (prompt: string, how: "replace" | "add") => void;
  // The project's presets; absent where there is no project to keep them in.
  presets?: PresetsHost;
}) {
  const hasPrompt = brief.trim() !== "";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<"" | "video" | "image">("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  // Most local models read English best, so prompts are written in English unless chosen.
  const [language, setLanguage] = useState<PromptLanguage>("en");
  const id = useId();

  const found = useMemo(
    () =>
      searchPrompts({
        query,
        category: category || undefined,
        kind: kind || undefined,
      }),
    [query, category, kind],
  );
  const template = chosen ? promptTemplate(chosen) : null;
  const filled = useMemo(() => {
    if (!template) return null;
    try {
      return fillPrompt({
        templateId: template.id,
        language,
        values: Object.entries(values).map(([field, value]) => ({
          field,
          value,
        })),
      }).prompt;
    } catch {
      return null;
    }
  }, [template, language, values]);
  // What Save as preset keeps: the filled template, else the brief's own words.
  const candidate: PresetCandidate | null =
    template && filled
      ? {
          templateId: template.id,
          language,
          values: Object.entries(values)
            .filter(([, value]) => value.trim() !== "")
            .map(([field, value]) => ({ field, value })),
          prompt: filled,
          suggestedName: template.title[lang],
        }
      : hasPrompt
        ? {
            templateId: null,
            language: /\p{Script=Arabic}/u.test(brief) ? "ar" : "en",
            values: [],
            prompt: brief.trim(),
            suggestedName: t("presets.fromBrief"),
          }
        : null;
  const choose = (templateId: string) => {
    if (templateId === chosen) return;
    setChosen(templateId);
    setValues({});
  };

  return (
    <details className="prompt-library" data-testid="prompt-library">
      <summary>{t("library.title")}</summary>
      <p className="note">{t("library.note")}</p>
      <div className="prompt-library-filters">
        <label>
          {t("library.search")}
          <input
            type="search"
            dir="auto"
            maxLength={PROMPT_QUERY_LIMIT}
            value={query}
            placeholder={t("library.searchHint")}
            data-testid="prompt-library-search"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {t("library.category")}
          <select
            value={category}
            data-testid="prompt-library-category"
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("library.all")}</option>
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title[lang]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("library.kind")}
          <select
            value={kind}
            data-testid="prompt-library-kind"
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="">{t("library.all")}</option>
            <option value="video">{t("library.kind.video")}</option>
            <option value="image">{t("library.kind.image")}</option>
          </select>
        </label>
      </div>
      <output
        aria-live="polite"
        data-testid="prompt-library-count"
        data-count={found.length}
      >
        {t("library.found", { count: found.length })}
      </output>
      <ul className="prompt-library-list" data-testid="prompt-library-list">
        {found.map((tpl) => (
          <li key={tpl.id}>
            <button
              type="button"
              aria-pressed={chosen === tpl.id}
              data-template-id={tpl.id}
              onClick={() => choose(tpl.id)}
            >
              <strong>{tpl.title[lang]}</strong>
              <span>{tpl.description[lang]}</span>
            </button>
          </li>
        ))}
      </ul>
      {template ? (
        <div
          className="prompt-library-fill"
          role="group"
          aria-labelledby={`${id}-chosen`}
          data-testid="prompt-library-fill"
        >
          <strong id={`${id}-chosen`}>{template.title[lang]}</strong>
          {template.fields.map((f) => (
            <label key={f.name}>
              {f.label[lang]}
              <input
                dir="auto"
                maxLength={PROMPT_VALUE_LIMIT}
                value={values[f.name] ?? ""}
                placeholder={f.default[language]}
                data-testid={`prompt-library-field-${f.name}`}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
              />
            </label>
          ))}
          <fieldset className="prompt-library-language">
            <legend>{t("library.language")}</legend>
            {(["en", "ar"] as const).map((l) => (
              <label key={l}>
                <input
                  type="radio"
                  name={`${id}-language`}
                  value={l}
                  checked={language === l}
                  data-testid={`prompt-library-language-${l}`}
                  onChange={() => {
                    // Values typed for one language are not carried into the other.
                    setLanguage(l);
                    setValues({});
                  }}
                />
                {t(l === "en" ? "library.language.en" : "library.language.ar")}
              </label>
            ))}
          </fieldset>
          <p
            className="prompt-library-preview"
            dir={language === "ar" ? "rtl" : "ltr"}
            lang={language}
            data-testid="prompt-library-preview"
          >
            {filled}
          </p>
          <div className="prompt-library-actions">
            <button
              type="button"
              disabled={!filled}
              data-testid="prompt-library-use"
              onClick={() => filled && use(filled, "replace")}
            >
              {t(hasPrompt ? "library.replace" : "library.use")}
            </button>
            {hasPrompt ? (
              <button
                type="button"
                disabled={!filled}
                data-testid="prompt-library-add"
                onClick={() => filled && use(filled, "add")}
              >
                {t("library.add")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {presets ? (
        <PromptPresets
          t={t}
          host={presets}
          candidate={candidate}
          use={(prompt) => use(prompt, "replace")}
        />
      ) : null}
      <p className="note" data-testid="prompt-library-credit">
        {t("library.credit")} <bdi>{YOUMIND_TAXONOMY_SOURCE.credit}</bdi>
      </p>
    </details>
  );
}
