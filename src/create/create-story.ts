// A made video's record in the project: one shot with one take, in a story of its
// own. So what a receipt showed stays with the project, in backups too, and Story's
// take tools can use it. The shot being written stays a draft in this browser.
import type { RunReceipt } from "./create-model.ts";

export const CREATE_STORY_TITLE = "Create";
const NAME_LIMIT = 120;
const NOTE_LIMIT = 2000;
const SHOTS_PER_SCENE = 200;

type Take = {
  id: string;
  assetId: string;
  sourceStartTicks: number;
  lineage: {
    label: string;
    outputHash: string;
    inputs: never[];
  };
};
type Shot = {
  id: string;
  name: string;
  durationTicks: number;
  notes: string;
  referencePacks: never[];
  takes: Take[];
  selectedTakeId: string | null;
};
export type CreateStory = {
  format: "yamakan.story";
  formatVersion: 1;
  title: string;
  scenes: { id: string; name: string; shots: Shot[] }[];
};

export type MadeRecord = {
  // What the receipt said: its claims, not facts this checked.
  label: string;
  prompt: string;
  // The stored file was converted on the way in, so it is not what was checked.
  converted: boolean;
};

const CONVERTED = " (converted copy)";

const shotName = (prompt: string) => {
  const line = prompt.trim().split(/\r?\n/)[0] || "Shot";
  return line.length > NAME_LIMIT ? `${line.slice(0, NAME_LIMIT - 1)}…` : line;
};

// The story with this video added, or null if it is already there or has no room.
export function addMadeVideo(
  story: CreateStory | null,
  video: {
    assetId: string;
    assetHash: string;
    durationTicks: number;
    receipt: RunReceipt;
  },
  newId: () => string,
): CreateStory | null {
  const current: CreateStory = story ?? {
    format: "yamakan.story",
    formatVersion: 1,
    title: CREATE_STORY_TITLE,
    scenes: [{ id: newId(), name: CREATE_STORY_TITLE, shots: [] }],
  };
  const shots = current.scenes.flatMap((s) => s.shots);
  if (shots.some((s) => s.takes.some((t) => t.assetId === video.assetId)))
    return null;
  const scene = current.scenes[0];
  if (!scene || shots.length >= SHOTS_PER_SCENE) return null;
  const { receipt } = video;
  const label = `${receipt.model}, seed ${receipt.seed}, steps ${receipt.steps}`;
  const takeId = newId();
  const shot: Shot = {
    id: newId(),
    name: shotName(receipt.prompt),
    durationTicks: video.durationTicks,
    notes: receipt.prompt.slice(0, NOTE_LIMIT),
    referencePacks: [],
    takes: [
      {
        id: takeId,
        assetId: video.assetId,
        sourceStartTicks: 0,
        lineage: {
          label: `${label.slice(0, NAME_LIMIT - CONVERTED.length)}${
            video.assetHash === receipt.sha256 ? "" : CONVERTED
          }`,
          outputHash: video.assetHash,
          inputs: [],
        },
      },
    ],
    selectedTakeId: takeId,
  };
  return {
    ...current,
    scenes: [
      { ...scene, shots: [...scene.shots, shot] },
      ...current.scenes.slice(1),
    ],
  };
}

// What the project's story records, by the stored file's hash. Anything that does not
// read as such a record is left out.
export function madeRecords(story: unknown): Record<string, MadeRecord> {
  const records: Record<string, MadeRecord> = {};
  const scenes = (story as { scenes?: unknown })?.scenes;
  if (!Array.isArray(scenes)) return records;
  for (const scene of scenes)
    for (const shot of Array.isArray(scene?.shots) ? scene.shots : [])
      for (const take of Array.isArray(shot?.takes) ? shot.takes : []) {
        const { label, outputHash } = take?.lineage ?? {};
        if (typeof label !== "string" || typeof outputHash !== "string")
          continue;
        records[outputHash] = {
          label: label.endsWith(CONVERTED)
            ? label.slice(0, -CONVERTED.length)
            : label,
          prompt: typeof shot.notes === "string" ? shot.notes : "",
          converted: label.endsWith(CONVERTED),
        };
      }
  return records;
}
