// Yamakan implementation of CanvasProjectMutationPort. SQLite revisions are
// the only persistent authority; this port holds session canvas state only.
import type { CanvasStateContractV3 } from "../canvas-engine/contracts";
import type { CanvasProjectMutation } from "../canvas-engine/mutationContracts";
import { applyCanvasProjectMutation } from "../workbench/canvasProjectMutations";
import type { Project } from "./workbench/projectContracts";
import type {
  CanvasEditIntent,
  CanvasMutationOrigin,
  CanvasProjectMutationPort,
} from "./workbench/canvasProjectMutationPort";

export type StudioPortListener = () => void;

export type StudioHostPort = CanvasProjectMutationPort & {
  /** Replace the whole canvas (revision restore). Clears callers' engine history. */
  replaceCanvas(next: CanvasStateContractV3 | null): void;
  /** Snapshot dirty marker for host commit coalescing. */
  isDirty(): boolean;
  clearDirty(): void;
  getProject(): Project | null;
};

function projectFromCanvas(
  id: string,
  canvas: CanvasStateContractV3,
): Project {
  return {
    id,
    canvas,
    events: [],
    queue: { items: [] },
  };
}

export function createStudioHostPort(
  initial: CanvasStateContractV3 | null = null,
  projectId = "studio-session",
): StudioHostPort {
  let project: Project | null = initial
    ? projectFromCanvas(projectId, initial)
    : null;
  let dirty = false;
  const listeners = new Set<StudioPortListener>();

  const notify = (): void => {
    for (const l of listeners) l();
  };

  return {
    getCanvasState: () => project?.canvas ?? null,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (mutation: CanvasProjectMutation, _origin?: CanvasMutationOrigin) => {
      if (!project) return false;
      try {
        project = applyCanvasProjectMutation(project, mutation);
        dirty = true;
        notify();
        return true;
      } catch {
        return false;
      }
    },
    commitEdit: (_intent: CanvasEditIntent) => {
      dirty = true;
      notify();
    },
    replaceCanvas: (next) => {
      project = next ? projectFromCanvas(projectId, next) : null;
      dirty = true;
      notify();
    },
    isDirty: () => dirty,
    clearDirty: () => {
      dirty = false;
    },
    getProject: () => project,
  };
}
