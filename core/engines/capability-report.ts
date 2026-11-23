// What each route can do with each model for each operation (MPR-202): supported, unsupported or
// unverified, with where the answer comes from, its date, its limits and a reason. Made in one
// pass over the catalog (MPR-201) and this host's local discovery; it reads nothing, sends
// nothing and starts nothing. A route that is not set up here is said apart and changes no cell.
import { CommandError } from "../command/errors.ts";
import {
  OPERATIONS,
  ROUTES,
  type CatalogEntry,
  type CatalogOffer,
  type CatalogRefusal,
  type ModelCatalog,
  type ModelIdentity,
} from "./catalog.ts";
import type { Operation, RefusalReason } from "./contract-v2.ts";
import { ENGINE_REASON_MESSAGES, type ReportReason } from "./reasons.ts";

export const CAPABILITY_REPORT_FORMAT = "yamakan.capability-report/v1";
export const CAPABILITY_REPORT_LIMITS = Object.freeze({
  cells: 960,
  refused: 32,
  reasons: 4,
  bytes: 524_288,
});

export type CapabilityState = "supported" | "unsupported" | "unverified";
export type CapabilityCell = {
  route: CatalogOffer["route"];
  catalogId: string;
  identity: ModelIdentity;
  recipeId: string | null;
  operation: Operation;
  state: CapabilityState;
  // None when it is supported; otherwise the deciding one first.
  reasons: ReportReason[];
  // `samples` is how many runs the evidence holds; null for what nothing measured.
  source: {
    kind: "evidence" | "catalog" | "build";
    ref: string;
    samples: number | null;
  };
  asOf: string;
  limits: CatalogOffer["limits"] | null;
};
export type CapabilityReport = {
  format: typeof CAPABILITY_REPORT_FORMAT;
  routes: {
    route: CatalogOffer["route"];
    configured: boolean;
    reason: ReportReason | null;
  }[];
  cells: CapabilityCell[];
  refused: {
    catalogId: string;
    identity: ModelIdentity;
    reason: ReportReason;
    // Why, in the catalog's own words for it.
    because: CatalogRefusal["reason"];
    refusedAt: string;
    evidence: readonly string[];
  }[];
  reasonMessages: Partial<Record<ReportReason, string>>;
};

// A local operation as discovery answered: what the build decides, not the catalog.
export type LocalDiscovery = {
  operation: Operation;
  available: boolean;
  reason: RefusalReason | null;
};

const REASON_OF_DISCOVERY: ReportReason = "ENGINE_DISABLED";
const NO_OFFER_REASON: ReportReason = "OPERATION_NOT_OFFERED";

function cellOf(
  entry: CatalogEntry,
  route: CatalogOffer["route"],
  operation: Operation,
  local: LocalDiscovery | undefined,
): CapabilityCell {
  const at = { route, catalogId: entry.id, identity: entry.identity };
  const fromCatalog = {
    source: { kind: "catalog" as const, ref: entry.id, samples: null },
    asOf: entry.verifiedAt,
  };
  const discovered = local?.available
    ? null
    : (local?.reason ?? REASON_OF_DISCOVERY);
  const decided = (offer: CatalogOffer): CapabilityCell => {
    const its = {
      ...at,
      recipeId: offer.recipeId,
      operation,
      limits: offer.limits,
    };
    if (offer.lifecycle === "retired")
      return {
        ...its,
        ...fromCatalog,
        state: "unsupported",
        reasons: ["OFFER_RETIRED"],
      };
    const [first] = offer.evidence;
    if (
      offer.lifecycle === "candidate" ||
      first === undefined ||
      offer.measured === null
    )
      return {
        ...its,
        ...fromCatalog,
        state: "unverified",
        reasons: [
          "NOT_QUALIFIED",
          ...(route === "local" && discovered ? [discovered] : []),
        ],
      };
    if (route === "local" && discovered)
      return {
        ...its,
        state: "unsupported",
        reasons: [discovered],
        source: { kind: "build", ref: "local-discovery", samples: null },
        asOf: entry.verifiedAt,
      };
    return {
      ...its,
      state: "supported",
      reasons: [],
      source: {
        kind: "evidence",
        ref: first,
        samples: offer.measured.samples,
      },
      asOf: offer.measured.at,
    };
  };
  const cells = entry.offers
    .filter((o) => o.route === route && o.operation === operation)
    .map(decided);
  // One cell for each place, whatever offers stand there: the furthest along, then the first.
  for (const state of ["supported", "unverified", "unsupported"] as const) {
    const cell = cells.find((c) => c.state === state);
    if (cell) return cell;
  }
  return {
    ...at,
    ...fromCatalog,
    recipeId: null,
    operation,
    state: "unsupported",
    reasons: [NO_OFFER_REASON],
    limits: null,
  };
}

