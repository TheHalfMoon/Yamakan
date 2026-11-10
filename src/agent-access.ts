// Agent access on the page (P1): the person makes, lists and revokes the tokens agents use
// (MCP, scripts). The service decides what a token may do; this only offers what it allows.

/**
 * The scopes an agent token may hold: every scope but those reserved for a person. Kept
 * equal to core/command/registry.ts `cliScopes()` by tests/agent-access.test.ts.
 */
export const AGENT_SCOPES = [
  "project:read",
  "project:write",
  "project:recover",
  "render:execute",
  "job:read",
  "job:control",
] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

/** When a new token ends: the person chooses one; nothing is chosen for them. */
export const AGENT_TOKEN_ENDS = ["7", "30", "90", "never"] as const;
export type AgentTokenEnd = (typeof AGENT_TOKEN_ENDS)[number];

export type AgentTokenRow = {
  agentId: string;
  label: string | null;
  scopes: string[] | null;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  expired: boolean;
  active: boolean;
};

export type AgentTokenStatus = "active" | "ended" | "revoked" | "unreadable";

/** What the list says about a token. A revoked one says so even if it has also ended. */
export function agentTokenStatus(row: AgentTokenRow): AgentTokenStatus {
  if (row.revoked) return "revoked";
  if (row.expired) return "ended";
  if (row.active) return "active";
  return "unreadable";
}

/** The create command's input for the page's form, or why it cannot be sent yet. */
export function agentCreateInput(form: {
  label: string;
  scopes: ReadonlySet<AgentScope>;
  end: AgentTokenEnd | "";
}):
  | {
      ok: true;
      input: { label?: string; scopes: AgentScope[]; expiresInDays?: number };
    }
  | { ok: false; reason: "noScope" | "noEnd" | "labelTooLong" } {
  const label = form.label.trim();
  if (label.length > 80) return { ok: false, reason: "labelTooLong" };
  const scopes = AGENT_SCOPES.filter((s) => form.scopes.has(s));
  if (scopes.length === 0) return { ok: false, reason: "noScope" };
  if (form.end === "") return { ok: false, reason: "noEnd" };
  return {
    ok: true,
    input: {
      ...(label ? { label } : {}),
      scopes,
      ...(form.end === "never" ? {} : { expiresInDays: Number(form.end) }),
    },
  };
}
