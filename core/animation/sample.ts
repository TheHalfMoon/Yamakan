// W16: one shared sampler for preview and export (M6).
import { getScalarChannelValueAtTime } from "./interpolation.ts";
import type { Channel } from "./types.ts";
import type { MediaTime } from "./media-time.ts";

export type SampledScalar = {
  path: string;
  value: number;
};

/**
 * Sample scalar animation channels at a local-element time (flicks).
 * Preview and export must call this same function.
 */
export function sampleScalarChannelsAtTime(
  channels: ReadonlyMap<string, Channel<number>> | Record<string, Channel<number>>,
  localTime: MediaTime,
  fallbackValue = 0,
): SampledScalar[] {
  const entries =
    channels instanceof Map
      ? [...channels.entries()]
      : Object.entries(channels);
  const out: SampledScalar[] = [];
  for (const [path, channel] of entries) {
    const value = getScalarChannelValueAtTime({
      channel,
      time: localTime,
      fallbackValue,
    });
    if (typeof value === "number" && Number.isFinite(value))
      out.push({ path, value });
  }
  return out;
}

/** Q13: expression form for opacity/volume at one instant (eval=frame later). */
export function scalarExpressionConstant(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return (Math.round(value * 1_000_000) / 1_000_000).toString();
}
