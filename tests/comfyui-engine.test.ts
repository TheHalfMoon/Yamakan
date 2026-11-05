// A ComfyUI adapter against a fake server speaking ComfyUI's HTTP and socket
// protocol on a real local port. `npm run qualify:comfyui` covers a real ComfyUI.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  ENGINE_CONTRACT_V2,
  readArtifactVerified,
  type EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import {
  PINNED_COMFY_RECIPES,
  comfyBaseUrl,
  comfyLaunchArguments,
  isComfyCloudNode,
  comfyRecipeHash,
  createComfyEngine,
  type ComfyRecipe,
} from "../core/engines/comfyui.ts";
import { ENGINE_ENABLED } from "../core/engines/contract.ts";

const sha = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const MANIFEST = "a".repeat(64);
const OUTPUT = Buffer.alloc(3 * 1024 * 1024 + 17, 7);

const recipe = (over: Partial<ComfyRecipe> = {}): ComfyRecipe => ({
  id: "test-t2v",
  operation: "textToVideo",
  modelManifestHash: MANIFEST,
  qualificationHash: "b".repeat(64),
  constraints: {
    maxWidth: 1280,
    maxHeight: 720,
    fps: [{ num: 24000, den: 1001 }],
    minDurationTicks: 1,
    maxDurationTicks: 705_600_000 * 10,
    audio: false,
    controls: ["guidance"],
    roles: ["firstFrame"],
  },
  graph: {
    "1": {
      class_type: "Loader",
      inputs: { model: "model.safetensors" },
      _meta: { title: "model" },
    },
    "2": {
      class_type: "Sampler",
      inputs: {
        text: "",
        seed: 0,
        width: 0,
        height: 0,
        length: 0,
        fps: 0,
        cfg: 1,
      },
      _meta: { title: "sampler" },
    },
    "3": { class_type: "Save", inputs: {}, _meta: { title: "save" } },
  },
  bindings: {
    prompt: { node: "sampler", input: "text" },
    seed: { node: "sampler", input: "seed" },
    width: { node: "sampler", input: "width" },
    height: { node: "sampler", input: "height" },
    frames: { node: "sampler", input: "length" },
    fps: { node: "sampler", input: "fps" },
    controls: { guidance: { node: "sampler", input: "cfg" } },
  },
  modelInputs: [{ node: "model", input: "model" }],
  outputNode: "save",
  ...over,
});

const request = (r: ComfyRecipe, over: object = {}) =>
  ({
    contract: ENGINE_CONTRACT_V2,
    operation: "textToVideo",
    recipeId: r.id,
    recipeHash: comfyRecipeHash(r),
    modelManifestHash: r.modelManifestHash,
    attemptKey: "attempt-1",
    leaseGeneration: 1,
    deadlineMs: 60_000,
    resourcePolicyHash: "c".repeat(64),
    prompt: "a red door",
    seed: 42,
    inputs: [],
    controls: { guidance: 3 },
    output: {
      kind: "video",
      width: 640,
      height: 360,
      fps: { num: 24000, den: 1001 },
      durationTicks: 29_429_400 * 48,
      audio: false,
    },
    ...over,
  }) as EngineRequestV2;

const servers: Server[] = [];
const upgraded: import("node:stream").Duplex[] = [];
after(() => {
  for (const s of upgraded) s.destroy();
  for (const s of servers) {
    s.closeAllConnections();
    s.close();
  }
});

type Fake = {
  url: string;
  prompts: Record<string, unknown>[];
  posted: string[];
  requests: () => number;
  queue: { running: string[]; pending: string[] };
  history: Record<string, unknown>;
  // Writes to a connected socket, as ComfyUI's progress messages arrive.
  send: (message: object) => void;
  promptAnswer?: (id: string) => { status: number; body: object };
  uploads: Buffer[];
  redirect?: boolean;
  outputs: Record<string, unknown>;
  classes: Record<string, object>;
};

const readAll = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
};

