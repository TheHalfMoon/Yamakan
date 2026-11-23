// MPR-501: an agent over MCP is shown exactly what its token may call, each marked as what it
// does, and a request it cancels stops cleanly. The service here proves itself and lists and
// refuses as the real one, and holds an answer until the test lets it go.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import {
  Scopes,
  authorize,
  catalog,
  catalogFor,
  cliScopes,
  commands,
  execute,
} from "../core/command/registry.ts";
import type { Operation, Principal, Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { ProjectStore } from "../core/store.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { stageDocument } from "../server/document-stage.ts";
import { CANCEL_TWINS, cancelPlan } from "../mcp/cancellation.ts";
import { MCP_LIMITS } from "../mcp/framing.ts";
import { YamakanClient, type OperationResult } from "../sdk/client.ts";
import { serviceId, serviceProof, tokenKey } from "../sdk/service-proof.ts";

const ends: (() => unknown)[] = [];
after(async () => {
  for (const end of ends.reverse()) await end();
});

const agent = (...scopes: Scope[]): Principal => ({
  id: `agent:${randomUUID()}`,
  scopes: new Set(scopes),
});
const tool = (operation: string) => operation.replaceAll(".", "_");

// A service for some principals, by token. A call is done at once; its answer waits while its
// command is held, as does the list while "tools" is.
async function service(
  people: Record<string, Principal>,
  stubs: Record<string, (a: any) => unknown> = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-mcp-surface-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  const calls: { operation: string; parameters: any }[] = [];
  const held = new Map<string, Promise<void>>();
  const paths: string[] = [];
  const reached: string[] = [];
  const dropped: string[] = [];
  let origin = "";
  let older = false;
  const http = createServer((req, res: ServerResponse) => {
    const url = new URL(req.url!, origin);
    paths.push(url.pathname);
    // From its arrival: a request can be dropped before this has done what it asks.
    res.on("close", () => {
      if (!res.writableEnded) dropped.push(url.pathname);
    });
    const json = (status: number, body: unknown) => {
      if (res.destroyed) return;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const holding = async (name: string) => {
      const gate = held.get(name);
      if (!gate) return;
      reached.push(name);
      await gate;
    };
    void (async () => {
      if (url.pathname === "/api/v1/hello") {
        await holding("hello");
        for (const token of Object.keys(people)) {
          const key = await tokenKey(token);
          if ((await serviceId(key)) === url.searchParams.get("id"))
            return json(200, {
              proof: await serviceProof(
                key,
                url.searchParams.get("nonce")!,
                origin,
              ),
            });
        }
        return json(401, { error: { code: "UNAUTHENTICATED", message: "" } });
      }
      const principal =
        people[String(req.headers.authorization).replace("Bearer ", "")];
      if (url.pathname === "/api/v1/tools") {
        await holding("tools");
        const { tools, withheld } = catalogFor(principal);
        return json(200, { tools, ...(older ? {} : { withheld }) });
      }
      const stage = /^\/api\/v1\/projects\/([^/]+)\/documents\/stage$/.exec(
        url.pathname,
      );
      if (stage)
        try {
          const receipt = await stageDocument(
            store,
            principal,
            stage[1]!,
            req,
            true,
          );
          await holding("stage");
          return json(200, receipt);
        } catch (e) {
          const { code, message, retryable } = toCommandError(e);
          return json(400, { error: { code, message, retryable } });
        }
      let text = "";
      for await (const chunk of req) text += chunk;
      const { operation, parameters, requestId } = JSON.parse(text);
      calls.push({ operation, parameters });
      let result: unknown;
      try {
        authorize(principal, operation);
        result = stubs[operation]
          ? stubs[operation](parameters)
          : (
              await execute(
                { store, queue, principal, requestId },
                operation,
                parameters,
              )
            ).result;
      } catch (e) {
        const { code, message, retryable } = toCommandError(e);
        return json(400, { error: { code, message, retryable } });
      }
      await holding(operation);
      json(200, { result });
    })();
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  ends.push(async () => {
    http.closeAllConnections();
    http.close();
    await queue.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    origin,
    store,
    queue,
    calls,
    paths,
    reached,
    dropped,
    older: () => {
      older = true;
    },
    count: (operation: string) =>
      calls.filter((c) => c.operation === operation).length,
    hold: (name: string) => {
      let open = () => {};
      held.set(name, new Promise<void>((r) => (open = r)));
      return () => {
        held.delete(name);
        open();
      };
    },
  };
}

function connect(origin: string, token: string) {
  const { YAMAKAN_MCP_LOCAL_CLIENT: _, ...env } = process.env;
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    {
      env: { ...env, YAMAKAN_URL: origin, YAMAKAN_AGENT_TOKEN: token },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  ends.push(async () => {
    if (child.exitCode !== null) return;
    const gone = once(child, "exit");
    child.kill();
    await gone;
  });
  const answers: any[] = [];
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += String(c)));
  const waiting = new Map<unknown, (value: any) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    answers.push(message);
    waiting.get(message.id)?.(message);
  });
  // Each on its own line, all in one write.
  const write = (...messages: object[]) =>
    child.stdin.write(
      messages
        .map((m) => `${JSON.stringify({ jsonrpc: "2.0", ...m })}\n`)
        .join(""),
    );
  let next = 1;
  const send = (method: string, params?: unknown, id: unknown = next++) => {
    const answered = new Promise<any>((r) => waiting.set(id, r));
    write({ id, method, params });
    return { id, answered };
  };
  return {
    answers,
    stderr: () => stderr,
    closeErrors: () => child.stderr.destroy(),
    write,
    send,
    request: (method: string, params?: unknown) =>
      send(method, params).answered,
    call: (operation: string, parameters: object = {}) =>
      send("tools/call", { name: tool(operation), arguments: parameters }),
    cancel: (requestId: unknown) =>
      write({ method: "notifications/cancelled", params: { requestId } }),
    // Every line so far has been handled once a ping is answered.
    settled: async () =>
      assert.deepEqual((await send("ping").answered).result, {}),
    answeredTo: (id: unknown) => answers.filter((a) => a.id === id).length,
  };
}
const until = async (what: () => boolean, why: string) => {
  for (const end = Date.now() + 10_000; !what();) {
    assert.ok(Date.now() < end, why);
    await wait(10);
  }
};

test("each token is shown exactly what it may call, marked as what it does", async () => {
  const people = {
    reader: agent("project:read"),
    renderer: agent("render:execute"),
    none: agent(),
    writer: agent("project:read", "project:write"),
    local: { id: "local-client", scopes: cliScopes() } as Principal,
  };
  const s = await service(people);
  const sizes: Record<string, number> = {};
  for (const [token, principal] of Object.entries(people)) {
    const client = connect(s.origin, token);
    const { tools } = (await client.request("tools/list")).result;
    const commandsShown = tools.filter(
      (t: any) => t.title !== "yamakan.document.save",
    );
    sizes[token] = commandsShown.length;
    const rest = await new YamakanClient({
      baseUrl: s.origin,
      token,
    }).catalog();
    assert.deepEqual(
      commandsShown.map((t: any) => t.title).sort(),
      rest.tools.map((t) => t.name).sort(),
    );
    assert.equal(
      rest.tools.length + rest.withheld.length,
      Object.keys(commands).length,
    );
    // A composite is shown with the command it is made of.
    assert.equal(
      tools.length > commandsShown.length,
      commandsShown.some((t: any) => t.title === "yamakan.document.commit"),
    );
    assert.ok(
      Buffer.byteLength(JSON.stringify(tools)) < MCP_LIMITS.outputBytes,
    );
    for (const t of commandsShown) {
      authorize(principal, t.title);
      const entry = catalog().find((c) => c.name === t.title)!;
      assert.equal(entry.humanOnly, false, t.title);
      assert.deepEqual(
        t.annotations,
        entry.mutation
          ? { readOnlyHint: false, destructiveHint: entry.destructive }
          : { readOnlyHint: true },
        t.title,
      );
    }
  }
  const { local, reader, renderer, none, writer } = sizes;
  assert.equal(none, 0);
  assert.ok(reader < writer && writer < local && renderer < local);
  assert.equal(
    local,
    catalog().filter((c) => !c.humanOnly).length -
      catalog().filter(
        (c) => !c.humanOnly && !cliScopes().has(c.scope as Scope),
      ).length,
  );
  const client = connect(s.origin, "renderer");
  const { tools } = (await client.request("tools/list")).result;
  const of = (operation: string) =>
    tools.find((t: any) => t.name === tool(operation)).annotations;
  assert.deepEqual(of("yamakan.proxy.build"), {
    readOnlyHint: false,
    destructiveHint: false,
  });
  assert.deepEqual(of("yamakan.proxy.cancel"), {
    readOnlyHint: false,
    destructiveHint: true,
  });
});

test("a withheld tool is answered by the service's own refusal, and one that is not there is unknown", async () => {
  const s = await service({ renderer: agent("render:execute") });
  const client = connect(s.origin, "renderer");
  const project = await s.store.create("Kept");
  const rest = new YamakanClient({ baseUrl: s.origin, token: "renderer" });
  for (const [operation, parameters] of [
    ["yamakan.project.save", { project, expectedRevision: project.revision }],
    ["yamakan.generation.start", {}],
    ["yamakan.agent.create", {}],
    ["yamakan.project.list", {}],
  ] as const) {
    const answer = await client.call(operation, parameters).answered;
    assert.equal(answer.result.isError, true);
    const said = JSON.parse(answer.result.content[0].text);
    assert.equal(said.code, "SCOPE_DENIED");
    await assert.rejects(
      rest.call(operation, parameters as never),
      (e: any) => e.code === said.code && e.message === said.message,
    );
    if (/generation|agent/.test(operation))
      assert.match(said.message, /requires the browser session/);
  }
  // A save's first step is refused as its command is.
  const save = await client.call("yamakan.document.save", {
    projectId: project.id,
    content: {},
    kind: "studio",
    schemaVersion: 1,
  }).answered;
  assert.equal(save.result.isError, true);
  assert.deepEqual(
    JSON.parse(save.result.content[0].text).code,
    "SCOPE_DENIED",
  );
  assert.equal((await s.store.load(project.id)).revision, project.revision);
  for (const name of ["yamakan_nothing", "constructor", ""]) {
    const answer = await client.request("tools/call", { name });
    assert.equal(answer.error.code, -32602, name);
  }
});

test("a cancelled read is aborted, gets no answer, and frees its place", async () => {
  const s = await service({ reader: agent("project:read") });
  const client = connect(s.origin, "reader");
  await client.request("tools/list");
  const open = s.hold("yamakan.project.list");
  const read = client.call("yamakan.project.list");
  await until(() => s.count("yamakan.project.list") === 1, "sent");
  const started = Date.now();
  client.cancel(read.id);
  await until(() => s.dropped.length === 1, "aborted");
  assert.ok(Date.now() - started < 1000);
  open();
  await client.settled();
  assert.equal(client.answeredTo(read.id), 0);
  // Its place and its id are free again.
  const again = client.send(
    "tools/call",
    { name: "yamakan_project_list", arguments: {} },
    read.id,
  );
  assert.deepEqual(
    JSON.parse((await again.answered).result.content[0].text),
    [],
  );
  // And that id names the new request, not the one before it.
  const reopen = s.hold("yamakan.project.list");
  client.send(
    "tools/call",
    { name: "yamakan_project_list", arguments: {} },
    read.id,
  );
  await until(() => s.count("yamakan.project.list") === 3, "sent again");
  client.cancel(read.id);
  await until(() => s.dropped.length === 2, "aborted again");
  reopen();
  // The list is a read too, also when a first call loads it.
  const shut = s.hold("tools");
  const list = client.send("tools/list");
  await until(() => s.reached.includes("tools"), "asked for");
  client.cancel(list.id);
  await until(() => s.dropped.length === 3, "the list is aborted");
  shut();
  await client.settled();
  assert.equal(client.answeredTo(list.id), 0);
});

// A job as the service would have it, with nothing running it.
const queuedJob = async (
  s: Awaited<ReturnType<typeof service>>,
  id: string,
) => {
  const project = await s.store.create("P");
  s.store.transaction((db) =>
    db
      .prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'export', ?, 0, ?, '{}', 'queued')",
      )
      .run(id, project.id, id),
  );
};
const stateOf = (s: Awaited<ReturnType<typeof service>>, id: string) =>
  (
    s.store.read((db) =>
      db.prepare("SELECT state FROM jobs WHERE job_id = ?").get(id),
    ) as { state: string }
  ).state;

