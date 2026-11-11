// The Creative Director's Cinema pipeline (Blender integration): a story shot, planned as a Cinema
// scene from its direction (core/director/cinema-shot.ts), rendered by the contained Blender
// worker, approved by the person, and then placed. The Director keeps the record and the human
// gate; the render is an ordinary blender-render job, and the scene is made again from the shot's
// id and direction whenever it is needed, so no document is spent on it.
import { z } from "zod";
import { CommandError } from "../command/errors.ts";
import { Id, frameRateOf } from "../project.ts";
import type { ProjectStore } from "../store.ts";
import type { JobSupervisor } from "../jobs.ts";
import { FLICKS_PER_SECOND } from "../time.ts";
import { StoryDocumentSchema } from "../story.ts";
import { blenderSceneFromCinema } from "../blender/scene.ts";
import { DIRECTIONS } from "../prompts/directions.ts";
import {
  parsePipelineManifest,
  registerBuiltinManifest,
  type PipelineManifest,
} from "./manifest.ts";
import { loadRun } from "./runtime.ts";
import { planCinemaShot } from "./cinema-shot.ts";

export const CINEMA_BLENDER_PIPELINE = "cinema-blender";

/** Yamakan-authored: render a story shot with Blender, approve it, place it. */
export const CINEMA_BLENDER_MANIFEST: PipelineManifest = parsePipelineManifest({
  name: CINEMA_BLENDER_PIPELINE,
  version: "1.0",
  description:
    "Plan a story shot as a Cinema scene from its direction, render it with Blender on this computer, have a person approve the video, then place it.",
  category: "cinematic",
  stability: "beta",
  default_checkpoint_policy: "guided",
  stages: [
    {
      name: "render",
      produces: ["render_video"],
      tools_available: [],
      checkpoint_required: true,
      human_approval_default: true,
      success_criteria: [
        "A Blender render of the shot's planned scene joins the project, and a person approves it",
      ],
    },
    {
      name: "place",
      required_artifacts_in: ["render_video"],
      produces: ["timeline"],
      tools_available: [],
      checkpoint_required: false,
      human_approval_default: false,
      success_criteria: [
        "The approved video is the shot's take and is on the timeline",
      ],
    },
  ],
});

registerBuiltinManifest(CINEMA_BLENDER_MANIFEST);

const choices = <K extends keyof typeof DIRECTIONS>(kind: K) =>
  z.enum(Object.keys(DIRECTIONS[kind]) as [string, ...string[]]).optional();

/** A shot's direction as a command takes it: only the Create page's own kinds and choices. */
export const ShotDirectionSchema = z
  .object({
    shot: choices("shot"),
    movement: choices("movement"),
    lens: choices("lens"),
    light: choices("light"),
  })
  .strict();

export const RenderShotInputSchema = z
  .object({
    runId: Id,
    storyDocumentId: Id,
    shotId: Id,
    direction: ShotDirectionSchema,
  })
  .strict();

// The render's frame rate for the project's: Blender renders at 24, 25 or 30, so a double rate
// (48, 50, 59.94, 60) renders at its half, and the rest at the nearest.
const renderFps = (rate: { num: number; den: number }): 24 | 25 | 30 => {
  const project = rate.num / rate.den;
  const fps = project > 36 ? project / 2 : project;
  return ([24, 25, 30] as const).reduce((best, n) =>
    Math.abs(n - fps) < Math.abs(best - fps) ? n : best,
  );
};
// The longest a render may be (core/blender/scene.ts BLENDER_SCENE_LIMITS.maxFrames).
const MAX_RENDER_FRAMES = 120;

/**
 * Plans a story shot of a cinema-blender run as a Cinema scene and queues its Blender render.
 * The video joins the project when the job succeeds; the run's render stage is then recorded
 * as awaiting the person's approval, with the video's hash.
 */
export async function renderStoryShot(
  store: ProjectStore,
  queue: JobSupervisor,
  input: z.input<typeof RenderShotInputSchema>,
) {
  const a = RenderShotInputSchema.parse(input);
  const run = await loadRun(store, a.runId);
  if (run.pipelineName !== CINEMA_BLENDER_PIPELINE)
    throw new CommandError(
      "VALIDATION",
      `Shots are rendered only in a ${CINEMA_BLENDER_PIPELINE} run.`,
    );
  const project = await store.load(run.projectId);
  const ref = store
    .listDocuments(run.projectId)
    .find((d) => d.id === a.storyDocumentId);
  if (!ref || ref.kind !== "story")
    throw new CommandError("NOT_FOUND", "This project has no such story.");
  const story = StoryDocumentSchema.parse(
    JSON.parse(
      store
        .getDocument(run.projectId, a.storyDocumentId)
        .bytes.toString("utf8"),
    ),
  );
  const shot = story.scenes
    .flatMap((s) => s.shots)
    .find((s) => s.id === a.shotId);
  if (!shot) throw new CommandError("NOT_FOUND", "The story has no such shot.");
  // Only the kinds given: an unset choice is left out, not passed as undefined.
  const direction = Object.fromEntries(
    Object.entries(a.direction).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
  const seconds = shot.durationTicks / FLICKS_PER_SECOND;
  const fps = renderFps(frameRateOf(project));
  // Refused before anything runs: a render shorter than its shot could not be its take.
  if (Math.ceil(seconds * fps - 1e-9) > MAX_RENDER_FRAMES)
    throw new CommandError(
      "VALIDATION",
      `This shot lasts ${seconds.toFixed(2)} s; a Blender render here is at most ${MAX_RENDER_FRAMES} frames (${(MAX_RENDER_FRAMES / fps).toFixed(1)} s at ${fps} fps). Shorten the shot first.`,
    );
  const plan = planCinemaShot({
    shotId: shot.id,
    direction,
    seconds,
    fps,
  });
  const job = await queue.submitBlenderRender(
    run.projectId,
    blenderSceneFromCinema(plan.scene, plan.settings),
    shot.name.slice(0, 100),
  );
  return {
    job,
    shot: { id: shot.id, name: shot.name },
    scene: plan.scene,
    settings: plan.settings,
    followed: plan.followed,
    notFollowed: plan.notFollowed,
  };
}
