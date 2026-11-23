// Yamakan MCP stdio server. It is an explicit local client of the running
// Yamakan service: tools are derived from the service catalog and every call
// goes through the same command registry, scopes and validation as the UI.
import { writeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { YamakanClient, YamakanError } from "../sdk/client.ts";
import type { Operation } from "../sdk/client.ts";
import { LineFramer, MCP_LIMITS } from "./framing.ts";
import type { Frame } from "./framing.ts";
import { CANCEL_TWINS, cancelPlan } from "./cancellation.ts";
import type { Phase } from "./cancellation.ts";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const env = (key: string) =>
  process.env[`YAMAKAN_${key}`] || process.env[`DARZAIN_${key}`];
const url = (env("URL") || "http://127.0.0.1:4318").replace(/\/$/, "");
if (new URL(url).hostname !== "127.0.0.1")
  throw new Error("MCP connects only to the local Yamakan server.");
const root = path.resolve(env("WORKSPACE") || ".yamakan");
const tokenFile = env("AGENT_TOKEN_FILE");
const tokenFromEnv = env("AGENT_TOKEN");
// An agent gets only what its own token allows. Running as the full local client, with the
// workspace's own token, is a choice the person makes by name, never a fallback.
const asLocalClient = env("MCP_LOCAL_CLIENT") === "1";
// A token of only spaces is no token: it gets this message, not an unexplained refusal later.
if (!tokenFromEnv?.trim() && !tokenFile?.trim() && !asLocalClient) {
  // Written at once, so a terminal cannot cut it off when the process ends.
  writeSync(
    2,
    "Yamakan MCP needs an agent token. Make one in Yamakan (Finish, Agent tools, Agent access), " +
      "save it in a file only the agent can read, and set YAMAKAN_AGENT_TOKEN_FILE to that file " +
      "(or YAMAKAN_AGENT_TOKEN to the token). To run MCP as the full local client with the " +
      "workspace's own token instead, set YAMAKAN_MCP_LOCAL_CLIENT=1.\n",
  );
  process.exit(2);
}
async function bearerToken() {
  if (tokenFromEnv?.trim()) return tokenFromEnv.trim();
  if (tokenFile)
    return (await readFile(path.resolve(tokenFile), "utf8")).trim();
  return (await readFile(path.join(root, "token"), "utf8")).trim();
}
// The service rotates its credential on restart, so read it for every call.
const client = async (request?: InFlight) =>
  new YamakanClient({
    baseUrl: url,
    token: await bearerToken(),
    ...(request ? { fetch: sending(request) } : {}),
  });
// A command is sent once the service has proved itself and the command itself goes out. Until
// then, a cancelled one is not sent: not after the proof, nor after a save's staged content.
const sending =
  (request: InFlight): typeof fetch =>
  (input, init) => {
    if (String(input) === `${url}/api/v1/call`) {
      request.stop.signal.throwIfAborted();
      request.phase = "sent";
    }
    return fetch(input, init);
  };

// A mutation retried with the same request ID returns its original result,
// as over REST (the envelope's requestId). MCP has no envelope, so each tool
// takes an optional `requestId` argument that is removed before the
// command's own strict input is validated.
const REQUEST_ID = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9._:-]+$",
  description:
    "Optional. Retrying a mutation with the same requestId returns the original result instead of applying it again; reusing it with different arguments fails with IDEMPOTENCY_MISMATCH. A mutation that cannot replay refuses a requestId and says so. Use a fresh unique value (for example a UUID): every local client shares one request-ID space.",
};
// MCP clients commonly restrict tool names to [A-Za-z0-9_-].
const toolName = (operation: string) => operation.replaceAll(".", "_");

type Message = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};
// A client that does not read these lines loses only them.
process.stderr.on("error", () => {});
const send = (value: unknown) =>
  process.stdout.write(`${JSON.stringify(value)}\n`);
const error = (id: Message["id"], code: number, message: string) =>
  send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// A request in progress, by its id: what a cancellation names. A read until it says otherwise.