test("a cancelled read frees its place among those in progress, and an id in use names its first", async () => {
  const s = await service({ reader: agent("project:read", "project:write") });
  const client = connect(s.origin, "reader");
  await client.request("tools/list");
  const open = s.hold("yamakan.project.list");
  const sent = () => s.count("yamakan.project.list");
  // One fewer than may be in progress, so that a cancellation is still read.
  const reads = Array.from({ length: MCP_LIMITS.inFlight - 1 }, () =>
    client.call("yamakan.project.list"),
  );
  await until(() => sent() === reads.length, "all sent");
  client.cancel(reads[0].id);
  await until(() => s.dropped.length === 1, "aborted");
  const started = Date.now();
  // Two more fit, and only with its place free.
  client.call("yamakan.project.list");
  client.call("yamakan.project.list");
  await until(() => sent() === reads.length + 2, "both sent");
  assert.ok(Date.now() - started < 1000);
  open();
  for (const read of reads.slice(1)) await read.answered;
  await client.settled();
  // Two with one id: a read, then a change that a cancellation would let finish unanswered.
  const reopen = s.hold("yamakan.project.list");
  const remake = s.hold("yamakan.project.create");
  const before = sent();
  const asked = (name: string, args: object) => ({
    id: "same",
    method: "tools/call",
    params: { name, arguments: args },
  });
  client.write(
    asked("yamakan_project_list", {}),
    asked("yamakan_project_create", { name: "Second" }),
  );
  await until(
    () => sent() === before + 1 && s.count("yamakan.project.create") === 1,
    "both sent",
  );
  client.cancel("same");
  await until(() => s.dropped.length === 2, "the first aborted");
  reopen();
  remake();
  await until(() => client.answeredTo("same") === 1, "the second answered");
  await client.settled();
  const [answer] = client.answers.filter((a) => a.id === "same");
  assert.equal(JSON.parse(answer.result.content[0].text).name, "Second");
  assert.equal(client.answeredTo("same"), 1);
});

