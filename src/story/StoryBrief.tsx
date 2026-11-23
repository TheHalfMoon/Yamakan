// The Story page's words (MPR-106): the film's brief, a script per scene and what each shot is
// meant to show, kept in the project's story. One Save writes what was typed and nothing else of
// the story; typing sends nothing.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  SHOT_FIELDS,
  TEXT_LIMITS,
  changedUnder,
  directionText,
  edit,
  fieldKey,
  fieldText,
  fullness,
  languagesFit,
  stillToSave,
  withEdits,
  type Edits,
  type Field,
  type TextStory,
} from "./story-text.ts";

type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};
type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
type Held = {
  documentId: string;
  contentHash: string;
  story: TextStory & { title: string };
};
type Refusal = "conflict" | "full" | "languages" | "failed";

const BRIEF = [
  { name: "logline", rows: 2, limit: TEXT_LIMITS.logline },
  { name: "audience", rows: 1, limit: TEXT_LIMITS.audience },
  { name: "format", rows: 1, limit: TEXT_LIMITS.format },
  { name: "languages", rows: 1, limit: 8 * 37 },
  { name: "tone", rows: 1, limit: TEXT_LIMITS.tone },
] as const;
const SHOT_ROWS = { framing: 1, movement: 1, action: 3, dialogue: 2 };

// Redrawn only when its own text changes, so typing stays quick in a long story.
const TextField = memo(function TextField(props: {
  id: string;
  testId: string;
  label: string;
  value: string;
  rows: number;
  limit: number;
  field: Field;
  onText: (field: Field, text: string) => void;
}) {
  return (
    <label className="story-field" htmlFor={props.id}>
      {props.label}
      <textarea
        id={props.id}
        data-testid={props.testId}
        dir="auto"
        rows={props.rows}
        maxLength={props.limit}
        value={props.value}
        onChange={(e) => props.onText(props.field, e.target.value)}
      />
    </label>
  );
}, sameField);
function sameField(
  a: { field: Field; value: string; label: string; onText: unknown },
  b: { field: Field; value: string; label: string; onText: unknown },
) {
  return (
    a.value === b.value &&
    a.label === b.label &&
    a.onText === b.onText &&
    fieldKey(a.field) === fieldKey(b.field)
  );
}

