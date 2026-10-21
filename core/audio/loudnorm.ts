// W18: two-pass FFmpeg loudnorm (EBU R128). Measured values live on the
// render plan; the second pass applies linear loudnorm with those values.
import { CommandError } from "../command/errors.ts";

export const LOUDNORM_ENABLED = true;

/** Broadcast-style default target (LUFS / dBTP / LU). */
export const DEFAULT_LOUDNORM_TARGET = {
  I: -16,
  TP: -1.5,
  LRA: 11,
} as const;

export type LoudnormTarget = {
  I: number;
  TP: number;
  LRA: number;
};

export type MeasuredLoudnorm = {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  target_offset: number;
};

export type LoudnormSpec = {
  target: LoudnormTarget;
  measured: MeasuredLoudnorm | null;
};

export function measurePassFilter(target: LoudnormTarget): string {
  return `loudnorm=I=${target.I}:TP=${target.TP}:LRA=${target.LRA}:print_format=json`;
}

export function applyPassFilter(spec: LoudnormSpec): string {
  if (!spec.measured)
    throw new CommandError(
      "VALIDATION",
      "Loudnorm apply requires measured values from the first pass.",
    );
  const m = spec.measured;
  const t = spec.target;
  return [
    `loudnorm=I=${t.I}`,
    `TP=${t.TP}`,
    `LRA=${t.LRA}`,
    `measured_I=${m.input_i}`,
    `measured_TP=${m.input_tp}`,
    `measured_LRA=${m.input_lra}`,
    `measured_thresh=${m.input_thresh}`,
    `offset=${m.target_offset}`,
    `linear=true`,
  ].join(":");
}

/**
 * FFmpeg prints a JSON object on stderr after the measure pass. Extract the
 * last JSON object that contains input_i.
 */
export function parseLoudnormJson(stderr: string): MeasuredLoudnorm {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new CommandError(
      "VALIDATION",
      "Loudnorm measure pass produced no JSON.",
    );
  let raw: unknown;
  try {
    raw = JSON.parse(stderr.slice(start, end + 1));
  } catch {
    throw new CommandError(
      "VALIDATION",
      "Loudnorm measure pass JSON was invalid.",
    );
  }
  const o = raw as Record<string, unknown>;
  const num = (key: string) => {
    const v = Number(o[key]);
    if (!Number.isFinite(v))
      throw new CommandError("VALIDATION", `Loudnorm measure missing ${key}.`);
    return v;
  };
  return {
    input_i: num("input_i"),
    input_tp: num("input_tp"),
    input_lra: num("input_lra"),
    input_thresh: num("input_thresh"),
    target_offset: num("target_offset"),
  };
}