test("a cancelled batch and a cancelled proxy are stopped by their own commands", async () => {
  const projectId = randomUUID();
  const assetId = randomUUID();
  const batchId = "b".repeat(32);
  for (const [start, parameters, result, cancel, input] of [
    [
      "yamakan.export.batch",
      { projectId, idempotencyKey: "k", variants: [] },
      { batchId },
      "yamakan.export.batchCancel",
      { projectId, batchId },
    ],
    [
      "yamakan.proxy.build",
      { projectId, assetId },
      { state: "queued" },
      "yamakan.proxy.cancel",
      { projectId, assetId },
    ],
    // What it started is not named, so nothing is stopped.
    ["yamakan.export.batch", { projectId }, {}, "", null],
  ] as const) {
    const s = await service(
      { renderer: agent("render:execute") },
      {
        [start]: () => result,
        "yamakan.export.batchCancel": () => ({}),
        "yamakan.proxy.cancel": () => ({}),
      },
    );
    const client = connect(s.origin, "renderer");
    await client.request("tools/list");
    const open = s.hold(start);
    const call = client.call(start, parameters);
    await until(() => s.reached.includes(start), "sent");
    client.cancel(call.id);
    await client.settled();
    open();
    if (cancel) await until(() => s.count(cancel) === 1, "stopped");
    else await wait(300);
    await client.settled();
    assert.deepEqual(
      s.calls.slice(1),
      cancel ? [{ operation: cancel, parameters: input }] : [],
    );
    assert.equal(client.answeredTo(call.id), 0);
  }
});

