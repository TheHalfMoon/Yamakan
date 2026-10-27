// Caption tracks (YU-024): import an SRT or WebVTT file, edit its cues
// (times and text), split a cue at the playhead, burn the track into the
// picture, and export it again. Every change is a typed command that makes
// a new project revision; the editor's draft follows it (onSaved).
import { useEffect, useRef, useState } from "react";
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
type Saved = {
  project: { revision: number };
  document?: { contentHash: string };
};

const TICKS_PER_MS = 705_600;
// Seconds with milliseconds, as typed and shown.
const seconds = (ticks: number) => (ticks / TICKS_PER_MS / 1000).toFixed(3);
const ticksOf = (text: string) => {
  const s = Number(text);
  return Number.isFinite(s) && s >= 0
    ? Math.round(s * 1000) * TICKS_PER_MS
    : null;
};

export function Captions({
  projectId,
  revision,
  playheadTicks,
  lang,
  client,
  t,
  onSaved,
}: {
  projectId: string;
  revision: number;
  playheadTicks: number;
  lang: string;
  client: Client;
  t: Translate;
  onSaved: (projectId: string, from: number, revision: number) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Cue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const caller = useRef(client);
  const at = useRef(revision);
  at.current = revision;

  const load = async () => {
    const refs = (await caller.current.call("yamakan.document.list", {
      projectId,
    })) as { id: string; kind: string; contentHash: string }[];
    const read = await Promise.all(
      refs
        .filter((r) => r.kind === "captions")
        .map(async (r) => {
          const doc = (await caller.current.call("yamakan.document.get", {
            projectId,
            documentId: r.id,
          })) as { content: Omit<Track, "id" | "contentHash"> };
          return { ...doc.content, id: r.id, contentHash: r.contentHash };
        }),
    );
    setTracks(read);
    return read;
  };
  useEffect(() => {
    let current = true;
    load().catch((e) => {
      if (current) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      current = false;
    };
  }, [projectId, revision]);

  const track = tracks.find((x) => x.id === selected) ?? null;
  const cues = draft ?? track?.cues ?? [];

  // Runs one command; the editor's draft then moves to the new revision.
  const commit = async (operation: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const from = at.current;
    try {
      const saved = (await caller.current.call(operation, {
        projectId,
        expectedRevision: from,
        ...args,
      })) as Saved;
      onSaved(projectId, from, saved.project.revision);
      setDraft(null);
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File, language: string) => {
    if (file.size > 512 * 1024) {
      setError(t("captions.tooLarge"));
      return;
    }
    const format = /\.vtt$/i.test(file.name) ? "vtt" : "srt";
    const documentId = crypto.randomUUID();
    const saved = await commit("yamakan.captions.import", {
      documentId,
      expectedContentHash: null,
      name: file.name.replace(/\.(srt|vtt)$/i, "").slice(0, 120) || "Captions",
      language,
      format,
      text: await file.text(),
    });
    if (saved) setSelected(documentId);
  };

  const download = async (format: "srt" | "vtt") => {
    if (!track) return;
    const out = (await caller.current.call("yamakan.captions.export", {
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
    a.download = `${track.name}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const edit = (id: string, patch: Partial<Cue>) =>
    setDraft(cues.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <section data-testid="captions-panel" aria-label={t("captions.title")}>
      <h3>{t("captions.title")}</h3>
      <label>
        {t("captions.import")}
        <input
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          data-testid="captions-file"
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void importFile(file, lang === "ar" ? "ar" : "en");
          }}
        />
      </label>
      {tracks.length ? (
        <label>
          {t("captions.track")}
          <select
            data-testid="captions-track"
            value={selected ?? ""}
            onChange={(e) => {
              setSelected(e.currentTarget.value || null);
              setDraft(null);
            }}
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
              disabled={busy}
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
              {cues.map((c) => {
                const inside =
                  playheadTicks > c.startTicks && playheadTicks < c.endTicks;
                return (
                  <tr key={c.id} data-cue={c.id}>
                    <td>
                      <input
                        key={`s${c.startTicks}`}
                        type="number"
                        step={0.001}
                        min={0}
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
                        defaultValue={seconds(c.endTicks)}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = ticksOf(e.currentTarget.value);
                          if (v === null)
                            e.currentTarget.value = seconds(c.endTicks);
                          else if (v !== c.endTicks)
                            edit(c.id, { endTicks: v });
                        }}
                      />
                    </td>
                    <td>
                      <textarea
                        dir="auto"
                        rows={Math.min(4, c.text.split("\n").length)}
                        maxLength={500}
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
                        disabled={busy || !inside || draft !== null}
                        title={t("captions.splitHint")}
                        onClick={() =>
                          void commit("yamakan.captions.split", {
                            documentId: track.id,
                            expectedContentHash: track.contentHash,
                            cueId: c.id,
                            atTicks: playheadTicks,
                            newCueId: crypto.randomUUID(),
                          })
                        }
                      >
                        {t("captions.split")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            <button
              type="button"
              data-testid="captions-save"
              disabled={busy || draft === null}
              onClick={() =>
                void commit("yamakan.captions.save", {
                  documentId: track.id,
                  expectedContentHash: track.contentHash,
                  cues,
                })
              }
            >
              {t("captions.save")}
            </button>{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => void download("srt")}
            >
              {t("captions.exportSrt")}
            </button>{" "}
            <button
              type="button"
              disabled={busy}
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