type InFlight = {
  operation: { name: string; mutation: boolean };
  phase: Phase;
  cancelled: boolean;
  stop: AbortController;
};
const requests = new Map<string | number, InFlight>();
// One the client cancelled is not answered.
function answer(id: Message["id"], request: InFlight, body: object) {
  if (request.cancelled) return;
  request.phase = "answered";
  send({ jsonrpc: "2.0", id: id ?? null, ...body });
}
function cancel(params: Record<string, unknown>) {
  const id = params.requestId;
  const request =
    typeof id === "string" || typeof id === "number"
      ? requests.get(id)
      : undefined;
  if (!request) return;
  const plan = cancelPlan(request.operation, request.phase);
  if (plan === "ignore") return;
  request.cancelled = true;
  if (plan === "abort") request.stop.abort();
}

// Documents larger than a tool call travel over the authenticated staging
// route: this one tool stages the JSON content, then commits the sealed
// upload (sdk/client.ts saveDocument). Its frame is still bounded by the
// 2 MiB MCP line cap; larger documents are saved by the UI or the CLI.
const SAVE_DOCUMENT = "yamakan_document_save";
const SAVE_REQUEST_ID_LENGTH = 121;
function saveDocumentTool(commit: {
  summary: string;
  scope: string;
  inputSchema: Record<string, unknown>;
}) {
  const schema = commit.inputSchema as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const { source: _source, ...properties } = schema.properties ?? {};
  return {
    name: SAVE_DOCUMENT,
    title: "yamakan.document.save",
    description: `Stage a creative document's JSON content and commit it as a new revision (stage route, then yamakan.document.commit). Requires scope ${commit.scope}.`,
    inputSchema: {
      ...schema,
      properties: {
        ...properties,
        content: {
          type: "object",
          description: "The whole document (Studio document or Cinema scene).",
        },
        requestId: { ...REQUEST_ID, maxLength: SAVE_REQUEST_ID_LENGTH },
      },
      required: [
        ...(schema.required ?? []).filter((r) => r !== "source"),
        "content",
      ],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  };
}

// Every name the service has, also one this token may not call: calling it is answered by the
// service's own refusal. Null until the first list.
type Known = { name: Operation; mutation: boolean; callable: boolean };
let operations: Map<string, Known> | null = null;
async function tools(signal: AbortSignal) {
  const catalog = await (await client()).catalog({ signal });
  operations = new Map<string, Known>([
    ...catalog.tools.map(
      ({ name, mutation }) =>
        [toolName(name), { name, mutation, callable: true }] as const,
    ),
    // What it does is not said, so it is never taken for a read.
    ...(catalog.withheld ?? []).map(
      ({ name }) =>
        [toolName(name), { name, mutation: true, callable: false }] as const,
    ),
  ]);
  const commit = catalog.tools.find(
    (t) => t.name === "yamakan.document.commit",
  );
  return [
    ...catalogTools(catalog.tools),
    ...(commit ? [saveDocumentTool(commit)] : []),
  ];
}
function catalogTools(
  list: Awaited<ReturnType<YamakanClient["catalog"]>>["tools"],
) {
  return list.map((t) => {
    const schema = t.inputSchema as {
      properties?: Record<string, unknown>;
    };
    if (schema.properties && "requestId" in schema.properties)
      throw new Error(`${t.name} already defines requestId.`);
    return {
      name: toolName(t.name),
      title: t.name,
      description: `${t.summary} Requires scope ${t.scope}.`,
      inputSchema: {
        ...schema,
        properties: { ...schema.properties, requestId: REQUEST_ID },
      },
      // Nothing here says whether a call is idempotent or reaches outside, so neither is claimed.
      annotations: {
        readOnlyHint: !t.mutation,
        ...(t.mutation ? { destructiveHint: t.destructive } : {}),
      },
    };
  });
}

// A tool result's request id, in the place MCP keeps for such things.
const requestMeta = (requestId: unknown) =>
  typeof requestId === "string"
    ? { _meta: { "yamakan/requestId": requestId } }
    : {};

// A cancelled start has finished: what it started is stopped, once, if this token may.
async function stopStarted(
  started: Operation,
  args: Record<string, unknown>,
  result: unknown,
) {
  const twin = CANCEL_TWINS[started];
  const input = twin?.input(args, result);
  if (!twin || !input || !operations!.get(toolName(twin.cancel))?.callable)
    return;
  const outcome = await client()
    .then((service) => service.call(twin.cancel, input as never))
    .then(
      () => "asked for",
      (e) =>
        e instanceof YamakanError ? `refused (${e.code})` : "not reached",
    );
  process.stderr.write(
    `Yamakan MCP: ${started} was cancelled after it started; ${twin.cancel} ${outcome}.\n`,
  );
}

async function handle(message: Message, request: InFlight) {
  const { id, method } = message;
  const reply = (result: unknown) => answer(id, request, { result });
  const params =
    message.params && typeof message.params === "object" ? message.params : {};
  const notification = id === undefined;
  // Notifications never receive responses, even for request methods.
  if (notification && !method?.startsWith("notifications/")) return;
  switch (method) {
    case "initialize": {
      const requested = String(params.protocolVersion ?? "");
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "yamakan", title: "Yamakan", version: "0.1.0" },
      });
    }
    case "notifications/cancelled":
      return cancel(params);
    case "notifications/initialized":
      return;
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: await tools(request.stop.signal) });
    case "tools/call": {
      // Tool failures are results the model can read, not protocol errors;
      // that includes a refused credential while loading the tool list.
      const toolError = (e: YamakanError, sent?: unknown) =>
        reply({
          // The caller's or save's own id first: a save's stage and commit
          // suffix theirs, and retrying under one of those replays nothing.
          // Otherwise the service's trace id, to report. The text stays as it was.
          ...requestMeta(sent ?? e.requestId),
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: e.code,
                message: e.message,
                retryable: e.retryable,
              }),
            },
          ],
        });
      const args =
        params.arguments && typeof params.arguments === "object"
          ? { ...(params.arguments as Record<string, unknown>) }
          : {};
      const requestId = args.requestId;
      delete args.requestId;
      // Malformed IDs are refused as over REST, never silently dropped. A save
      // suffixes its id for the stage and the commit, so its limit is lower.
      const valid =
        requestId === undefined ||
        (typeof requestId === "string" &&
          new RegExp(REQUEST_ID.pattern).test(requestId) &&
          requestId.length <=
            (params.name === SAVE_DOCUMENT
              ? SAVE_REQUEST_ID_LENGTH
              : REQUEST_ID.maxLength));
      try {
        if (!operations) await tools(request.stop.signal);
      } catch (e) {
        if (e instanceof YamakanError)
          return toolError(e, valid ? requestId : undefined);
        throw e;
      }
      const operation = operations!.get(String(params.name));
      const saving =
        params.name === SAVE_DOCUMENT &&
        [...operations!.values()].some(
          (o) => o.name === "yamakan.document.commit",
        );
      if (!operation && !saving)
        return answer(id, request, {
          error: { code: -32602, message: "Unknown tool." },
        });
      let sent: unknown = requestId;
      try {
        if (!valid)
          throw new YamakanError(
            "VALIDATION",
            // The service's own message for a malformed envelope.
            "Invalid command envelope.",
            false,
            null,
          );
        if (saving) {
          // As strict as a catalog tool: no field outside the schema, and
          // the document must be a JSON object.
          const allowed = new Set([
            "projectId",
            "expectedRevision",
            "documentId",
            "kind",
            "schemaVersion",
            "expectedContentHash",
            "content",
          ]);
          const content = args.content;
          if (
            Object.keys(args).some((k) => !allowed.has(k)) ||
            !content ||
            typeof content !== "object" ||
            Array.isArray(content)
          )
            throw new YamakanError(
              "VALIDATION",
              "Invalid yamakan_document_save arguments.",
              false,
              null,
            );
        }
        const service = await client(request);
        if (request.cancelled) return;
        request.operation = operation ?? {
          name: "yamakan.document.save",
          mutation: true,
        };
        // A save always has an id. One generated here reaches the caller only
        // with a reply: after a lost response, only a supplied id can retry.
        if (saving)
          sent = (requestId as string | undefined) ?? crypto.randomUUID();
        const result = saving
          ? await service.saveDocument({
              ...(args as Parameters<YamakanClient["saveDocument"]>[0]),
              // Stage and commit each replay under this id on a retry.
              requestId: sent as string,
            })
          : await service.call(
              operation!.name,
              args as never,
              // The service validates it like the REST envelope's requestId.
              requestId === undefined ? undefined : (requestId as string),
              { signal: request.stop.signal },
            );
        if (request.cancelled)
          return saving
            ? undefined
            : await stopStarted(operation!.name, args, result);
        return reply({
          ...requestMeta(sent),
          content: [{ type: "text", text: JSON.stringify(result) }],
        });
      } catch (e) {
        if (!(e instanceof YamakanError)) throw e;
        return toolError(e, valid ? sent : undefined);
      }
    }
    default:
      if (!notification)
        answer(id, request, {
          error: { code: -32601, message: "Method not found." },
        });
  }
}

