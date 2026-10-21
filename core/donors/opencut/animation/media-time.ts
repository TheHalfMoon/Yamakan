// Adapted from OpenCut Classic (MIT) apps/web/src/animation/media-time.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick MediaTime, properties.ts params surface.

// Yamakan flick ticks stand-in for OpenCut wasm MediaTime (M6/W16).
import { addTicks } from "../../../time.ts";

export type MediaTime = number;

export const ZERO_MEDIA_TIME: MediaTime = 0;

function assertSafeInteger(ticks: number, label: string): MediaTime {
  if (!Number.isSafeInteger(ticks)) {
    throw new RangeError(`${label} must be a safe integer flick tick.`);
  }
  return ticks;
}

/** Construct a flick tick time from a raw integer count. */
export function mediaTime({ ticks }: { ticks: number }): MediaTime {
  return assertSafeInteger(ticks, "MediaTime");
}

/** Round a fractional tick offset to the nearest integer flick tick. */
export function roundMediaTime({ time }: { time: number }): MediaTime {
  return assertSafeInteger(Math.round(time), "MediaTime");
}

export function subMediaTime({
  a,
  b,
}: {
  a: MediaTime;
  b: MediaTime;
}): MediaTime {
  return addTicks(a, -b);
}

export function addMediaTime({
  a,
  b,
}: {
  a: MediaTime;
  b: MediaTime;
}): MediaTime {
  return addTicks(a, b);
}
