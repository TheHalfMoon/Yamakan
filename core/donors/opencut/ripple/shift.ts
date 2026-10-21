// Adapted from OpenCut Classic (MIT) apps/web/src/ripple/shift.ts
 // @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: flick ticks;
 // shiftAmount may be signed (negative opens a gap for insert).
import { addTicks } from "../../../time.ts";
import type { TimelineElement } from "../timeline-types.ts";

export function rippleShiftElements<TElement extends TimelineElement>({
  elements,
  afterTime,
  shiftAmount,
}: {
  elements: TElement[];
  afterTime: number;
  shiftAmount: number;
}): TElement[] {
  return elements.map((element) =>
    element.startTime >= afterTime
      ? ({
          ...element,
          startTime: addTicks(element.startTime, -shiftAmount),
        } as TElement)
      : element,
  );
}