async function fake(): Promise<Fake> {
  let count = 0;
  const sockets: import("node:stream").Duplex[] = [];
  const state: Fake = {
    url: "",
    prompts: [],
    posted: [],
    requests: () => count,
    queue: { running: [], pending: [] },
    history: {},
    uploads: [],
    outputs: {},
    classes: {
      Loader: { input: { required: { model: [["model.safetensors"]] } } },
      Sampler: { input: { required: {} } },
      Save: { input: { required: {} } },
    },
    send(message) {
      const text = Buffer.from(JSON.stringify(message));
      const head =
        text.length < 126
          ? Buffer.from([0x81, text.length])
          : Buffer.from([0x81, 126, text.length >> 8, text.length & 255]);
      for (const s of sockets) s.write(Buffer.concat([head, text]));
    },
  };
  const server = createServer(async (req, res) => {
    count++;
    const url = new URL(req.url!, "http://x");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === "not json" ? "not json" : JSON.stringify(body));
    };
    state.posted.push(`${req.method} ${url.pathname}`);
    if (state.redirect) {
      res.writeHead(302, { Location: `${state.url}/elsewhere` });
      return res.end();
    }
    if (url.pathname.startsWith("/object_info/")) {
      const type = decodeURIComponent(url.pathname.slice(13));
      return send(
        200,
        state.classes[type] ? { [type]: state.classes[type] } : {},
      );
    }
    if (url.pathname === "/prompt") {
      const body = JSON.parse((await readAll(req)).toString()) as {
        prompt_id: string;
      };
      state.prompts.push(body);
      if (state.promptAnswer) {
        const a = state.promptAnswer(body.prompt_id);
        return send(a.status, a.body);
      }
      return send(200, {
        prompt_id: body.prompt_id,
        number: 1,
        node_errors: {},
      });
    }
    if (url.pathname === "/upload/image") {
      state.uploads.push(await readAll(req));
      return send(200, {
        name: "uploaded.png",
        subfolder: "yamakan",
        type: "input",
      });
    }
    if (url.pathname.startsWith("/history/")) {
      const id = url.pathname.slice(9);
      return send(200, state.history[id] ? { [id]: state.history[id] } : {});
    }
    if (url.pathname === "/queue" && req.method === "GET")
      return send(200, {
        queue_running: state.queue.running.map((id) => [1, id, {}, {}, []]),
        queue_pending: state.queue.pending.map((id) => [2, id, {}, {}, []]),
      });
    if (url.pathname === "/queue" || url.pathname === "/interrupt") {
      state.posted.push(`${url.pathname} ${(await readAll(req)).toString()}`);
      return send(200, {});
    }
    if (url.pathname === "/view") {
      const name = url.searchParams.get("filename")!;
      const bytes = state.outputs[name] as Buffer | undefined;
      if (!bytes) return send(404, {});
      res.writeHead(200);
      return res.end(bytes);
    }
    send(404, {});
  });
  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.on("error", () => {});
    sockets.push(socket);
    upgraded.push(socket);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return state;
}

async function started(r = recipe()) {
  const f = await fake();
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [r],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), []);
  return { f, engine, r };
}
const context = {
  async *openAsset() {
    yield Buffer.from("never read");
  },
};

test("this build enables nothing: engines are off and no recipe is pinned", async () => {
  assert.equal(ENGINE_ENABLED, false);
  assert.deepEqual(PINNED_COMFY_RECIPES, []);
  const f = await fake();
  const engine = createComfyEngine({ baseUrl: f.url, recipes: [recipe()] });
  assert.deepEqual(await engine.checkSetup(), []);
  assert.ok(engine.capabilities().every((c) => c.reason === "ENGINE_DISABLED"));
  const r = recipe();
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "ENGINE_DISABLED",
  });
  assert.equal(f.requests(), 0, "off means no IO at all");
});

test("while off, status, reconcile and cancel do no IO either", async () => {
  const f = await fake();
  const engine = createComfyEngine({ baseUrl: f.url, recipes: [recipe()] });
  assert.equal((await engine.status("x")).state, "unknown");
  assert.equal((await engine.reconcile("x")).state, "unknown");
  const cancelled = await engine.requestCancel("x");
  assert.equal(cancelled.remoteAcknowledged, false);
  assert.equal(f.requests(), 0);
});

