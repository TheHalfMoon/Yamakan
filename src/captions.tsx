// Caption tracks (YU-024): import an SRT or WebVTT file, edit its cues
// (times and text), split a cue at the playhead, burn the track into the
// picture, and export it again. Every change is a typed command that makes
// a new project revision; the editor's draft follows it (onSaved).
import { memo, useEffect, useRef, useState } from "react";
import type { MessageKey } from "./i18n.ts";

type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};
type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

type Cue = {
  id: string;
  startTicks: number;
  endTicks: number;
  text: string;
  source: unknown;
};
type Track = {
  id: string;
  contentHash: string;
  name: string;
  language: string;
  burnIn: boolean;
  cues: Cue[];
};
type Saved = { project: { revision: number } };
type Props = {
  projectId: string;
  revision: number;
  lang: string;
  // Read when a cue is split (not passed every frame).
  playheadTicks: () => number;
  client: Client;
  t: Translate;
  onSaved: (projectId: string, from: number, revision: number) => void;
};

const TICKS_PER_MS = 705_600;
const LANGUAGES = ["ar", "en"] as const;
// Seconds with milliseconds, as typed and shown.
const seconds = (ticks: number) => (ticks / TICKS_PER_MS / 1000).toFixed(3);
const ticksOf = (text: string) => {
  const s = Number(text);
  return Number.isFinite(s) && s >= 0
    ? Math.round(s * 1000) * TICKS_PER_MS
    : null;
};

