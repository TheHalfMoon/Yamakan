import test from "node:test";
import assert from "node:assert/strict";
import { cliScopes } from "../core/command/registry.ts";
import {
  AGENT_SCOPES,
  agentCreateInput,
  agentTokenStatus,
  type AgentScope,
  type AgentTokenRow,
} from "../src/agent-access.ts";

test("the page offers exactly the scopes the service lets an agent hold", () => {
  assert.deepEqual([...AGENT_SCOPES].sort(), [...cliScopes()].sort());
});

test("a token is made only once its scopes and its end are chosen", () => {
  const read = new Set<AgentScope>(["project:read"]);
  assert.deepEqual(
    agentCreateInput({ label: "", scopes: new Set(), end: "7" }),
    {
      ok: false,
      reason: "noScope",
    },
  );
  assert.deepEqual(agentCreateInput({ label: "", scopes: read, end: "" }), {
    ok: false,
    reason: "noEnd",
  });
  assert.deepEqual(
    agentCreateInput({ label: "x".repeat(81), scopes: read, end: "7" }),
    { ok: false, reason: "labelTooLong" },
  );
  assert.deepEqual(
    agentCreateInput({
      label: "  nightly  ",
      scopes: new Set<AgentScope>(["job:read", "project:read"]),
      end: "30",
    }),
    {
      ok: true,
      input: {
        label: "nightly",
        scopes: ["project:read", "job:read"],
        expiresInDays: 30,
      },
    },
  );
  // "Never" sends no end; a blank name sends no label.
  assert.deepEqual(
    agentCreateInput({ label: " ", scopes: read, end: "never" }),
    {
      ok: true,
      input: { scopes: ["project:read"] },
    },
  );
});

test("the list says what each token is, revoked before ended", () => {
  const row = (r: Partial<AgentTokenRow>): AgentTokenRow => ({
    agentId: "agent:1",
    label: null,
    scopes: ["project:read"],
    createdAt: "2026-11-10T00:00:00.000Z",
    expiresAt: null,
    revoked: false,
    expired: false,
    active: true,
    ...r,
  });
  assert.equal(agentTokenStatus(row({})), "active");
  assert.equal(
    agentTokenStatus(row({ expired: true, active: false })),
    "ended",
  );
  assert.equal(
    agentTokenStatus(row({ revoked: true, expired: true, active: false })),
    "revoked",
  );
  assert.equal(
    agentTokenStatus(row({ scopes: null, active: false })),
    "unreadable",
  );
});
