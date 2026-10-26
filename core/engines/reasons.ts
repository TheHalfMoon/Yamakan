// Plain reasons an operation cannot run, in the service's answers
// (browser-safe: no Node imports). The interface shows its own translation
// of each reason (src/i18n.ts, engine.reason.*). Which check refused stays
// in the service.

export const ENGINE_REASON_MESSAGES: Readonly<Record<string, string>> =
  Object.freeze({
    ENGINE_DISABLED:
      "Generative engines are turned off in this build. Editing, rendering and export work without them.",
    WEIGHTS_ABSENT:
      "The model files for this operation are not installed on this computer, or failed their check. Yamakan never downloads them.",
    HARDWARE_UNQUALIFIED:
      "This computer is not qualified for this operation, or its qualification has expired.",
    RIGHTS_UNQUALIFIED: "The model's license does not allow this use.",
  });

export const engineReasonMessage = (reason: string | undefined) =>
  (reason && ENGINE_REASON_MESSAGES[reason]) ||
  "This operation is not available.";