function CaptionsPanel(props: Props) {
  const { projectId, revision, lang } = props;
  // Callbacks are read through a ref: the panel re-renders only when the
  // project, its revision or the language changes, not on every frame.
  const live = useRef(props);
  live.current = props;
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    live.current.t(key, vars);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // Edited cues, and the track version they were made from.
  const [draft, setDraft] = useState<{ base: string; cues: Cue[] } | null>(
    null,
  );
  const [language, setLanguage] = useState<string>(lang === "ar" ? "ar" : "en");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const at = useRef(revision);
  at.current = revision;
  const loads = useRef(0);

  const call = (operation: string, args: Record<string, unknown>) =>
    live.current.client.call(operation, args);
  // Reads the project's caption tracks; only the latest read is shown.
  const load = async () => {
    const n = ++loads.current;
    const refs = (await call("yamakan.document.list", { projectId })) as {
      id: string;
      kind: string;
      contentHash: string;
    }[];
    const read = await Promise.all(
      refs
        .filter((r) => r.kind === "captions")
        .map(async (r) => {
          const doc = (await call("yamakan.document.get", {
            projectId,
            documentId: r.id,
          })) as { content: Omit<Track, "id" | "contentHash"> };
          return { ...doc.content, id: r.id, contentHash: r.contentHash };
        }),
    );
    if (n === loads.current) setTracks(read);
  };
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [projectId, revision]);

  const track = tracks.find((x) => x.id === selected) ?? null;
  // A draft made from another version of the track (another writer) is
  // dropped, never saved over the newer cues.
  useEffect(() => {
    if (draft && track && draft.base !== track.contentHash) {
      setDraft(null);
      setError(t("captions.changed"));
    }
  }, [track?.contentHash]);
  const cues = draft?.cues ?? track?.cues ?? [];
  const drafting = draft !== null;

  // Runs one command; the editor's draft then moves to the new revision
  // and the tracks are read again.
  const commit = async (operation: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const from = at.current;
    try {
      const saved = (await call(operation, {
        projectId,
        expectedRevision: from,
        ...args,
      })) as Saved;
      live.current.onSaved(projectId, from, saved.project.revision);
      setDraft(null);
      await load();
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    if (file.size > 512 * 1024) {
      setError(t("captions.tooLarge"));
      return;
    }
    const text = await file.text();
    // WebVTT is recognised by its header, whatever the file is called.
    const format = /^﻿?WEBVTT/.test(text) ? "vtt" : "srt";
    const documentId = crypto.randomUUID();
    const name =
      file.name
        .replace(/\.(srt|vtt|txt)$/i, "")
        .trim()
        .slice(0, 120) || "Captions";
    const saved = await commit("yamakan.captions.import", {
      documentId,
      expectedContentHash: null,
      name,
      language,
      format,
      text,
    });
    if (saved) setSelected(documentId);
  };

  const download = async (format: "srt" | "vtt") => {
    if (!track) return;
    try {
      const out = (await call("yamakan.captions.export", {
        projectId,
        documentId: track.id,
        format,
      })) as { text: string };
      const url = URL.createObjectURL(
        new Blob([out.text], {
          type: format === "vtt" ? "text/vtt" : "application/x-subrip",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      // The browser reduces the name to a safe file name.
      a.download = `${track.name}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const edit = (id: string, patch: Partial<Cue>) =>
    track &&
    setDraft({
      base: draft?.base ?? track.contentHash,
      cues: cues.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const split = (cue: Cue) => {
    const at = live.current.playheadTicks();
    if (!(at > cue.startTicks && at < cue.endTicks)) {
      setError(t("captions.splitHint"));
      return;
    }
    void commit("yamakan.captions.split", {
      documentId: track!.id,
      expectedContentHash: track!.contentHash,
      cueId: cue.id,
      atTicks: at,
      newCueId: crypto.randomUUID(),
    });
  };

  return (
    <section data-testid="captions-panel" aria-label={t("captions.title")}>
      <h3>{t("captions.title")}</h3>
      <p>
        <label>
          {t("captions.language")}{" "}
          <select
            data-testid="captions-language"
            value={language}
            disabled={busy || drafting}
            onChange={(e) => setLanguage(e.currentTarget.value)}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`captions.language.${code}`)}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          {t("captions.import")}{" "}
          <input
            type="file"
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            data-testid="captions-file"
            disabled={busy || drafting}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void importFile(file);
            }}
          />
        </label>
      </p>
      {tracks.length ? (
        <label>
          {t("captions.track")}{" "}
          <select
            data-testid="captions-track"
            value={selected ?? ""}
            disabled={busy || drafting}
            onChange={(e) => setSelected(e.currentTarget.value || null)}
          >
            <option value="">—</option>
            {tracks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.language})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="hint">{t("captions.none")}</p>
      )}
      {track ? (
        <div data-testid="captions-editor" lang={track.language}>
          <label>
            <input
              type="checkbox"
              data-testid="captions-burn-in"
              checked={track.burnIn}
              disabled={busy || drafting}
              onChange={(e) =>
                void commit("yamakan.captions.save", {
                  documentId: track.id,
                  expectedContentHash: track.contentHash,
                  burnIn: e.currentTarget.checked,
                })
              }
            />{" "}
            {t("captions.burnIn")}
          </label>
          <table>
            <thead>
              <tr>
                <th>{t("captions.start")}</th>
                <th>{t("captions.end")}</th>
                <th>{t("captions.text")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cues.map((c, n) => (
                <tr key={c.id} data-cue={c.id}>
                  <td>
                    <input
                      key={`s${c.startTicks}`}
                      type="number"
                      step={0.001}
                      min={0}
                      aria-label={t("captions.startOf", { n: n + 1 })}
                      defaultValue={seconds(c.startTicks)}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = ticksOf(e.currentTarget.value);
                        if (v === null)
                          e.currentTarget.value = seconds(c.startTicks);
                        else if (v !== c.startTicks)
                          edit(c.id, { startTicks: v });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      key={`e${c.endTicks}`}
                      type="number"
                      step={0.001}
                      min={0}
                      aria-label={t("captions.endOf", { n: n + 1 })}
                      defaultValue={seconds(c.endTicks)}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = ticksOf(e.currentTarget.value);
                        if (v === null)
                          e.currentTarget.value = seconds(c.endTicks);
                        else if (v !== c.endTicks) edit(c.id, { endTicks: v });
                      }}
                    />
                  </td>
                  <td>
                    <textarea
                      dir="auto"
                      rows={Math.min(4, c.text.split("\n").length)}
                      maxLength={500}
                      aria-label={t("captions.textOf", { n: n + 1 })}
                      value={c.text}
                      disabled={busy}
                      data-testid="captions-text"
                      onChange={(e) =>
                        edit(c.id, { text: e.currentTarget.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={busy || drafting}
                      onClick={() => split(c)}
                    >
                      {t("captions.split")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {drafting ? <p className="hint">{t("captions.unsaved")}</p> : null}
          <p>
            <button
              type="button"
              data-testid="captions-save"
              disabled={busy || !drafting}
              onClick={() =>
                void commit("yamakan.captions.save", {
                  documentId: track.id,
                  expectedContentHash: track.contentHash,
                  // Edited text loses its outer spaces, as an import does.
                  cues: cues.map((c) => ({ ...c, text: c.text.trim() })),
                })
              }
            >
              {t("captions.save")}
            </button>{" "}
            <button
              type="button"
              disabled={busy || drafting}
              onClick={() => setDraft(null)}
              hidden={!drafting}
            >
              {t("captions.discard")}
            </button>{" "}
            <button
              type="button"
              disabled={busy || drafting}
              onClick={() => void download("srt")}
            >
              {t("captions.exportSrt")}
            </button>{" "}
            <button
              type="button"
              disabled={busy || drafting}
              onClick={() => void download("vtt")}
            >
              {t("captions.exportVtt")}
            </button>
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" data-testid="captions-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export const Captions = memo(
  CaptionsPanel,
  (a, b) =>
    a.projectId === b.projectId &&
    a.revision === b.revision &&
    a.lang === b.lang,
);
