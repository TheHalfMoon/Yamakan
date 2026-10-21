import type { Project, WorkbenchState } from "./projectContracts.ts";
import { createEmptyCanvasState } from "../../workbench/canvasMigration.ts";

export type { WorkbenchState };

/** Minimal host workbench seed for inherited Studio tests (Q9 shim). */
export function createInitialWorkbenchState(): WorkbenchState {
  const project: Project = {
    id: "studio-test-project",
    canvas: createEmptyCanvasState(1024, 1024),
    events: [],
    queue: { items: [] },
  };
  return { projects: [project] };
}

export function getWorkbenchState(): WorkbenchState {
  return createInitialWorkbenchState();
}
