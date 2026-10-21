export {
  createInitialWorkbenchState,
  getWorkbenchState,
  type WorkbenchState,
} from "./workbenchState.ts";

/** Donor testing re-export; host has no separate workbench reducer. */
export function workbenchReducer(
  state: unknown,
  _action: unknown,
): unknown {
  return state;
}
