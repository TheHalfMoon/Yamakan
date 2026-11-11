// The Director's Cinema shot on the page (Blender integration): which story shots can be
// rendered, and the story with an approved render as a shot's take. Pure, so it is tested
// without a page; the service checks the story again when it is saved.
import type { StoryDocument } from "../../core/story.ts";

export type KeptStory = {
  documentId: string;
  contentHash: string;
  story: StoryDocument;
};

export type ShotChoice = {
  documentId: string;
  shotId: string;
  // "Story title › Scene › Shot", for the list.
  label: string;
};

/** Every shot of the project's stories, in story order. */
export function shotChoices(stories: readonly KeptStory[]): ShotChoice[] {
  return stories.flatMap((kept) =>
    kept.story.scenes.flatMap((scene) =>
      scene.shots.map((shot) => ({
        documentId: kept.documentId,
        shotId: shot.id,
        label: `${kept.story.title} › ${scene.name} › ${shot.name}`,
      })),
    ),
  );
}

// A story shot holds at most this many takes (core/story.ts STORY_LIMITS.takesPerShot).
export const TAKES_PER_SHOT = 8;

/**
 * The story with the approved render as the shot's new take, selected; or why it cannot be.
 * The take records the render's hash and what the shot was planned from.
 */
export function withRenderedTake(
  story: StoryDocument,
  shotId: string,
  take: { id: string; assetId: string; outputHash: string; label: string },
): StoryDocument | { refused: "noShot" | "full" } {
  const shot = story.scenes
    .flatMap((s) => s.shots)
    .find((s) => s.id === shotId);
  if (!shot) return { refused: "noShot" };
  if (shot.takes.length >= TAKES_PER_SHOT) return { refused: "full" };
  return {
    ...story,
    scenes: story.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((s) =>
        s.id !== shotId
          ? s
          : {
              ...s,
              takes: [
                ...s.takes,
                {
                  id: take.id,
                  assetId: take.assetId,
                  sourceStartTicks: 0,
                  lineage: {
                    label: take.label.slice(0, 120),
                    outputHash: take.outputHash,
                    inputs: [],
                  },
                },
              ],
              selectedTakeId: take.id,
            },
      ),
    })),
  };
}
