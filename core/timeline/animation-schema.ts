// Strict zod shapes for optional clip.animation maps (W16/M6).
// Uses a fixed key set (not z.record) so command catalog JSON Schema stays
// additionalProperties:false all the way down.
import { z } from "zod";

const MediaTimeTicks = z.number().int();

const CurveHandleSchema = z
  .object({
    dt: MediaTimeTicks,
    dv: z.number().finite(),
  })
  .strict();

const ScalarKeySchema = z
  .object({
    id: z.string().min(1).max(80),
    time: MediaTimeTicks,
    value: z.number().finite(),
    leftHandle: CurveHandleSchema.optional(),
    rightHandle: CurveHandleSchema.optional(),
    segmentToNext: z.enum(["step", "linear", "bezier"]),
    tangentMode: z.enum(["auto", "aligned", "broken", "flat"]),
  })
  .strict();

export const ScalarChannelSchema = z
  .object({
    keys: z.array(ScalarKeySchema).max(512),
    extrapolation: z
      .object({
        before: z.enum(["hold", "linear"]),
        after: z.enum(["hold", "linear"]),
      })
      .strict()
      .optional(),
  })
  .strict();

/** M6 transform / opacity / volume channels only (effects/graphics excluded). */
export const ClipAnimationSchema = z
  .object({
    "transform.positionX": ScalarChannelSchema.optional(),
    "transform.positionY": ScalarChannelSchema.optional(),
    "transform.scaleX": ScalarChannelSchema.optional(),
    "transform.scaleY": ScalarChannelSchema.optional(),
    "transform.rotate": ScalarChannelSchema.optional(),
    opacity: ScalarChannelSchema.optional(),
    volume: ScalarChannelSchema.optional(),
  })
  .strict();
