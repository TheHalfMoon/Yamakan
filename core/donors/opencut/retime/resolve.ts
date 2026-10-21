// Adapted from OpenCut Classic (MIT) apps/web/src/retime/resolve.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick ticks and
// rational rates via checked BigInt division.
import { toSafe } from "../../../time.ts";
import {
  clampRetimeRate,
  DEFAULT_RETIME_RATE,
  type RetimeConfig,
} from "./rate.ts";

function getSafeRate({ rate }: { rate: RetimeConfig["rate"] | undefined }) {
  return clampRetimeRate({ rate: rate ?? DEFAULT_RETIME_RATE });
}

function scaleTicks(ticks: number, num: number, den: number): number {
  if (!Number.isSafeInteger(ticks) || ticks < 0)
    throw new RangeError("Ticks must be a non-negative safe integer.");
  return toSafe((BigInt(ticks) * BigInt(num)) / BigInt(den));
}

export function getSourceTimeAtClipTime({
  clipTime,
  retime,
}: {
  clipTime: number;
  retime?: RetimeConfig;
}): number {
  const rate = getSafeRate({ rate: retime?.rate });
  return scaleTicks(clipTime, rate.num, rate.den);
}

export function getClipTimeAtSourceTime({
  sourceTime,
  retime,
}: {
  sourceTime: number;
  retime?: RetimeConfig;
}): number {
  const rate = getSafeRate({ rate: retime?.rate });
  return scaleTicks(sourceTime, rate.den, rate.num);
}

export function getEffectiveRateAt({
  retime,
}: {
  clipTime?: number;
  retime?: RetimeConfig;
}) {
  return getSafeRate({ rate: retime?.rate });
}

export function getTimelineDurationForSourceSpan({
  sourceSpan,
  retime,
}: {
  sourceSpan: number;
  retime?: RetimeConfig;
}): number {
  if (sourceSpan <= 0) {
    return 0;
  }
  const rate = getSafeRate({ rate: retime?.rate });
  return scaleTicks(sourceSpan, rate.den, rate.num);
}

/** Shared source window consumed by a timeline clip of the given duration. */
export function sourceRange({
  sourceStartTicks,
  durationTicks,
  retime,
}: {
  sourceStartTicks: number;
  durationTicks: number;
  retime?: RetimeConfig;
}): { startTicks: number; durationTicks: number } {
  const consumed = getSourceTimeAtClipTime({
    clipTime: durationTicks,
    retime,
  });
  return { startTicks: sourceStartTicks, durationTicks: consumed };
}

export function timelineDuration({
  sourceDurationTicks,
  retime,
}: {
  sourceDurationTicks: number;
  retime?: RetimeConfig;
}): number {
  return getTimelineDurationForSourceSpan({
    sourceSpan: sourceDurationTicks,
    retime,
  });
}
