import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectSchema } from "../core/project.ts";
import { RESOURCE_POLICY } from "../core/command/policy.ts";
import type { Project } from "../core/project.ts";
import type { RenderJob } from "../core/render.ts";
import type { ProjectHistory } from "../core/store.ts";
import Timeline from "./editor/components/Timeline";
import PreviewPlayer from "./editor/components/PreviewPlayer";
import type { TimelineClip } from "./editor/types";
import {
  createHistoryState,
  pushHistoryState,
  undoHistoryState,
  redoHistoryState,
} from "./editor/utils/historyState";
import { editorView } from "./adapter";
import { preferProxies, proxiesPreferred, useEditProxies } from "./proxies.ts";
import { ReferencePreview } from "./reference.tsx";
import { previewParity } from "../core/render/parity.ts";
import {
  direction,
  initialLang,
  saveLang,
  translate,
  formatNumber,
  formatDate,
  formatPercent,
  formatSeconds,
} from "./i18n.ts";
import type { Lang, MessageKey } from "./i18n.ts";
import {
  applyLocal,
  deleteClip,
  FRAME_TICKS,
  setClipAnimation,
  setClipSound,
  splitClip,
  updateClips as applyClipUpdates,
} from "./edit-ops.ts";
import { operationsBetween, touched } from "./edit-diff.ts";
import { ANIMATION_ENABLED } from "../core/animation/flags.ts";
import { YamakanClient, YamakanError } from "../sdk/client.ts";
import { mediaUrl, sessionHeaders, startSession } from "./session.ts";
import { StudioCanvas } from "./studio/StudioCanvas.tsx";
import type { StudioClient } from "./studio/host/persistence.ts";
import { CinemaViewport } from "./cinema/CinemaViewport.tsx";
import { DirectorPanel } from "./director/DirectorPanel.tsx";
import type {
  Operation,
  OperationInput,
  OperationResult,
} from "../sdk/client.ts";
import "./editor/editor.css";
import "./style.css";
// The UI is a same-origin client of the shared command registry; its session
// cookie identifies the browser-ui principal.
const client = new YamakanClient({ headers: sessionHeaders });
// A status line: a message key (re-translated when the language changes)
// or text from elsewhere (service errors), shown as given.
type Status =
  string | { key: MessageKey; vars?: Record<string, string | number> };
