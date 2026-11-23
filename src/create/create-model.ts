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

export {
  DIRECTIONS,
  DIRECTION_KINDS,
  type DirectionKind,
} from "../../core/prompts/directions.ts";
import {
  DIRECTIONS,
  DIRECTION_KINDS,
  type DirectionKind,
} from "../../core/prompts/directions.ts";
import type { MessageKey } from "../i18n.ts";

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

// The still a run started from, by the version the page knows; none without one.
export const picturePins = (
  picture: { id: string } | undefined,
  findAsset: (id: string) => { hash: string } | undefined,
) => {
  const hash = picture ? findAsset(picture.id)?.hash : undefined;
  return picture && hash ? [{ assetId: picture.id, assetHash: hash }] : [];
};

export const validSeed = (seed: number) =>
  Number.isInteger(seed) && seed >= 0 && seed <= 2 ** 32 - 1;

// A kept brief is read back as untrusted: anything wrong falls to the default.
export function readBrief(raw: string | null): CreateBrief {
  const brief = emptyBrief();
  if (!raw) return brief;
  try {
    const kept = JSON.parse(raw);
    if (typeof kept?.prompt === "string")
      // Never half a character.
      brief.prompt = kept.prompt
        .slice(0, PROMPT_LIMIT)
        .replace(/[\uD800-\uDBFF]$/, "");
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
  // The project's media a run started here was made from, such as its first frame. A
  // receipt file brought in by hand names none.
  inputs?: { assetId: string; assetHash: string }[];
  // The receipt's own prompt, where this page cut it: null when it is too long to record.
  wholePrompt?: string | null;
};
// The longest prompt a take's record takes (core/engines/contract-v2.ts).
export const DECLARED_PROMPT_LIMIT = 4000;

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
    ...(r.prompt.length > PROMPT_LIMIT
      ? {
          wholePrompt:
            r.prompt.length > DECLARED_PROMPT_LIMIT ? null : r.prompt,
        }
      : {}),
  };
}

