// Adapted from OpenCut Classic (MIT) apps/web/src/animation/index.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick MediaTime, properties.ts params surface.

export {
  getChannelValueAtTime,
  getDiscreteChannelValueAtTime,
  getScalarChannelValueAtTime,
  getScalarSegmentInterpolation,
  normalizeChannel,
} from "./interpolation.ts";

export {
  clampAnimationsToDuration,
  cloneAnimations,
  getChannel,
  removeElementKeyframe,
  retimeElementKeyframe,
  setBindingComponentChannel,
  setChannel,
  splitAnimationsAtTime,
  updateScalarKeyframeCurve,
  upsertPathKeyframe,
} from "./keyframes.ts";

export {
  getElementLocalTime,
  resolveAnimationPathValueAtTime,
} from "./resolve.ts";

export {
  getElementKeyframes,
  getKeyframeById,
  getKeyframeAtTime,
  hasKeyframesForPath,
} from "./keyframe-query.ts";

export {
  type EditableScalarChannels,
  getEditableScalarChannel,
  getEditableScalarChannels,
  getScalarKeyframeContext,
} from "./graph-channels.ts";

export {
  getCurveHandlesForNormalizedCubicBezier,
  getNormalizedCubicBezierForScalarSegment,
} from "./curve-bridge.ts";

export {
  getGroupKeyframesAtTime,
  hasGroupKeyframeAtTime,
  type GroupKeyframeRef,
} from "./property-groups.ts";

export { isAnimationPath, isAnimationPropertyPath } from "./path.ts";

export type { NumericSpec } from "./types.ts";

export { ANIMATION_ENABLED } from "./flags.ts";
