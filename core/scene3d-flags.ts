/** Cinema feature flag + capability (safe for browser and Node). */

/**
 * Cinema preview/persist for supported camera+scene3d scope.
 * Generative / AI-conditioned camera stays unavailable (see cinemaCapability).
 */
export const CINEMA_ENABLED = true;

export function cinemaCapability(): {
  id: string;
  available: boolean;
  reason?: string;
  unsupported?: readonly string[];
} {
  if (!CINEMA_ENABLED) {
    return {
      id: "cinema",
      available: false,
      reason:
        "Cinema is imported but disabled until preview/persist qualification passes.",
    };
  }
  return {
    id: "cinema",
    available: true,
    reason:
      "Supported camera/scene3d preview and persist are enabled; AI-conditioned camera remains off.",
    unsupported: [
      "ai-conditioned-camera",
      "generative-video",
      "remote-media-url-fetch",
    ],
  };
}