const msg = (key: MessageKey, vars?: Record<string, string | number>) => ({
  key,
  vars,
});
const call = <O extends Operation>(
  operation: O,
  parameters: OperationInput<O>,
) => client.call(operation, parameters);
function App() {
  // Interface language: Arabic lays the page out right to left; the
  // timeline keeps left-to-right time.
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
  // Applied before paint, so an Arabic page never shows left to right
  // first; the choice is stored only when the user makes it.
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = direction(lang);
  }, [lang]);
  const [history, setHistory] = useState<ReturnType<
      typeof createHistoryState<Project>
    > | null>(null),
    [projects, setProjects] = useState<any[]>([]),
    [message, setMessage] = useState<Status>(msg("status.initial")),
    [busy, setBusy] = useState(false),
    // null until edited: the default name follows the interface language.
    [name, setName] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [playhead, setPlayhead] = useState(0),
    [playing, setPlaying] = useState(false),
    [snapping, setSnapping] = useState(true),
    [activeTrack, setActiveTrack] = useState<string | null>(null),
    [job, setJob] = useState<RenderJob | null>(null),
    [tools, setTools] = useState(false),
    [catalog, setCatalog] = useState<string | null>(null),
    [downloadedDraft, setDownloadedDraft] = useState<Project | null>(null),
    // A change a conflict kept from being applied, offered for download.
    [unapplied, setUnapplied] = useState<Project | null>(null),
    [revisionHistory, setRevisionHistory] = useState<ProjectHistory | null>(
      null,
    ),
    // Workspace backups, loaded on request.
    [backups, setBackups] =
      useState<OperationResult<"yamakan.workspace.backups"> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const p = history?.present;
  // The latest history, also between renders: every change goes through
  // putHistory, and commits read their draft here, so a commit chained
  // behind another never pairs a new head with a stale draft (YU-015).
  const historyNow = useRef(history);
  const putHistory = (
    next: typeof history | ((h: typeof history) => typeof history),
  ) => {
    const value =
      typeof next === "function"
        ? (next as (h: typeof history) => typeof history)(historyNow.current)
        : next;
    historyNow.current = value;
    setHistory(value);
  };
  const current = {
    get current() {
      return historyNow.current?.present;
    },
  };
  // The service's head of the open project: what the editor's change is
  // made from, and what a commit compares and swaps against (YU-015).
  const head = useRef<Project | null>(null);
  // Which opening of a project the head belongs to: opening, switching or
  // restoring starts a new one (a Studio save only moves the revision).
  const headGen = useRef(0);
  const refresh = async () =>
    setProjects(await call("yamakan.project.list", {}));
  useEffect(() => {
    refresh().catch((e) =>
      setMessage(
        // No session: the page was opened without its launch link.
        e instanceof YamakanError && e.code === "UNAUTHENTICATED"
          ? msg("session.locked")
          : e.message,
      ),
    );
  }, []);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("error.operation"));
    } finally {
      setBusy(false);
    }
  };
  const edit = (fn: (p: Project) => Project) => {
    if (busy) return;
    putHistory((h) => {
      if (!h) return h;
      try {
        return pushHistoryState(h, ProjectSchema.parse(fn(h.present)));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : t("error.edit"));
        return h;
      }
    });
  };
  const accept = (project: Project) => {
    const opened = ProjectSchema.parse(project);
    head.current = opened;
    headGen.current++;
    setUnapplied(null);
    putHistory(createHistoryState(opened));
    setMessage(
      msg("status.opened", { name: project.name, revision: project.revision }),
    );
    setSelected(null);
    setPlayhead(0);
    setPlaying(false);
    setRevisionHistory(null);
    setDownloadedDraft(null);
  };
  // Commits the editor's pending change as one batch of the typed
  // operations agents and tools use, compare-and-swap on the head it was
  // made from (YU-015). A change those operations cannot express exactly
  // stays a draft, for an explicit full save. Commits run one at a time;
  // editing goes on meanwhile, and what was edited during a commit is kept
  // on top of it and committed next.
  type Outcome = "unchanged" | "committed" | "draft" | "conflict";
  const committing = useRef<Promise<Outcome> | null>(null);
  const commit = (): Promise<Outcome> => {
    if (committing.current)
      return committing.current.then(
        () => commit(),
        () => commit(),
      );
    const work = commitOnce();
    committing.current = work;
    void work
      .finally(() => {
        if (committing.current === work) committing.current = null;
      })
      .catch(() => {});
    return work;
  };
  // Edits made on `from` (since it was committed), carried onto `onto`; null
  // when they do not apply there.
  const carry = (from: Project, to: Project, onto: Project) => {
    if (from === to) return onto;
    const later = operationsBetween(from, to);
    if (!later) return null;
    try {
      return later.length ? applyLocal(onto, later) : onto;
    } catch {
      return null;
    }
  };
  const commitOnce = async (): Promise<Outcome> => {
    const base = head.current,
      draft = current.current,
      gen = headGen.current;
    if (!base || !draft || base.id !== draft.id || base === draft)
      return "unchanged";
    const operations = operationsBetween(base, draft);
    if (operations === null) {
      setMessage(msg("status.draftNeedsSave"));
      return "draft";
    }
    if (!operations.length) {
      // A change undone by the next one: nothing is pending.
      putHistory((h) =>
        h && h.present === draft ? createHistoryState(base) : h,
      );
      return "unchanged";
    }
    const send = (revision: number, requestId: string) =>
      client.call(
        "yamakan.project.applyBatch",
        { projectId: base.id, expectedRevision: revision, operations },
        requestId,
      );
    let committed: Project;
    try {
      const requestId = crypto.randomUUID();
      // A lost response is asked again under the same request id, which
      // the service answers with the original result.
      committed = ProjectSchema.parse(
        await send(base.revision, requestId).catch((e) => {
          if (e instanceof YamakanError) throw e;
          return send(base.revision, requestId);
        }),
      );
    } catch (e) {
      if (!(e instanceof YamakanError && e.code === "REVISION_CONFLICT"))
        throw e;
      // Another writer moved the project. The change is applied to the
      // current version when its operations still apply there; otherwise
      // the current version is shown and the change is kept for download.
      // Nothing is overwritten.
      const fresh = ProjectSchema.parse(
        await call("yamakan.project.open", { projectId: base.id }),
      );
      // The editor moved on (another project, a restore): leave it be.
      if (headGen.current !== gen) return "unchanged";
      // Merged only when the two changes touch different things: the
      // other writer's edit to the same clip, track or scene is never
      // replaced by this one.
      const theirs = operationsBetween(base, fresh);
      const disjoint =
        theirs !== null &&
        ![...touched(operations)].some((id) => touched(theirs).has(id));
      let merged: Project | null = null;
      let applies = disjoint;
      try {
        if (applies) applyLocal(fresh, operations);
      } catch {
        applies = false;
      }
      if (applies) {
        const mergeId = crypto.randomUUID();
        try {
          merged = ProjectSchema.parse(
            await send(fresh.revision, mergeId).catch((e) => {
              if (e instanceof YamakanError) throw e;
              return send(fresh.revision, mergeId);
            }),
          );
        } catch (e) {
          // Refused by the service: kept for download. A lost connection
          // is an error, not a conflict (the batch may have landed).
          if (!(e instanceof YamakanError)) throw e;
          merged = null;
        }
      }
      if (headGen.current !== gen) return "unchanged";
      if (!merged) {
        head.current = fresh;
        setUnapplied(current.current ?? draft);
        putHistory(createHistoryState(fresh));
        setMessage(msg("status.conflictReloaded"));
        return "conflict";
      }
      committed = merged;
      setMessage(msg("status.mergedAfterConflict"));
    }
    // The editor moved on during the commit (another project, a restore,
    // a reload): the commit stands on the service; the editor is left be.
    if (headGen.current !== gen) return "unchanged";
    head.current = committed;
    const now = current.current;
    // What was edited during the commit, on top of the committed head.
    const carried = now && now !== draft ? carry(draft, now, committed) : null;
    const kept = carried === committed ? null : carried;
    putHistory(
      kept
        ? { past: [committed], present: kept, future: [] }
        : createHistoryState(committed),
    );
    // (What was kept is committed next: the [p] effect schedules it.)
    if (!kept && now === draft)
      setMessage(msg("status.saved", { revision: committed.revision }));
    return "committed";
  };
  // A finished gesture is committed once the pointer is released and the
  // editor has been still for a moment, so a drag or a slider becomes one
  // revision, not one per movement.
  const held = useRef(false);
  const pending = useRef<number | undefined>(undefined);
  const commitSoon = () => {
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      if (held.current) return commitSoon();
      if (!head.current || current.current === head.current) return;
      commit().catch((e) =>
        setMessage(e instanceof Error ? e.message : t("error.operation")),
      );
    }, 400);
  };
  useEffect(() => {
    const down = () => {
      held.current = true;
    };
    // A release outside the window (or leaving it) also ends the gesture.
    const up = () => {
      held.current = false;
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") held.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("blur", up);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("blur", up);
      document.removeEventListener("visibilitychange", hidden);
      window.clearTimeout(pending.current);
    };
  }, []);
  useEffect(() => {
    if (p && head.current && p !== head.current) commitSoon();
  }, [p]);
  const save = async () => {
    if (!current.current) return;
    window.clearTimeout(pending.current);
    const outcome = await commit();
    if (outcome === "conflict") return;
    if (outcome !== "draft") {
      await refresh();
      if (head.current)
        setMessage(msg("status.saved", { revision: head.current.revision }));
      return head.current ?? undefined;
    }
    const saved = await call("yamakan.project.save", {
      project: current.current,
      expectedRevision: current.current.revision,
    });
    accept(saved);
    await refresh();
    setMessage(msg("status.saved", { revision: saved.revision }));
    return saved as Project;
  };
  const sequenceDuration = p
    ? Math.max(0, ...p.clips.map((c) => (c.startFrame + c.durationFrames) / 30))
    : 0;
  useEffect(() => {
    if (!playing || !p) return;
    const start = performance.now(),
      at = playhead,
      total = sequenceDuration;
    const timer = setInterval(() => {
      const pos = at + (performance.now() - start) / 1000;
      setPlayhead(Math.min(total, pos));
      if (pos >= total) setPlaying(false);
    }, 33);
    return () => clearInterval(timer);
  }, [playing, p?.id, sequenceDuration]);
  useEffect(() => {
    if (!job || ["COMPLETED", "FAILED", "CANCELLED"].includes(job.state))
      return;
    const timer = setInterval(() => {
      call("yamakan.job.status", { jobId: job.id })
        .then(setJob)
        .catch((e) => {
          setMessage(e.message);
          clearInterval(timer);
        });
    }, 500);
    return () => clearInterval(timer);
  }, [job?.id, job?.state]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (history && history.past.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [history]);
  // Edit proxies for the preview (YU-017): the viewer's choice, per browser.
  const [proxiesOn, setProxiesOn] = useState(proxiesPreferred);
  const proxies = useEditProxies(
    p?.id ?? null,
    p ? p.assets.filter((a) => a.kind === "video").map((a) => a.id) : [],
    proxiesOn,
    (operation, parameters) =>
      client.call(operation as never, parameters as never),
  );
  // While playing, the preview keeps the files it started with: a proxy
  // that becomes ready (or the toggle) takes effect at the next pause, so
  // no clip's media element is replaced mid-play.
  const shownProxies = useRef<ReadonlySet<string>>(new Set());
  if (!playing) shownProxies.current = proxiesOn ? proxies.ready : new Set();
  const view = p ? editorView(p, shownProxies.current) : null;
  const addAsset = (assetId: string, trackId?: string, time?: number) =>
    edit((p) => {
      const a = p.assets.find((a) => a.id === assetId);
      if (!a) throw new Error(t("error.assetMissing"));
      const kind = a.kind === "audio" ? "audio" : "video";
      const track = trackId
        ? p.tracks.find((x) => x.id === trackId)
        : p.tracks.find(
            (x) => x.id === activeTrack && x.kind === kind && !x.locked,
          ) ||
          p.tracks.find((x) => x.targeted && x.kind === kind && !x.locked) ||
          p.tracks.find((x) => x.kind === kind && !x.locked);
      if (!track || track.locked || track.kind !== kind)
        throw new Error(t("error.track"));
      const start =
        time === undefined
          ? Math.max(
              0,
              ...p.clips
                .filter((c) => c.trackId === track.id)
                .map((c) => c.startFrame + c.durationFrames),
            )
          : Math.round(time * 30);
      const clip = {
        id: crypto.randomUUID(),
        trackId: track.id,
        assetId: a.id,
        startFrame: start,
        durationFrames:
          a.kind === "image" ? 90 : Math.min(a.durationFrames, 150),
        sourceFrame: 0,
        title: null as string | null,
        ...(a.kind === "video"
          ? {
              sound: {
                enabled: a.hasAudio === true,
                gainDb: 0,
                fadeInFrames: 0,
                fadeOutFrames: 0,
              },
            }
          : {}),
      };
      return { ...p, clips: [...p.clips, clip] };
    });
  const updateClips = (updates: TimelineClip[]) =>
    edit((p) => applyClipUpdates(p, updates));
  return (
    <div className="app">
      <header>
        <div className="identity">
          <span className="mark" aria-hidden="true">
            Y
          </span>
          <div>
            <strong>YAMAKAN</strong>
            <small>{t("brand.tagline")}</small>
          </div>
        </div>
        <nav>
          <button onClick={() => setTools(false)} aria-pressed={!tools}>
            {t("nav.production")}
          </button>
          <button onClick={() => setTools(true)} aria-pressed={tools}>
            {t("nav.tools")}
          </button>
        </nav>
        <span className="badge">{t("badge.local")}</span>
        {/* The visible text (the other language's name) is the accessible
            name; it is marked with its own language. */}
        <button
          type="button"
          className="language"
          title={t("lang.label")}
          onClick={() => {
            const next = lang === "ar" ? "en" : "ar";
            saveLang(next);
            setLang(next);
          }}
        >
          <span lang={lang === "ar" ? "en" : "ar"}>{t("lang.switch")}</span>
        </button>
      </header>
      <div role="status" className="status" dir="auto">
        {busy
          ? t("status.working")
          : typeof message === "string"
            ? message
            : t(message.key, message.vars)}
      </div>
      <div className="workspace">
        <aside>
          <h2>{t("projects.title")}</h2>
          <label>
            {t("projects.name")}
            <input
              dir="auto"
              value={name ?? t("projects.defaultName")}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (history?.past.length) await save();
                accept(
                  await call("yamakan.project.create", {
                    name: name ?? t("projects.defaultName"),
                  }),
                );
                await refresh();
              })
            }
          >
            {t("projects.create")}
          </button>
          <div className="project-list">
            {projects.map((item) => (
              <div key={item.id}>
                <button
                  disabled={busy || item.error}
                  onClick={() =>
                    run(async () => {
                      if (history?.past.length) await save();
                      accept(
                        await call("yamakan.project.open", {
                          projectId: item.id,
                        }),
                      );
                    })
                  }
                >
                  <bdi>{item.name}</bdi>
                  <small dir="auto">
                    {item.error ||
                      t("projects.revision", { revision: item.revision })}
                  </small>
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setRevisionHistory(
                        await call("yamakan.project.history", {
                          projectId: item.id,
                        }),
                      );
                    })
                  }
                >
                  {t("projects.history")}
                </button>
              </div>
            ))}
          </div>
          <section className="backups" aria-label={t("backups.title")}>
            <h2>{t("backups.title")}</h2>
            <p className="note">{t("backups.note")}</p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const made = await call("yamakan.workspace.backup", {});
                  setBackups(await call("yamakan.workspace.backups", {}));
                  setMessage(
                    made.damaged
                      ? msg("backups.madeDamaged", { count: made.damaged })
                      : msg("backups.made"),
                  );
                })
              }
            >
              {t("backups.create")}
            </button>
            {!backups && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    setBackups(await call("yamakan.workspace.backups", {})),
                  )
                }
              >
                {t("backups.show")}
              </button>
            )}
            {backups && backups.length === 0 && <p>{t("backups.none")}</p>}
            {backups && backups.length > 0 && (
              <ul className="backup-list">
                {backups.map((b) => (
                  <li key={b.backupId}>
                    {b.complete ? (
                      <>
                        <span>
                          {t("backups.summary", {
                            date: formatDate(lang, b.createdAt),
                            projects: b.projects,
                            size: Math.max(1, Math.ceil(b.bytes / 1e6)),
                          })}
                        </span>
                        {b.damaged > 0 && (
                          <small className="error">
                            {t("backups.damaged", { count: b.damaged })}
                          </small>
                        )}
                        {b.creative !== "complete" && (
                          <small className="note">
                            {t("backups.partialScope")}
                          </small>
                        )}
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const restored = await call(
                                "yamakan.workspace.restore",
                                { backupId: b.backupId },
                              );
                              setMessage(
                                restored.quarantined.length
                                  ? restored.fenced?.jobsHeld
                                    ? msg("backups.restoredQuarantinedHeld", {
                                        folder: restored.root,
                                        count: restored.quarantined.length,
                                        held: restored.fenced.jobsHeld,
                                      })
                                    : msg("backups.restoredQuarantined", {
                                        folder: restored.root,
                                        count: restored.quarantined.length,
                                      })
                                  : restored.fenced?.jobsHeld
                                    ? msg("backups.restoredHeld", {
                                        folder: restored.root,
                                        count: restored.fenced?.jobsHeld,
                                      })
                                    : msg("backups.restored", {
                                        folder: restored.root,
                                      }),
                              );
                            })
                          }
                        >
                          {t("backups.restore")}
                        </button>
                      </>
                    ) : (
                      <span>{t("backups.incomplete", { id: b.backupId })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {p && (
            <>
              <h2>
                {t("assets.title")}{" "}
                <span>{formatNumber(lang, p.assets.length)}</span>
              </h2>
              <div className="file-import">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  {t("assets.import")}
                </button>
                <input
                  ref={input}
                  type="file"
                  className="file-import__native"
                  aria-label={t("assets.import")}
                  accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.wav,.mp3,.ogg"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    run(async () => {
                      await save();
                      const r = await fetch(`/api/v1/projects/${p.id}/assets`, {
                        method: "POST",
                        headers: {
                          ...sessionHeaders(),
                          "X-Asset-Name": encodeURIComponent(file.name),
                        },
                        body: file,
                      });
                      const v = await r.json();
                      if (!r.ok)
                        throw new Error(v.error?.message || t("import.failed"));
                      if (v.job) {
                        // Variable-frame-rate video: wait for its constant-rate version.
                        setMessage(
                          msg("import.converting", { name: file.name }),
                        );
                        let job = v.job;
                        // Stop waiting (the job continues) after twice the
                        // conversion time limit, queueing included.
                        const deadline =
                          Date.now() +
                          2000 * RESOURCE_POLICY.enforced.conversionWallSeconds;
                        while (
                          job.state === "QUEUED" ||
                          job.state === "RUNNING"
                        ) {
                          if (Date.now() > deadline)
                            throw new Error(
                              t("import.stillConverting", { name: file.name }),
                            );
                          await new Promise((resolve) =>
                            setTimeout(resolve, 500),
                          );
                          job = await call("yamakan.job.status", {
                            jobId: job.id,
                          });
                        }
                        if (job.state !== "COMPLETED")
                          throw new Error(job.error || t("import.incomplete"));
                        accept(
                          await call("yamakan.project.open", {
                            projectId: p.id,
                          }),
                        );
                        setMessage(
                          msg("import.converted", { name: file.name }),
                        );
                      } else {
                        accept(v.project);
                        setMessage(msg("import.done", { name: v.asset.name }));
                      }
                      await refresh();
                    });
                  }}
                />
              </div>
              <div className="asset-list">
                {p.assets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addAsset(a.id)}
                    disabled={busy}
                  >
                    {a.kind === "image" && (
                      <img
                        src={mediaUrl(
                          `/api/v1/projects/${p.id}/assets/${a.id}`,
                        )}
                        alt=""
                      />
                    )}
                    <span>
                      <bdi>{a.name}</bdi>
                      <small>
                        {t(`assets.kind.${a.kind}`)} ·{" "}
                        {t("assets.size", { kb: Math.round(a.bytes / 1024) })}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="hint">{t("hint.media")}</p>
        </aside>
        <main>
          {revisionHistory && (
            <section className="tools" aria-label={t("history.label")}>
              <h2>{t("history.title")}</h2>
              <p>
                {t("history.current", {
                  id: revisionHistory.projectId,
                  revision:
                    revisionHistory.currentRevision ?? t("history.unverified"),
                })}
              </p>
              <p>{t("history.note")}</p>
              {revisionHistory.currentRevision === null && (
                <p className="error">{t("history.unverifiable")}</p>
              )}
              {revisionHistory.snapshots.map((snapshot) => (
                <div key={snapshot.revision} className="scene">
                  <span>
                    {t("history.item", {
                      revision: snapshot.revision,
                      name: snapshot.name || snapshot.error || "",
                    })}
                  </span>
                  <button
                    disabled={
                      busy ||
                      !snapshot.verified ||
                      (!!history?.past.length &&
                        downloadedDraft !== history.present)
                    }
                    onClick={() =>
                      run(async () => {
                        accept(
                          await call("yamakan.project.restore", {
                            projectId: revisionHistory.projectId,
                            revision: snapshot.revision,
                            expectedHeadFingerprint:
                              revisionHistory.headFingerprint,
                          }),
                        );
                        await refresh();
                      })
                    }
                  >
                    {t("history.restore", { revision: snapshot.revision })}
                  </button>
                </div>
              ))}
              {history?.past.length ? (
                <>
                  <p>{t("history.saveFirst")}</p>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const draft = history.present;
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(draft, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `yamakan-draft-${draft.id}.json`;
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      setDownloadedDraft(draft);
                    }}
                  >
                    {t("history.downloadDraft")}
                  </button>
                </>
              ) : null}
              <button onClick={() => setRevisionHistory(null)}>
                {t("history.close")}
              </button>
            </section>
          )}
          {tools ? (
            <section className="tools">
              <h1>{t("tools.title")}</h1>
              <p>{t("tools.intro")}</p>
              <h2>{t("studio.title")}</h2>
              <p>{t("studio.intro")}</p>
              <StudioCanvas
                forceMount={
                  new URLSearchParams(window.location.search).get(
                    "studioQ8",
                  ) === "1"
                }
                project={p ? { id: p.id, revision: p.revision } : null}
                client={client as unknown as StudioClient}
                t={(key) => t(key)}
                onSaved={(projectId, from, revision) =>
                  // A Studio save changes only the project's documents: a
                  // draft based on the revision it replaced moves to the new
                  // revision unchanged (the service carries documents forward
                  // on its next save). A draft based on anything else is left
                  // alone, so its save still meets another writer's changes.
                  putHistory((h) => {
                    if (
                      !h ||
                      h.present.id !== projectId ||
                      h.present.revision !== from
                    )
                      return h;
                    const at = (x: Project) => ({ ...x, revision });
                    const present = at(h.present);
                    // The head moves with it (the same object when nothing
                    // is pending, so no commit follows).
                    if (head.current === h.present) head.current = present;
                    else if (
                      head.current?.id === projectId &&
                      head.current.revision === from
                    )
                      head.current = at(head.current);
                    return {
                      past: h.past.map(at),
                      present,
                      future: h.future.map(at),
                    };
                  })
                }
              />
              <h2>{t("cinema.title")}</h2>
              <p>{t("cinema.intro")}</p>
              <CinemaViewport />
              <h2>{t("director.title")}</h2>
              <p>{t("director.intro")}</p>
              <DirectorPanel
                projectId={p?.id ?? null}
                t={t}
                client={{
                  call: (operation, parameters) =>
                    client.call(operation as never, parameters as never),
                }}
              />
              <pre>npm run cli -- yamakan.project.list {"{}"}</pre>
              {/* Shown here: a new tab would hold no session. */}
              <p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      setCatalog(
                        JSON.stringify(await client.catalog(), null, 2),
                      ),
                    )
                  }
                >
                  {t("tools.catalog")}
                </button>
              </p>
              {catalog && (
                <pre className="catalog" dir="ltr">
                  {catalog}
                </pre>
              )}
              <p>{t("tools.jobs")}</p>
            </section>
          ) : p && view ? (
            <>
              {unapplied && unapplied.id === p.id ? (
                <div className="notice" role="alert">
                  <p>{t("conflict.unapplied")}</p>
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(unapplied, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `yamakan-unapplied-${unapplied.id}.json`;
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {t("conflict.download")}
                  </button>
                  <button onClick={() => setUnapplied(null)}>
                    {t("conflict.dismiss")}
                  </button>
                </div>
              ) : null}
              <div className="toolbar">
                <div>
                  <h1 dir="auto">{p.name}</h1>
                  <small>
                    {t("projects.revision", { revision: p.revision })}
                    {history.past.length ? ` · ${t("toolbar.unsaved")}` : ""}
                  </small>
                </div>
                <div className="actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      // A change not yet committed is taken back locally;
                      // committed ones by the service's history, which
                      // undoes only this writer's own steps.
                      if (history.past.length) {
                        window.clearTimeout(pending.current);
                        putHistory((h) => h && undoHistoryState(h));
                        return;
                      }
                      run(async () => {
                        const undone = ProjectSchema.parse(
                          await call("yamakan.project.undo", {
                            projectId: p.id,
                            expectedRevision:
                              head.current?.revision ?? p.revision,
                          }),
                        );
                        head.current = undone;
                        putHistory(createHistoryState(undone));
                        setMessage(
                          msg("status.saved", { revision: undone.revision }),
                        );
                      });
                    }}
                  >
                    {t("action.undo")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (history.future.length) {
                        putHistory((h) => h && redoHistoryState(h));
                        return;
                      }
                      run(async () => {
                        const redone = ProjectSchema.parse(
                          await call("yamakan.project.redo", {
                            projectId: p.id,
                            expectedRevision:
                              head.current?.revision ?? p.revision,
                          }),
                        );
                        head.current = redone;
                        putHistory(createHistoryState(redone));
                        setMessage(
                          msg("status.saved", { revision: redone.revision }),
                        );
                      });
                    }}
                  >
                    {t("action.redo")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await save();
                      })
                    }
                  >
                    {t("action.save")}
                  </button>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !p.clips.length ||
                      (job && ["QUEUED", "RUNNING"].includes(job.state)) ||
                      false
                    }
                    onClick={() =>
                      run(async () => {
                        const saved = await save();
                        if (saved)
                          setJob(
                            await call("yamakan.export.video", {
                              projectId: saved.id,
                              idempotencyKey: crypto.randomUUID(),
                            }),
                          );
                      })
                    }
                  >
                    {t("action.export")}
                  </button>
                </div>
              </div>
              <div className="production">
                <section className="preview">
                  <PreviewPlayer
                    timelineClips={view.clips}
                    timelineTracks={view.tracks}
                    mediaItems={view.media}
                    playheadPosition={playhead}
                    isPlaying={playing}
                    onTogglePlayback={() => setPlaying((x) => !x)}
                    canvasWidth={p.width}
                    canvasHeight={p.height}
                    aspectStyle={{ aspectRatio: `${p.width}/${p.height}` }}
                    showControls
                    clipStatusLabel={t("preview.clipStatus", {
                      count: view.clips.length,
                    })}
                  />
                  <div className="transport">
                    <label className="proxy-toggle">
                      <input
                        type="checkbox"
                        data-testid="proxy-toggle"
                        checked={proxiesOn}
                        onChange={(e) => {
                          setProxiesOn(e.target.checked);
                          preferProxies(e.target.checked);
                        }}
                      />{" "}
                      {t("proxy.toggle")}
                    </label>
                    <span
                      data-testid="proxy-status"
                      data-proxies-ready={proxies.ready.size}
                    >
                      {proxiesOn
                        ? t("proxy.summary", {
                            ready: proxies.ready.size,
                            total: proxies.total,
                            building: proxies.building,
                          })
                        : t("proxy.off")}
                    </span>
                    <button
                      onClick={() => setPlaying((x) => !x)}
                      disabled={!p.clips.length}
                    >
                      {playing ? t("transport.pause") : t("transport.play")}
                    </button>
                    <input
                      aria-label={t("transport.playhead")}
                      type="range"
                      min="0"
                      step={1 / 30}
                      max={Math.max(
                        1,
                        ...p.clips.map(
                          (c) => (c.startFrame + c.durationFrames) / 30,
                        ),
                      )}
                      value={playhead}
                      onChange={(e) => {
                        setPlaying(false);
                        setPlayhead(Number(e.target.value));
                      }}
                    />
                    <span>
                      {t("transport.seconds", {
                        seconds: formatSeconds(lang, playhead),
                      })}
                    </span>
                  </div>
                  {(() => {
                    // What the canvas above shows only approximately (YU-018).
                    const parity = previewParity(p);
                    return (
                      <p
                        className="parity"
                        data-testid="preview-parity"
                        data-exact={String(parity.exact)}
                        data-approximations={parity.approximations
                          .map((a) => a.kind)
                          .join(",")}
                      >
                        {parity.exact
                          ? t("parity.exact")
                          : t("parity.approximate", {
                              list: parity.approximations
                                .map((a) => t(`parity.${a.kind}`))
                                .join(lang === "ar" ? "، " : ", "),
                            })}
                      </p>
                    );
                  })()}
                  <ReferencePreview
                    projectId={p.id}
                    revision={p.revision}
                    frame={Math.round(playhead * 30)}
                    totalFrames={Math.max(
                      0,
                      ...p.clips.map((c) => c.startFrame + c.durationFrames),
                    )}
                    unsaved={history.past.length > 0}
                    playing={playing}
                    onSave={() => run(async () => void (await save()))}
                    t={t}
                  />
                </section>
                <section className="inspector">
                  <h2>{t("scene.heading")}</h2>
                  <button
                    disabled={busy}
                    onClick={() =>
                      edit((p) => ({
                        ...p,
                        scenes: [
                          ...p.scenes,
                          {
                            id: crypto.randomUUID(),
                            name: t("scene.default", {
                              n: p.scenes.length + 1,
                            }),
                            referenceAssetId:
                              p.assets.find((a) => a.kind === "image")?.id ||
                              null,
                            camera: {
                              focalLengthMm: 50,
                              shotScale: "medium",
                              movement: "static",
                            },
                          },
                        ],
                      }))
                    }
                  >
                    {t("scene.add")}
                  </button>
                  {p.scenes.map((s) => (
                    <div className="scene" key={s.id}>
                      <label>
                        {t("scene.name")}
                        <input
                          dir="auto"
                          value={s.name}
                          maxLength={120}
                          onChange={(e) =>
                            edit((p) => ({
                              ...p,
                              scenes: p.scenes.map((x) =>
                                x.id === s.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label>
                        {t("scene.focal")}
                        <input
                          type="number"
                          min="8"
                          max="300"
                          value={s.camera.focalLengthMm}
                          onChange={(e) =>
                            edit((p) => ({
                              ...p,
                              scenes: p.scenes.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      camera: {
                                        ...x.camera,
                                        focalLengthMm: Number(e.target.value),
                                      },
                                    }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label>
                        {t("scene.scale")}
                        <select
                          value={s.camera.shotScale}
                          onChange={(e) =>
                            edit((p) => ({
                              ...p,
                              scenes: p.scenes.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      camera: {
                                        ...x.camera,
                                        shotScale: e.target.value as any,
                                      },
                                    }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {(["wide", "medium", "close"] as const).map((v) => (
                            <option key={v} value={v}>
                              {t(`scene.scale.${v}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("scene.movement")}
                        <select
                          value={s.camera.movement}
                          onChange={(e) =>
                            edit((p) => ({
                              ...p,
                              scenes: p.scenes.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      camera: {
                                        ...x.camera,
                                        movement: e.target.value as any,
                                      },
                                    }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {(["static", "dolly", "pan", "orbit"] as const).map(
                            (v) => (
                              <option key={v} value={v}>
                                {t(`scene.movement.${v}`)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                  ))}
                  <p className="hint">{t("hint.camera")}</p>
                  <h2>{t("clip.sound.heading")}</h2>
                  {(() => {
                    const clip = p.clips.find((c) => c.id === selected);
                    const asset = clip?.assetId
                      ? p.assets.find((a) => a.id === clip.assetId)
                      : null;
                    const track = clip
                      ? p.tracks.find((tr) => tr.id === clip.trackId)
                      : null;
                    if (
                      !clip ||
                      clip.title !== null ||
                      track?.kind !== "video" ||
                      asset?.kind !== "video"
                    )
                      return <p className="hint">{t("clip.sound.notVideo")}</p>;
                    if (asset.hasAudio === false)
                      return <p className="hint">{t("clip.sound.noAudio")}</p>;
                    const sound = clip.sound ?? {
                      enabled: false,
                      gainDb: 0,
                      fadeInFrames: 0,
                      fadeOutFrames: 0,
                    };
                    return (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={sound.enabled}
                            disabled={busy}
                            onChange={(e) =>
                              edit((proj) =>
                                setClipSound(proj, clip.id, {
                                  enabled: e.target.checked,
                                }),
                              )
                            }
                          />{" "}
                          {t("clip.sound.enable")}
                        </label>
                        <label>
                          {t("clip.sound.gain")}
                          <input
                            type="number"
                            min={-60}
                            max={12}
                            step={0.5}
                            disabled={busy || !sound.enabled}
                            value={sound.gainDb ?? 0}
                            onChange={(e) =>
                              edit((proj) =>
                                setClipSound(proj, clip.id, {
                                  gainDb: Number(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      </>
                    );
                  })()}
                  {ANIMATION_ENABLED ? (
                    <>
                      <h2>{t("clip.animation.heading")}</h2>
                      {(() => {
                        const clip = p.clips.find((c) => c.id === selected);
                        if (!clip || clip.title !== null)
                          return (
                            <p className="hint">{t("clip.animation.none")}</p>
                          );
                        const opacity = clip.animation?.opacity?.keys ?? [];
                        const volume = clip.animation?.volume?.keys ?? [];
                        const startOp =
                          opacity.find((k) => k.time === 0)?.value ?? 1;
                        const endOp =
                          opacity.find(
                            (k) =>
                              k.time ===
                              Math.max(0, clip.durationFrames - 1) *
                                FRAME_TICKS,
                          )?.value ??
                          opacity[opacity.length - 1]?.value ??
                          1;
                        const startVol =
                          volume.find((k) => k.time === 0)?.value ?? 1;
                        const endVol =
                          volume.find(
                            (k) =>
                              k.time ===
                              Math.max(0, clip.durationFrames - 1) *
                                FRAME_TICKS,
                          )?.value ??
                          volume[volume.length - 1]?.value ??
                          1;
                        const endTicks =
                          Math.max(0, clip.durationFrames - 1) * FRAME_TICKS;
                        return (
                          <div data-testid="clip-animation-panel" key={clip.id}>
                            <p className="hint">{t("clip.animation.hint")}</p>
                            <label>
                              {t("clip.animation.startOpacity")}
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                disabled={busy}
                                defaultValue={startOp}
                                id="anim-start-opacity"
                              />
                            </label>
                            <label>
                              {t("clip.animation.endOpacity")}
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                disabled={busy}
                                defaultValue={endOp}
                                id="anim-end-opacity"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                const startEl = document.getElementById(
                                  "anim-start-opacity",
                                ) as HTMLInputElement | null;
                                const endEl = document.getElementById(
                                  "anim-end-opacity",
                                ) as HTMLInputElement | null;
                                const s = Number(startEl?.value ?? 1);
                                const e = Number(endEl?.value ?? 1);
                                edit((proj) => {
                                  const live = proj.clips.find(
                                    (c) => c.id === clip.id,
                                  );
                                  return setClipAnimation(proj, clip.id, {
                                    opacity: {
                                      keys: [
                                        {
                                          id: "opacity-start",
                                          time: 0,
                                          value: s,
                                          segmentToNext: "linear",
                                          tangentMode: "auto",
                                        },
                                        {
                                          id: "opacity-end",
                                          time: endTicks,
                                          value: e,
                                          segmentToNext: "linear",
                                          tangentMode: "auto",
                                        },
                                      ],
                                    },
                                    ...(live?.animation?.volume
                                      ? { volume: live.animation.volume }
                                      : {}),
                                  });
                                });
                              }}
                            >
                              {t("clip.animation.apply")}
                            </button>
                            <label>
                              {t("clip.animation.startVolume")}
                              <input
                                type="number"
                                min={0}
                                max={4}
                                step={0.05}
                                disabled={busy}
                                defaultValue={startVol}
                                id="anim-start-volume"
                              />
                            </label>
                            <label>
                              {t("clip.animation.endVolume")}
                              <input
                                type="number"
                                min={0}
                                max={4}
                                step={0.05}
                                disabled={busy}
                                defaultValue={endVol}
                                id="anim-end-volume"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                const startEl = document.getElementById(
                                  "anim-start-volume",
                                ) as HTMLInputElement | null;
                                const endEl = document.getElementById(
                                  "anim-end-volume",
                                ) as HTMLInputElement | null;
                                const s = Number(startEl?.value ?? 1);
                                const e = Number(endEl?.value ?? 1);
                                edit((proj) => {
                                  const live = proj.clips.find(
                                    (c) => c.id === clip.id,
                                  );
                                  return setClipAnimation(proj, clip.id, {
                                    ...(live?.animation?.opacity
                                      ? { opacity: live.animation.opacity }
                                      : {}),
                                    volume: {
                                      keys: [
                                        {
                                          id: "volume-start",
                                          time: 0,
                                          value: s,
                                          segmentToNext: "linear",
                                          tangentMode: "auto",
                                        },
                                        {
                                          id: "volume-end",
                                          time: endTicks,
                                          value: e,
                                          segmentToNext: "linear",
                                          tangentMode: "auto",
                                        },
                                      ],
                                    },
                                  });
                                });
                              }}
                            >
                              {t("clip.animation.applyVolume")}
                            </button>
                            <button
                              type="button"
                              disabled={busy || !clip.animation}
                              onClick={() =>
                                edit((proj) =>
                                  setClipAnimation(proj, clip.id, null),
                                )
                              }
                            >
                              {t("clip.animation.clear")}
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  ) : null}
                  <h2>{t("title.heading")}</h2>
                  <label>
                    {t("title.text")}
                    <input
                      dir="auto"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={500}
                    />
                  </label>
                  <button
                    disabled={!title || busy}
                    onClick={() =>
                      edit((p) => {
                        const track = {
                          id: crypto.randomUUID(),
                          name: "Titles",
                          kind: "video" as const,
                          muted: false,
                          locked: false,
                        };
                        return {
                          ...p,
                          tracks: [...p.tracks, track],
                          clips: [
                            ...p.clips,
                            {
                              id: crypto.randomUUID(),
                              trackId: track.id,
                              assetId: null,
                              startFrame: 0,
                              durationFrames: 90,
                              sourceFrame: 0,
                              title,
                            },
                          ],
                        };
                      })
                    }
                  >
                    {t("title.add")}
                  </button>
                  {job && (
                    <div className="job" role="status">
                      <strong>{t(`job.${job.state}`)}</strong>
                      <progress max="1" value={job.progress} />
                      <small>{formatPercent(lang, job.progress)}</small>
                      {["QUEUED", "RUNNING"].includes(job.state) && (
                        <button
                          onClick={() =>
                            run(async () =>
                              setJob(
                                await call("yamakan.job.cancel", {
                                  jobId: job.id,
                                }),
                              ),
                            )
                          }
                        >
                          {t("job.cancel")}
                        </button>
                      )}
                      {job.state === "COMPLETED" && (
                        <a
                          className="download"
                          href={mediaUrl(`/api/v1/jobs/${job.id}/artifact`)}
                        >
                          {t("job.download")}
                        </a>
                      )}
                      {job.error && (
                        <p className="error" dir="auto">
                          {job.error}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </div>
              {/* Time runs left to right in every interface language. */}
              <section className="timeline" dir="ltr">
                <Timeline
                  tracks={view.tracks}
                  clips={view.clips}
                  mediaItems={view.media}
                  selectedClipId={selected}
                  activeTrackId={activeTrack}
                  playheadPosition={playhead}
                  isSnappingEnabled={snapping}
                  trimMode="normal"
                  onSelectClip={setSelected}
                  onSetActiveTrack={setActiveTrack}
                  onUpdateClip={(c) => updateClips([c])}
                  onBatchUpdateClips={updateClips}
                  onPlayheadUpdate={(time) => {
                    setPlaying(false);
                    setPlayhead(time);
                  }}
                  onSnappingToggle={() => setSnapping((x) => !x)}
                  onSplitClip={(id, time) =>
                    edit((p) => splitClip(p, id, time, crypto.randomUUID()))
                  }
                  onAddTrack={(kind) =>
                    edit((p) => ({
                      ...p,
                      tracks: [
                        ...p.tracks,
                        {
                          id: crypto.randomUUID(),
                          name: kind === "video" ? "Picture" : "Audio",
                          kind,
                          muted: false,
                          locked: false,
                        },
                      ],
                    }))
                  }
                  onUpdateTrack={(id, u) =>
                    edit((p) => ({
                      ...p,
                      tracks: p.tracks.map((t) =>
                        t.id === id
                          ? {
                              ...t,
                              name: u.name ?? t.name,
                              muted: u.isMuted ?? t.muted,
                              locked: u.isLocked ?? t.locked,
                              solo: u.isSolo ?? t.solo ?? false,
                              targeted: u.isTargeted ?? t.targeted ?? false,
                            }
                          : t,
                      ),
                    }))
                  }
                  onDropMedia={addAsset}
                  onDeleteClip={() => edit((p) => deleteClip(p, selected))}
                />
              </section>
            </>
          ) : (
            <section className="empty">
              <span className="large-mark" aria-hidden="true">
                Y
              </span>
              <h1>{t("empty.title")}</h1>
              <p>{t("empty.body")}</p>
              <p>{t("empty.persist")}</p>
            </section>
          )}
        </main>
      </div>
      <footer>{t("footer")}</footer>
    </div>
  );
}
// The page starts in the chosen language and direction before React draws.
document.documentElement.lang = initialLang();
document.documentElement.dir = direction(initialLang());
void startSession().finally(() =>
  createRoot(document.getElementById("root")!).render(<App />),
);
