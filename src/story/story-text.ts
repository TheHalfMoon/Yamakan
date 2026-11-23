// What the Story page and Create know of a story's words (MPR-106): the brief, the scene scripts
// and the shot intents. Pure: each change returns a new story and keeps everything it does not
// set, the fields it does not know among them. The service checks again.
import { STORY_LIMITS } from "../../core/story.ts";
import {
  DIRECTIONS,
  DIRECTION_KINDS,
  PROMPT_LIMIT,
  readBrief,
  type CreateBrief,
  type DirectionKind,
} from "../create/create-model.ts";

// The service's numbers (core/story.ts), by string length but for the two in bytes.
export const TEXT_LIMITS = Object.freeze({
  logline: 500,
  audience: 300,
  format: 120,
  tone: 300,
  languages: STORY_LIMITS.briefLanguages,
  sceneText: 4_000,
  framing: 200,
  movement: 200,
  action: 2_000,
  dialogue: 500,
  textBytes: STORY_LIMITS.textBytes,
  documentBytes: STORY_LIMITS.documentBytes,
});

export type Brief = {
  logline?: string;
  audience?: string;
  format?: string;
  tone?: string;
  languages?: string[];
};
export type Intent = {
  framing?: string;
  movement?: string;
  action?: string;
  dialogue?: string;
  direction?: Partial<Record<DirectionKind, string>>;
};
// As much of a story as this reads. Anything else in it is carried along.
type TextShot = { id: string; name?: string; intent?: Intent };
type TextScene = {
  id: string;
  name?: string;
  sceneText?: string;
  shots: TextShot[];
};
export type TextStory = {
  formatVersion: number;
  brief?: Brief;
  scenes: TextScene[];
};

const encoder = new TextEncoder();
const bytes = (value: unknown): number =>
  typeof value === "string"
    ? encoder.encode(value).length
    : value && typeof value === "object"
      ? Object.values(value).reduce((n: number, v) => n + bytes(v), 0)
      : 0;

/** As core/story.ts counts it: the words alone, without keys or punctuation. */
export const textBytes = (story: TextStory) =>
  bytes(story.brief) +
  story.scenes.reduce(
    (n, scene) =>
      n +
      bytes(scene.sceneText) +
      scene.shots.reduce((m, shot) => m + bytes(shot.intent), 0),
    0,
  );

/** The whole story as it would be stored, at least: the service writes it without spaces. */
export const documentBytes = (story: TextStory) =>
  encoder.encode(JSON.stringify(story)).length;

/**
 * How full a story is, as a person reads it: whole percents of the nearer of its two limits, of
 * its words and of the whole story. It says 100 only when no more fits, and more when too much
 * is there already.
 */
export function fullness(story: TextStory) {
  const part = Math.max(
    textBytes(story) / TEXT_LIMITS.textBytes,
    documentBytes(story) / TEXT_LIMITS.documentBytes,
  );
  return {
    percent: part > 1 ? Math.ceil(part * 100) : Math.floor(part * 100),
    tooFull: part > 1,
  };
}

// An empty value is left out, never stored as an empty string or object.
function filled<T extends object>(value: T): T | undefined {
  const some = Object.fromEntries(
    Object.entries(value).flatMap(([key, v]): [string, unknown][] => {
      if (v === undefined || v === "") return [];
      if (Array.isArray(v)) return v.length ? [[key, v]] : [];
      if (v && typeof v === "object") {
        const inner = filled(v);
        return inner ? [[key, inner]] : [];
      }
      return [[key, v]];
    }),
  );
  return Object.keys(some).length ? (some as T) : undefined;
}
function set<T extends object, K extends string>(
  target: T,
  key: K,
  value: unknown,
): T {
  const next = { ...target } as T & Record<K, unknown>;
  if (value === undefined) delete next[key];
  else next[key] = value as (T & Record<K, unknown>)[K];
  return next;
}

/** The story with this brief. It is in the form that is written, whatever it was read in. */
export const withBrief = <S extends TextStory>(story: S, brief: Brief): S => ({
  ...set(story, "brief", filled(brief)),
  formatVersion: 2,
});
export const withScript = <S extends TextStory>(
  story: S,
  sceneId: string,
  text: string,
): S => ({
  ...story,
  formatVersion: 2,
  scenes: story.scenes.map((scene) =>
    scene.id === sceneId
      ? set(scene, "sceneText", text === "" ? undefined : text)
      : scene,
  ),
});
export const withIntent = <S extends TextStory>(
  story: S,
  shotId: string,
  intent: Intent,
): S => ({
  ...story,
  formatVersion: 2,
  scenes: story.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) =>
      shot.id === shotId ? set(shot, "intent", filled(intent)) : shot,
    ),
  })),
});

/** By whole characters, so that no emoji is cut in half and stored. */
export const upTo = (text: string, limit: number) => {
  let out = "";
  for (const point of text) {
    if (out.length + point.length > limit) break;
    out += point;
  }
  return out;
};