test("one recipe's qualification lends nothing to another for the same operation", async () => {
  const good = recipe();
  const bad = recipe({ id: "unqualified", qualificationHash: undefined });
  const missing = recipe({
    id: "lacks-model",
    graph: {
      ...recipe().graph,
      "1": {
        class_type: "Loader",
        inputs: { model: "absent.safetensors" },
        _meta: { title: "model" },
      },
    },
  });
  const f = await fake();
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [good, bad, missing],
    enabled: true,
  });
  await engine.checkSetup();
  const cap = engine.capabilities().find((c) => c.operation === "textToVideo")!;
  assert.equal(cap.available, true);
  assert.deepEqual(
    await engine.submit(request(bad, { attemptKey: "bad" }), context),
    { refused: "HARDWARE_UNQUALIFIED" },
  );
  assert.deepEqual(
    await engine.submit(request(missing, { attemptKey: "missing" }), context),
    { refused: "WEIGHTS_ABSENT" },
  );
  assert.equal(f.prompts.length, 0);
  assert.ok("executionRef" in (await engine.submit(request(good), context)));
  engine.close();
});

test("a recipe using a node that calls a remote service is not available", async () => {
  const f = await fake();
  f.classes.Sampler = { api_node: true, input: { required: {} } };
  const r = recipe();
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [r],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), [
    { kind: "cloud-node", recipe: r.id, classType: "Sampler" },
  ]);
  assert.equal(
    engine.capabilities().find((c) => c.operation === "textToVideo")!.available,
    false,
  );
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "WEIGHTS_ABSENT",
  });
  assert.equal(f.prompts.length, 0);
});

test("a partner node is known by its module even when its flag is not set", async () => {
  assert.equal(
    isComfyCloudNode({
      api_node: false,
      python_module: "comfy_api_nodes.nodes_krea",
    }),
    true,
  );
  assert.equal(isComfyCloudNode({ api_node: true }), true);
  assert.equal(
    isComfyCloudNode({
      api_node: false,
      python_module: "comfy_extras.nodes_video",
    }),
    false,
  );
  assert.equal(
    isComfyCloudNode({ python_module: "comfy_api_nodes_lookalike" }),
    false,
  );
  const f = await fake();
  f.classes.Sampler = {
    api_node: false,
    python_module: "comfy_api_nodes.nodes_krea",
    input: { required: {} },
  };
  const r = recipe();
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [r],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), [
    { kind: "cloud-node", recipe: r.id, classType: "Sampler" },
  ]);
});

test("nothing accepted and no answer reports unknown, and claims no job ran", async () => {
  const { f, engine, r } = await started();
  let posted = "";
  f.promptAnswer = (id) => {
    posted = id;
    return { status: 200, body: "not json" as unknown as object };
  };
  const answer = await engine.submit(request(r), context);
  assert.deepEqual(answer, { executionRef: posted });
  const status = await engine.status(posted);
  assert.equal(status.state, "unknown");
  assert.deepEqual(await engine.enumerateArtifacts(posted), []);
  engine.close();
});

test("ComfyUI is always started offline, on loopback, without custom nodes", () => {
  const argv = comfyLaunchArguments({ port: 1234, baseDirectory: "D:/x" });
  assert.deepEqual(argv.slice(0, 2), ["--listen", "127.0.0.1"]);
  for (const flag of ["--offline", "--disable-all-custom-nodes"])
    assert.ok(argv.includes(flag), flag);
});

test("a lost answer leaves the job followed, and the same attempt replays it", async () => {
  const { f, engine, r } = await started();
  let posted = "";
  f.promptAnswer = (id) => {
    posted = id;
    f.queue.pending = [id];
    return { status: 200, body: "not json" as unknown as object };
  };
  const first = await engine.submit(request(r), context);
  assert.deepEqual(first, { executionRef: posted });
  assert.equal((await engine.status(posted)).state, "queued");
  assert.deepEqual(await engine.submit(request(r), context), first);
  assert.equal(f.prompts.length, 1, "no second job");
  engine.close();
});

