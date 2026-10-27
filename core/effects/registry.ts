// Typed clip effects (YU-020). A clip may carry a short, versioned effect
// stack; today it holds one kind, a transform with crop. Every value is a
// bounded integer, so a stored effect can never carry NaN, an unbounded
// scale, a filter, a script or a path, and its compiled filter text is
// built only from those integers. An effect kind or version this build
// does not know fails validation (preflight), and a project with effects is
// stored as canonical v6, which an older build refuses as a newer format;
// no build reads it with its effects dropped.
//
// Semantics, the same in export and reference preview (both compile from
// the render plan):
//   1. crop the source: left/top/right/bottom, in thousandths of its size;
//   2. fit the cropped picture inside the frame (contain, as without it);
//   3. scale that picture about its centre, in thousandths (1000 = 1x);
//   4. move it from the centre by offsetX/offsetY, in thousandths of the
//      frame's width and height.
import { z } from "zod";

const Permille = (min: number, max: number) =>
  z.number().int().min(min).max(max);

export const TransformEffectSchema = z
  .object({
    type: z.literal("transform"),
    version: z.literal(1),
    // 0.1x to 4x.
    scale: Permille(100, 4000),
    // Up to one frame width or height either way.
    offsetX: Permille(-1000, 1000),
    offsetY: Permille(-1000, 1000),
    crop: z
      .object({
        left: Permille(0, 900),
        top: Permille(0, 900),
        right: Permille(0, 900),
        bottom: Permille(0, 900),
      })
      .strict()
      .refine((c) => c.left + c.right <= 900 && c.top + c.bottom <= 900, {
        message: "A crop keeps at least a tenth of the picture.",
      }),
  })
  .strict();
export type TransformEffect = z.infer<typeof TransformEffectSchema>;

// YU-023: a 3D LUT, applied to the source picture in the policy's Rec.709
// RGB before the fit. It names an immutable `lut` creative document of
// the project by id and content hash; it holds no numbers or paths itself.
export const LutEffectSchema = z
  .object({
    type: z.literal("lut"),
    version: z.literal(1),
    documentId: z.uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type LutEffect = z.infer<typeof LutEffectSchema>;

/** Known effect kinds, by `type`; a later kind is added here, versioned. */
export const ClipEffectSchema = z.discriminatedUnion("type", [
  TransformEffectSchema,
  LutEffectSchema,
]);
export type ClipEffect = z.infer<typeof ClipEffectSchema>;

export const EFFECT_LIMITS = Object.freeze({
  effectsPerClip: 4,
  // The largest picture a scaled layer may be, in pixels (a 1920x1080
  // frame at 4x): bounds a render's memory however the output is sized.
  // Canonical output is capped at 1920x1080 today, so this only bites if
  // that cap is raised; revisit it then.
  scaledPixels: 1920 * 1080 * 16,
  // A cropped source is at least this wide and tall.
  cropSourcePixels: 20,
});

export const ClipEffectsSchema = z
  .array(ClipEffectSchema)
  .min(1)
  .max(EFFECT_LIMITS.effectsPerClip)
  .refine((list) => list.filter((e) => e.type === "transform").length <= 1, {
    message: "A clip has at most one transform.",
  })
  .refine((list) => list.filter((e) => e.type === "lut").length <= 1, {
    message: "A clip has at most one LUT.",
  });
export type ClipEffects = z.infer<typeof ClipEffectsSchema>;

export const IDENTITY_TRANSFORM: TransformEffect = Object.freeze({
  type: "transform",
  version: 1,
  scale: 1000,
  offsetX: 0,
  offsetY: 0,
  crop: Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 }),
}) as TransformEffect;

export function isIdentityTransform(t: TransformEffect): boolean {
  return (
    t.scale === 1000 &&
    t.offsetX === 0 &&
    t.offsetY === 0 &&
    t.crop.left === 0 &&
    t.crop.top === 0 &&
    t.crop.right === 0 &&
    t.crop.bottom === 0
  );
}

/** The clip's transform, or null when it has none (or only an identity). */
export function clipTransform(
  effects: ClipEffects | undefined | null,
): TransformEffect | null {
  const t = effects?.find((e) => e.type === "transform") ?? null;
  return t && !isIdentityTransform(t) ? t : null;
}

/** The clip's LUT, or null when it has none. */
export function clipLut(
  effects: ClipEffects | undefined | null,
): LutEffect | null {
  return effects?.find((e) => e.type === "lut") ?? null;
}

/** Whether a stack changes nothing (every effect an identity). */
export const isIdentityStack = (effects: ClipEffects) =>
  effects.every((e) => e.type === "transform" && isIdentityTransform(e));

/**
 * Effect writes (YU-020): on, unless an operator turned them off with
 * YAMAKAN_EFFECTS_OFF=1 (rollback without a rebuild). It refuses new
 * effect values by command and by whole-project save; stored effects stay
 * readable and keep rendering. Undo, redo and restore move between stored
 * revisions and may bring effects back or take them away.
 */
export const EFFECTS_OFF =
  "Changing clip effects is turned off on this service (YAMAKAN_EFFECTS_OFF); saved effects stay and still render.";
export function effectWritesEnabled(): boolean {
  return (
    typeof process === "undefined" || process.env?.YAMAKAN_EFFECTS_OFF !== "1"
  );
}

/**
 * The FFmpeg filters for a transform, between the decoded source and the
 * overlay: a crop before the contain fit (`fit` is the existing contain
 * scale), and a scale after it. Every number comes from the validated
 * integers above, so the text cannot carry anything else.
 */
export function transformFilters(
  t: TransformEffect,
  fit: string,
): { picture: string; overlay: { x: string; y: string } } {
  const c = t.crop;
  const keepW = 1000 - c.left - c.right;
  const keepH = 1000 - c.top - c.bottom;
  const cropped =
    keepW === 1000 && keepH === 1000
      ? ""
      : `crop=w=trunc(iw*${keepW}/2000)*2:h=trunc(ih*${keepH}/2000)*2:x=trunc(iw*${c.left}/1000):y=trunc(ih*${c.top}/1000),`;
  const scaled =
    t.scale === 1000
      ? ""
      : `,scale=w='max(2,trunc(iw*${t.scale}/2000)*2)':h='max(2,trunc(ih*${t.scale}/2000)*2)'`;
  return {
    picture: `${cropped}${fit}${scaled}`,
    overlay: {
      x: `(W-w)/2+trunc(W*${t.offsetX}/1000)`,
      y: `(H-h)/2+trunc(H*${t.offsetY}/1000)`,
    },
  };
}
