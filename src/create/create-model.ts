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
  secondsToMake: number;
  folder: string;
};

export const CREATE_MODELS: readonly CreateModel[] = Object.freeze([
  {
    id: "zai-org/CogVideoX-2b",
    name: "CogVideoX-2b",
    licence: "Apache-2.0",
    width: 720,
    height: 480,
    frames: 49,
    fps: 8,
    steps: 50,
    secondsToMake: 1051,
    folder: "scripts/kaggle/cogvideox-2b",
  },
  {
    id: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    name: "Wan2.2-TI2V-5B",
    licence: "Apache-2.0",
    width: 704,
    height: 480,
    frames: 41,
    fps: 24,
    steps: 30,
    secondsToMake: 353,
    folder: "scripts/kaggle/wan22-ti2v-5b",
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

// The exact text a model would be given.
export function composePrompt(brief: CreateBrief) {
  const base = brief.prompt.trim();
  const words = DIRECTION_KINDS.map((kind) =>
    directionWords(kind, brief.direction[kind]),
  ).filter((w): w is string => w !== null);
  if (words.length === 0) return base;
  if (!base) return words.join(", ");
  return `${base.replace(/[.,;:\s]+$/, "")}. ${words.join(", ")}.`;
}

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
  if (r.stage !== "done") throw new Error("not-finished");
  if (
    typeof r.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    typeof r.model !== "string" ||
    typeof r.revision !== "string" ||
    typeof r.prompt !== "string" ||
    !Number.isInteger(r.seed) ||
    !Number.isInteger(r.steps)
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

// Kept receipts, by the hash of the video they describe.
export function readReceipts(raw: string | null): Record<string, RunReceipt> {
  const kept: Record<string, RunReceipt> = {};
  if (!raw) return kept;
  try {
    const all = JSON.parse(raw);
    for (const [hash, value] of Object.entries(all ?? {})) {
      const receipt = parseReceipt(
        JSON.stringify({
          ...(value as object),
          format: "yamakan.generation-receipt/v1",
          stage: "done",
          license: (value as RunReceipt).licence,
        }),
      );
      if (receipt.sha256 === hash) kept[hash] = receipt;
    }
  } catch {
    // Not receipts: none kept.
  }
  return kept;
}
