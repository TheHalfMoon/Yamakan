// W18: read-only Flow projection of a Director run over a pipeline manifest.
// Flow never issues commands; it only describes stage state.
import type { PipelineManifest } from "../director/manifest.ts";
import type { DirectorRun, StageStatus } from "../director/stages.ts";
import { stageRequiresApproval } from "../director/manifest.ts";

export const FLOW_ENABLED = true;

export type FlowStageView = {
  name: string;
  status: StageStatus | "not_started";
  requiresApproval: boolean;
  humanApproved: boolean;
  outputHash: string | null;
  produces: string[];
};

export type FlowSnapshot = {
  format: "yamakan.flow-snapshot";
  formatVersion: 1;
  enabled: true;
  pipelineName: string;
  pipelineVersion: string;
  runId: string | null;
  projectId: string | null;
  stages: FlowStageView[];
  /** True: this view never mutates; callers must not treat it as a command. */
  readOnly: true;
};

export function flowSnapshot(
  manifest: PipelineManifest,
  run: DirectorRun | null,
): FlowSnapshot {
  const byStage = new Map(
    (run?.receipts ?? []).map((r) => [r.stage, r] as const),
  );
  return {
    format: "yamakan.flow-snapshot",
    formatVersion: 1,
    enabled: true,
    pipelineName: manifest.name,
    pipelineVersion: manifest.version,
    runId: run?.id ?? null,
    projectId: run?.projectId ?? null,
    readOnly: true,
    stages: manifest.stages.map((s) => {
      const receipt = byStage.get(s.name);
      return {
        name: s.name,
        status: receipt?.status ?? "not_started",
        requiresApproval: stageRequiresApproval(manifest, s.name),
        humanApproved: receipt?.humanApproved ?? false,
        outputHash: receipt?.outputHash ?? null,
        produces: s.produces ?? [],
      };
    }),
  };
}