test("a job ComfyUI may have accepted is cancelled when its answer is unusable", async () => {
  const { f, engine, r } = await started();
  let accepted = "";
  f.promptAnswer = (id) => {
    accepted = id;
    f.queue.pending = [id];
    return { status: 200, body: { prompt_id: "another-valid-id" } };
  };
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "INVALID_REQUEST",
  });
  assert.ok(
    f.posted.includes(`/queue ${JSON.stringify({ delete: [accepted] })}`),
  );
  engine.close();
});

test("a history entry that does not state success is not success", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  f.history[id] = { outputs: {} };
  assert.equal((await engine.status(id)).state, "unknown");
  engine.close();
});

test("model choices are read in either of ComfyUI's two shapes", async () => {
  const f = await fake();
  f.classes.Loader = {
    input: {
      optional: { model: ["COMBO", { options: ["model.safetensors"] }] },
    },
  };
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [recipe()],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), []);
});

test("only a loopback address by number is accepted", () => {
  assert.equal(comfyBaseUrl("http://127.0.0.1:8188"), "http://127.0.0.1:8188");
  assert.equal(comfyBaseUrl("http://[::1]:8188/"), "http://[::1]:8188");
  for (const bad of [
    "http://localhost:8188",
    "https://127.0.0.1:8188",
    "http://cloud.comfy.org",
    "http://127.0.0.1.evil.example:8188",
    "http://user:pw@127.0.0.1:8188",
    "http://127.0.0.1:8188/proxy",
    "http://127.0.0.1:8188/?x=1",
    "http://10.0.0.5:8188",
    "file:///etc/passwd",
    "nonsense",
  ])
    assert.throws(() => comfyBaseUrl(bad), /loopback|not a URL/, bad);
});

test("a recipe that binds to a node it does not have is refused at start", () => {
  assert.throws(
    () =>
      createComfyEngine({
        baseUrl: "http://127.0.0.1:1",
        recipes: [recipe({ outputNode: "missing" })],
      }),
    /no one missing/,
  );
  assert.throws(
    () =>
      createComfyEngine({
        baseUrl: "http://127.0.0.1:1",
        recipes: [
          recipe({
            bindings: { prompt: { node: "sampler", input: "nothing" } },
          }),
        ],
      }),
    /no one sampler\.nothing/,
  );
});

test("a setup check names what is missing, and a recipe lacking it is not available", async () => {
  const f = await fake();
  delete f.classes.Sampler;
  f.classes.Loader = {
    input: { required: { model: [["other.safetensors"]] } },
  };
  const r = recipe();
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [r],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), [
    { kind: "node", recipe: r.id, classType: "Sampler" },
    { kind: "model", recipe: r.id, name: "model.safetensors" },
  ]);
  const cap = engine.capabilities().find((c) => c.operation === "textToVideo")!;
  assert.equal(cap.available, false);
  assert.equal(cap.reason, "WEIGHTS_ABSENT");
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "WEIGHTS_ABSENT",
  });
  assert.equal(f.prompts.length, 0);
});

test("an unreachable ComfyUI is reported, and nothing is available", async () => {
  const r = recipe();
  const engine = createComfyEngine({
    baseUrl: "http://127.0.0.1:9",
    recipes: [r],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), [{ kind: "unreachable" }]);
  assert.ok(engine.capabilities().every((c) => !c.available));
});

test("a redirect is never followed", async () => {
  const f = await fake();
  f.redirect = true;
  const engine = createComfyEngine({
    baseUrl: f.url,
    recipes: [recipe()],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), [{ kind: "unreachable" }]);
  assert.ok(!f.posted.some((p) => p.includes("/elsewhere")));
  assert.equal(f.requests(), 1);
});

