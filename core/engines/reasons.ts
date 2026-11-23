// Plain reasons an operation cannot run, in the service's answers
// (browser-safe: no Node imports). The interface shows its own translation
// of each reason (src/i18n.ts, engine.reason.*). Which check refused stays
// in the service.
import type { RefusalReason } from "./contract-v2.ts";

// What an engine answers, and what only a report says (MPR-202).
export type ReportReason =
  | RefusalReason
  | "NOT_QUALIFIED"
  | "OPERATION_NOT_OFFERED"
  | "OFFER_RETIRED"
  | "ROUTE_NOT_CONFIGURED"
  | "MODEL_REFUSED";

export const ENGINE_REASON_MESSAGES: Readonly<Record<string, string>> =
  Object.freeze({
    ENGINE_DISABLED:
      "Generative engines are turned off in this build. Editing, rendering and export work without them.",
    WEIGHTS_ABSENT:
      "The model files for this operation are not installed on this computer, or failed their check. Yamakan never downloads them.",
    HARDWARE_UNQUALIFIED:
      "This computer is not qualified for this operation, or its qualification has expired.",
    RIGHTS_UNQUALIFIED: "The model's license does not allow this use.",
    CONTROL_UNSUPPORTED: "This engine does not follow one of these settings.",
    OUTPUT_UNSUPPORTED:
      "This engine does not make a video of this size, length or kind.",
    RECIPE_UNKNOWN: "This engine does not know this recipe.",
    INPUT_UNSUPPORTED: "This engine does not use one of these inputs.",
    STALE_ATTEMPT: "A newer attempt has taken this one's place.",
    ATTEMPT_CONFLICT: "This attempt was made with a different request.",
    INVALID_REQUEST: "The engine could not read this request.",
    NOT_QUALIFIED: "This has not been checked here yet.",
    OPERATION_NOT_OFFERED: "Yamakan has no recipe for this with this model.",
    OFFER_RETIRED: "This is no longer offered.",
    ROUTE_NOT_CONFIGURED: "This service was not set up to use that route.",
    MODEL_REFUSED: "This model was looked at and turned down.",
  } satisfies Record<ReportReason, string>);

export const engineReasonMessage = (reason: string | undefined) =>
  (reason && ENGINE_REASON_MESSAGES[reason]) ||
  "This operation is not available.";
