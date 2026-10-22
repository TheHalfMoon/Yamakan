// Adapted from OpenCut Classic (MIT) apps/web/src/retime/split.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: rational RetimeConfig.
import type { RetimeConfig } from "./rate.ts";
import { getSourceTimeAtClipTime } from "./resolve.ts";

export function getSourceSpanAtClipTime({
  clipTime,
  retime,
}: {
  clipTime: number;
  retime?: RetimeConfig;
}): number {
  return Math.max(0, getSourceTimeAtClipTime({ clipTime, retime }));
}

export function splitRetimeAtClipTime({
  retime,
}: {
  retime?: RetimeConfig;
  splitClipTime: number;
}): {
  left: RetimeConfig | undefined;
  right: RetimeConfig | undefined;
} {
  return { left: retime, right: retime };
}

export function adjustRetimeForTrimChange({
  retime,
}: {
  retime?: RetimeConfig;
  clipTrimTime: number;
  side: "start" | "end";
}): RetimeConfig | undefined {
  return retime;
}
