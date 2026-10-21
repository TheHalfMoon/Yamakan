// Yamakan implementation of CanvasProjectMutationPort. SQLite revisions are
// the only persistent authority; this port holds session canvas state only.
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";
import type {
  CanvasEditIntent,
  CanvasMutationOrigin,
  CanvasProjectMutation,
  CanvasProjectMutationPort,
} from "./workbench/canvasProjectMutationPort";

export type StudioPortListener = () => void;

export type StudioHostPort = CanvasProjectMutationPort & {
  /** Replace the whole canvas (revision restore). Clears callers' engine history. */
  replaceCanvas(next: CanvasStateContractV3 | null): void;
  /** Snapshot dirty marker for host commit coalescing. */
  isDirty(): boolean;
  clearDirty(): void;
};

export function createStudioHostPort(
  initial: CanvasStateContractV3 | null = null,
): StudioHostPort {
  let canvas = initial;
  let dirty = false;
  const listeners = new Set<StudioPortListener>();

  const notify = (): void => {
    for (const l of listeners) l();
  };

  return {
    getCanvasState: () => canvas,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (_mutation: CanvasProjectMutation, _origin?: CanvasMutationOrigin) => {
      // Full mutation application is the adapted reducer seam (Q7b). Until that
      // seam is wired for every mutation kind, structural no-ops stay false.
      dirty = true;
      notify();
      return false;
    },
    commitEdit: (_intent: CanvasEditIntent) => {
      dirty = true;
      notify();
    },
    replaceCanvas: (next) => {
      canvas = next;
      dirty = true;
      notify();
    },
    isDirty: () => dirty,
    clearDirty: () => {
      dirty = false;
    },
  };
}