export async function sha256Of(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// How a run ended without a usable video, as the service says it.
export type RunOutcome = {
  failureClass?: string;
  mayStillBeBilled?: boolean;
  retry?: string;
};

const FAIL_LINES: Readonly<Record<string, MessageKey>> = Object.freeze({
  refusedByPolicy: "create.failRefused",
  quotaExhausted: "create.failQuota",
  credentialRejected: "create.failCredential",
  contentRefused: "create.failContent",
  providerRejected: "create.failRejected",
  resourceExhausted: "create.failResource",
  timeout: "create.failTimeout",
  lostJob: "create.failLost",
  invalidArtifact: "create.failInvalid",
  cancelled: "create.failCancelled",
  unknown: "create.failUnknown",
});
const RETRY_LINES: Readonly<Record<string, MessageKey>> = Object.freeze({
  afterChange: "create.retryAfterChange",
  afterWaiting: "create.retryAfterWaiting",
  afterChecking: "create.retryAfterChecking",
  whenWanted: "create.retryWhenWanted",
});

/** What to say of it: which kind of end, what it may have used, and what trying again takes. */
export function outcomeLines(
  o: RunOutcome,
  // Stopped here, and not known to have ended there.
  mayStillRun = false,
): MessageKey[] {
  if (o.failureClass === undefined) return [];
  const kind = Object.hasOwn(FAIL_LINES, o.failureClass)
    ? o.failureClass
    : "unknown";
  const retry = o.retry ?? "";
  return [
    FAIL_LINES[kind]!,
    // Where it is not known, nothing is said of it.
    ...(o.mayStillBeBilled === undefined
      ? []
      : [
          !o.mayStillBeBilled
            ? ("create.billNot" as const)
            : mayStillRun
              ? ("create.billStill" as const)
              : ("create.billMay" as const),
        ]),
    Object.hasOwn(RETRY_LINES, retry)
      ? RETRY_LINES[retry]!
      : "create.retryAfterChecking",
  ];
}

// What a person is asked to approve before anything is sent (MPR-204), and how it stands.
export type GateKind = "egress" | "spend";
export type GateStateName =
  | "approved"
  | "missing"
  | "expired"
  | "revoked"
  | "exhausted"
  | "voided"
  | "changed";
export type GateRouteInfo = {
  route: "kaggle";
  host: string;
  account: string;
  network: { proxyConfigured: boolean; certificateOverride: boolean };
  run: { bytes: number; seconds: number };
  gates: {
    kind: GateKind;
    state: GateStateName;
    runsLeft: number;
    uses: number;
  }[];
};
export type GateApprovalRow = {
  id: string;
  kind: GateKind;
  host: string;
  account: string;
  expiresAt: number;
  state: GateStateName;
  runsLeft: number;
};
export type GateAnswer = {
  approvals: GateApprovalRow[];
  route: GateRouteInfo | null;
};
// What the page proposes; a person types more.
export const GATE_PROPOSAL = Object.freeze({ runs: 1, hours: 1 });
const HOUR_MS = 3_600_000;

/** Whether a start would be let through as far as approvals go. */
export const gatesOpen = (route: GateRouteInfo) =>
  route.gates.length === 2 && route.gates.every((g) => g.state === "approved");

/** Whether a run that has left may be followed: an approval that is only used up still lets it. */
export const contactOpen = (route: GateRouteInfo) =>
  route.gates.some(
    (g) =>
      g.kind === "egress" &&
      (g.state === "approved" || (g.state === "exhausted" && g.uses > 0)),
  );
/**
 * The approvals that count, to be shown and taken back: the newest of each kind of this route's
 * account, while it still allows anything or would again under its own settings. The service
 * gives the newest first, and an older one never counts again.
 */
export function approvalsInForce({ approvals, route }: GateAnswer) {
  if (!route) return [];
  return (["egress", "spend"] as const).flatMap((kind) => {
    const newest = approvals.find(
      (a) =>
        a.kind === kind && a.host === route.host && a.account === route.account,
    );
    return newest &&
      (newest.state === "approved" ||
        newest.state === "changed" ||
        newest.state === "exhausted")
      ? [newest]
      : [];
  });
}

export const validRuns = (runs: number) =>
  Number.isInteger(runs) && runs >= 1 && runs <= 1_000;
export const validHours = (hours: number) =>
  Number.isInteger(hours) && hours >= 1 && hours <= 366 * 24;

/** The approvals that one press of the button records: contacting, and using unless only a run
 * is to be followed. Under the network settings the person was shown. */
export function approvalRequests(
  route: GateRouteInfo,
  { runs, hours }: { runs: number; hours: number },
  kinds: readonly GateKind[] = ["egress", "spend"],
) {
  if (!validRuns(runs) || !validHours(hours))
    throw new Error("An approval is out of its range.");
  return kinds.map((kind) => ({
    kind,
    route: route.route,
    network: route.network,
    host: route.host,
    account: route.account,
    purpose: "generation" as const,
    ttlMs: hours * HOUR_MS,
    limit: {
      runs,
      units: runs * (kind === "egress" ? route.run.bytes : route.run.seconds),
    },
  }));
}

type Line = { key: MessageKey; vars?: Record<string, string | number> };
/** What an approval would allow, in words. */
export function approvalLines(
  route: GateRouteInfo,
  { runs, hours }: { runs: number; hours: number },
  kinds: readonly GateKind[] = ["egress", "spend"],
): Line[] {
  const { host, account, run } = route;
  const minutes = Math.ceil(run.seconds / 60);
  return [
    ...(kinds.includes("spend")
      ? [
          {
            key: "create.gateContact" as const,
            vars: {
              host,
              account,
              runs,
              megabytes: Math.ceil(run.bytes / 1_000_000),
            },
          },
          { key: "create.gateUse" as const, vars: { runs, minutes } },
        ]
      : [{ key: "create.gateFollow" as const, vars: { host, account } }]),
    { key: "create.gateUntil", vars: { hours } },
    { key: "create.gateMayEnd", vars: { minutes } },
    { key: "create.gateHosts" },
    ...(route.network.proxyConfigured
      ? [{ key: "create.gateProxy" as const }]
      : []),
    ...(route.network.certificateOverride
      ? [{ key: "create.gateCertificate" as const }]
      : []),
  ];
}
/** Why the page asks again, where there was an approval. */
export const gateReasons = (
  route: GateRouteInfo,
  kinds: readonly GateKind[] = ["egress", "spend"],
): MessageKey[] => [
  ...new Set(
    route.gates.flatMap((g): MessageKey[] =>
      g.state === "approved" || !kinds.includes(g.kind)
        ? []
        : [`create.gateState.${g.state}`],
    ),
  ),
];
