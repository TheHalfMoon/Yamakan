// Adapted from OpenCut Classic (MIT) apps/web/src/animation/path.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick MediaTime, properties.ts params surface.

import type { AnimationPath, AnimationPropertyPath } from "./types.ts";
import { ANIMATION_PROPERTY_PATHS } from "./types.ts";

const ANIMATION_PROPERTY_PATH_SET = new Set<string>(ANIMATION_PROPERTY_PATHS);

const GRAPHIC_PARAM_PATH_PREFIX = "params.";
const EFFECT_PARAM_PATH_PREFIX = "effects.";
const EFFECT_PARAM_PATH_SUFFIX = ".params.";

export function isAnimationPropertyPath(
  propertyPath: string,
): propertyPath is AnimationPropertyPath {
  return ANIMATION_PROPERTY_PATH_SET.has(propertyPath);
}

function isGraphicParamPath(propertyPath: string): boolean {
  return propertyPath.startsWith(GRAPHIC_PARAM_PATH_PREFIX);
}

function isEffectParamPath(propertyPath: string): boolean {
  return (
    propertyPath.startsWith(EFFECT_PARAM_PATH_PREFIX) &&
    propertyPath.includes(EFFECT_PARAM_PATH_SUFFIX)
  );
}

export function isAnimationPath(
  propertyPath: string,
): propertyPath is AnimationPath {
  return (
    isAnimationPropertyPath(propertyPath) ||
    isGraphicParamPath(propertyPath) ||
    isEffectParamPath(propertyPath)
  );
}