test("a recipe with no qualification never reports available", async () => {
  const r = recipe({ qualificationHash: undefined });
  const { engine } = await started(r);
  const cap = engine.capabilities().find((c) => c.operation === "textToVideo")!;
  assert.equal(cap.reason, "HARDWARE_UNQUALIFIED");
});

test("a request fills only the recipe's bindings, on the project's own timing", async () => {
  const { f, engine, r } = await started();
  const answer = await engine.submit(request(r), context);
  assert.ok("executionRef" in answer);
  const sent = f.prompts[0] as {
    prompt: Record<string, { inputs: Record<string, unknown> }>;
  };
  assert.deepEqual(sent.prompt["2"].inputs, {
    text: "a red door",
    seed: 42,
    width: 640,
    height: 360,
    length: 48,
    fps: 24000 / 1001,
    cfg: 3,
  });
  assert.equal(sent.prompt["1"].inputs.model, "model.safetensors");
  assert.equal(r.graph["2"].inputs.text, "", "the recipe itself is unchanged");
  engine.close();
});

test("a request naming another recipe, hash or manifest does not run", async () => {
  const { f, engine, r } = await started();
  for (const over of [
    { recipeId: "other" },
    { recipeHash: "d".repeat(64) },
    { modelManifestHash: "e".repeat(64) },
  ]) {
    assert.deepEqual(
      await engine.submit(
        request(r, { ...over, attemptKey: `a${Object.keys(over)[0]}` }),
        context,
      ),
      { refused: "RECIPE_UNKNOWN" },
    );
  }
  assert.equal(f.prompts.length, 0);
});

test("a graph, URL or path in a request is refused before anything happens", async () => {
  const { f, engine, r } = await started();
  for (const over of [
    { graph: {} },
    { url: "http://evil.example" },
    { recipeId: "../../x" },
  ])
    assert.deepEqual(await engine.submit(request(r, over), context), {
      refused: "INVALID_REQUEST",
    });
  assert.equal(f.prompts.length, 0);
});

test("output beyond what a recipe was qualified for is refused", async () => {
  const { f, engine, r } = await started();
  assert.deepEqual(
    await engine.submit(
      request(r, {
        output: { ...request(r).output, width: 1920, height: 1080 },
      }),
      context,
    ),
    { refused: "OUTPUT_UNSUPPORTED" },
  );
  assert.deepEqual(
    await engine.submit(
      request(r, { attemptKey: "b", controls: { sneaky: 1 } }),
      context,
    ),
    { refused: "CONTROL_UNSUPPORTED" },
  );
  assert.equal(f.prompts.length, 0);
});

test("ComfyUI refusing a graph is a refusal, not a running job", async () => {
  const { f, engine, r } = await started();
  const rejected = (type: string, input_name: string) => () => ({
    status: 400,
    body: {
      error: { type: "prompt_outputs_failed_validation" },
      node_errors: { "2": { errors: [{ type, extra_info: { input_name } }] } },
    },
  });
  f.promptAnswer = rejected("value_not_in_list", "model");
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "WEIGHTS_ABSENT",
  });
  f.promptAnswer = rejected("value_not_in_list", "sampler_name");
  assert.deepEqual(
    await engine.submit(request(r, { attemptKey: "bad-choice" }), context),
    { refused: "INVALID_REQUEST" },
  );
  f.promptAnswer = rejected("value_bigger_than_max", "length");
  assert.deepEqual(
    await engine.submit(request(r, { attemptKey: "too-big" }), context),
    { refused: "INVALID_REQUEST" },
  );
  f.promptAnswer = () => ({
    status: 400,
    body: { error: { type: "missing_node_type" } },
  });
  assert.deepEqual(
    await engine.submit(request(r, { attemptKey: "no-node" }), context),
    { refused: "WEIGHTS_ABSENT" },
  );
  f.promptAnswer = () => ({ status: 200, body: { prompt_id: "../../evil" } });
  assert.deepEqual(
    await engine.submit(request(r, { leaseGeneration: 2 }), context),
    { refused: "INVALID_REQUEST" },
  );
  engine.close();
});

