// W16 / Q14: Yamakan property registry replacing OpenCut `@/params` surface
// used by animation (ParamValue, color helpers, ChannelEasingMode).
// Culori is not pulled in; hex/rgb parsing is bounded and fail-closed.

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export type ChannelValueKind = "scalar" | "discrete";
export type ChannelEasingMode = "independent" | "shared";

export interface LinearRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** OpenCut-shaped clamp({ value, min, max }). */
export function clampOpts(opts: {
  value: number;
  min: number;
  max: number;
}): number {
  return clamp(opts.value, opts.min, opts.max);
}

function srgbToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const c = clamp(value, 0, 1);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function parseColorToLinearRgba(color: string): LinearRgba | null {
  const raw = color.trim();
  const hex = raw.match(
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  );
  if (!hex) return null;
  let h = hex[1]!;
  if (h.length === 3 || h.length === 4) {
    h = [...h].map((c) => c + c).join("");
  }
  const hasAlpha = h.length === 8;
  const n = Number.parseInt(hasAlpha ? h.slice(0, 6) : h, 16);
  const aByte = hasAlpha ? Number.parseInt(h.slice(6, 8), 16) : 255;
  if (!Number.isFinite(n) || !Number.isFinite(aByte)) return null;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return {
    r: srgbToLinear(r),
    g: srgbToLinear(g),
    b: srgbToLinear(b),
    a: aByte / 255,
  };
}

