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
  // Re-reads the project so its new video is in the editor.
  refresh(): Promise<void>;
  // Places a whole video on the timeline; null when placed, or why it could not be.
  place(assetId: string): string | null;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Render the project's saved Cinema scene with Blender, then place it on the timeline. Only a
 * saved scene is rendered: the job renders what the project holds, never unsaved changes.
 */
export function BlenderRender({
  host,
  t,
  sceneSaved,
}: {
  host: BlenderHost;
  t: Translate;
  sceneSaved: boolean;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState("");
  const [choices, setChoices] = useState<BlenderChoices>(
    DEFAULT_BLENDER_CHOICES,
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [view, setView] = useState<BlenderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const refreshed = useRef<string | null>(null);
  // The page's newest host: its refresh and place read the editor as it is now.
  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    host
      .capability()
      .then((c) => {
        setAvailable(c.available);
        setUnavailable(c.message ?? "");
      })
      .catch((e: unknown) => {
        setAvailable(false);
        setUnavailable(message(e));
      });
    // The page's one host; asked once.
  }, []);

  // While a render runs, its state is read every second.
  useEffect(() => {
    if (!jobId) return;
    let current = true;
    const tick = async () => {
      try {
        const job = await hostRef.current.status(jobId);
        if (!current) return;
        const next = blenderView(job);
        setView(next);
        if (next.kind === "working") setTimeout(tick, 1000);
        else if (next.kind === "done" && refreshed.current !== jobId) {
          // The new video joins the editor's project before it can be placed.
          refreshed.current = jobId;
          await hostRef.current.refresh();
        }
      } catch (e) {
        if (current) setError(message(e));
      }
    };
    void tick();
    return () => {
      current = false;
    };
  }, [jobId]);

  const working = view?.kind === "working";
  const start = async () => {
    setError(null);
    setPlaced(null);
    setView({ kind: "working", percent: 0 });
    try {
      const job = await host.start(blenderSettings(choices));
      setJobId(job.id);
    } catch (e) {
      setView(null);
      setError(message(e));
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
          disabled={available !== true || !sceneSaved || working}
          onClick={() => void start()}
        >
          {t("blender.render")}
        </button>
        {working && jobId ? (
          <button
            type="button"
            data-testid="cinema-blender-cancel"
            onClick={() =>
              host.cancel(jobId).catch((e: unknown) => setError(message(e)))
            }
          >
            {t("blender.cancel")}
          </button>
        ) : null}
        {view?.kind === "done" ? (
          <button
            type="button"
            data-testid="cinema-blender-place"
            disabled={placed === "yes"}
            onClick={() => {
              const why = host.place(view.assetId);
              if (why) setError(why);
              else setPlaced("yes");
            }}
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
        {view?.kind === "working"
          ? t("blender.working", { percent: view.percent })
          : view?.kind === "done"
            ? placed === "yes"
              ? t("blender.placed")
              : t("blender.done")
            : view?.kind === "cancelled"
              ? t("blender.cancelled")
              : ""}
      </output>
      {view?.kind === "failed" || error ? (
        <p role="alert" data-testid="cinema-blender-error">
          {t("blender.failed")}{" "}
          <bdi>{view?.kind === "failed" ? view.message : error}</bdi>
        </p>
      ) : null}
    </div>
  );
}