/** What a Create draft means for a shot: its words and its direction. Never a model or a seed. */
export const draftToIntent = (draft: CreateBrief): Intent =>
  filled({
    action: upTo(draft.prompt, Math.min(PROMPT_LIMIT, TEXT_LIMITS.action)),
    direction: { ...draft.direction },
  }) ?? {};

/**
 * The draft to offer to keep in the project's story, or null: there is one, the project has a
 * shot to put it in, and the person has not answered yet.
 */
export function draftOffer(
  stored: string | null,
  stories: readonly TextStory[],
  answered: boolean,
): CreateBrief | null {
  if (answered || !stored) return null;
  const draft = readBrief(stored);
  if (draft.prompt.trim() === "") return null;
  return stories.some((s) => s.scenes.some((scene) => scene.shots.length > 0))
    ? draft
    : null;
}

/** A shot's direction in words, and a choice that is no longer on the list as it is. */
export const directionText = (direction: Intent["direction"]): string[] =>
  DIRECTION_KINDS.flatMap((kind) => {
    const choice = direction?.[kind];
    if (choice === undefined) return [];
    const words: Record<string, string> = DIRECTIONS[kind];
    return [Object.hasOwn(words, choice) ? words[choice]! : choice];
  });

// One text of the story that the page edits.
export const BRIEF_FIELDS = [
  "logline",
  "audience",
  "format",
  "languages",
  "tone",
] as const;
export const SHOT_FIELDS = [
  "framing",
  "movement",
  "action",
  "dialogue",
] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];
export type ShotField = (typeof SHOT_FIELDS)[number];
export type Field =
  | { at: "brief"; name: BriefField }
  | { at: "scene"; id: string }
  | { at: "shot"; id: string; name: ShotField };
export const fieldKey = (field: Field) =>
  field.at === "brief"
    ? `brief:${field.name}`
    : field.at === "scene"
      ? `scene:${field.id}`
      : `shot:${field.id}:${field.name}`;

/** What the story holds there, or null when its scene or shot is gone. */
export function fieldText(story: TextStory, field: Field): string | null {
  if (field.at === "brief")
    return field.name === "languages"
      ? (story.brief?.languages ?? []).join(", ")
      : (story.brief?.[field.name] ?? "");
  if (field.at === "scene") {
    const scene = story.scenes.find((s) => s.id === field.id);
    return scene ? (scene.sceneText ?? "") : null;
  }
  for (const scene of story.scenes)
    for (const shot of scene.shots)
      if (shot.id === field.id) return shot.intent?.[field.name] ?? "";
  return null;
}

// What a person has typed and not saved, by field: what the story said when they began, and what
// they want it to say. The story itself may move on under it.
export type Edit = { field: Field; was: string; now: string };
export type Edits = Record<string, Edit>;

/** The edits after typing `now` there. A field put back as the story has it is no edit. */
export function edit(
  edits: Edits,
  story: TextStory,
  field: Field,
  now: string,
): Edits {
  const key = fieldKey(field);
  const held = fieldText(story, field) ?? "";
  const next = { ...edits };
  if (now === held) delete next[key];
  else next[key] = { field, was: edits[key]?.was ?? held, now };
  return next;
}

/** What is left to save once the story reads as it now does. */
export const stillToSave = (edits: Edits, story: TextStory): Edits =>
  Object.fromEntries(
    Object.entries(edits).filter(
      ([, e]) => (fieldText(story, e.field) ?? null) !== e.now,
    ),
  );

/** The edits that have a place in the story. */
export const editsThatFit = (edits: Edits, story: TextStory): Edits =>
  Object.fromEntries(
    Object.entries(edits).filter(([, e]) => fieldText(story, e.field) !== null),
  );

/** Edits whose text the story holds differently from when they began, and what it says now. */
export const changedUnder = (edits: Edits, story: TextStory) =>
  Object.values(edits).flatMap((e) => {
    const says = fieldText(story, e.field);
    return says === e.was ? [] : [{ ...e, says }];
  });

export const languagesOf = (text: string) =>
  text.split(/[\s,\u060C]+/).filter((tag) => tag !== "");
/** Whether the service takes these language tags. */
export function languagesFit(text: string) {
  const tags = languagesOf(text);
  return (
    tags.length <= TEXT_LIMITS.languages &&
    tags.every(
      (tag) =>
        tag.length <= 35 && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag),
    ) &&
    new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length
  );
}

/** The story with what was typed in it, and everything else as it is. */
export function withEdits<S extends TextStory>(story: S, edits: Edits): S {
  let next = story;
  for (const { field, now } of Object.values(edits)) {
    if (field.at === "brief")
      next = withBrief(next, {
        ...next.brief,
        [field.name]: field.name === "languages" ? languagesOf(now) : now,
      });
    else if (field.at === "scene") next = withScript(next, field.id, now);
    else {
      const shot = next.scenes
        .flatMap((scene) => scene.shots)
        .find((s) => s.id === field.id);
      if (shot)
        next = withIntent(next, field.id, {
          ...shot.intent,
          [field.name]: now,
        });
    }
  }
  return next;
}
