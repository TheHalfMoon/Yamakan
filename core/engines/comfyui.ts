// A local ComfyUI as an EngineAdapterV2. It speaks only to a loopback address,
// follows no redirect, and runs only graphs the server owns: a request names a
// recipe and fills that recipe's bindings, and no graph, node, path or URL ever
// crosses the contract. Off under ENGINE_ENABLED, when it does no IO; and this
// build pins no recipe, so nothing runs until one is qualified. Setup inspection
// follows D3voz/openjutsu lib/setup.ts (MIT); see notices/openjutsu-LICENSE.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ENGINE_ENABLED } from "./contract.ts";
import {
  AttemptFence,
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  EngineRequestV2Schema,
  Operation,
  constraintsHash,
  diagnostic,
  refusal,
  underClaim,
  type Artifact,
  type AssetRef,
  type Cancellation,
  type CapabilityV2,
  type Constraints,
  type EngineAdapterV2,
  type EngineContextV2,
  type EngineRequestV2,
  type ExecutionStatus,
  type RefusalReason,
} from "./contract-v2.ts";

export const COMFY_LIMITS = Object.freeze({
  jsonBytes: 16 * 1024 * 1024,
  uploadBytes: 2 * 1024 * 1024 * 1024,
  requestMs: 15_000,
  transferMs: 30 * 60 * 1000,
  tracked: 256,
});

export type ComfyNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};
export type ComfyGraph = Record<string, ComfyNode>;
// Where a request's value goes: a node, by its title, and one of its inputs.
export type ComfyBinding = { node: string; input: string };

export type ComfyRecipe = {
  id: string;
  operation: Operation;
  modelManifestHash: string;
  // Set once this recipe has passed on this kind of host; without it, it never
  // reports available.
  qualificationHash?: string;
  constraints: Constraints;
  graph: ComfyGraph;
  bindings: {
    prompt?: ComfyBinding;
    seed?: ComfyBinding;
    width?: ComfyBinding;
    height?: ComfyBinding;
    frames?: ComfyBinding;
    fps?: ComfyBinding;
    // By the contract's input role and control name.
    roles?: Record<string, ComfyBinding>;
    controls?: Record<string, ComfyBinding>;
  };
  // Inputs naming a model file, and so what a setup check looks for.
  modelInputs?: ComfyBinding[];
  // The node whose saved files are this recipe's output.
  outputNode: string;
};

// A stable hash of what a recipe would run.
export const comfyRecipeHash = (recipe: ComfyRecipe) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        recipe.id,
        recipe.operation,
        recipe.modelManifestHash,
        recipe.constraints,
        recipe.graph,
        recipe.bindings,
        recipe.outputNode,
      ]),
    )
    .digest("hex");

// No ComfyUI recipe is pinned in this build.
export const PINNED_COMFY_RECIPES: readonly ComfyRecipe[] = Object.freeze([]);

// Only a loopback address by number: a name could resolve elsewhere.
export function comfyBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ComfyUI's address is not a URL.");
  }
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new Error("ComfyUI must be on this machine, at a loopback address.");
  return url.origin;
}

const nodeByTitle = (graph: ComfyGraph, title: string) =>
  Object.values(graph).filter((n) => n._meta?.title === title);

function assertRecipe(recipe: ComfyRecipe) {
  const { bindings: b } = recipe;
  const all = [
    b.prompt,
    b.seed,
    b.width,
    b.height,
    b.frames,
    b.fps,
    ...Object.values(b.roles ?? {}),
    ...Object.values(b.controls ?? {}),
    ...(recipe.modelInputs ?? []),
  ].filter((x): x is ComfyBinding => Boolean(x));
  for (const { node, input } of all) {
    const found = nodeByTitle(recipe.graph, node);
    if (found.length !== 1 || !Object.hasOwn(found[0].inputs, input))
      throw new Error(`Recipe ${recipe.id} has no one ${node}.${input}.`);
  }
  if (nodeByTitle(recipe.graph, recipe.outputNode).length !== 1)
    throw new Error(`Recipe ${recipe.id} has no one ${recipe.outputNode}.`);
}

const MEDIA_BY_EXTENSION: Record<string, Artifact["mediaType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
};
const EXTENSION_BY_MEDIA: Record<AssetRef["mediaType"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "audio/wav": "wav",
  "text/vtt": "vtt",
};

