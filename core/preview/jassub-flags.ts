/**
 * W12 / M15 JASSUB live title preview gate.
 * Stays false until Q11 measurements pass and H1 native Arabic review signs off.
 * Server libass reference stills remain the primary preview path.
 */
export const JASSUB_ENABLED = false;

export function jassubCapability(): {
  id: string;
  available: boolean;
  reason?: string;
  unsupported?: readonly string[];
} {
  if (!JASSUB_ENABLED) {
    return {
      id: "jassub-preview",
      available: false,
      reason:
        "JASSUB preview is engineered behind this flag; enablement waits for Q11 + H1 native Arabic review.",
      unsupported: [
        "live-jassub-preview",
        "wasm-unsafe-eval-csp",
        "threaded-jassub-coop-coep",
      ],
    };
  }
  return {
    id: "jassub-preview",
    available: true,
    reason: "JASSUB non-threaded preview enabled after Q11 + H1.",
  };
}
