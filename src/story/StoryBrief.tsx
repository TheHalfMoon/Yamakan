// The Story page's words (MPR-106): the film's brief, a script per scene and what each shot is
// meant to show, kept in the project's story. One Save writes what was typed and nothing else of
// the story; typing sends nothing.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import { saveStory, type SaveOutcome, type StoryClient } from "./save-story.ts";
import { focusIfLost } from "./focus.ts";
import {
  SHOT_FIELDS,
  TEXT_LIMITS,
  changedUnder,
  directionText,
  edit,
  editsThatFit,
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

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
type Held = {
  documentId: string;
  contentHash: string;
  story: TextStory & { title: string };
};
// Why the last save wrote nothing, as far as is known.
type Refusal =
  | { why: "full" | "languages" | "unknown" | "gone" }
  | { why: "failed"; message: string | null };

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
  client: StoryClient;
  t: Translate;
  // Saving moves the project on, and reloading replaces what the editor holds, so the editor's
  // own edits come first.
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
  // The story is no longer as the page took it, and there is text typed on top.
  const [moved, setMoved] = useState(false);
  const [done, setDone] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [reads, setReads] = useState(0);
  const caller = useRef(client);
  caller.current = client;
  const latest = useRef({ base, edits });
  latest.current = { base, edits };
  // A read that began before a later save or reload is not shown.
  const ticket = useRef(0);
  const shown = useRef<HTMLDivElement | null>(null);
  const actions = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => registerUnsaved(() => Object.keys(latest.current.edits).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // A button that held focus may be gone or off: what came of it takes it. Never from a person
  // who has gone on to type.
  useEffect(() => {
    if (done || refused) focusIfLost(shown.current, actions.current);
  }, [done, refused]);
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
    setMoved(false);
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
          hold(same ?? found[0] ?? null);
          setMoved(false);
        } else if (same && same.contentHash !== held?.contentHash)
          setMoved(true);
        const gone = Object.keys(typed).length > 0 && !same;
        setRefused((r) =>
          gone
            ? r?.why === "gone"
              ? r
              : { why: "gone" }
            : r?.why === "gone"
              ? null
              : r,
        );
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
    setRefused((r) => (r?.why === "unknown" || r?.why === "gone" ? r : null));
    setDone(null);
    const next = edit(latest.current.edits, held.story, field, text);
    latest.current = { ...latest.current, edits: next };
    setEdits(next);
    // Put back as it was: the page shows the story as it now is.
    if (Object.keys(next).length === 0) setReads((n) => n + 1);
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

  const typed = Object.keys(edits).length > 0;
  // Text for a scene or a shot that is gone cannot be saved.
  const toSave = Object.keys(editsThatFit(edits, base.story)).length > 0;
  const value = (field: Field) =>
    edits[fieldKey(field)]?.now ?? fieldText(base.story, field) ?? "";
  const under = changedUnder(edits, base.story);

  const save = async () => {
    setDone(null);
    if (!languagesFit(value({ at: "brief", name: "languages" })))
      return setRefused({ why: "languages" });
    if (full.tooFull) return setRefused({ why: "full" });
    setSaving(true);
    setRefused(null);
    const sent = edits;
    const outcome: SaveOutcome = await saveStory(client, {
      projectId,
      expectedRevision: revision,
      documentId: base.documentId,
      expectedContentHash: base.contentHash,
      story: draft,
    });
    if (outcome.kind === "saved") {
      ticket.current++;
      // As sent, until it is read again as the service stored it.
      hold({ ...base, contentHash: outcome.contentHash, story: draft });
      // What was typed while it was being saved, and what had no place, is still there.
      setEdits((now) => {
        const left: Edits = {};
        for (const [key, e] of Object.entries(now)) {
          const says = fieldText(draft, e.field);
          if (says === null) left[key] = e;
          else if (sent[key]?.now !== e.now) left[key] = { ...e, was: says };
        }
        return left;
      });
      setMoved(false);
      setRefused(null);
      setSavedOnce(true);
      setDone("words.saved");
      onSaved(projectId, revision, outcome.revision);
      setReads((n) => n + 1);
    } else if (outcome.kind === "conflict") setMoved(true);
    else if (outcome.kind === "refused")
      setRefused({ why: "failed", message: outcome.message });
    else setRefused({ why: outcome.kind });
    setSaving(false);
  };
  const reload = async () => {
    setSaving(true);
    setDone(null);
    try {
      await onReload();
      ticket.current++;
      const found = await read();
      setStories(found);
      const same = found.find((s) => s.documentId === base.documentId);
      if (same) {
        adopt(same);
        setRefused(null);
        setDone("words.reloaded");
      } else setRefused({ why: "gone" });
    } catch {
      setRefused({ why: "failed", message: null });
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    latest.current = { ...latest.current, edits: {} };
    setEdits({});
    setRefused(null);
    setMoved(false);
    setDone("words.discarded");
    setReads((n) => n + 1);
  };

  const label = (field: Field) =>
    field.at === "brief"
      ? t(`words.brief.${field.name}`)
      : field.at === "scene"
        ? t("words.script")
        : t(`words.shot.${field.name}`);
  const why = refused?.why ?? (moved ? "conflict" : null);
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
            disabled={typed || saving}
            onChange={(e) => {
              const next = stories.find((s) => s.documentId === e.target.value);
              if (!next) return;
              hold(next);
              setRefused(null);
              setMoved(false);
              setDone(null);
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
      {unsaved && (typed || why) && (
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
      <div ref={shown} tabIndex={-1}>
        {why && (
          <p role="alert" data-testid="story-text-refused" data-why={why}>
            {refused?.why === "failed" && refused.message
              ? t("words.refused.said", { message: refused.message })
              : why === "full"
                ? t("words.refused.full", { percent: full.percent })
                : t(`words.refused.${why}`)}
          </p>
        )}
        {done && (
          <p role="status" data-testid="story-text-done">
            {t(done)}
          </p>
        )}
      </div>
      <div className="story-words-actions" ref={actions}>
        <button
          type="button"
          data-testid="story-text-save"
          disabled={!toSave || saving || unsaved}
          onClick={() => void save()}
        >
          {t("words.save")}
        </button>
        {(moved || refused?.why === "unknown") && (
          <button
            type="button"
            data-testid="story-text-reload"
            disabled={saving || unsaved}
            onClick={() => void reload()}
          >
            {t("words.reload")}
          </button>
        )}
        {typed && (
          <button
            type="button"
            data-testid="story-text-discard"
            disabled={saving}
            onClick={discard}
          >
            {t("words.discard")}
          </button>
        )}
      </div>
    </section>
  );
}
