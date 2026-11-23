/** Gives focus to what came of a press, where the press left it nowhere: never takes it from a
 * person who has gone on elsewhere. */
export function focusIfLost(
  to: HTMLElement | null,
  pressedIn: HTMLElement | null,
) {
  const at = document.activeElement;
  if (!at || at === document.body || pressedIn?.contains(at)) to?.focus();
}
