import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  DIRECTIONS,
  DIRECTION_KINDS,
  type DirectionKind,
} from "../../core/prompts/directions.ts";
import { blenderView, type BlenderView } from "../cinema/blenderRender.ts";
import { shotChoices, withRenderedTake, type KeptStory } from "./cinemaShot.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};

/** What the page gives the panel beside its client: placing under the editor's busy state. */
export type CinemaShotHost = {
  // Saves the story with the take (the editor's work first) and puts it on the timeline: the
  // story assembled if none of it is there yet, else the shot's clip switched to the new take.
  // Null when placed, or why not.
  place(next: {
    documentId: string;
    expectedContentHash: string;
    story: KeptStory["story"];
    shotId: string;
    takeId: string;
  }): Promise<string | null>;
};

type Step =
  | "idle"
  | "started"
  | "rendering"
  | "rendered"
  | "awaiting"
  | "approved"
  | "placed";

// An approval lasts a day: long enough to place the shot, short enough not to linger.
const APPROVAL_MS = 24 * 60 * 60 * 1000;

/**
 * The cinema-blender Director pipeline on the page: a story shot is planned as a Cinema scene
 * from its direction and rendered with Blender on this computer; the person watches the video
 * and approves it (only the browser session can); it then becomes the shot's take and the story
 * goes on the timeline. What the render cannot follow is said, never faked.
 */