// A saved file as history reports it, which is data from another process: it
// names one plain file of ComfyUI's output folder, or it is not an output.
type SavedFile = { filename: string; subfolder: string };
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,199}$/;
function savedFile(value: unknown): SavedFile | null {
  const v = value as {
    filename?: unknown;
    subfolder?: unknown;
    type?: unknown;
  } | null;
  if (!v || v.type !== "output" || typeof v.filename !== "string") return null;
  const subfolder = v.subfolder ?? "";
  if (typeof subfolder !== "string") return null;
  if (!PLAIN.test(v.filename) || v.filename.endsWith(".")) return null;
  if (
    subfolder &&
    !subfolder.split(/[\\/]/).every((s) => PLAIN.test(s) && !s.endsWith("."))
  )
    return null;
  return { filename: v.filename, subfolder };
}
const extensionOf = (name: string) =>
  name.slice(name.lastIndexOf(".") + 1).toLowerCase();

type HistoryEntry = {
  status?: { status_str?: unknown; messages?: unknown };
  outputs?: Record<string, Record<string, unknown>>;
};

type Execution = {
  recipe: ComfyRecipe;
  artifacts?: (Artifact & { file: SavedFile })[];
};

export type ComfyEngineOptions = {
  baseUrl: string;
  recipes?: readonly ComfyRecipe[];
  // Tests only: the build's ENGINE_ENABLED decides otherwise.
  enabled?: boolean;
};

export type ComfySetupProblem =
  | { kind: "unreachable" }
  | { kind: "node"; recipe: string; classType: string }
  | { kind: "model"; recipe: string; name: string };