export function formatLinearRgba(color: LinearRgba): string {
  const r = Math.round(clamp(linearToSrgb(color.r), 0, 1) * 255);
  const g = Math.round(clamp(linearToSrgb(color.g), 0, 1) * 255);
  const b = Math.round(clamp(linearToSrgb(color.b), 0, 1) * 255);
  const a = Math.round(clamp(color.a, 0, 1) * 255);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return a === 255
    ? `#${hex(r)}${hex(g)}${hex(b)}`
    : `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
}

export interface ChannelComponentDefinition<TKey extends string = string> {
  key: TKey;
  valueKind: ChannelValueKind;
  defaultInterpolation: "linear" | "hold";
}

export interface LeafChannelLayout<TValue extends ParamValue = ParamValue> {
  kind: "leaf";
  component: ChannelComponentDefinition<"value">;
  easingMode: "independent";
  decompose: (value: TValue) => { value: TValue };
  compose: (components: { value?: TValue }) => TValue | null;
}

export interface CompositeChannelLayout<
  TValue extends ParamValue = ParamValue,
  TComponents extends object = Record<string, ParamValue>,
> {
  kind: "composite";
  components: Array<ChannelComponentDefinition<keyof TComponents & string>>;
  easingMode: ChannelEasingMode;
  decompose: (value: TValue) => TComponents | null;
  compose: (components: Partial<TComponents>) => TValue | null;
}

export type ChannelLayout<
  TValue extends ParamValue = ParamValue,
  TComponents extends object = Record<string, ParamValue>,
> = LeafChannelLayout<TValue> | CompositeChannelLayout<TValue, TComponents>;

export type ParamChannelLayout =
  | LeafChannelLayout<number>
  | LeafChannelLayout<boolean>
  | LeafChannelLayout<string>
  | CompositeChannelLayout<string, LinearRgba>;

function createLeafChannelLayout<TValue extends ParamValue>({
  valueKind,
  defaultInterpolation,
}: {
  valueKind: ChannelValueKind;
  defaultInterpolation: "linear" | "hold";
}): LeafChannelLayout<TValue> {
  return {
    kind: "leaf",
    component: {
      key: "value",
      valueKind,
      defaultInterpolation,
    },
    easingMode: "independent",
    decompose: (value) => ({ value }),
    compose: ({ value }) => value ?? null,
  };
}

export const NUMBER_CHANNEL_LAYOUT: LeafChannelLayout<number> =
  createLeafChannelLayout<number>({
    valueKind: "scalar",
    defaultInterpolation: "linear",
  });

export const BOOLEAN_CHANNEL_LAYOUT: LeafChannelLayout<boolean> =
  createLeafChannelLayout<boolean>({
    valueKind: "discrete",
    defaultInterpolation: "hold",
  });

export const STRING_CHANNEL_LAYOUT: LeafChannelLayout<string> =
  createLeafChannelLayout<string>({
    valueKind: "discrete",
    defaultInterpolation: "hold",
  });

const colorComponent = (
  key: keyof LinearRgba,
): ChannelComponentDefinition<keyof LinearRgba> => ({
  key,
  valueKind: "scalar",
  defaultInterpolation: "linear",
});

export const COLOR_CHANNEL_LAYOUT: CompositeChannelLayout<string, LinearRgba> =
  {
    kind: "composite",
    components: [
      colorComponent("r"),
      colorComponent("g"),
      colorComponent("b"),
      colorComponent("a"),
    ],
    easingMode: "shared",
    decompose: (value) => parseColorToLinearRgba(value),
    compose: ({ r, g, b, a }) =>
      typeof r === "number" &&
      typeof g === "number" &&
      typeof b === "number" &&
      typeof a === "number"
        ? formatLinearRgba({ r, g, b, a })
        : null,
  };

interface BaseParamDefinition<TKey extends string = string> {
  key: TKey;
  label: string;
  keyframable?: boolean;
}

export interface NumberParamDefinition<TKey extends string = string>
  extends BaseParamDefinition<TKey> {
  type: "number";
  default: number;
  channels?: LeafChannelLayout<number>;
  min: number;
  max?: number;
  step: number;
}

export interface BooleanParamDefinition<TKey extends string = string>
  extends BaseParamDefinition<TKey> {
  type: "boolean";
  default: boolean;
  channels?: LeafChannelLayout<boolean>;
}

export interface ColorParamDefinition<TKey extends string = string>
  extends BaseParamDefinition<TKey> {
  type: "color";
  default: string;
  channels?: ChannelLayout<string, LinearRgba>;
}

export interface SelectParamDefinition<TKey extends string = string>
  extends BaseParamDefinition<TKey> {
  type: "select";
  default: string;
  channels?: LeafChannelLayout<string>;
  options: Array<{ value: string; label: string }>;
}

export interface TextParamDefinition<TKey extends string = string>
  extends BaseParamDefinition<TKey> {
  type: "text";
  default: string;
  channels?: LeafChannelLayout<string>;
}

export type ParamDefinition<TKey extends string = string> =
  | NumberParamDefinition<TKey>
  | BooleanParamDefinition<TKey>
  | ColorParamDefinition<TKey>
  | SelectParamDefinition<TKey>
  | TextParamDefinition<TKey>;

export function getParamChannelLayout({
  param,
}: {
  param: ParamDefinition;
}): ParamChannelLayout {
  switch (param.type) {
    case "number":
      return param.channels ?? NUMBER_CHANNEL_LAYOUT;
    case "boolean":
      return param.channels ?? BOOLEAN_CHANNEL_LAYOUT;
    case "color":
      return param.channels ?? COLOR_CHANNEL_LAYOUT;
    case "select":
    case "text":
      return param.channels ?? STRING_CHANNEL_LAYOUT;
    default: {
      const exhaustive: never = param;
      return exhaustive;
    }
  }
}

export function getParamValueKind({
  param,
}: {
  param: ParamDefinition;
}): "number" | "color" | "discrete" {
  const layout = getParamChannelLayout({ param });
  if (layout.kind === "composite") {
    return "color";
  }
  if (layout.component.valueKind === "scalar") {
    return "number";
  }
  return "discrete";
}

export function getParamDefaultInterpolation({
  param,
}: {
  param: ParamDefinition;
}): "linear" | "hold" {
  const layout = getParamChannelLayout({ param });
  if (layout.kind === "leaf") {
    return layout.component.defaultInterpolation;
  }
  return layout.components[0]?.defaultInterpolation ?? "linear";
}

export function getParamNumericRange({
  param,
}: {
  param: ParamDefinition;
}): { min?: number; max?: number; step?: number } | undefined {
  if (param.type !== "number") {
    return undefined;
  }

  return {
    min: param.min,
    max: param.max,
    step: param.step,
  };
}

function getFractionDigitsForStep(step: number): number {
  const normalizedStep = step.toString().toLowerCase();
  if (normalizedStep.includes("e-")) {
    return Number(normalizedStep.split("e-")[1] ?? 0);
  }
  const [, fractionalPart = ""] = normalizedStep.split(".");
  return fractionalPart.length;
}

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const snappedValue = Math.round(value / step) * step;
  return Number(snappedValue.toFixed(getFractionDigitsForStep(step)));
}

export function coerceParamValue({
  param,
  value,
}: {
  param: ParamDefinition;
  value: unknown;
}): ParamValue | null {
  switch (param.type) {
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return null;
      }

      const steppedValue = snapToStep(value, param.step);
      const maxValue = param.max ?? Number.POSITIVE_INFINITY;
      return Math.min(maxValue, Math.max(param.min, steppedValue));
    }
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "color":
    case "text":
      return typeof value === "string" ? value : null;
    case "select":
      return typeof value === "string" &&
        param.options.some((option) => option.value === value)
        ? value
        : null;
    default: {
      const exhaustive: never = param;
      return exhaustive;
    }
  }
}

/** Transform / opacity / gain channels used by M6 (effects/graphics excluded). */
export const YAMAKAN_ANIMATION_PROPERTIES: readonly {
  id: string;
  valueKind: ChannelValueKind;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: ParamValue;
}[] = [
  { id: "transform.positionX", valueKind: "scalar", defaultValue: 0 },
  { id: "transform.positionY", valueKind: "scalar", defaultValue: 0 },
  {
    id: "transform.scaleX",
    valueKind: "scalar",
    min: 0,
    defaultValue: 1,
  },
  {
    id: "transform.scaleY",
    valueKind: "scalar",
    min: 0,
    defaultValue: 1,
  },
  { id: "transform.rotate", valueKind: "scalar", defaultValue: 0 },
  {
    id: "opacity",
    valueKind: "scalar",
    min: 0,
    max: 1,
    defaultValue: 1,
  },
  {
    id: "volume",
    valueKind: "scalar",
    min: 0,
    max: 4,
    defaultValue: 1,
  },
];
