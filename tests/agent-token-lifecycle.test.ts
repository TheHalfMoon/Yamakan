import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore, agentTokenExpired } from "../core/store.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import type { Scope } from "../core/command/registry.ts";
import { CommandError } from "../core/command/errors.ts";
import { JobSupervisor } from "../core/jobs.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-agent-life-"));
  bases.push(root);
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  return { root, store, queue, browser };
}

test("a token made to end stops working at its end, and is listed as ended", async () => {
  const { store, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", {
      label: "nightly",
      scopes: ["project:read"],
      expiresInDays: 7,
    })
  ).result as { agentId: string; token: string; expiresAt: string };
  const madeAt = Date.now();
  const end = Date.parse(made.expiresAt);
  assert.ok(Math.abs(end - (madeAt + 7 * 86_400_000)) < 60_000);
  assert.ok(store.principalForAgentToken(made.token));
  assert.ok(store.principalForAgentToken(made.token, new Date(end - 1)));
  assert.equal(store.principalForAgentToken(made.token, new Date(end)), null);
  const later = store.listAgentTokens(new Date(end + 1)).tokens[0];
  assert.equal(later.expired, true);
  assert.equal(later.active, false);
  assert.equal(later.revoked, false);
  store.close();
});

test("without an end a token works until revoked, as before", async () => {
  const { store, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", { scopes: ["project:read"] })
  ).result as { agentId: string; token: string; expiresAt: string | null };
  assert.equal(made.expiresAt, null);
  assert.ok(
    store.principalForAgentToken(made.token, new Date("2100-01-01T00:00:00Z")),
  );
  store.close();
});

test("the list names every token and what it may do, never the token itself", async () => {
  const { store, browser } = await workspace();
  const a = (
    await execute(browser, "yamakan.agent.create", {
      label: "editor bot",
      scopes: ["project:read", "project:write"],
    })
  ).result as { agentId: string; token: string };
  const b = (
    await execute(browser, "yamakan.agent.create", {
      scopes: ["project:read"],
      expiresInDays: 1,
    })
  ).result as { agentId: string; token: string };
  await execute(browser, "yamakan.agent.revoke", { agentId: a.agentId });
  const listed = (await execute(browser, "yamakan.agent.list", {})).result as {
    tokens: {
      agentId: string;
      label: string | null;
      scopes: string[] | null;
      revoked: boolean;
      active: boolean;
      expiresAt: string | null;
    }[];
  };
  const text = JSON.stringify(listed);
  for (const secret of [a.token, b.token]) {
    assert.ok(!text.includes(secret), "no token is listed");
  }
  assert.ok(!/[0-9a-f]{64}/.test(text), "nor any hash");
  const byId = new Map(listed.tokens.map((t) => [t.agentId, t]));
  assert.deepEqual(
    {
      label: byId.get(a.agentId)!.label,
      scopes: byId.get(a.agentId)!.scopes,
      revoked: byId.get(a.agentId)!.revoked,
      active: byId.get(a.agentId)!.active,
    },
    {
      label: "editor bot",
      scopes: ["project:read", "project:write"],
      revoked: true,
      active: false,
    },
  );
  assert.equal(byId.get(b.agentId)!.active, true);
  assert.ok(byId.get(b.agentId)!.expiresAt);
  store.close();
});

test("only a person lists tokens; an agent cannot, even one allowed to revoke", async () => {
  const { store, queue, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", { scopes: ["project:read"] })
  ).result as { token: string };
  const agent = store.principalForAgentToken(made.token)!;
  await assert.rejects(
    execute({ store, queue, principal: agent }, "yamakan.agent.list", {}),
    (e: unknown) => e instanceof CommandError && e.code === "SCOPE_DENIED",
  );
  await assert.rejects(
    execute(
      {
        store,
        queue,
        principal: {
          id: agent.id,
          scopes: new Set(Scopes) as ReadonlySet<Scope>,
        },
      },
      "yamakan.agent.list",
      {},
    ),
    (e: unknown) => e instanceof CommandError,
  );
  store.close();
});

test("an end time is bounded, and one that cannot be read ends the token", async () => {
  const { store, browser } = await workspace();
  for (const expiresInDays of [0, -1, 367, 1.5])
    await assert.rejects(
      execute(browser, "yamakan.agent.create", {
        scopes: ["project:read"],
        expiresInDays,
      }),
      // Refused by the command's input schema, before anything is made.
      (e: unknown) =>
        e instanceof Error && /expiresInDays|number|integer/i.test(String(e)),
    );
  assert.equal(store.listAgentTokens().tokens.length, 0);
  const now = new Date("2026-11-10T00:00:00.000Z");
  assert.equal(agentTokenExpired(null, now), false);
  assert.equal(agentTokenExpired("2026-11-10T00:00:00.001Z", now), false);
  assert.equal(agentTokenExpired("2026-11-10T00:00:00.000Z", now), true);
  assert.equal(agentTokenExpired("not a time at all here!!", now), true);
  store.close();
});

test("a token made before the upgrade keeps working and has no end", async () => {
  const { root, store, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", { scopes: ["project:read"] })
  ).result as { agentId: string; token: string };
  store.close();
  // Back to schema 16: the column did not exist, so the row has no end.
  const file = path.join(root, "workspace.sqlite");
  const db = new DatabaseSync(file);
  db.exec("ALTER TABLE agent_tokens DROP COLUMN expires_at");
  db.exec("PRAGMA user_version = 16");
  db.close();
  const upgraded = new ProjectStore(root);
  await upgraded.initialize();
  const listed = upgraded.listAgentTokens().tokens;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].expiresAt, null);
  assert.equal(listed[0].active, true);
  assert.ok(upgraded.principalForAgentToken(made.token));
  upgraded.close();
});

test("a restored token table without the end column is read as having no end", async () => {
  const { root, store, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", { scopes: ["project:read"] })
  ).result as { token: string };
  store.close();
  // Schema 17, but the table as an older build wrote it.
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  db.exec("ALTER TABLE agent_tokens DROP COLUMN expires_at");
  db.close();
  const reopened = new ProjectStore(root);
  await reopened.initialize();
  assert.ok(reopened.principalForAgentToken(made.token));
  assert.equal(reopened.listAgentTokens().tokens[0].expiresAt, null);
  reopened.close();
});

test("a database that already has the end column but an older version opens", async () => {
  const { root, store, browser } = await workspace();
  const made = (
    await execute(browser, "yamakan.agent.create", { scopes: ["project:read"] })
  ).result as { token: string };
  store.close();
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  db.exec("PRAGMA user_version = 16");
  db.close();
  const reopened = new ProjectStore(root);
  await reopened.initialize();
  assert.ok(reopened.principalForAgentToken(made.token));
  reopened.close();
});
