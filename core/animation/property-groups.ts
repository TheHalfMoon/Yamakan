// Adapted from OpenCut Classic (MIT) apps/web/src/animation/property-groups.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick MediaTime, properties.ts params surface.

import type {
	AnimationPropertyGroup,
	AnimationPropertyPath,
	ElementAnimations,
} from "./types.ts";
import { ANIMATION_PROPERTY_GROUPS } from "./types.ts";
import { getKeyframeAtTime } from "./keyframe-query.ts";

export interface GroupKeyframeRef {
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
}

export function getGroupKeyframesAtTime({
	animations,
	group,
	time,
}: {
	animations: ElementAnimations | undefined;
	group: AnimationPropertyGroup;
	time: number;
}): GroupKeyframeRef[] {
	return ANIMATION_PROPERTY_GROUPS[group].flatMap((propertyPath) => {
		const keyframe = getKeyframeAtTime({ animations, propertyPath, time });
		return keyframe ? [{ propertyPath, keyframeId: keyframe.id }] : [];
	});
}

export function hasGroupKeyframeAtTime({
	animations,
	group,
	time,
}: {
	animations: ElementAnimations | undefined;
	group: AnimationPropertyGroup;
	time: number;
}): boolean {
	return getGroupKeyframesAtTime({ animations, group, time }).length > 0;
}
