// W18: read-only Flow view. Renders a FlowSnapshot; issues no commands.
import React from "react";
import type { FlowSnapshot } from "../../core/flow/snapshot.ts";

export type FlowViewProps = {
  snapshot: FlowSnapshot;
};

export function FlowView({ snapshot }: FlowViewProps) {
  if (!snapshot.enabled) return null;
  return (
    <section
      className="yamakan-flow"
      aria-label="Flow"
      data-flow-readonly="true"
      data-pipeline={snapshot.pipelineName}
    >
      <header>
        <h2>Flow</h2>
        <p>
          {snapshot.pipelineName} · v{snapshot.pipelineVersion}
          {snapshot.runId ? ` · run ${snapshot.runId.slice(0, 8)}` : ""}
        </p>
      </header>
      <ol className="yamakan-flow-stages">
        {snapshot.stages.map((stage) => (
          <li key={stage.name} data-status={stage.status}>
            <span className="yamakan-flow-stage-name">{stage.name}</span>
            <span className="yamakan-flow-stage-status">{stage.status}</span>
            {stage.requiresApproval ? (
              <span className="yamakan-flow-stage-approval">
                {stage.humanApproved ? "approved" : "needs approval"}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
