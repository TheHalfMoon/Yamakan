// A made video's record in the project: one shot with one take, in a story of its
// own. So what a receipt showed stays with the project, in backups too, and Story's
// take tools can use it. The shot being written stays a draft in this browser.
import { STORY_LIMITS } from "../../core/story.ts";
import type { RunReceipt } from "./create-model.ts";

// Distinct, so that a person's own story is not taken for this one.
export const CREATE_STORY_TITLE = "Made in Create";
const NAME_LIMIT = 120;
const NOTE_LIMIT = 2000;

type Take = {
  id: string;
  assetId: string;
  sourceStartTicks: number;
  lineage: {
    label: string;
    outputHash: string;
    inputs: { assetId: string; assetHash: string }[];
  };
  // The record of how it was made, which the service writes.
  recordHash?: string;
};
type Shot = {
  id: string;
  name: string;
  durationTicks: number;
  notes: string;
  referencePacks: { documentId: string; contentHash: string }[];
  takes: Take[];
  selectedTakeId: string | null;
};
export type CreateStory = {
  format: "yamakan.story";
  formatVersion: 2;
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

// By whole characters, so that no emoji is cut in half and stored.
const upTo = (text: string, limit: number) => {
  let out = "";
  for (const point of text) {
    if (out.length + point.length > limit) break;
    out += point;
  }
  return out;
};

const shotName = (prompt: string) => {
  const line = prompt.trim().split(/\r?\n/)[0] || "Shot";
  return line.length > NAME_LIMIT ? `${upTo(line, NAME_LIMIT - 1)}…` : line;
};

// The story with this video added, or why not.
export function addMadeVideo(
  story: CreateStory | null,
  video: {
    assetId: string;
    assetHash: string;
    durationTicks: number;
    receipt: RunReceipt;
  },
  newId: () => string,
): CreateStory | "already-there" | "full" {
  const current: CreateStory = story ?? {
    format: "yamakan.story",
    formatVersion: 2,
    title: CREATE_STORY_TITLE,
    scenes: [],
  };
  const shots = current.scenes.flatMap((s) => s.shots);
  if (shots.some((s) => s.takes.some((t) => t.assetId === video.assetId)))
    return "already-there";
  if (shots.length >= STORY_LIMITS.shots) return "full";
  const last = current.scenes.at(-1);
  const room = last && last.shots.length < STORY_LIMITS.shotsPerScene;
  if (!room && current.scenes.length >= STORY_LIMITS.scenes) return "full";
  const { receipt } = video;
  const tail = video.assetHash === receipt.sha256 ? "" : CONVERTED;
  // What matters first, so that a long name cannot push it out.
  const label = `seed ${receipt.seed}, steps ${receipt.steps}, ${receipt.model}`;
  const takeId = newId();
  const shot: Shot = {
    id: newId(),
    name: shotName(receipt.prompt),
    durationTicks: video.durationTicks,
    notes: upTo(receipt.prompt, NOTE_LIMIT),
    referencePacks: [],
    takes: [
      {
        id: takeId,
        assetId: video.assetId,
        sourceStartTicks: 0,
        lineage: {
          label: `${upTo(label, NAME_LIMIT - tail.length)}${tail}`,
          outputHash: video.assetHash,
          // A take made from a picture names it, so its record does not read as if made
          // from the prompt alone.
          inputs: (receipt.inputs ?? []).map(({ assetId, assetHash }) => ({
            assetId,
            assetHash,
          })),
        },
      },
    ],
    selectedTakeId: takeId,
  };
  return {
    ...current,
    // A story kept in the older form is written in this one.
    formatVersion: 2,
    scenes: room
      ? [
          ...current.scenes.slice(0, -1),
          { ...last, shots: [...last.shots, shot] },
        ]
      : [
          ...current.scenes,
          { id: newId(), name: CREATE_STORY_TITLE, shots: [shot] },
        ],
  };
}

// What the service makes a video's take record from: its run here, or the receipt's claims.
export type TakeRecordSource =
  | { generationId: string }
  | {
      declared: {
        model: string;
        revision?: string;
        prompt: string;
        seed: number;
        steps: number;
        licence?: string;
      };
    };
export type TakeRecordRequest = { takeId: string; from: TakeRecordSource };

// The records to ask for with a story that now holds this video: its take's, from the run
// that made it, else from its receipt. A receipt that names no model, or whose prompt is too
// long to record, has none to declare.
export function recordRequests(
  story: CreateStory,
  assetId: string,
  receipt: RunReceipt,
  generationId?: string,
): TakeRecordRequest[] {
  const take = story.scenes
    .flatMap((s) => s.shots.flatMap((shot) => shot.takes))
    .find((t) => t.assetId === assetId);
  if (!take || take.recordHash) return [];
  if (generationId) return [{ takeId: take.id, from: { generationId } }];
  if (!receipt.model || receipt.wholePrompt === null) return [];
  return [
    {
      takeId: take.id,
      from: {
        declared: {
          model: receipt.model,
          ...(receipt.revision ? { revision: receipt.revision } : {}),
          prompt: receipt.wholePrompt ?? receipt.prompt,
          seed: receipt.seed,
          steps: receipt.steps,
          ...(receipt.licence ? { licence: receipt.licence } : {}),
        },
      },
    },
  ];
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
