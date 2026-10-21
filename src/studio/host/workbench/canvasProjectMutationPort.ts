import type { CanvasStateContractV3 } from "../../canvas-engine/contracts";

export type CanvasEditIntent = { kind: string; [k: string]: unknown };
export type CanvasMutationOrigin = "user" | "system" | string;
export type CanvasProjectMutation = { type: string; [k: string]: unknown };

export interface CanvasProjectMutationPort {
  getCanvasState(): CanvasStateContractV3 | null;
  subscribe(listener: () => void): () => void;
  dispatch(mutation: CanvasProjectMutation, origin?: CanvasMutationOrigin): boolean;
  commitEdit(intent: CanvasEditIntent): void;
}

export function createHostPort(
  initial: CanvasStateContractV3 | null = null,
): CanvasProjectMutationPort {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getCanvasState: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    dispatch: () => true,
    commitEdit: () => {},
  };
}
