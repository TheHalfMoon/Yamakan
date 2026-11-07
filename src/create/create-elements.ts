// A reusable place, prop, wardrobe, style or made-up character: one reference pack, whose
// versions a shot pins by hash. A record in the project only. Nothing here reaches a model,
// and a real person's likeness is not one of these, since that needs consent this does not
// ask for.
import { STORY_LIMITS } from "../../core/story.ts";

export const ELEMENT_ROLES = [
  "environment",
  "prop",
  "wardrobe",
  "style",
  "fictional-character",
] as const;
export type ElementRole = (typeof ELEMENT_ROLES)[number];

export const ELEMENT_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
export const ELEMENT_NAME_LIMIT = 120;

export type ElementPack = {
  format: "yamakan.reference-pack";
  formatVersion: 1;
  name: string;
  entries: {
    id: string;
    role: ElementRole;
    label: string;
    assetId: string;
    assetHash: string;
    characterId: null;
    consentId: null;
  }[];
};

export type KeptElement = {
  documentId: string;
  contentHash: string;
  pack: ElementPack;
};

export type ElementImage = { assetId: string; assetHash: string; name: string };

const cleanName = (name: string) => name.trim().slice(0, ELEMENT_NAME_LIMIT);

export const validElementName = (name: string) => cleanName(name).length > 0;

const entryOf = (
  role: ElementRole,
  image: ElementImage,
  newId: () => string,
): ElementPack["entries"][number] => ({
  id: newId(),
  role,
  label: cleanName(image.name) || "Image",
  assetId: image.assetId,
  assetHash: image.assetHash,
  characterId: null,
  consentId: null,
});

export function newElementPack(
  name: string,
  role: ElementRole,
  image: ElementImage,
  newId: () => string,
): ElementPack {
  return {
    format: "yamakan.reference-pack",
    formatVersion: 1,
    name: cleanName(name),
    entries: [entryOf(role, image, newId)],
  };
}

// Another image of the same element. "full" if it holds all it can.
export const elementIsFull = (pack: ElementPack) =>
  pack.entries.length >= STORY_LIMITS.entriesPerPack;

export function withImage(
  pack: ElementPack,
  role: ElementRole,
  image: ElementImage,
  newId: () => string,
): ElementPack | "full" {
  if (elementIsFull(pack)) return "full";
  return { ...pack, entries: [...pack.entries, entryOf(role, image, newId)] };
}

// Only what this panel can show and add to, whoever made it: one kind, with no likeness.
export function asElement(content: unknown): ElementPack | null {
  const pack = content as Partial<ElementPack> | null;
  if (pack?.format !== "yamakan.reference-pack" || !Array.isArray(pack.entries))
    return null;
  const fits = pack.entries.every(
    (e) =>
      ELEMENT_ROLES.includes(e.role) &&
      e.consentId === null &&
      e.role === pack.entries?.[0].role,
  );
  return fits && pack.entries.length > 0 ? (pack as ElementPack) : null;
}

type StoryWithPins = {
  scenes: {
    shots: {
      id: string;
      referencePacks: { documentId: string; contentHash: string }[];
    }[];
  }[];
};

const withShot = <S extends StoryWithPins>(
  story: S,
  shotId: string,
  change: (
    pins: StoryWithPins["scenes"][number]["shots"][number]["referencePacks"],
  ) => StoryWithPins["scenes"][number]["shots"][number]["referencePacks"],
): S => ({
  ...story,
  scenes: story.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) =>
      shot.id === shotId
        ? { ...shot, referencePacks: change(shot.referencePacks) }
        : shot,
    ),
  })),
});

// The element's version as it now stands, once: an older pin of it moves to this one.
// "full" if the shot already holds all it can.
export function pinElement<S extends StoryWithPins>(
  story: S,
  shotId: string,
  element: { documentId: string; contentHash: string },
): S | "full" {
  const shot = story.scenes
    .flatMap((scene) => scene.shots)
    .find((s) => s.id === shotId);
  if (!shot) return story;
  const others = shot.referencePacks.filter(
    (p) => p.documentId !== element.documentId,
  );
  if (others.length >= STORY_LIMITS.packsPerShot) return "full";
  return withShot(story, shotId, () => [
    ...others,
    {
      documentId: element.documentId,
      contentHash: element.contentHash,
    },
  ]);
}

export const unpinElement = <S extends StoryWithPins>(
  story: S,
  shotId: string,
  documentId: string,
): S =>
  withShot(story, shotId, (pins) =>
    pins.filter((p) => p.documentId !== documentId),
  );
