import type { ProjectEvent } from "./projectEventTypes";

export type { ProjectEvent, ProjectEventType } from "./projectEventTypes";

/**
 * Host-adapted Project shape for Q7a/Q7b. Donor projectContracts pulls the full
 * workbench; Yamakan supplies a minimal typed stand-in. Canvas is non-null at
 * mutation time (donor invariant); staging/queue fields are structural anys
 * until the host reducer (Q7b) narrows them.
 */
export type Project = {
  id: string;
  // Donor mutations assume a present canvas; keep non-null for seam compile.
  canvas: import("../../canvas-engine/contracts").CanvasStateContractV3;
  events: ProjectEvent[];
  queue: { items: Array<{ id: string; [k: string]: unknown }> };
  [k: string]: unknown;
};

export type WorkbenchState = {
  projects: readonly Project[];
};
