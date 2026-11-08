// What the Create workspace knows, apart from how it looks: the models that have
// really been run, the words a direction adds to a prompt, and a run's receipt.
// Nothing here runs a model.

export type CreateModel = {
  id: string;
  name: string;
  licence: string;
  // What has been run and looked at, not what the model might be able to do.
  width: number;
  height: number;
  frames: number;
  fps: number;
  steps: number;
  // Loading and generating, from its run. Loading was the first on that disk.
  secondsToMake: number;
  // What its notebook always asks to avoid, or null.
  negativePrompt: string | null;
  // About how many words of a prompt it reads, when that is less than a prompt can hold: its
  // text encoder stops there, saying so only in the run's log, and was trained on English. Null
  // when it reads a whole prompt.
  readsAboutWords: number | null;
  folder: string;
};

export const CREATE_MODELS: readonly CreateModel[] = Object.freeze([
  {
    id: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    name: "Wan2.2-TI2V-5B",
    licence: "Apache-2.0",
    width: 704,
    height: 480,
    frames: 81,
    fps: 24,
    steps: 30,
    secondsToMake: 1132,
    negativePrompt: "blurry, low quality, distorted, static",
    readsAboutWords: null,
    folder: "scripts/kaggle/wan22-ti2v-5b",
  },
  {
    id: "zai-org/CogVideoX-2b",
    name: "CogVideoX-2b",
    licence: "Apache-2.0",
    width: 720,
    height: 480,
    frames: 49,
    fps: 8,
    steps: 50,
    secondsToMake: 1125,
    negativePrompt: null,
    // 226 tokens of an English T5 encoder, which is the pipeline's default and its notebook's.
    readsAboutWords: 150,
    folder: "scripts/kaggle/cogvideox-2b",
  },
]);

// Neither model takes camera settings. A direction is only words in the prompt, so
// each choice here is the words it adds, and the model may not follow them.
export const DIRECTIONS = Object.freeze({
  shot: {
    wide: "wide shot",
    medium: "medium shot",
    close: "close-up",
    aerial: "aerial view",
  },
  movement: {
    still: "static camera",
    pan: "slow pan",
    push: "slow push in",
    pull: "slow pull back",
    handheld: "handheld camera",
    orbit: "camera orbits the subject",
  },
  lens: {
    wide: "wide-angle lens",
    normal: "50mm lens",
    tele: "telephoto lens",
    macro: "macro lens",
  },
  light: {
    morning: "soft morning light",
    golden: "golden hour light",
    night: "night, low light",
    studio: "soft studio lighting",
  },
});
export type DirectionKind = keyof typeof DIRECTIONS;
export const DIRECTION_KINDS = Object.keys(DIRECTIONS) as DirectionKind[];

export type CreateBrief = {
  prompt: string;
  modelId: string;
  seed: number;
  direction: Partial<Record<DirectionKind, string>>;
};

export const PROMPT_LIMIT = 2000;
export const RECEIPT_BYTE_LIMIT = 1024 * 1024;
// Checking reads the whole video into this page's memory.
export const VIDEO_CHECK_BYTE_LIMIT = 512 * 1024 * 1024;

export const emptyBrief = (): CreateBrief => ({
  prompt: "",
  modelId: CREATE_MODELS[0].id,
  seed: 42,
  direction: {},
});

const directionWords = (kind: DirectionKind, choice: string | undefined) => {
  const words = DIRECTIONS[kind] as Record<string, string>;
  return choice !== undefined && Object.hasOwn(words, choice)
    ? words[choice]
    : null;
};

// The exact text a model would be given. A model may not read all of it: see readsAboutWords.
export function composePrompt(brief: CreateBrief) {
  const base = brief.prompt.trim();
  const words = DIRECTION_KINDS.map((kind) =>
    directionWords(kind, brief.direction[kind]),
  ).filter((w): w is string => w !== null);
  if (words.length === 0) return base;
  if (!base) return words.join(", ");
  return `${base.replace(/[.,;:\s]+$/, "")}. ${words.join(", ")}.`;
}

