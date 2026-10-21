// Adapted from OpenCut Classic (MIT) apps/web/src/retime/presets.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: rational rates.
import { rational } from "../../../time.ts";
import { clampRetimeRate, type RetimeConfig } from "./rate.ts";

export function buildConstantRetime({
  rate,
  maintainPitch = false,
}: {
  rate: { num: number; den: number };
  maintainPitch?: boolean;
}): RetimeConfig {
  return {
    rate: clampRetimeRate({ rate: rational(rate.num, rate.den) }),
    maintainPitch,
  };
}