test("status follows queue, history, and failure, with bounded diagnostics", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  assert.equal((await engine.status(id)).state, "unknown");
  f.queue.pending = [id];
  assert.equal((await engine.status(id)).state, "queued");
  f.queue = { pending: [], running: [id] };
  assert.equal((await engine.status(id)).state, "running");
  f.queue.running = [];
  f.history[id] = {
    status: {
      status_str: "error",
      messages: [
        [
          "execution_error",
          {
            exception_message:
              "CUDA OOM at C:\\Users\\me\\model and http://x.y/z",
          },
        ],
      ],
    },
  };
  const failed = await engine.status(id);
  assert.equal(failed.state, "failed");
  assert.equal(failed.diagnostic, "CUDA OOM at [path] and [url]");
  f.history[id] = { status: { messages: [["execution_interrupted", {}]] } };
  assert.equal((await engine.status(id)).state, "cancelled");
  f.history[id] = { status: { status_str: "success" }, outputs: {} };
  assert.deepEqual(await engine.reconcile(id), {
    executionRef: id,
    state: "succeeded",
    progress: 1,
  });
  engine.close();
});

test("real progress arrives by socket, and only for this execution", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  f.queue.running = [id];
  await new Promise((d) => setTimeout(d, 150));
  f.send({ type: "progress", data: { prompt_id: "other", value: 9, max: 10 } });
  f.send({ type: "progress", data: { prompt_id: id, value: 3, max: 12 } });
  for (let i = 0; i < 50; i++) {
    if ((await engine.status(id)).progress !== undefined) break;
    await new Promise((d) => setTimeout(d, 20));
  }
  assert.equal((await engine.status(id)).progress, 0.25);
  engine.close();
});

test("cancel removes a queued job, interrupts only a running one, and claims no more than it knows", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  f.queue.pending = [id];
  const queued = await engine.requestCancel(id);
  assert.ok(f.posted.includes(`/queue ${JSON.stringify({ delete: [id] })}`));
  assert.equal(queued.remoteAcknowledged, true);
  assert.equal(queued.localProcessExited, false);
  assert.equal(queued.remoteOutcome, "unknown");
  f.queue = { pending: [], running: [id] };
  await engine.requestCancel(id);
  assert.ok(
    f.posted.includes(`/interrupt ${JSON.stringify({ prompt_id: id })}`),
  );
  f.queue.running = ["someone-else"];
  const before = f.posted.filter((p) => p.startsWith("/interrupt")).length;
  const notOurs = await engine.requestCancel(id);
  assert.equal(notOurs.remoteAcknowledged, false);
  assert.equal(
    f.posted.filter((p) => p.startsWith("/interrupt")).length,
    before,
    "another job is never interrupted",
  );
  engine.close();
});

test("a newer generation cancels the older, and an older one is stale", async () => {
  const { f, engine, r } = await started();
  const one = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  f.queue.pending = [one.executionRef];
  const two = await engine.submit(request(r, { leaseGeneration: 2 }), context);
  assert.ok("executionRef" in two);
  assert.ok(
    f.posted.includes(
      `/queue ${JSON.stringify({ delete: [one.executionRef] })}`,
    ),
  );
  assert.deepEqual(await engine.submit(request(r), context), {
    refused: "STALE_ATTEMPT",
  });
  engine.close();
});

test("outputs are hashed, read in bounded chunks, and pass the service's check", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  assert.deepEqual(await engine.enumerateArtifacts(id), [], "nothing yet");
  f.outputs["clip_00001.mp4"] = OUTPUT;
  f.history[id] = {
    status: { status_str: "success" },
    outputs: {
      "3": {
        images: [
          { filename: "clip_00001.mp4", subfolder: "", type: "output" },
          { filename: "preview.png", subfolder: "", type: "temp" },
        ],
        animated: [true],
      },
      "2": {
        images: [{ filename: "other.png", subfolder: "", type: "output" }],
      },
    },
  };
  const [artifact, ...rest] = await engine.enumerateArtifacts(id);
  assert.deepEqual(rest, [], "only the recipe's own saved output");
  assert.deepEqual(artifact, {
    handle: "output-0.mp4",
    mediaType: "video/mp4",
    byteLength: OUTPUT.length,
    sha256: sha(OUTPUT),
  });
  assert.deepEqual(await readArtifactVerified(engine, id, artifact), {
    bytes: OUTPUT.length,
  });
  // Changed underneath: the service's check refuses it.
  f.outputs["clip_00001.mp4"] = Buffer.alloc(OUTPUT.length, 8);
  await assert.rejects(
    readArtifactVerified(engine, id, artifact),
    /does not match/,
  );
  engine.close();
});

