import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Scope } from "./command/registry.ts";
import { Scopes, assertAgentScopeCeiling } from "./command/registry.ts";
import { CommandError } from "./command/errors.ts";

export const AgentId = z.string().regex(/^agent:[0-9a-f-]{36}$/);

export type AgentId = z.infer<typeof AgentId>;

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newAgentToken() {
  return randomBytes(32).toString("hex");
}

export function newAgentId(): AgentId {
  return AgentId.parse(`agent:${randomUUID()}`);
}

export function parseAgentScopes(raw: string): ReadonlySet<Scope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CommandError("INTERNAL", "Agent token record is damaged.");
  }
  const list = z.array(z.enum(Scopes)).parse(parsed);
  const scopes = new Set(list) as ReadonlySet<Scope>;
  assertAgentScopeCeiling(scopes);
  return scopes;
}

export function encodeAgentScopes(scopes: ReadonlySet<Scope>) {
  assertAgentScopeCeiling(scopes);
  return JSON.stringify([...scopes].sort());
}