export function StoryBrief({
  projectId,
  revision,
  client,
  t,
  unsaved,
  onSaved,
  onReload,
  registerUnsaved,
}: {
  projectId: string;
  revision: number;
  client: Client;
  t: Translate;
  // Saving moves the project on, so the editor's own edits come first.
  unsaved: boolean;
  onSaved: (projectId: string, from: number, to: number) => void;
  // The editor goes on from the project as it now is.
  onReload: () => Promise<void>;
  registerUnsaved: (isUnsaved: () => boolean) => () => void;
}) {
  const [stories, setStories] = useState<Held[] | "unknown" | null>(null);
  const [base, setBase] = useState<Held | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [openScene, setOpenScene] = useState<string | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [reads, setReads] = useState(0);
  const caller = useRef(client);
  caller.current = client;
  const latest = useRef({ base, edits });
  latest.current = { base, edits };
  // A read that began before a later save or reload is not shown.
  const ticket = useRef(0);

  useEffect(
    () => registerUnsaved(() => Object.keys(latest.current.edits).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const read = async (): Promise<Held[]> => {
    const refs = (await caller.current.call("yamakan.document.list", {
      projectId,
    })) as { id: string; kind: string }[];
    const found: Held[] = [];
    for (const ref of refs)
      if (ref.kind === "story") {
        const held = (await caller.current.call("yamakan.document.get", {
          projectId,
          documentId: ref.id,
        })) as { contentHash: string; content: Held["story"] };
        found.push({
          documentId: ref.id,
          contentHash: held.contentHash,
          story: held.content,
        });
      }
    return found;
  };
  // Known at once, also to a read that ends before the page is drawn again.
  const hold = (held: Held | null) => {
    latest.current = { ...latest.current, base: held };
    setBase(held);
  };
  // Takes the story as it is. Typed text stays, on top of it.
  const adopt = (held: Held) => {
    hold(held);
    setEdits((typed) => stillToSave(typed, held.story));
  };
  useEffect(() => {
    const mine = ++ticket.current;
    read()
      .then((found) => {
        if (mine !== ticket.current) return;
        setStories(found);
        const { base: held, edits: typed } = latest.current;
        const same = found.find((s) => s.documentId === held?.documentId);
        // Nothing typed: the page shows the story as it is. Otherwise the person is told, and
        // reloads when they want to.
        if (Object.keys(typed).length === 0) {
          const next = same ?? found[0] ?? null;
          hold(next);
          setRefused(null);
        } else if (same?.contentHash !== held?.contentHash)
          setRefused("conflict");
      })
      .catch(() => {
        if (mine === ticket.current) setStories((known) => known ?? "unknown");
      });
    // Only a change of the project, its revision, or a reading asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, revision, reads]);

  const onText = useCallback((field: Field, text: string) => {
    const { base: held } = latest.current;
    if (!held) return;
    setRefused((r) => (r === "conflict" ? r : null));
    setEdits((typed) => edit(typed, held.story, field, text));
  }, []);
  const draft = useMemo(
    () => (base ? withEdits(base.story, edits) : null),
    [base, edits],
  );
  const full = useMemo(() => (draft ? fullness(draft) : null), [draft]);

  if (stories === null) return null;
  if (stories === "unknown")
    return (
      <p role="alert" data-testid="story-text-unknown">
        {t("words.unknown")}
      </p>
    );
  if (!base || !draft || !full)
    return <p data-testid="story-text-none">{t("words.none")}</p>;

  const dirty = Object.keys(edits).length > 0;
  const value = (field: Field) =>
    edits[fieldKey(field)]?.now ?? fieldText(base.story, field) ?? "";
  const under = changedUnder(edits, base.story);

  const save = async () => {
    if (!languagesFit(value({ at: "brief", name: "languages" })))
      return setRefused("languages");
    if (full.tooFull) return setRefused("full");
    setSaving(true);
    setRefused(null);
    const sent = edits;
    try {
      const answer = (await client.call("yamakan.story.save", {
        projectId,
        expectedRevision: revision,
        documentId: base.documentId,
        expectedContentHash: base.contentHash,
        story: draft,
      })) as {
        project?: { revision?: number };
        document: { contentHash: string };
      };
      setSavedOnce(true);
      ticket.current++;
      // As sent, until it is read again as the service stored it.
      const held = {
        ...base,
        contentHash: answer.document.contentHash,
        story: draft,
      };
      hold(held);
      // What was typed while it was being saved is still to save.
      setEdits((typed) => {
        const left: Edits = {};
        for (const [key, e] of Object.entries(typed))
          if (sent[key]?.now !== e.now)
            left[key] = { ...e, was: fieldText(draft, e.field) ?? "" };
        return left;
      });
      if (typeof answer.project?.revision === "number")
        onSaved(projectId, revision, answer.project.revision);
      setReads((n) => n + 1);
    } catch (e) {
      const { code } = e as { code?: unknown };
      setRefused(
        code === "REVISION_CONFLICT"
          ? "conflict"
          : code === "LIMIT_EXCEEDED"
            ? "full"
            : "failed",
      );
    } finally {
      setSaving(false);
    }
  };
  const reload = async () => {
    setSaving(true);
    try {
      await onReload();
      ticket.current++;
      const found = await read();
      setStories(found);
      const same = found.find((s) => s.documentId === base.documentId);
      if (same) {
        adopt(same);
        setRefused(null);
      } else setRefused("failed");
    } catch {
      setRefused("failed");
    } finally {
      setSaving(false);
    }
  };

  const label = (field: Field) =>
    field.at === "brief"
      ? t(`words.brief.${field.name}`)
      : field.at === "scene"
        ? t("words.script")
        : t(`words.shot.${field.name}`);
  return (
    <section
      className="story-words"
      data-testid="story-text"
      aria-label={t("words.words")}
    >
      <h3>{t("words.words")}</h3>
      {stories.length > 1 ? (
        <label className="story-field">
          {t("words.which")}
          <select
            data-testid="story-text-which"
            value={base.documentId}
            disabled={dirty || saving}
            onChange={(e) => {
              const next = stories.find((s) => s.documentId === e.target.value);
              if (next) hold(next);
            }}
          >
            {stories.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.story.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p dir="auto">{base.story.title}</p>
      )}
      {BRIEF.map(({ name, rows, limit }) => {
        const field: Field = { at: "brief", name };
        return (
          <div key={name}>
            <TextField
              id={`story-brief-${name}`}
              testId={`story-brief-${name}`}
              label={label(field)}
              value={value(field)}
              rows={rows}
              limit={limit}
              field={field}
              onText={onText}
            />
            {name === "languages" && (
              <p className="note">{t("words.languagesNote")}</p>
            )}
          </div>
        );
      })}
      {base.story.scenes.map((scene, i) => {
        const field: Field = { at: "scene", id: scene.id };
        const open = scene.id === openScene;
        return (
          <div key={scene.id} className="story-scene" data-scene={scene.id}>
            <h4 dir="auto">{scene.name ?? i + 1}</h4>
            <TextField
              id={`story-scene-${scene.id}`}
              testId="story-scene-script"
              label={label(field)}
              value={value(field)}
              rows={3}
              limit={TEXT_LIMITS.sceneText}
              field={field}
              onText={onText}
            />
            <button
              type="button"
              data-testid="story-scene-open"
              aria-expanded={open}
              disabled={scene.shots.length === 0}
              onClick={() => setOpenScene(open ? null : scene.id)}
            >
              {t(open ? "words.hideShots" : "words.showShots", {
                count: scene.shots.length,
              })}
            </button>
            {/* Only the open scene's shots are there. */}
            {open &&
              scene.shots.map((shot, n) => {
                const words = directionText(shot.intent?.direction);
                return (
                  <fieldset
                    key={shot.id}
                    className="story-shot"
                    data-shot={shot.id}
                  >
                    <legend dir="auto">{shot.name ?? n + 1}</legend>
                    {SHOT_FIELDS.map((name) => {
                      const of: Field = { at: "shot", id: shot.id, name };
                      return (
                        <TextField
                          key={name}
                          id={`story-shot-${shot.id}-${name}`}
                          testId={`story-shot-${name}`}
                          label={label(of)}
                          value={value(of)}
                          rows={SHOT_ROWS[name]}
                          limit={TEXT_LIMITS[name]}
                          field={of}
                          onText={onText}
                        />
                      );
                    })}
                    {words.length > 0 && (
                      <p className="note" data-testid="story-shot-direction">
                        {t("words.direction", { choices: words.join(", ") })}
                      </p>
                    )}
                  </fieldset>
                );
              })}
          </div>
        );
      })}
      <p data-testid="story-text-used" data-percent={full.percent}>
        {t("words.used", { percent: full.percent })}
      </p>
      {!savedOnce && <p className="note">{t("words.endsUndo")}</p>}
      {unsaved && dirty && (
        <p data-testid="story-text-save-first">{t("words.saveFirst")}</p>
      )}
      {under.length > 0 && (
        <ul className="story-under" data-testid="story-text-under">
          {under.map((e) => (
            <li key={fieldKey(e.field)} dir="auto">
              {e.says === null
                ? t("words.gone", { field: label(e.field), text: e.now })
                : t("words.saysNow", { field: label(e.field), text: e.says })}
            </li>
          ))}
        </ul>
      )}
      {refused && (
        <p role="alert" data-testid="story-text-refused" data-why={refused}>
          {refused === "full"
            ? t("words.refused.full", { percent: full.percent })
            : t(`words.refused.${refused}`)}
        </p>
      )}
      <div className="story-words-actions">
        <button
          type="button"
          data-testid="story-text-save"
          disabled={!dirty || saving || unsaved}
          onClick={() => void save()}
        >
          {t("words.save")}
        </button>
        {refused === "conflict" && (
          <button
            type="button"
            data-testid="story-text-reload"
            disabled={saving}
            onClick={() => void reload()}
          >
            {t("words.reload")}
          </button>
        )}
      </div>
    </section>
  );
}