export function CinemaShot({
  projectId,
  revision,
  client,
  host,
  t,
}: {
  projectId: string;
  revision: number | null;
  client: Client;
  host: CinemaShotHost;
  t: Translate;
}) {
  const caller = useRef(client);
  caller.current = client;
  const call = <T,>(op: string, args: Record<string, unknown>) =>
    caller.current.call(op, args) as Promise<T>;

  const [stories, setStories] = useState<KeptStory[] | null>(null);
  const [choice, setChoice] = useState("");
  const [direction, setDirection] = useState<
    Partial<Record<DirectionKind, string>>
  >({});
  const [step, setStep] = useState<Step>("idle");
  const [run, setRun] = useState<{ id: string; version: number } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [view, setView] = useState<BlenderView | null>(null);
  const [planned, setPlanned] = useState<{
    followed: string[];
    notFollowed: string[];
  } | null>(null);
  const [made, setMade] = useState<{ assetId: string; hash: string } | null>(
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);

  // The project's stories, read again when the project moves.
  useEffect(() => {
    let current = true;
    (async () => {
      const refs = await call<{ id: string; kind: string }[]>(
        "yamakan.document.list",
        { projectId },
      );
      const found: KeptStory[] = [];
      for (const ref of refs.filter((r) => r.kind === "story")) {
        const read = await call<{
          contentHash: string;
          content: KeptStory["story"];
        }>("yamakan.document.get", { projectId, documentId: ref.id });
        found.push({
          documentId: ref.id,
          contentHash: read.contentHash,
          story: read.content,
        });
      }
      if (current) setStories(found);
    })().catch(() => current && setStories([]));
    return () => {
      current = false;
    };
  }, [projectId, revision]);

  // While the render runs, its state is read every second.
  useEffect(() => {
    if (!jobId) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const job = await call<Parameters<typeof blenderView>[0]>(
          "yamakan.job.status",
          { jobId },
        );
        if (!current) return;
        const next = blenderView(job);
        setView(next);
        if (next.kind === "working") timer = setTimeout(tick, 1000);
        else if (next.kind === "done") {
          const project = await call<{
            assets: { id: string; hash: string }[];
          }>("yamakan.project.open", { projectId });
          const asset = project.assets.find((a) => a.id === next.assetId);
          if (current && asset) {
            setMade({ assetId: asset.id, hash: asset.hash });
            setStep("rendered");
          }
        }
      } catch (e) {
        if (current) setProblem(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  const act = async (fn: () => Promise<void>) => {
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };
  const choices = stories ? shotChoices(stories) : [];
  const chosen = choices.find((c) => `${c.documentId}/${c.shotId}` === choice);
  const label = [
    ...Object.entries(direction).map(([k, v]) => `${k} ${v}`),
  ].join(", ");

  return (
    <section
      className="director-cinema"
      aria-labelledby="director-cinema-title"
      data-testid="director-cinema"
      data-step={step}
      data-run={run?.id ?? ""}
    >
      <strong id="director-cinema-title">{t("directorCinema.title")}</strong>
      <p className="note">{t("directorCinema.note")}</p>
      {stories && !choices.length ? (
        <p data-testid="director-cinema-no-shots">
          {t("directorCinema.noShots")}
        </p>
      ) : null}
      <div className="director-cinema-choices">
        <label>
          {t("directorCinema.shot")}
          <select
            value={choice}
            disabled={step === "rendering"}
            data-testid="director-cinema-story-shot"
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">{t("directorCinema.chooseShot")}</option>
            {choices.map((c) => (
              <option
                key={`${c.documentId}/${c.shotId}`}
                value={`${c.documentId}/${c.shotId}`}
              >
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {DIRECTION_KINDS.map((kind) => (
          <label key={kind}>
            {t(`create.direction.${kind}`)}
            <select
              value={direction[kind] ?? ""}
              disabled={step === "rendering"}
              data-testid={`director-cinema-${kind}`}
              onChange={(e) => {
                const { [kind]: _gone, ...others } = direction;
                setDirection(
                  e.target.value
                    ? { ...others, [kind]: e.target.value }
                    : others,
                );
              }}
            >
              <option value="">{t("create.direction.none")}</option>
              {Object.entries(DIRECTIONS[kind]).map(([key, words]) => (
                <option key={key} value={key}>
                  {words}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="cinema-objects-buttons">
        <button
          type="button"
          data-testid="director-cinema-render"
          disabled={!chosen || step === "rendering" || step === "awaiting"}
          onClick={() =>
            void act(async () => {
              if (!chosen) return;
              // A new run for each shot rendered: its record is this shot's.
              const started = await call<{ id: string; version: number }>(
                "yamakan.director.start",
                { projectId, pipelineName: "cinema-blender" },
              );
              setRun({ id: started.id, version: started.version });
              setMade(null);
              setPlanned(null);
              const answer = await call<{
                job: { id: string };
                followed: string[];
                notFollowed: string[];
              }>("yamakan.director.renderShot", {
                runId: started.id,
                storyDocumentId: chosen.documentId,
                shotId: chosen.shotId,
                direction,
              });
              setPlanned({
                followed: answer.followed,
                notFollowed: answer.notFollowed,
              });
              setView({ kind: "working", percent: 0 });
              setStep("rendering");
              setJobId(answer.job.id);
            })
          }
        >
          {t("directorCinema.render")}
        </button>
        {step === "rendered" && made && run ? (
          <button
            type="button"
            data-testid="director-cinema-review"
            onClick={() =>
              void act(async () => {
                // The run records the video and waits for the person.
                const next = await call<{ version: number }>(
                  "yamakan.director.advance",
                  {
                    runId: run.id,
                    stage: "render",
                    status: "awaiting_human",
                    outputHash: made.hash,
                    expectedVersion: run.version,
                  },
                );
                setRun({ ...run, version: next.version });
                setStep("awaiting");
              })
            }
          >
            {t("directorCinema.sendForApproval")}
          </button>
        ) : null}
        {step === "awaiting" && made && run ? (
          <button
            type="button"
            data-testid="director-cinema-approve"
            onClick={() =>
              void act(async () => {
                const next = await call<{ version: number }>(
                  "yamakan.director.approve",
                  {
                    runId: run.id,
                    stage: "render",
                    outputHash: made.hash,
                    ttlMs: APPROVAL_MS,
                    expectedVersion: run.version,
                  },
                );
                setRun({ ...run, version: next.version });
                setStep("approved");
              })
            }
          >
            {t("directorCinema.approve")}
          </button>
        ) : null}
        {step === "approved" && made && run && chosen ? (
          <button
            type="button"
            data-testid="director-cinema-place"
            onClick={() =>
              void act(async () => {
                const kept = stories?.find(
                  (s) => s.documentId === chosen.documentId,
                );
                if (!kept) throw new Error(t("directorCinema.storyGone"));
                const takeId = crypto.randomUUID();
                const next = withRenderedTake(kept.story, chosen.shotId, {
                  id: takeId,
                  assetId: made.assetId,
                  outputHash: made.hash,
                  label: `Blender: ${label || "default"}`,
                });
                if ("refused" in next)
                  throw new Error(
                    t(
                      next.refused === "full"
                        ? "directorCinema.takesFull"
                        : "directorCinema.storyGone",
                    ),
                  );
                const why = await host.place({
                  documentId: kept.documentId,
                  expectedContentHash: kept.contentHash,
                  story: next,
                  shotId: chosen.shotId,
                  takeId,
                });
                if (why) throw new Error(why);
                const done = await call<{ version: number }>(
                  "yamakan.director.advance",
                  {
                    runId: run.id,
                    stage: "place",
                    status: "completed",
                    outputHash: made.hash,
                    expectedVersion: run.version,
                  },
                );
                setRun({ ...run, version: done.version });
                setStep("placed");
              })
            }
          >
            {t("directorCinema.place")}
          </button>
        ) : null}
      </div>
      {planned ? (
        <p data-testid="director-cinema-planned">
          {planned.followed.length
            ? t("directorCinema.followed", {
                list: planned.followed.join(", "),
              })
            : null}{" "}
          {planned.notFollowed.length ? (
            <span data-testid="director-cinema-not-followed">
              {t("directorCinema.notFollowed", {
                list: planned.notFollowed.join(", "),
              })}
            </span>
          ) : null}
        </p>
      ) : null}
      <output
        aria-live="polite"
        data-testid="director-cinema-state"
        data-state={step}
      >
        {step === "rendering"
          ? t("blender.rendering")
          : step === "rendered"
            ? t("directorCinema.rendered")
            : step === "awaiting"
              ? t("directorCinema.awaiting")
              : step === "approved"
                ? t("directorCinema.approved")
                : step === "placed"
                  ? t("directorCinema.placed")
                  : ""}
      </output>
      {view?.kind === "working" ? (
        <progress
          max={100}
          value={view.percent}
          aria-label={t("blender.progress", { percent: view.percent })}
          data-testid="director-cinema-progress"
        />
      ) : null}
      {view?.kind === "failed" || view?.kind === "cancelled" ? (
        <p role="alert" data-testid="director-cinema-failed">
          {t("blender.failed")}{" "}
          <bdi>
            {view.kind === "failed"
              ? (view.message ?? t("blender.unknown"))
              : t("blender.cancelled")}
          </bdi>
        </p>
      ) : null}
      {problem ? (
        <p role="alert" data-testid="director-cinema-problem">
          <bdi>{problem}</bdi>
        </p>
      ) : null}
    </section>
  );
}