export function createComfyEngine(options: ComfyEngineOptions) {
  const enabled = options.enabled ?? ENGINE_ENABLED;
  const base = comfyBaseUrl(options.baseUrl);
  const recipes = options.recipes ?? PINNED_COMFY_RECIPES;
  recipes.forEach(assertRecipe);
  const clientId = randomUUID();
  const fence = new AttemptFence();
  const executions = new Map<string, Execution>();
  const progress = new Map<string, number>();
  // Recipes a setup check found everything for, until the next check.
  const ready = new Set<string>();
  let socket: WebSocket | null = null;
  let closed = false;

  const call = (
    path: string,
    init: RequestInit = {},
    ms: number = COMFY_LIMITS.requestMs,
  ) =>
    fetch(`${base}${path}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(ms),
    });

  async function readBounded(res: Response, limit: number) {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.byteLength;
      if (bytes > limit) throw new Error("ComfyUI's answer is too long.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  const json = async (res: Response): Promise<unknown> =>
    JSON.parse(
      (await readBounded(res, COMFY_LIMITS.jsonBytes)).toString("utf8"),
    );

  const post = (path: string, body: unknown) =>
    call(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Real progress where the socket offers it; status works without it.
  function listen() {
    if (socket || closed || typeof WebSocket !== "function") return;
    const ws = new WebSocket(
      `${base.replace(/^http/, "ws")}/ws?clientId=${clientId}`,
    );
    socket = ws;
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string" || event.data.length > 65_536) return;
      try {
        const m = JSON.parse(event.data) as {
          type?: string;
          data?: { prompt_id?: unknown; value?: unknown; max?: unknown };
        };
        const { prompt_id: id, value, max } = m.data ?? {};
        if (
          m.type === "progress" &&
          typeof id === "string" &&
          executions.has(id) &&
          typeof value === "number" &&
          typeof max === "number" &&
          max > 0
        )
          progress.set(id, Math.min(1, Math.max(0, value / max)));
      } catch {
        // Not a message this reads; the status answer does not depend on it.
      }
    });
    const gone = () => {
      if (socket === ws) socket = null;
    };
    ws.addEventListener("close", gone);
    ws.addEventListener("error", gone);
  }

  // What this ComfyUI lacks for each recipe: node classes and model files,
  // asked one class at a time since the full list can take many seconds.
  async function checkSetup(): Promise<ComfySetupProblem[]> {
    ready.clear();
    if (!enabled) return [];
    const problems: ComfySetupProblem[] = [];
    for (const recipe of recipes) {
      const before = problems.length;
      const registry = new Map<string, Record<string, unknown> | null>();
      try {
        for (const type of new Set(
          Object.values(recipe.graph).map((n) => n.class_type),
        )) {
          const res = await call(`/object_info/${encodeURIComponent(type)}`);
          const info = res.ok
            ? ((await json(res)) as Record<string, unknown>)
            : null;
          const entry = info && Object.hasOwn(info, type) ? info[type] : null;
          registry.set(type, entry as Record<string, unknown> | null);
          if (!entry)
            problems.push({
              kind: "node",
              recipe: recipe.id,
              classType: type,
            });
        }
      } catch {
        return [{ kind: "unreachable" }];
      }
      for (const { node, input } of recipe.modelInputs ?? []) {
        const n = nodeByTitle(recipe.graph, node)[0];
        const name = n.inputs[input];
        const schema = registry.get(n.class_type)?.input as
          { required?: Record<string, unknown[]> } | undefined;
        const choices = schema?.required?.[input]?.[0];
        if (
          typeof name !== "string" ||
          !Array.isArray(choices) ||
          !choices.includes(name)
        )
          problems.push({
            kind: "model",
            recipe: recipe.id,
            name: String(name).slice(0, 200),
          });
      }
      if (problems.length === before) ready.add(recipe.id);
    }
    return problems;
  }

  const recipeFor = (operation: Operation) =>
    recipes.find((r) => r.operation === operation);

  const capabilities = (): CapabilityV2[] =>
    Operation.options.map((operation) => {
      const recipe = recipeFor(operation);
      const off = (reason: RefusalReason): CapabilityV2 => ({
        operation,
        available: false,
        reason,
        constraintsHash: constraintsHash(null),
      });
      if (!enabled) return off("ENGINE_DISABLED");
      if (!recipe) return off("RECIPE_UNKNOWN");
      if (!recipe.qualificationHash) return off("HARDWARE_UNQUALIFIED");
      if (!ready.has(recipe.id)) return off("WEIGHTS_ABSENT");
      return {
        operation,
        available: true,
        qualificationHash: recipe.qualificationHash,
        constraints: recipe.constraints,
        constraintsHash: constraintsHash(recipe.constraints),
      };
    });

  // One input to ComfyUI's input folder, streamed, its hash checked on the way:
  // a mismatch means nothing is ever submitted that names it.
  async function upload(
    request: EngineRequestV2,
    role: string,
    asset: AssetRef,
    context: EngineContextV2,
  ) {
    const boundary = `yamakan${randomBytes(16).toString("hex")}`;
    const name = `${request.attemptKey}-${request.leaseGeneration}-${role}-${randomBytes(4).toString("hex")}.${EXTENSION_BY_MEDIA[asset.mediaType]}`;
    const field = (key: string, value: string) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    const hash = createHash("sha256");
    let bytes = 0;
    const source = context.openAsset(asset);
    const body = (async function* () {
      yield Buffer.from(
        `${field("type", "input")}${field("subfolder", "yamakan")}--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${name}"\r\nContent-Type: ${asset.mediaType}\r\n\r\n`,
      );
      for await (const chunk of source) {
        bytes += chunk.byteLength;
        if (bytes > COMFY_LIMITS.uploadBytes)
          throw new Error("An input is longer than allowed.");
        hash.update(chunk);
        yield chunk;
      }
      yield Buffer.from(`\r\n--${boundary}--\r\n`);
    })();
    const res = await call(
      "/upload/image",
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        duplex: "half",
      } as unknown as RequestInit,
      COMFY_LIMITS.transferMs,
    );
    if (!res.ok) return null;
    const answer = (await json(res)) as {
      name?: unknown;
      subfolder?: unknown;
    };
    if (hash.digest("hex") !== asset.sha256) return null;
    if (typeof answer.name !== "string" || !PLAIN.test(answer.name))
      return null;
    return answer.subfolder === "yamakan"
      ? `yamakan/${answer.name}`
      : answer.name;
  }

  function buildGraph(
    recipe: ComfyRecipe,
    request: EngineRequestV2,
    uploaded: Map<string, string>,
  ) {
    const graph = structuredClone(recipe.graph);
    const set = (binding: ComfyBinding | undefined, value: unknown) => {
      if (binding)
        nodeByTitle(graph, binding.node)[0].inputs[binding.input] = value;
    };
    const { bindings: b } = recipe;
    if ("prompt" in request) set(b.prompt, request.prompt);
    if (request.seed !== undefined) set(b.seed, request.seed);
    const out = request.output;
    if (out.kind === "video") {
      set(b.width, out.width);
      set(b.height, out.height);
      set(b.fps, out.fps.num / out.fps.den);
      set(
        b.frames,
        Math.max(
          1,
          Math.round(
            (out.durationTicks * out.fps.num) / (705_600_000 * out.fps.den),
          ),
        ),
      );
    }
    for (const [role, value] of uploaded) set(b.roles?.[role], value);
    for (const [key, value] of Object.entries(request.controls ?? {}))
      set(b.controls?.[key], value);
    return graph;
  }

  async function history(id: string): Promise<HistoryEntry | null> {
    const res = await call(`/history/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("ComfyUI did not answer about its history.");
    const answer = (await json(res)) as Record<string, HistoryEntry>;
    return Object.hasOwn(answer, id) ? answer[id] : null;
  }

  async function inQueue(id: string) {
    const res = await call("/queue");
    if (!res.ok) throw new Error("ComfyUI did not answer about its queue.");
    const q = (await json(res)) as {
      queue_running?: unknown[][];
      queue_pending?: unknown[][];
    };
    const has = (list?: unknown[][]) =>
      Array.isArray(list) && list.some((e) => Array.isArray(e) && e[1] === id);
    if (has(q.queue_running)) return "running" as const;
    if (has(q.queue_pending)) return "queued" as const;
    return null;
  }

  // What ComfyUI knows, never a resubmit.
  async function observe(executionRef: string): Promise<ExecutionStatus> {
    try {
      const entry = await history(executionRef);
      if (entry) {
        const messages = Array.isArray(entry.status?.messages)
          ? (entry.status.messages as unknown[][])
          : [];
        const named = (type: string) =>
          messages.find((m) => Array.isArray(m) && m[0] === type)?.[1] as
            { exception_message?: unknown } | undefined;
        if (named("execution_interrupted"))
          return { executionRef, state: "cancelled" };
        if (entry.status?.status_str === "error" || named("execution_error")) {
          const reason = named("execution_error")?.exception_message;
          return {
            executionRef,
            state: "failed",
            diagnostic:
              diagnostic(typeof reason === "string" ? reason : undefined) ??
              "ComfyUI reported an error.",
          };
        }
        return { executionRef, state: "succeeded", progress: 1 };
      }
      const queued = await inQueue(executionRef);
      if (!queued) return { executionRef, state: "unknown" };
      const known = progress.get(executionRef);
      return {
        executionRef,
        state: queued,
        ...(known === undefined ? {} : { progress: known }),
      };
    } catch {
      return {
        executionRef,
        state: "unknown",
        diagnostic: "ComfyUI could not be reached.",
      };
    }
  }

  async function cancel(executionRef: string): Promise<Cancellation> {
    let acknowledged = false;
    try {
      const where = await inQueue(executionRef);
      if (where === "queued")
        acknowledged = (await post("/queue", { delete: [executionRef] })).ok;
      else if (where === "running")
        acknowledged = (await post("/interrupt", { prompt_id: executionRef }))
          .ok;
    } catch {
      acknowledged = false;
    }
    return {
      requested: true,
      // Yamakan does not own ComfyUI's process, so this does not claim it ended.
      localProcessExited: false,
      remoteAcknowledged: acknowledged,
      remoteOutcome: "unknown",
      billingOutcome: "notApplicable",
    };
  }

  const viewPath = ({ filename, subfolder }: SavedFile) =>
    `/view?${new URLSearchParams({ filename, subfolder, type: "output" })}`;

  // Bounded chunks of one saved file.
  async function* bytesOf(file: SavedFile) {
    const res = await call(viewPath(file), {}, COMFY_LIMITS.transferMs);
    if (!res.ok || !res.body)
      throw new Error("ComfyUI did not serve its output.");
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > ENGINE_V2_LIMITS.artifactBytes)
        throw new Error("An output is longer than allowed.");
      for (let at = 0; at < chunk.byteLength; at += ENGINE_V2_LIMITS.chunkBytes)
        yield chunk.subarray(at, at + ENGINE_V2_LIMITS.chunkBytes);
    }
  }

  async function artifactsOf(executionRef: string, e: Execution) {
    if (e.artifacts) return e.artifacts;
    const status = await observe(executionRef);
    if (status.state !== "succeeded") return [];
    const entry = await history(executionRef);
    const nodeId = Object.entries(e.recipe.graph).find(
      ([, n]) => n._meta?.title === e.recipe.outputNode,
    )?.[0];
    const outputs = nodeId ? entry?.outputs?.[nodeId] : undefined;
    const found: (Artifact & { file: SavedFile })[] = [];
    for (const list of Object.values(outputs ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        // Anything else in the list, such as a temporary preview, is not output.
        const file = savedFile(raw);
        if (!file) continue;
        const mediaType = MEDIA_BY_EXTENSION[extensionOf(file.filename)];
        if (!mediaType) continue;
        if (found.length >= ENGINE_V2_LIMITS.artifacts)
          throw new Error("ComfyUI reported too many outputs.");
        const hash = createHash("sha256");
        let byteLength = 0;
        for await (const chunk of bytesOf(file)) {
          byteLength += chunk.byteLength;
          hash.update(chunk);
        }
        if (byteLength === 0) continue;
        found.push({
          handle: `output-${found.length}.${extensionOf(file.filename)}`,
          mediaType,
          byteLength,
          sha256: hash.digest("hex"),
          file,
        });
      }
    }
    e.artifacts = found;
    return found;
  }

  const known = (executionRef: string) => {
    const e = executions.get(executionRef);
    if (!e) throw new Error("Unknown engine execution.");
    return e;
  };

  const adapter: EngineAdapterV2 & {
    checkSetup(): Promise<ComfySetupProblem[]>;
    close(): void;
  } = {
    contract: ENGINE_CONTRACT_V2,
    checkSetup,
    close() {
      closed = true;
      socket?.close();
      socket = null;
    },
    capabilities,
    async submit(raw, context) {
      const parsed = EngineRequestV2Schema.safeParse(raw);
      if (!parsed.success) return { refused: "INVALID_REQUEST" };
      const request = parsed.data;
      const claim = fence.claim(request);
      if (claim.kind === "done") return claim.result;
      return underClaim(claim, async () => {
        const capability = capabilities().find(
          (c) => c.operation === request.operation,
        );
        const refused = refusal(request, capability);
        if (refused) return { refused };
        const recipe = recipes.find(
          (r) =>
            r.id === request.recipeId &&
            r.operation === request.operation &&
            r.modelManifestHash === request.modelManifestHash &&
            comfyRecipeHash(r) === request.recipeHash,
        );
        if (!recipe) return { refused: "RECIPE_UNKNOWN" };
        const uploaded = new Map<string, string>();
        for (const { role, asset } of request.inputs) {
          if (!recipe.bindings.roles?.[role])
            return { refused: "INPUT_UNSUPPORTED" };
          const name = await upload(request, role, asset, context).catch(
            () => null,
          );
          if (!name) return { refused: "INVALID_REQUEST" };
          uploaded.set(role, name);
        }
        listen();
        const promptId = randomUUID();
        const res = await post("/prompt", {
          prompt: buildGraph(recipe, request, uploaded),
          client_id: clientId,
          prompt_id: promptId,
        });
        // ComfyUI refuses a graph whose nodes or models it does not have.
        if (!res.ok) return { refused: "WEIGHTS_ABSENT" };
        const answer = (await json(res)) as { prompt_id?: unknown };
        const executionRef = answer.prompt_id;
        if (
          typeof executionRef !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(executionRef)
        )
          return { refused: "INVALID_REQUEST" };
        if (executions.size >= COMFY_LIMITS.tracked) {
          const oldest = executions.keys().next().value as string;
          executions.delete(oldest);
          progress.delete(oldest);
        }
        executions.set(executionRef, { recipe });
        const superseded = claim.supersede(executionRef);
        if (superseded) await cancel(superseded);
        return superseded === executionRef
          ? { refused: "STALE_ATTEMPT" }
          : { executionRef };
      });
    },
    status: observe,
    reconcile: observe,
    requestCancel: cancel,
    async enumerateArtifacts(executionRef) {
      const found = await artifactsOf(executionRef, known(executionRef));
      return found.map(({ file: _file, ...artifact }) => artifact);
    },
    async *readArtifact(executionRef, handle) {
      const found = await artifactsOf(executionRef, known(executionRef));
      const artifact = found.find((a) => a.handle === handle);
      if (!artifact) throw new Error("No such artifact.");
      yield* bytesOf(artifact.file);
    },
  };
  return adapter;
}