export function buildCapabilityReport(of: {
  catalog: ModelCatalog;
  discovery: readonly LocalDiscovery[];
  kaggleConfigured: boolean;
  comfyConfigured: boolean;
  localConfigured: boolean;
}): CapabilityReport {
  const { catalog, discovery } = of;
  const count = catalog.entries.length * ROUTES.length * OPERATIONS.length;
  if (
    count > CAPABILITY_REPORT_LIMITS.cells ||
    catalog.refused.length > CAPABILITY_REPORT_LIMITS.refused
  )
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The capability report is too large.",
    );
  const configured = {
    kaggle: of.kaggleConfigured,
    comfyui: of.comfyConfigured,
    local: of.localConfigured,
  };
  const off = discovery.some((d) => d.reason === REASON_OF_DISCOVERY);
  const routes = ROUTES.map((route) => ({
    route,
    configured: configured[route],
    reason: configured[route]
      ? null
      : route === "local" && off
        ? REASON_OF_DISCOVERY
        : ("ROUTE_NOT_CONFIGURED" as const),
  }));
  const cells = catalog.entries.flatMap((entry) =>
    ROUTES.flatMap((route) =>
      OPERATIONS.map((operation) =>
        cellOf(
          entry,
          route,
          operation,
          discovery.find((d) => d.operation === operation),
        ),
      ),
    ),
  );
  const refused = catalog.refused.map((r) => ({
    catalogId: r.id,
    identity: r.identity,
    reason: "MODEL_REFUSED" as const,
    because: r.reason,
    refusedAt: r.refusedAt,
    evidence: r.evidence,
  }));
  const said = new Set<ReportReason>([
    ...routes.flatMap((r) => r.reason ?? []),
    ...cells.flatMap((c) => c.reasons),
    ...refused.map((r) => r.reason),
  ]);
  const report: CapabilityReport = {
    format: CAPABILITY_REPORT_FORMAT,
    routes,
    cells,
    refused,
    reasonMessages: Object.fromEntries(
      [...said].sort().map((r) => [r, ENGINE_REASON_MESSAGES[r]]),
    ),
  };
  // Whole or not at all.
  if (
    new TextEncoder().encode(JSON.stringify(report)).length >
    CAPABILITY_REPORT_LIMITS.bytes
  )
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The capability report is too large.",
    );
  return report;
}

/** The models a person can start from here: the recipes whose cell is supported, in their order. */
export function projectGenerationOptions<R extends { id: string }, M>(
  report: CapabilityReport,
  kaggle: { recipes: readonly R[]; modelOf: (recipe: R) => M } | null,
): { route: "kaggle" | null; models: M[] } {
  if (!kaggle) return { route: null, models: [] };
  const supported = new Set(
    report.cells
      .filter((c) => c.route === "kaggle" && c.state === "supported")
      .map((c) => c.recipeId),
  );
  return {
    route: "kaggle",
    models: kaggle.recipes
      .filter((r) => supported.has(r.id))
      .map(kaggle.modelOf),
  };
}