function dispatch(frame: Frame) {
  if ("oversized" in frame)
    return error(null, -32700, "Message exceeds the request size limit.");
  let message: Message;
  try {
    message = JSON.parse(frame.line);
  } catch {
    return error(null, -32700, "Parse error.");
  }
  // JSON-RPC ids are strings, numbers or null; any other id is never echoed
  // (a deeply nested one would overflow JSON.stringify and end the process).
  const id = message && typeof message === "object" ? message.id : undefined;
  const validId =
    id === undefined ||
    id === null ||
    typeof id === "string" ||
    typeof id === "number";
  if (!validId) return error(null, -32600, "Invalid request.");
  if (message?.jsonrpc !== "2.0" || typeof message.method !== "string")
    return error(message?.id, -32600, "Invalid request.");
  // Transport failures (no token file, service not listening) never echo host paths.
  const request: InFlight = {
    operation: { name: message.method, mutation: false },
    phase: "waiting",
    cancelled: false,
    stop: new AbortController(),
  };
  // A client may not cancel initialize, and nothing without an id of its own can be named.
  const named =
    typeof id === "string" || typeof id === "number"
      ? message.method !== "initialize" && !requests.has(id)
      : false;
  if (named) requests.set(id as string | number, request);
  const pending = handle(message, request).catch(() =>
    answer(id, request, {
      error: {
        code: -32603,
        message:
          "Yamakan service is not running or its workspace credential is unavailable.",
      },
    }),
  );
  inFlight.add(pending);
  void pending.finally(() => {
    if (named) requests.delete(id as string | number);
    inFlight.delete(pending);
    pump();
  });
}

