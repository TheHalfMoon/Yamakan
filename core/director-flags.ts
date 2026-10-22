/** Director feature flag + capability (browser-safe). */

/**
 * Manual / deterministic Director workflows.
 * Model-dependent generative stages remain unavailable.
 */
export const DIRECTOR_ENABLED = true;

export function directorCapability(): {
  id: string;
  available: boolean;
  reason?: string;
  unsupported?: readonly string[];
} {
  if (!DIRECTOR_ENABLED) {
    return {
      id: "director",
      available: false,
      reason:
        "Director UI is disabled until manual workflow qualification passes.",
    };
  }
  return {
    id: "director",
    available: true,
    reason:
      "Manual stage start/advance/approve/next are enabled; model stages stay off.",
    unsupported: [
      "model-dependent-stages",
      "paid-inference",
      "agent-human-approval",
    ],
  };
}
