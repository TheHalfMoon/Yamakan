// Yamakan helper: build an FFmpeg atempo chain that realises a rational rate
// within the 0.5–2.0 per-filter bound, for Q6 exactness checks.
import type { Rational } from "../time.ts";
import { rateAsFloat } from "./rate.ts";

export function atempoChain(rate: Rational): string[] {
  // FFmpeg atempo accepts 0.5..2.0 per filter. Factor the overall rate into
  // that range (rate here is source/timeline: 2 means play twice as fast).
  let remaining = rateAsFloat(rate);
  if (!(remaining > 0) || !Number.isFinite(remaining))
    throw new RangeError("Retime rate must be a positive finite number.");
  const filters: string[] = [];
  while (remaining > 2) {
    filters.push("atempo=2.0");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining}`);
  return filters;
}