// The project's stills a run from a picture can start from: what the service takes, a PNG or
// JPEG, by the name it was imported under. The service checks again.
export const startingStills = (
  assets: readonly { id: string; kind: string; name: string }[],
) =>
  assets
    .filter((a) => a.kind === "image" && /\.(png|jpe?g)$/i.test(a.name))
    .map(({ id, name }) => ({ id, name }));

// What a start sends: from a picture only with the person's word about who it shows, which
// the service also requires.
export function startRequest(r: {
  model: {
    recipeId: string;
    width: number;
    height: number;
    frames: number;
    fps: number;
  };
  prompt: string;
  seed: number;
  projectFps: number;
  picture: { id: string } | undefined;
  noPerson: boolean;
}) {
  if (r.picture && !r.noPerson)
    throw new Error("A run from a picture needs the person's word first.");
  return {
    recipeId: r.model.recipeId,
    prompt: r.prompt,
    seed: r.seed,
    width: r.model.width,
    height: r.model.height,
    durationFrames: Math.max(
      1,
      Math.floor((r.model.frames / r.model.fps) * r.projectFps),
    ),
    ...(r.picture
      ? { firstFrameAssetId: r.picture.id, noUnconsentedPerson: true as const }
      : {}),
  };
}

// What a tick was given for: this recipe, from this picture or none.
export const choiceOf = (recipeId: string, pictureId?: string) =>
  JSON.stringify([recipeId, pictureId ?? null]);

export const mayStart = (r: {
  agreed: boolean;
  picture: { id: string } | undefined;
  noPerson: boolean;
}) => r.agreed && (r.picture === undefined || r.noPerson);

export const validSeed = (seed: number) =>
  Number.isInteger(seed) && seed >= 0 && seed <= 2 ** 32 - 1;

// A kept brief is read back as untrusted: anything wrong falls to the default.
export function readBrief(raw: string | null): CreateBrief {
  const brief = emptyBrief();
  if (!raw) return brief;
  try {
    const kept = JSON.parse(raw);
    if (typeof kept?.prompt === "string")
      brief.prompt = kept.prompt.slice(0, PROMPT_LIMIT);
    if (CREATE_MODELS.some((m) => m.id === kept?.modelId))
      brief.modelId = kept.modelId;
    if (validSeed(kept?.seed)) brief.seed = kept.seed;
    for (const kind of DIRECTION_KINDS) {
      const choice = kept?.direction?.[kind];
      if (typeof choice === "string" && directionWords(kind, choice))
        brief.direction[kind] = choice;
    }
  } catch {
    // Not a brief: start again.
  }
  return brief;
}

// What a Kaggle run says it made. A receipt describes a file; it proves nothing
// until the file's own hash is compared with it.
export type RunReceipt = {
  model: string;
  revision: string;
  prompt: string;
  seed: number;
  steps: number;
  sha256: string;
  licence: string | null;
};

export function parseReceipt(text: string): RunReceipt {
  let r: any;
  try {
    r = JSON.parse(text);
  } catch {
    throw new Error("not-json");
  }
  if (r?.format !== "yamakan.generation-receipt/v1")
    throw new Error("not-receipt");
  if (r.stage !== "done" || r.verified !== true)
    throw new Error("not-finished");
  if (
    typeof r.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    typeof r.model !== "string" ||
    typeof r.revision !== "string" ||
    typeof r.prompt !== "string" ||
    !validSeed(r.seed) ||
    !Number.isInteger(r.steps) ||
    r.steps < 1 ||
    r.steps > 100_000
  )
    throw new Error("not-receipt");
  return {
    model: r.model.slice(0, 200),
    revision: r.revision.slice(0, 80),
    prompt: r.prompt.slice(0, PROMPT_LIMIT),
    seed: r.seed,
    steps: r.steps,
    sha256: r.sha256,
    licence: typeof r.license === "string" ? r.license.slice(0, 80) : null,
  };
}

export async function sha256Of(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