test("a client that closes the error stream loses only its lines", async () => {
  const s = await service(
    { both: agent("render:execute", "job:control") },
    {
      "yamakan.export.video": () => ({ id: randomUUID() }),
      "yamakan.job.cancel": () => {
        throw new Error("gone");
      },
    },
  );
  const client = connect(s.origin, "both");
  await client.request("tools/list");
  client.closeErrors();
  const open = s.hold("yamakan.export.video");
  const start = client.call("yamakan.export.video", {});
  await until(() => s.reached.includes("yamakan.export.video"), "sent");
  client.cancel(start.id);
  await client.settled();
  open();
  await until(() => s.count("yamakan.job.cancel") === 1, "asked");
  await wait(200);
  await client.settled();
});

test("what became of the cancel is said, and an address may end in slashes", async () => {
  const s = await service(
    { both: agent("render:execute", "job:control") },
    { "yamakan.export.video": () => ({ id: randomUUID() }) },
  );
  for (const slashes of ["", "/", "//"]) {
    const client = connect(s.origin + slashes, "both");
    await client.request("tools/list");
    s.reached.length = 0;
    const before = s.count("yamakan.job.cancel");
    const open = s.hold("yamakan.export.video");
    const start = client.call("yamakan.export.video", {});
    await until(() => s.reached.includes("yamakan.export.video"), "sent");
    client.cancel(start.id);
    await client.settled();
    open();
    // The real cancel knows no such job.
    await until(
      () => /job\.cancel refused \([A-Z_]+\)\.\n/.test(client.stderr()),
      `said after ${JSON.stringify(slashes)}`,
    );
    assert.equal(s.count("yamakan.job.cancel"), before + 1);
    assert.equal(client.answeredTo(start.id), 0);
  }
});

