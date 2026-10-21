// Adapted from OpenCut Classic (MIT) apps/web/src/animation/values.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick MediaTime, properties.ts params surface.

import type {
	AnimationColorPropertyPath,
	AnimationNumericPropertyPath,
	ElementAnimations,
} from "./types.ts";
import { resolveAnimationPathValueAtTime } from "./resolve.ts";

export function resolveOpacityAtTime({
	baseOpacity,
	animations,
	localTime,
}: {
	baseOpacity: number;
	animations: ElementAnimations | undefined;
	localTime: number;
}): number {
	return resolveAnimationPathValueAtTime({
		animations,
		propertyPath: "opacity",
		localTime: Math.max(0, localTime),
		fallbackValue: baseOpacity,
	});
}

export function resolveNumberAtTime({
	baseValue,
	animations,
	propertyPath,
	localTime,
}: {
	baseValue: number;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationNumericPropertyPath;
	localTime: number;
}): number {
	return resolveAnimationPathValueAtTime({
		animations,
		propertyPath,
		localTime: Math.max(0, localTime),
		fallbackValue: baseValue,
	});
}

export function resolveColorAtTime({
	baseColor,
	animations,
	propertyPath,
	localTime,
}: {
	baseColor: string;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationColorPropertyPath;
	localTime: number;
}): string {
	return resolveAnimationPathValueAtTime({
		animations,
		propertyPath,
		localTime: Math.max(0, localTime),
		fallbackValue: baseColor,
	});
}
