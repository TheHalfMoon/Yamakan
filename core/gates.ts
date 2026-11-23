// Default-deny gates (MPR-204): a person's approvals of what leaves this computer, what uses a
// remote allowance and what is downloaded, each for exactly one route, host, account and purpose,
// with an expiry and a limit. The places that refuse without one ask here (part b). An approval
// is a row that is never changed; a revocation and a use are rows of their own. A restore brings
// none back, and one of another epoch is void. The newest approval of a place is the one that
// counts, so revoking it closes the place.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { CommandError } from "./command/errors.ts";
import { epochOf, once } from "./director/runtime.ts";
import type { ProjectStore, RequestReceipt } from "./store.ts";

export const GATE_LIMITS = Object.freeze({
  ttlMsLeast: 60_000,
  ttlMsMost: 366 * 24 * 60 * 60 * 1000,
  runs: 1_000,
  units: 2 ** 40,
  listed: 200,
  listBytes: 65_536,
});

export const GateKind = z.enum(["egress", "spend", "download"]);
export type GateKind = z.infer<typeof GateKind>;
export const GatePurpose = z.enum(["generation", "qualification"]);
export type GatePurpose = z.infer<typeof GatePurpose>;

// The one host that each route's approval names. What the route's own program then contacts is
// its own (docs/SECURITY.md).
export const GATE_ROUTES = Object.freeze({
  kaggle: Object.freeze({ host: "kaggle.com" }),
});
export const GateRoute = z.enum(["kaggle"]);

// How the route's program would reach its host, as far as its settings say: facts, never their
// values, which can hold a credential (OA-20).
export type GateNetwork = {
  proxyConfigured: boolean;
  certificateOverride: boolean;
};

export type GateAsk = {
  kind: GateKind;
  route: string;
  host: string;
  account: string;
  purpose: GatePurpose;
  network: GateNetwork;
};
export type GateState =
  | "approved"
  | "missing"
  | "expired"
  | "revoked"
  | "exhausted"
  | "voided"
  // The network settings are not those it was given under.
  | "changed";
export type GateReading = {
  kind: GateKind;
  state: GateState;
  approvalId: string | null;
  expiresAt: number | null;
  runsLeft: number;
  unitsLeft: number;
  // What was counted on it so far.
  uses: number;
};

const unitOf = (kind: GateKind) => (kind === "spend" ? "seconds" : "bytes");

type Row = {
  id: string;
  kind: GateKind;
  route: string;
  host: string;
  account: string;
  purpose: GatePurpose;
  proxy_configured: number;
  certificate_override: number;
  limit_runs: number;
  limit_units: number;
  limit_unit: "seconds" | "bytes";
  granted_at: number;
  expires_at: number;
  grantor_principal_id: string;
  epoch: number;
  revoked_at: number | null;
  runs: number;
  units: number;
};
const COLUMNS =
  "a.*, r.revoked_at AS revoked_at, (SELECT count(*) FROM gate_approval_uses u WHERE u.approval_id = a.id) AS runs, (SELECT coalesce(sum(units), 0) FROM gate_approval_uses u WHERE u.approval_id = a.id) AS units";
const FROM =
  "FROM gate_approvals a LEFT JOIN gate_approval_revocations r ON r.approval_id = a.id";

const networkOf = (row: Row): GateNetwork => ({
  proxyConfigured: row.proxy_configured !== 0,
  certificateOverride: row.certificate_override !== 0,
});
const sameNetwork = (a: GateNetwork, b: GateNetwork) =>
  a.proxyConfigured === b.proxyConfigured &&
  a.certificateOverride === b.certificateOverride;

function readRow(
  db: DatabaseSync,
  row: Row,
  network: GateNetwork,
  nowMs: number,
): GateReading {
  const runsLeft = Math.max(0, row.limit_runs - row.runs);
  const unitsLeft = Math.max(0, row.limit_units - row.units);
  const state: GateState =
    // A row a person could not have recorded is as good as none.
    row.kind === "download"
      ? "missing"
      : row.epoch !== epochOf(db)
        ? "voided"
        : row.revoked_at !== null
          ? "revoked"
          : // Nor before it was given: this computer's clock was set back.
            nowMs >= row.expires_at || nowMs < row.granted_at
            ? "expired"
            : !sameNetwork(networkOf(row), network)
              ? "changed"
              : runsLeft === 0 || unitsLeft === 0
                ? "exhausted"
                : "approved";
  return {
    kind: row.kind,
    state,
    approvalId: row.id,
    expiresAt: row.expires_at,
    runsLeft,
    unitsLeft,
    uses: row.runs,
  };
}

const wellFormed = (text: string) =>
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
    text,
  );

const NONE = {
  state: "missing" as const,
  approvalId: null,
  expiresAt: null,
  runsLeft: 0,
  unitsLeft: 0,
  uses: 0,
};

