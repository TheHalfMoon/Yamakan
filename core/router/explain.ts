/**
 * Smart Router explain (original): hard-filters eligibility before any ranking.
 * With no provider enabled, ranks nothing and returns rejection reasons.
 */
import { z } from "zod";

export const ROUTER_EXPLAIN_FORMAT = "yamakan.router-explain/v1";

/** No paid/cloud providers are enabled on the offline MVP path. */
export const ROUTER_PROVIDERS_ENABLED = false;

export const RouterExplainRequestSchema = z
  .object({
    operation: z.string().min(1).max(80),
    region: z.string().min(1).max(40).optional(),
    remainingBudgetMinor: z.number().int().nonnegative().optional(),
  })
  .strict();

export type RouterExplainRequest = z.infer<typeof RouterExplainRequestSchema>;

export type RouterRejection = {
  routeId: string;
  reasonCode: string;
  detail: string;
};

export type RouterExplainResult = {
  format: typeof ROUTER_EXPLAIN_FORMAT;
  eligible: never[];
  rejected: RouterRejection[];
  providersEnabled: boolean;
};

/**
 * Hard-filter first. Ranking runs only over routes that survive filters.
 * Offline / no-provider mode: every candidate is rejected; eligible stays empty.
 */
export function explainRoutes(
  raw: unknown,
  catalog: readonly { routeId: string; operation: string }[] = [],
): RouterExplainResult {
  const req = RouterExplainRequestSchema.parse(raw);
  const rejected: RouterRejection[] = [];

  if (!ROUTER_PROVIDERS_ENABLED) {
    rejected.push({
      routeId: "*",
      reasonCode: "PROVIDERS_DISABLED",
      detail:
        "No cloud or paid inference providers are enabled on this head (offline MVP).",
    });
    return {
      format: ROUTER_EXPLAIN_FORMAT,
      eligible: [],
      rejected,
      providersEnabled: false,
    };
  }

  for (const route of catalog) {
    if (route.operation !== req.operation) {
      rejected.push({
        routeId: route.routeId,
        reasonCode: "OPERATION_UNSUPPORTED",
        detail: `Route does not support operation ${req.operation}.`,
      });
      continue;
    }
    rejected.push({
      routeId: route.routeId,
      reasonCode: "NOT_QUALIFIED",
      detail: "Route survived name match but is not qualified for ranking.",
    });
  }

  return {
    format: ROUTER_EXPLAIN_FORMAT,
    eligible: [],
    rejected,
    providersEnabled: ROUTER_PROVIDERS_ENABLED,
  };
}