test("a list without withheld names, as an older service gives it, is read", async () => {
  const s = await service({ reader: agent("project:read") });
  s.older();
  const client = connect(s.origin, "reader");
  const { tools } = (await client.request("tools/list")).result;
  assert.ok(tools.length > 0);
});

test("a cancelled start finishes, and what it started is stopped once, if the token may", async () => {
  const may = randomUUID();
  const mayNot = randomUUID();
  const s = await service(
    {
      both: agent("render:execute", "job:control"),
      renderer: agent("render:execute"),
    },
    {
      "yamakan.export.video": (a) => ({
        id: a.idempotencyKey === "may" ? may : mayNot,
      }),
    },
  );
  await queuedJob(s, may);
  await queuedJob(s, mayNot);
  for (const [token, key, job] of [
    ["both", "may", may],
    ["renderer", "mayNot", mayNot],
  ]) {
    const client = connect(s.origin, token);
    await client.request("tools/list");
    const before = s.count("yamakan.export.video");
    const cancels = s.count("yamakan.job.cancel");
    const open = s.hold("yamakan.export.video");
    const start = client.call("yamakan.export.video", {
      projectId: randomUUID(),
      idempotencyKey: key,
    });
    await until(() => s.count("yamakan.export.video") > before, "sent");
    client.cancel(start.id);
    client.cancel(start.id);
    await client.settled();
    // It was sent, so it is not aborted.
    assert.equal(s.dropped.length, 0);
    assert.equal(s.count("yamakan.job.cancel"), cancels);
    open();
    if (token === "both") {
      await until(() => stateOf(s, job) === "cancelled", "stopped");
      await until(() => /job\.cancel asked for/.test(client.stderr()), "said");
    } else await wait(300);
    await client.settled();
    assert.equal(
      s.count("yamakan.job.cancel") - cancels,
      token === "both" ? 1 : 0,
    );
    assert.equal(stateOf(s, job), token === "both" ? "cancelled" : "queued");
    assert.equal(client.answeredTo(start.id), 0);
  }
});

test("any other change is left to finish, with no answer, and none already answered is touched", async () => {
  const job = randomUUID();
  const s = await service(
    { all: agent("project:write", "render:execute", "job:control") },
    { "yamakan.export.video": () => ({ id: job }) },
  );
  await queuedJob(s, job);
  const client = connect(s.origin, "all");
  await client.request("tools/list");
  const open = s.hold("yamakan.project.create");
  const create = client.call("yamakan.project.create", { name: "Finished" });
  await until(() => s.count("yamakan.project.create") === 1, "sent");
  client.cancel(create.id);
  await client.settled();
  open();
  await wait(200);
  await client.settled();
  assert.equal(client.answeredTo(create.id), 0);
  assert.deepEqual(s.dropped, []);
  assert.deepEqual((await s.store.list()).map((p) => p.name).sort(), [
    "Finished",
    "P",
  ]);
  // Answered first, then cancelled: what it started goes on.
  const start = client.call("yamakan.export.video", {
    projectId: randomUUID(),
    idempotencyKey: "k",
  });
  assert.equal((await start.answered).result.isError, undefined);
  client.cancel(start.id);
  await client.settled();
  await wait(200);
  assert.equal(s.count("yamakan.job.cancel"), 0);
  assert.equal(stateOf(s, job), "queued");
});

