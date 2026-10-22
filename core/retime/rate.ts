// Adapted from OpenCut Classic (MIT) apps/web/src/retime/rate.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: rate is a reduced
// rational (num/den) instead of a float so timeline durations stay exact.
import { rational, type Rational } from "../time.ts";

export const DEFAULT_RETIME_RATE: Rational = rational(1, 1);
export const MIN_RETIME_RATE: Rational = rational(1, 100);
export const MAX_RETIME_RATE: Rational = rational(5, 1);

export type RetimeConfig = {
  rate: Rational;
  maintainPitch?: boolean;
};

function cmp(a: Rational, b: Rational): number {
  return a.num * b.den - b.num * a.den;
}

export function clampRetimeRate({ rate }: { rate: Rational }): Rational {
  if (
    !Number.isSafeInteger(rate.num) ||
    !Number.isSafeInteger(rate.den) ||
    rate.num <= 0 ||
    rate.den <= 0
  ) {
    return DEFAULT_RETIME_RATE;
  }
  const reduced = rational(rate.num, rate.den);
  if (cmp(reduced, MIN_RETIME_RATE) < 0) return MIN_RETIME_RATE;
  if (cmp(reduced, MAX_RETIME_RATE) > 0) return MAX_RETIME_RATE;
  return reduced;
}

export function canMaintainPitch({ rate }: { rate: Rational }): boolean {
  return rate.num > 0 && rate.den > 0;
}

export function shouldMaintainPitch({
  rate,
  maintainPitch,
}: {
  rate: Rational;
  maintainPitch?: boolean;
}): boolean {
  return maintainPitch === true && canMaintainPitch({ rate });
}

/** Approximate rate as a finite float for preview-only SoundTouch paths. */
export function rateAsFloat(rate: Rational): number {
  return rate.num / rate.den;
}