function stateOf(db: DatabaseSync, ask: GateAsk, nowMs: number): GateReading {
  // Stored text is UTF-8, where two halves of a character that is not one would be the same.
  if (!wellFormed(ask.host) || !wellFormed(ask.account))
    return { kind: ask.kind, ...NONE };
  const row = db
    .prepare(
      `SELECT ${COLUMNS} ${FROM} WHERE a.kind = ? AND a.route = ? AND a.host = ? AND a.account = ? AND a.purpose = ? ORDER BY a.n DESC LIMIT 1`,
    )
    .get(ask.kind, ask.route, ask.host, ask.account, ask.purpose) as
    Row | undefined;
  return row
    ? readRow(db, row, ask.network, nowMs)
    : { kind: ask.kind, ...NONE };
}

/** How a gate stands for exactly this ask: no wildcard, and the newest approval of it. */
export const gateState = (
  store: ProjectStore,
  ask: GateAsk,
  nowMs = Date.now(),
): GateReading => store.read((db) => stateOf(db, ask, nowMs));

const WHAT: Record<GateKind, string> = {
  egress: "contacting",
  spend: "using the allowance of",
  download: "downloading from",
};
const WHY: Record<Exclude<GateState, "approved">, string> = {
  missing: "No one has approved",
  expired:
    "The approval has expired, or this computer's clock is before it, for",
  revoked: "The approval was revoked for",
  exhausted: "The approval is used up for",
  voided: "The approval was voided by a restore for",
  changed:
    "The network settings are not those of the approval (a proxy or a certificate setting was added or removed) for",
};

const refusal = (ask: GateAsk, state: Exclude<GateState, "approved">) =>
  new CommandError(
    "CAPABILITY_UNAVAILABLE",
    ask.kind === "download"
      ? "This build downloads nothing."
      : `${WHY[state]} ${WHAT[ask.kind]} ${ask.host} as ${ask.account}. A person approves it on the Create page first.`,
  );

/**
 * The approval that allows a contact now, or why there is none. It is not the check of a start:
 * that is `consumeGates`, which counts. One for contacting that is only used up still allows
 * following what was counted on it.
 */
export function requireGate(
  store: ProjectStore,
  ask: GateAsk,
  nowMs = Date.now(),
): GateReading & { approvalId: string } {
  const read = gateState(store, ask, nowMs);
  if (
    read.approvalId !== null &&
    (read.state === "approved" ||
      (ask.kind === "egress" && read.state === "exhausted" && read.uses > 0))
  )
    return { ...read, approvalId: read.approvalId };
  throw refusal(ask, read.state as Exclude<GateState, "approved">);
}

/**
 * Counts one use of each ask, all of them or none, inside one transaction: a limit is counted
 * before the send, the same use is counted once, and a use is never given back.
 */
export function consumeGates(
  store: ProjectStore,
  asks: readonly { ask: GateAsk; units: number }[],
  useId: string,
  nowMs = Date.now(),
): string[] {
  const places = asks.map(({ ask }) =>
    JSON.stringify([ask.kind, ask.route, ask.host, ask.account, ask.purpose]),
  );
  if (
    asks.length === 0 ||
    new Set(places).size !== places.length ||
    useId.length < 1 ||
    useId.length > 80 ||
    asks.some(({ units }) => !Number.isSafeInteger(units) || units < 0)
  )
    throw new CommandError("VALIDATION", "A use names each gate once.");
  return store.transaction((db) =>
    asks.map(({ ask, units }) => {
      const read = stateOf(db, ask, nowMs);
      const used =
        read.approvalId === null
          ? undefined
          : (db
              .prepare(
                "SELECT units FROM gate_approval_uses WHERE approval_id = ? AND use_id = ?",
              )
              .get(read.approvalId, useId) as { units: number } | undefined);
      if (
        used &&
        (read.state === "approved" || read.state === "exhausted") &&
        used.units === units
      )
        return read.approvalId!;
      if (read.state !== "approved") throw refusal(ask, read.state);
      if (used)
        throw new CommandError(
          "VALIDATION",
          "The same use was counted with another amount.",
        );
      if (units > read.unitsLeft) throw refusal(ask, "exhausted");
      const { changes } = db
        .prepare(
          "INSERT INTO gate_approval_uses(approval_id, use_id, units, used_at) VALUES (?, ?, ?, ?)",
        )
        .run(read.approvalId, useId, units, nowMs);
      // Counted, and nothing before it lost: else none of this is written.
      const after = stateOf(db, ask, nowMs);
      if (
        Number(changes) !== 1 ||
        after.uses !== read.uses + 1 ||
        after.unitsLeft !== read.unitsLeft - units
      )
        throw new CommandError("INTERNAL", "A use was not counted.");
      return read.approvalId!;
    }),
  );
}

