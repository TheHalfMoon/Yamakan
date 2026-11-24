// A person's approvals of what leaves this computer, what uses a remote allowance and what is
// downloaded (MPR-204), under the network settings they were given under (OA-20): the workspace's
// schema step 19. No row is updated: a revocation and a use are rows of their own, and none is
// given back. The number of an approval is never used again, so the newest is always the last
// given. A restore empties the tables, whatever they hold, and makes them again from this.
export const GATES_TABLES = Object.freeze([
  "gate_approval_uses",
  "gate_approval_revocations",
  "gate_approvals",
] as const);
export const GATES_SCHEMA = `
CREATE TABLE IF NOT EXISTS gate_approvals(
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE CHECK(length(id) = 36),
  kind TEXT NOT NULL CHECK(kind IN ('egress', 'spend', 'download')),
  route TEXT NOT NULL CHECK(length(route) BETWEEN 1 AND 40),
  host TEXT NOT NULL CHECK(length(host) BETWEEN 1 AND 253),
  account TEXT NOT NULL CHECK(length(account) BETWEEN 1 AND 80),
  purpose TEXT NOT NULL CHECK(purpose IN ('generation', 'qualification')),
  proxy_configured INTEGER NOT NULL CHECK(proxy_configured IN (0, 1)),
  certificate_override INTEGER NOT NULL CHECK(certificate_override IN (0, 1)),
  limit_runs INTEGER NOT NULL CHECK(limit_runs > 0),
  limit_units INTEGER NOT NULL CHECK(limit_units >= 0),
  limit_unit TEXT NOT NULL CHECK(limit_unit IN ('seconds', 'bytes')),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at > granted_at),
  grantor_principal_id TEXT NOT NULL CHECK(length(grantor_principal_id) BETWEEN 1 AND 64),
  epoch INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS gate_approvals_asked ON gate_approvals(kind, route, host, account, purpose);
CREATE TABLE IF NOT EXISTS gate_approval_revocations(
  approval_id TEXT PRIMARY KEY REFERENCES gate_approvals(id),
  revoked_at INTEGER NOT NULL,
  principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 64)
) STRICT;
CREATE TABLE IF NOT EXISTS gate_approval_uses(
  approval_id TEXT NOT NULL REFERENCES gate_approvals(id),
  use_id TEXT NOT NULL CHECK(length(use_id) BETWEEN 1 AND 80),
  units INTEGER NOT NULL CHECK(units >= 0),
  used_at INTEGER NOT NULL,
  PRIMARY KEY(approval_id, use_id)
) STRICT;
`;