// Frames from stdin wait here, in order, while the server is saturated;
// stdin stays paused until the queue drains, so the queue never holds more
// than the chunk that filled it.
const framer = new LineFramer(MCP_LIMITS.lineBytes);
const inFlight = new Set<Promise<unknown>>();
let queue: Frame[] = [];
let next = 0;
let ended = false;
let finishing = false;
const saturated = () =>
  inFlight.size >= MCP_LIMITS.inFlight ||
  process.stdout.writableLength >= MCP_LIMITS.outputBytes;
function pump() {
  while (next < queue.length && !saturated()) dispatch(queue[next++]!);
  if (next === queue.length) {
    queue = [];
    next = 0;
  }
  if (queue.length > 0 || saturated()) process.stdin.pause();
  else if (!ended) process.stdin.resume();
  if (ended && queue.length === 0 && !finishing) {
    finishing = true;
    // Exit only once every reply has reached stdout: on POSIX a pipe
    // write is asynchronous and exiting would drop what is still buffered.
    void Promise.allSettled(inFlight).then(() =>
      process.stdout.write("", () => process.exit(0)),
    );
  }
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  for (const frame of framer.push(chunk)) queue.push(frame);
  pump();
});
process.stdout.on("drain", pump);
process.stdin.on("end", () => {
  ended = true;
  pump();
});
