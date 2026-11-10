import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { YamakanClient, YamakanError } from "../sdk/client.ts";
import { serviceId, serviceProof, tokenKey } from "../sdk/service-proof.ts";
import { ProjectStore } from "../core/store.ts";
import type { Scope } from "../core/command/registry.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

const TOKEN = "a".repeat(64);
const ok = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// A service stand-in that records what it was sent and answers hello with `proof`.
function service(answer: (url: URL) => Promise<Response>) {
  const seen: { url: string; authorization: string | null }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    seen.push({
      url: url.pathname,
      authorization: headers.get("authorization"),
    });
    if (url.pathname === "/api/v1/hello") return answer(url);
    return ok({ apiVersion: 1, requestId: "r", result: { projects: [] } });
  }) as typeof globalThis.fetch;
  return { fetch, seen };
}
const client = (fetch: typeof globalThis.fetch) =>
  new YamakanClient({ baseUrl: "http://127.0.0.1:4318", token: TOKEN, fetch });

test("the proof is a standard HMAC-SHA256 of the challenge, keyed by the token's hash", async () => {
  const key = createHash("sha256").update(TOKEN).digest("hex");
  assert.equal(await tokenKey(TOKEN), key);
  const nonce = "b".repeat(64);
  assert.equal(
    await serviceProof(key, nonce),
    createHmac("sha256", key)
      .update(`yamakan-service-proof/1:${nonce}`)
      .digest("hex"),
  );
  // The id names the token one way only: it is neither the token nor its hash.
  const id = await serviceId(key);
  assert.notEqual(id, key);
  assert.notEqual(id, TOKEN);
});

test("a process holding the port that cannot prove it never receives the token", async () => {
  for (const answer of [
    async () => ok({ apiVersion: 1, proof: "0".repeat(64) }),
    async () => ok({ apiVersion: 1 }),
    async () => new Response("not json"),
    async () => {
      throw new Error("connection refused");
    },
  ]) {
    const { fetch, seen } = service(answer);
    await assert.rejects(
      client(fetch).call("yamakan.project.list", {}),
      (e: unknown) =>
        e instanceof YamakanError &&
        e.code === "UNAVAILABLE" &&
        /did not prove/.test(e.message),
    );
    assert.ok(
      seen.every((r) => r.authorization === null),
      "no request carried the token",
    );
    assert.ok(seen.every((r) => r.url === "/api/v1/hello"));
  }
});

test("a proof made for another challenge is refused", async () => {
  const key = await tokenKey(TOKEN);
  const stale = await serviceProof(key, "c".repeat(64));
  const { fetch, seen } = service(async () =>
    ok({ apiVersion: 1, proof: stale }),
  );
  await assert.rejects(client(fetch).call("yamakan.project.list", {}));
  assert.ok(seen.every((r) => r.authorization === null));
});

test("a service refusal is told as any call's, and still no token is sent", async () => {
  const { fetch, seen } = service(
    async () =>
      new Response(
        JSON.stringify({
          apiVersion: 1,
          requestId: "service-trace",
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required.",
            retryable: false,
          },
        }),
        { status: 401 },
      ),
  );
  await assert.rejects(
    client(fetch).call("yamakan.project.list", {}),
    (e: unknown) =>
      e instanceof YamakanError &&
      e.code === "UNAUTHENTICATED" &&
      e.requestId === "service-trace",
  );
  assert.ok(seen.every((r) => r.authorization === null));
});

test("the service that proves it is sent the token, and is asked only once", async () => {
  const key = await tokenKey(TOKEN);
  const { fetch, seen } = service(async (url) => {
    assert.equal(url.searchParams.get("id"), await serviceId(key));
    return ok({
      apiVersion: 1,
      proof: await serviceProof(key, url.searchParams.get("nonce")!),
    });
  });
  const c = client(fetch);
  await c.call("yamakan.project.list", {});
  await c.call("yamakan.project.list", {});
  assert.deepEqual(
    seen.map((r) => r.url),
    ["/api/v1/hello", "/api/v1/call", "/api/v1/call"],
  );
  assert.equal(seen[0].authorization, null);
  assert.equal(seen[1].authorization, `Bearer ${TOKEN}`);
});

test("without a token (the browser page) nothing is asked first", async () => {
  const { fetch, seen } = service(async () => ok({}));
  await new YamakanClient({ baseUrl: "http://127.0.0.1:4318", fetch }).call(
    "yamakan.project.list",
    {},
  );
  assert.deepEqual(
    seen.map((r) => r.url),
    ["/api/v1/call"],
  );
});

test("the service answers for live agent tokens only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-proof-"));
  bases.push(root);
  const store = new ProjectStore(root);
  await store.initialize();
  const read = new Set<Scope>(["project:read"]);
  const live = store.createAgentToken(read);
  const revoked = store.createAgentToken(read);
  store.revokeAgentToken(revoked.agentId);
  const ending = store.createAgentToken(read, undefined, 1);
  const hashes = (at: Date) => store.activeAgentTokenHashes(at);
  const now = new Date();
  assert.deepEqual(
    new Set(hashes(now)),
    new Set([await tokenKey(live.token), await tokenKey(ending.token)]),
  );
  assert.deepEqual(hashes(new Date(now.getTime() + 2 * 86_400_000)), [
    await tokenKey(live.token),
  ]);
  store.close();
});
