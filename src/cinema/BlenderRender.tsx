import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  BLENDER_FPS,
  BLENDER_ORBITS,
  BLENDER_QUALITY,
  BLENDER_SECONDS,
  BLENDER_SIZES,
  DEFAULT_BLENDER_CHOICES,
  blenderSettings,
  blenderView,
  type BlenderChoices,
  type BlenderJob,
  type BlenderView,
} from "./blenderRender.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

/** What the page gives the panel: the service's commands, and the editor's own placing. */
export type BlenderHost = {
  capability(): Promise<{ available: boolean; message?: string }>;
  start(settings: ReturnType<typeof blenderSettings>): Promise<{ id: string }>;
  status(jobId: string): Promise<BlenderJob>;
  cancel(jobId: string): Promise<unknown>;
  // Saves the editor's work, reopens the project (the new video is in it) and places the whole
  // video on the timeline: null when placed, or why it was not.
  place(assetId: string): Promise<string | null>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// A render still running when the panel is unmounted (another project opened) is followed
// again when the project's panel comes back.
const running = new Map<string, string>();

/**
 * Render the project's saved Cinema scene with Blender, then place it on the timeline. Only a
 * saved scene is rendered: the job renders what the project holds, never unsaved changes.
 * Nothing in the editor changes until the person chooses Place on timeline.
 */
export function BlenderRender({
  host,
  t,
  projectId,
  sceneSaved,
}: {
  host: BlenderHost;
  t: Translate;
  projectId: string;
  sceneSaved: boolean;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState("");
  const [choices, setChoices] = useState<BlenderChoices>(
    DEFAULT_BLENDER_CHOICES,
  );
  const [jobId, setJobId] = useState<string | null>(
    () => running.get(projectId) ?? null,
  );
  const [view, setView] = useState<BlenderView | null>(() =>
    running.has(projectId) ? { kind: "working", percent: 0 } : null,
  );
  // Why starting, following, cancelling or placing did not work, and which it was.
  const [problem, setProblem] = useState<{
    key: MessageKey;
    detail: string;
  } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    let current = true;
    host
      .capability()
      .then((c) => {
        if (!current) return;
        setAvailable(c.available);
        setUnavailable(c.message ?? "");
      })
      .catch((e: unknown) => {
        if (!current) return;
        setAvailable(false);
        setUnavailable(message(e));
      });
    return () => {
      current = false;
    };
    // The page's one host; asked once.
  }, []);

  // While a render runs, its state is read every second. A failed read is tried again, more
  // slowly, so a dropped connection does not leave the panel stuck.
  useEffect(() => {
    if (!jobId) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let misses = 0;
    const tick = async () => {
      try {
        const job = await hostRef.current.status(jobId);
        if (!current) return;
        misses = 0;
        setProblem((p) => (p?.key === "blender.lost" ? null : p));
        const next = blenderView(job);
        setView(next);
        if (next.kind === "working") timer = setTimeout(tick, 1000);
        else running.delete(projectId);
      } catch (e) {
        if (!current) return;
        misses++;
        setProblem({ key: "blender.lost", detail: message(e) });
        timer = setTimeout(tick, Math.min(10000, 1000 * 2 ** misses));
      }
    };
    void tick();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  const working = view?.kind === "working";
  const start = async () => {
    setProblem(null);
    setPlaced(false);
    setView({ kind: "working", percent: 0 });
    try {
      const job = await host.start(blenderSettings(choices));
      running.set(projectId, job.id);
      setJobId(job.id);
    } catch (e) {
      setView(null);
      setProblem({ key: "blender.failed", detail: message(e) });
    }
  };
  const place = async (assetId: string) => {
    setProblem(null);
    setPlacing(true);
    try {
      const why = await host.place(assetId);
      if (why) setProblem({ key: "blender.placeFailed", detail: why });
      else setPlaced(true);
    } finally {
      setPlacing(false);
    }
  };
  const choose = <K extends keyof BlenderChoices>(
    key: K,
    value: BlenderChoices[K],
  ) => setChoices((c) => ({ ...c, [key]: value }));

  if (available === false)
    return (
      <div className="cinema-blender" data-testid="cinema-blender">
        <strong>{t("blender.title")}</strong>
        <p data-testid="cinema-blender-unavailable">
          {t("blender.unavailable")} <bdi>{unavailable}</bdi>
        </p>
      </div>
    );

  // Announced when it changes: what the render is doing, not each percent.
  const said =
    view?.kind === "working"
      ? t("blender.rendering")
      : view?.kind === "done"
        ? placed
          ? t("blender.placed")
          : t("blender.done")
        : view?.kind === "cancelled"
          ? t("blender.cancelled")
          : "";
  const failure =
    view?.kind === "failed"
      ? (view.message ??
        t(view.noVideo ? "blender.noVideo" : "blender.unknown"))
      : null;

  return (
    <div
      className="cinema-blender"
      role="group"
      aria-labelledby="cinema-blender-title"
      data-testid="cinema-blender"
    >
      <strong id="cinema-blender-title">{t("blender.title")}</strong>
      <p className="cinema-lens-note">{t("blender.note")}</p>
      <div className="cinema-blender-choices">
        <label>
          {t("blender.size")}{" "}
          <select
            data-testid="cinema-blender-size"
            value={choices.size}
            disabled={working}
            onChange={(e) =>
              choose("size", e.target.value as BlenderChoices["size"])
            }
          >
            {Object.entries(BLENDER_SIZES).map(([key, s]) => (
              <option key={key} value={key}>
                {t("blender.sizeValue", { width: s.width, height: s.height })}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("blender.length")}{" "}
          <select
            data-testid="cinema-blender-seconds"
            value={choices.seconds}
            disabled={working}
            onChange={(e) =>
              choose(
                "seconds",
                Number(e.target.value) as BlenderChoices["seconds"],
              )
            }
          >
            {BLENDER_SECONDS.map((s) => (
              <option key={s} value={s}>
                {t("blender.seconds", { n: s })}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("blender.fps")}{" "}
          <select
            data-testid="cinema-blender-fps"
            value={choices.fps}
            disabled={working}
            onChange={(e) =>
              choose("fps", Number(e.target.value) as BlenderChoices["fps"])
            }
          >
            {BLENDER_FPS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("blender.quality")}{" "}
          <select
            data-testid="cinema-blender-quality"
            value={choices.quality}
            disabled={working}
            onChange={(e) =>
              choose("quality", e.target.value as BlenderChoices["quality"])
            }
          >
            {Object.keys(BLENDER_QUALITY).map((q) => (
              <option key={q} value={q}>
                {t(`blender.quality.${q as BlenderChoices["quality"]}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("blender.orbit")}{" "}
          <select
            data-testid="cinema-blender-orbit"
            value={choices.orbitDegrees}
            disabled={working}
            onChange={(e) =>
              choose(
                "orbitDegrees",
                Number(e.target.value) as BlenderChoices["orbitDegrees"],
              )
            }
          >
            {BLENDER_ORBITS.map((o) => (
              <option key={o} value={o}>
                {t("blender.degrees", { n: o })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cinema-objects-buttons">
        <button
          type="button"
          data-testid="cinema-blender-render"
          disabled={available !== true || !sceneSaved || working || placing}
          onClick={() => void start()}
        >
          {t("blender.render")}
        </button>
        {working && jobId ? (
          <button
            type="button"
            data-testid="cinema-blender-cancel"
            onClick={() =>
              host.cancel(jobId).catch((e: unknown) =>
                setProblem({
                  key: "blender.cancelFailed",
                  detail: message(e),
                }),
              )
            }
          >
            {t("blender.cancel")}
          </button>
        ) : null}
        {view?.kind === "done" ? (
          <button
            type="button"
            data-testid="cinema-blender-place"
            disabled={placing}
            onClick={() => void place(view.assetId)}
          >
            {t("blender.place")}
          </button>
        ) : null}
      </div>
      {!sceneSaved && available ? (
        <p data-testid="cinema-blender-save-first">{t("blender.saveFirst")}</p>
      ) : null}
      <output
        aria-live="polite"
        data-testid="cinema-blender-state"
        data-state={view?.kind ?? "idle"}
      >
        {said}
      </output>
      {view?.kind === "working" ? (
        <progress
          data-testid="cinema-blender-progress"
          max={100}
          value={view.percent}
          aria-label={t("blender.progress", { percent: view.percent })}
        >
          {view.percent}%
        </progress>
      ) : null}
      {failure !== null ? (
        <p role="alert" data-testid="cinema-blender-error">
          {t("blender.failed")} <bdi>{failure}</bdi>
        </p>
      ) : null}
      {problem ? (
        <p role="alert" data-testid="cinema-blender-problem">
          {t(problem.key)} <bdi>{problem.detail}</bdi>
        </p>
      ) : null}
    </div>
  );
}
