export {
  createInitialWorkbenchState,
  getWorkbenchState,
  type WorkbenchState,
} from "./workbenchState.ts";

/** Donor WorkbenchAction stand-in for inherited Studio tests (host has no reducer). */
export type WorkbenchAction = { type: string; [key: string]: unknown };

/** Donor testing re-export; host has no separate workbench reducer. */
export function workbenchReducer(
  state: unknown,
  _action: unknown,
): unknown {
  return state;
}