test("a change cancelled before it is sent is never sent", async () => {
  const s = await service({ writer: agent("project:write") });
  const client = connect(s.origin, "writer");
  // Its first call loads the list, which is held.
  const open = s.hold("tools");
  const create = client.call("yamakan.project.create", { name: "Never" });
  await until(() => s.reached.includes("tools"), "asked for");
  client.cancel(create.id);
  await until(() => s.dropped.length === 1, "the list is aborted");
  open();
  await client.settled();
  assert.equal(s.count("yamakan.project.create"), 0);
  assert.equal(client.answeredTo(create.id), 0);
  // Nor while the service is still proving itself.
  await client.request("tools/list");
  const prove = s.hold("hello");
  const early = client.call("yamakan.project.create", { name: "Never" });
  await until(() => s.reached.includes("hello"), "proving");
  client.cancel(early.id);
  await until(() => s.dropped.length === 2, "the proof is aborted");
  prove();
  await client.settled();
  // Nor a save, when the cancellation comes with it, or when its content is staged.
  const document = {
    projectId: randomUUID(),
    content: createEmptyStudioDocument({ id: randomUUID(), name: "Never" }),
    kind: "studio",
    schemaVersion: 1,
  };
  client.write(
    {
      id: "save",
      method: "tools/call",
      params: { name: "yamakan_document_save", arguments: document },
    },
    { method: "notifications/cancelled", params: { requestId: "save" } },
  );
  await client.settled();
  await wait(200);
  const staged = () => s.paths.filter((p) => p.endsWith("/stage")).length;
  assert.equal(staged(), 0, s.paths.join(" "));
  // Its content does not go either, when it is stopped while the service proves itself.
  s.reached.length = 0;
  const proving = s.hold("hello");
  const unproved = client.call("yamakan.document.save", document);
  await until(() => s.reached.includes("hello"), "proving");
  client.cancel(unproved.id);
  await client.settled();
  proving();
  await wait(200);
  await client.settled();
  assert.equal(staged(), 0, s.paths.join(" "));
  assert.equal(client.answeredTo(unproved.id), 0);
  const project = await s.store.create("Staged");
  const keep = s.hold("stage");
  const save = client.call("yamakan.document.save", {
    ...document,
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: randomUUID(),
    expectedContentHash: null,
  });
  await until(() => s.reached.includes("stage"), "staged");
  client.cancel(save.id);
  await client.settled();
  keep();
  await wait(200);
  await client.settled();
  assert.equal(staged(), 1);
  assert.equal(s.count("yamakan.document.commit"), 0);
  assert.equal(s.count("yamakan.project.create"), 0);
  for (const id of [early.id, "save", save.id])
    assert.equal(client.answeredTo(id), 0);
  // The next call loads the list again and works.
  const next = await client.call("yamakan.project.create", { name: "Made" })
    .answered;
  assert.equal(next.result.isError, undefined);
});

test("a cancellation that names nothing in progress does nothing", async () => {
  const s = await service({ reader: agent("project:read") });
  const client = connect(s.origin, "reader");
  const first = client.send("initialize", { protocolVersion: "2025-06-18" });
  client.cancel(first.id);
  assert.equal((await first.answered).result.serverInfo.name, "yamakan");
  for (const params of [
    undefined,
    null,
    [],
    "x",
    {},
    { requestId: null },
    { requestId: {} },
    { requestId: "missing" },
    { requestId: 999 },
    { requestId: String(first.id) },
    { requestId: first.id },
  ])
    client.write({ method: "notifications/cancelled", params });
  await client.settled();
  // The wrong kind of id is another id.
  const open = s.hold("yamakan.project.list");
  const read = client.call("yamakan.project.list");
  await until(() => s.count("yamakan.project.list") === 1, "sent");
  client.cancel(String(read.id));
  await client.settled();
  assert.deepEqual(s.dropped, []);
  open();
  assert.equal((await read.answered).result.isError, undefined);
  client.cancel(read.id);
  client.cancel(read.id);
  await client.settled();
  // initialize, the read and the pings: nothing more was written.
  assert.equal(client.answers.length, 5);
});