test("a history entry naming a path outside the output folder is not an output", async () => {
  const { f, engine, r } = await started();
  const { executionRef: id } = (await engine.submit(request(r), context)) as {
    executionRef: string;
  };
  for (const [filename, subfolder, type] of [
    ["..\\..\\secret.mp4", "", "output"],
    ["../secret.mp4", "", "output"],
    ["clip.mp4", "..", "output"],
    ["clip.mp4", "../..", "output"],
    ["clip.mp4", "C:\\Windows", "output"],
    ["clip.mp4", "", "input"],
    ["clip.exe", "", "output"],
    ["clip.mp4.", "", "output"],
    [5, "", "output"],
  ]) {
    f.history[id] = {
      status: { status_str: "success" },
      outputs: { "3": { images: [{ filename, subfolder, type }] } },
    };
    const again = createComfyEngine({
      baseUrl: f.url,
      recipes: [r],
      enabled: true,
    });
    await again.checkSetup();
    const { executionRef } = (await again.submit(
      request(r, {
        attemptKey: `x${String(filename).length}${String(subfolder).length}`,
      }),
      context,
    )) as { executionRef: string };
    f.history[executionRef] = f.history[id];
    assert.deepEqual(await again.enumerateArtifacts(executionRef), []);
    assert.ok(
      !f.posted.some((p) => /secret|Windows/.test(p)),
      String(filename),
    );
    again.close();
  }
  engine.close();
});

test("an input is streamed, and one failing its hash is never submitted", async () => {
  const r = recipe({
    operation: "imageToVideo",
    bindings: {
      roles: { firstFrame: { node: "sampler", input: "text" } },
    },
  });
  const { f, engine } = await started(r);
  const png = Buffer.from("real image bytes");
  const asset = {
    assetVersionId: "asset-1",
    sha256: sha(png),
    mediaType: "image/png" as const,
  };
  const base = {
    operation: "imageToVideo",
    prompt: "go",
    controls: {},
    inputs: [{ role: "firstFrame", asset }],
  };
  const good = await engine.submit(request(r, base), {
    async *openAsset() {
      yield png;
    },
  });
  assert.ok("executionRef" in good);
  assert.ok(f.uploads[0].includes(png));
  assert.match(f.uploads[0].toString(), /name="subfolder"\r\n\r\nyamakan/);
  assert.equal(
    (f.prompts[0] as { prompt: Record<string, { inputs: { text: string } }> })
      .prompt["2"].inputs.text,
    "yamakan/uploaded.png",
  );
  const uploadsBefore = f.uploads.length;
  const bad = await engine.submit(request(r, { ...base, attemptKey: "bad" }), {
    async *openAsset() {
      yield Buffer.from("something else");
    },
  });
  assert.deepEqual(bad, { refused: "INVALID_REQUEST" });
  assert.equal(f.prompts.length, 1);
  assert.equal(f.uploads.length, uploadsBefore, "ComfyUI never sees it");
  // Right on the first read, changed on the second: uploaded, but never named.
  let reads = 0;
  const changed = await engine.submit(
    request(r, { ...base, attemptKey: "changed" }),
    {
      async *openAsset() {
        yield reads++ === 0 ? png : Buffer.from("changed bytes");
      },
    },
  );
  assert.deepEqual(changed, { refused: "INVALID_REQUEST" });
  assert.equal(f.prompts.length, 1);
  engine.close();
});
