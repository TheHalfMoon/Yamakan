import type { CanvasControlAdapterContract } from "../../canvas-engine/contracts";

export const CONTROL_ADAPTER_DEFAULTS: Readonly<
  Record<CanvasControlAdapterContract["kind"], CanvasControlAdapterContract>
> = {
  anima_lllite: {
    beginEndStepPct: [0, 1],
    controlMode: null,
    kind: "anima_lllite",
    model: null,
    weight: 1,
  },
  control_lora: {
    beginEndStepPct: [0, 1],
    controlMode: null,
    kind: "control_lora",
    model: null,
    weight: 0.75,
  },
  controlnet: {
    beginEndStepPct: [0, 0.75],
    controlMode: "balanced",
    kind: "controlnet",
    model: null,
    weight: 0.75,
  },
  t2i_adapter: {
    beginEndStepPct: [0, 1],
    controlMode: null,
    kind: "t2i_adapter",
    model: null,
    weight: 1,
  },
  z_image_control: {
    beginEndStepPct: [0, 1],
    controlMode: null,
    kind: "z_image_control",
    model: null,
    weight: 0.75,
  },
};

export const CONTROL_KIND_BASE: Readonly<
  Partial<Record<CanvasControlAdapterContract["kind"], string>>
> = {
  anima_lllite: "anima",
  z_image_control: "z-image",
};

export const getDefaultControlAdapterKind = (
  base: string | null | undefined,
): CanvasControlAdapterContract["kind"] =>
  (
    Object.keys(CONTROL_KIND_BASE) as CanvasControlAdapterContract["kind"][]
  ).find((kind) => CONTROL_KIND_BASE[kind] === base) ?? "controlnet";

export const createDefaultControlAdapter = (
  base: string | null | undefined,
  model: string | null = null,
): CanvasControlAdapterContract => {
  const defaults = CONTROL_ADAPTER_DEFAULTS[getDefaultControlAdapterKind(base)];
  return { ...defaults, beginEndStepPct: [...defaults.beginEndStepPct], model };
};

export const normalizeControlAdapter = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string" || !(v.kind in CONTROL_ADAPTER_DEFAULTS)) {
    return value;
  }
  const kind = v.kind as CanvasControlAdapterContract["kind"];
  const defaults = CONTROL_ADAPTER_DEFAULTS[kind];
  return {
    ...defaults,
    ...v,
    beginEndStepPct: Array.isArray(v.beginEndStepPct)
      ? v.beginEndStepPct
      : defaults.beginEndStepPct,
    model: typeof v.model === "string" ? v.model : null,
  };
};