test("each command a cancellation stops has a cancel of its own, with input it takes", () => {
  const id = randomUUID();
  const batchId = "a".repeat(32);
  // The fields the answers really have, which the compiler holds to the commands.
  const results = {
    "yamakan.export.video": {
      id,
    } as OperationResult<"yamakan.export.video">,
    "yamakan.blender.render": {
      id,
    } as OperationResult<"yamakan.blender.render">,
    "yamakan.blender.track": { id } as OperationResult<"yamakan.blender.track">,
    "yamakan.director.renderShot": {
      job: { id },
    } as OperationResult<"yamakan.director.renderShot">,
    "yamakan.export.batch": {
      batchId,
    } as OperationResult<"yamakan.export.batch">,
    "yamakan.proxy.build": {} as OperationResult<"yamakan.proxy.build">,
  };
  const inputs: Record<string, unknown> = {
    "yamakan.export.batch": { projectId: id, batchId },
    "yamakan.proxy.build": { projectId: id, assetId: id },
  };
  assert.deepEqual(
    Object.keys(CANCEL_TWINS).sort(),
    Object.keys(results).sort(),
  );
  for (const [name, twin] of Object.entries(CANCEL_TWINS)) {
    assert.ok(Object.hasOwn(commands, name), name);
    assert.ok(commands[name as Operation].mutation, name);
    const cancel = commands[twin!.cancel];
    assert.ok(cancel?.mutation, twin!.cancel);
    const args = { projectId: id, assetId: id };
    const built = twin!.input(args, results[name as keyof typeof results]);
    assert.deepEqual(built, inputs[name] ?? { jobId: id }, name);
    assert.deepEqual(cancel.input.parse(built), built);
    // An answer that names nothing stops nothing.
    for (const nothing of [null, undefined, "x", 1, {}, { id: 1 }])
      if (name !== "yamakan.proxy.build")
        assert.equal(twin!.input(args, nothing), null, name);
    for (const missing of [{}, { projectId: 1, assetId: 2 }])
      if (inputs[name])
        assert.equal(
          twin!.input(missing, results[name as keyof typeof results]),
          null,
          name,
        );
  }
});

test("what a cancellation does follows from the command and from where it is", () => {
  const read = { name: "yamakan.project.list", mutation: false };
  const change = { name: "yamakan.project.create", mutation: true };
  const start = { name: "yamakan.export.video", mutation: true };
  const odd = { name: "constructor", mutation: true };
  for (const [operation, waiting, sent] of [
    [read, "abort", "abort"],
    [change, "abort", "finish-and-drop"],
    [start, "abort", "finish-then-cancel"],
    [odd, "abort", "finish-and-drop"],
  ] as const) {
    assert.equal(cancelPlan(operation, "waiting"), waiting);
    assert.equal(cancelPlan(operation, "sent"), sent);
    assert.equal(cancelPlan(operation, "answered"), "ignore");
  }
});

test("a caller's own stop is its own, and nothing is sent after it", async () => {
  const s = await service({ reader: agent(...Scopes.slice(0, 1)) });
  const client = new YamakanClient({ baseUrl: s.origin, token: "reader" });
  const stopped = AbortSignal.abort();
  await assert.rejects(
    client.call("yamakan.project.list", {}, undefined, { signal: stopped }),
    { name: "AbortError" },
  );
  assert.equal(s.calls.length, 0);
  const open = s.hold("yamakan.project.list");
  const controller = new AbortController();
  const read = client.call("yamakan.project.list", {}, undefined, {
    signal: controller.signal,
  });
  await until(() => s.calls.length === 1, "sent");
  controller.abort();
  await assert.rejects(read, { name: "AbortError" });
  open();
  // Stopped while the service is still to prove itself: not the service's fault.
  const proving = new AbortController();
  const asked = new YamakanClient({
    baseUrl: s.origin,
    token: "reader",
    fetch: ((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => {
        init!.signal!.addEventListener("abort", () =>
          reject(init!.signal!.reason),
        );
        proving.abort();
      })) as never,
  }).call("yamakan.project.list", {}, undefined, { signal: proving.signal });
  await assert.rejects(asked, { name: "AbortError" });
});