export type GateApproval = {
  id: string;
  kind: GateKind;
  route: string;
  host: string;
  account: string;
  purpose: GatePurpose;
  network: GateNetwork;
  limit: { runs: number; units: number; unit: "seconds" | "bytes" };
  grantedAt: number;
  expiresAt: number;
  grantorPrincipalId: string;
  revokedAt: number | null;
  state: GateState;
  runsLeft: number;
  unitsLeft: number;
};
const approvalOf = (
  db: DatabaseSync,
  row: Row,
  network: GateNetwork,
  nowMs: number,
): GateApproval => {
  const { state, runsLeft, unitsLeft } = readRow(db, row, network, nowMs);
  return {
    id: row.id,
    kind: row.kind,
    route: row.route,
    host: row.host,
    account: row.account,
    purpose: row.purpose,
    network: networkOf(row),
    limit: {
      runs: row.limit_runs,
      units: row.limit_units,
      unit: row.limit_unit,
    },
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    grantorPrincipalId: row.grantor_principal_id,
    revokedAt: row.revoked_at,
    state,
    runsLeft,
    unitsLeft,
  };
};
const rowOf = (db: DatabaseSync, id: string) =>
  db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE a.id = ?`).get(id) as
    Row | undefined;

/** Records a person's approval, under the network settings as they are. */
export function approveGate(
  store: ProjectStore,
  input: {
    ask: GateAsk;
    ttlMs: number;
    limit: { runs: number; units: number };
    principalId: string;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): GateApproval {
  const { ask, ttlMs, limit } = input;
  if (ask.kind === "download") throw refusal(ask, "missing");
  const whole = (n: number, least: number, most: number) =>
    Number.isSafeInteger(n) && n >= least && n <= most;
  if (
    !whole(ttlMs, GATE_LIMITS.ttlMsLeast, GATE_LIMITS.ttlMsMost) ||
    !whole(limit.runs, 1, GATE_LIMITS.runs) ||
    !whole(limit.units, 0, GATE_LIMITS.units) ||
    !wellFormed(ask.host) ||
    !wellFormed(ask.account)
  )
    throw new CommandError("VALIDATION", "An approval is out of its range.");
  const now = input.nowMs ?? Date.now();
  return store.transaction((db) =>
    once(db, receipt, () => {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO gate_approvals(id, kind, route, host, account, purpose, proxy_configured, certificate_override, limit_runs, limit_units, limit_unit, granted_at, expires_at, grantor_principal_id, epoch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        ask.kind,
        ask.route,
        ask.host,
        ask.account,
        ask.purpose,
        Number(ask.network.proxyConfigured),
        Number(ask.network.certificateOverride),
        limit.runs,
        limit.units,
        unitOf(ask.kind),
        now,
        now + ttlMs,
        input.principalId,
        epochOf(db),
      );
      return approvalOf(db, rowOf(db, id)!, ask.network, now);
    }),
  );
}

/** Revokes an approval, once and for good. */
export function revokeGate(
  store: ProjectStore,
  input: {
    approvalId: string;
    principalId: string;
    network: GateNetwork;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): GateApproval {
  const now = input.nowMs ?? Date.now();
  return store.transaction((db) =>
    once(db, receipt, () => {
      const row = rowOf(db, input.approvalId);
      if (!row) throw new CommandError("NOT_FOUND", "Approval not found.");
      if (row.revoked_at !== null)
        throw new CommandError("VALIDATION", "Approval is already revoked.");
      db.prepare(
        "INSERT INTO gate_approval_revocations(approval_id, revoked_at, principal_id) VALUES (?, ?, ?)",
      ).run(input.approvalId, now, input.principalId);
      const stands = approvalOf(
        db,
        rowOf(db, input.approvalId)!,
        input.network,
        now,
      );
      if (stands.revokedAt !== now)
        throw new CommandError("INTERNAL", "The approval was not revoked.");
      return stands;
    }),
  );
}

/** The newest approvals, each with how it stands and what is left; `more` when some are left out. */
export function listGateApprovals(
  store: ProjectStore,
  network: GateNetwork,
  nowMs = Date.now(),
): { approvals: GateApproval[]; more: boolean } {
  return store.read((db) => {
    const rows = db
      .prepare(`SELECT ${COLUMNS} ${FROM} ORDER BY a.n DESC LIMIT ?`)
      .all(GATE_LIMITS.listed + 1) as Row[];
    const approvals: GateApproval[] = [];
    let bytes = 64;
    for (const row of rows.slice(0, GATE_LIMITS.listed)) {
      const approval = approvalOf(db, row, network, nowMs);
      bytes += Buffer.byteLength(JSON.stringify(approval)) + 1;
      if (bytes > GATE_LIMITS.listBytes) break;
      approvals.push(approval);
    }
    return { approvals, more: approvals.length < rows.length };
  });
}
