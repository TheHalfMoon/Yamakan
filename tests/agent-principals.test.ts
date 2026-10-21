import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import type { Scope } from "../core/command/registry.ts";
import { CommandError } from "../core/command/errors.ts";
import {
  consumeLaunchSecret,
  writeLaunchLink,
  LAUNCH_TTL_MS,
} from "../core/launch.ts";
import { JobSupervisor } from "../core/jobs.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

test("launch secrets are single-use and expire", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-launch-"));
  bases.push(root);
  const origin = "http://127.0.0.1:4318";
  const { secret } = await writeLaunchLink(root, origin, 1_000);
  assert.equal((await consumeLaunchSecret(root, secret, 1_000)).ok, true);
  assert.equal((await consumeLaunchSecret(root, secret, 1_100)).ok, false);
  const fresh = await writeLaunchLink(root, origin, 1_000);
  assert.equal(
    (await consumeLaunchSecret(root, fresh.secret, 1_000 + LAUNCH_TTL_MS + 1))
      .ok,
    false,
  );
});

test("agent tokens derive principals and respect scope ceilings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-agents-"));
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
  const created = await execute(browser, "yamakan.agent.create", {
    scopes: ["project:read", "project:write"],
  });
  const { agentId, token } = created.result as {
    agentId: string;
    token: string;
    scopes: Scope[];
  };
  const agent = store.principalForAgentToken(token);
  assert.ok(agent);
  assert.equal(agent!.id, agentId);
  await assert.rejects(
    execute(browser, "yamakan.agent.create", {
      scopes: ["project:read", "agent:create"],
    }),
    (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
  );
  const agentCtx = { store, queue, principal: agent! };
  await execute(agentCtx, "yamakan.project.list", {});
  await assert.rejects(
    execute(agentCtx, "yamakan.agent.create", {
      scopes: ["project:read"],
    }),
    (e: unknown) => e instanceof CommandError && e.code === "SCOPE_DENIED",
  );
  await execute(browser, "yamakan.agent.revoke", { agentId });
  assert.equal(store.principalForAgentToken(token), null);
  store.close();
});

test("undo binds to the principal that wrote the batch", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-undo-principal-"));
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
  const created = await execute(browser, "yamakan.agent.create", {
    scopes: ["project:read", "project:write"],
  });
  const { token: agentToken } = created.result as { token: string };
  const agentPrincipal = store.principalForAgentToken(agentToken)!;
  const project = (
    await execute(
      { store, queue, principal: agentPrincipal },
      "yamakan.project.create",
      { name: "Undo isolation" },
    )
  ).result as { id: string; revision: number; tracks: { id: string }[] };
  const trackId = project.tracks[0]!.id;
  const clip = {
    type: "clip.add" as const,
    clipId: randomUUID(),
    trackId,
    assetId: null,
    title: "Agent",
    startTicks: 0,
    durationTicks: 705_600_000,
    sourceStartTicks: 0,
  };
  const batch = await execute(
    { store, queue, principal: agentPrincipal },
    "yamakan.project.applyBatch",
    {
      projectId: project.id,
      expectedRevision: project.revision,
      operations: [clip],
    },
  );
  const after = batch.result as { revision: number };
  const otherCreated = await execute(browser, "yamakan.agent.create", {
    scopes: ["project:read", "project:write"],
  });
  const { token: otherToken } = otherCreated.result as { token: string };
  const otherAgent = store.principalForAgentToken(otherToken)!;
  await assert.rejects(
    execute(
      { store, queue, principal: otherAgent },
      "yamakan.project.undo",
      { projectId: project.id, expectedRevision: after.revision },
    ),
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === "REVISION_CONFLICT" &&
      /another client/.test(e.message),
  );
  store.close();
});
