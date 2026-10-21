import type { ProjectEvent } from "./projectEventTypes";

export type { ProjectEvent, ProjectEventType } from "./projectEventTypes";

/** Host shim: prepend an event without touching a competing event store. */
export function prependProjectEvent(
  events: readonly ProjectEvent[] | undefined,
  event: ProjectEvent,
): ProjectEvent[] {
  return [event, ...(events ?? [])];
}
