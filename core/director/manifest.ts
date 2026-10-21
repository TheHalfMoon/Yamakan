// M12 / W15: Pipeline manifest schema translated from OpenMontage
// schemas/pipelines/pipeline_manifest.schema.json @ 9327439 (AGPL-3.0).
// Manifests are data only and cannot name executables.
import { z } from "zod";
import { CommandError } from "../command/errors.ts";

export const PipelineStageSchema = z
  .object({
    name: z.string().min(1).max(80),
    required_artifacts_in: z.array(z.string().max(80)).max(32).optional(),
    produces: z.array(z.string().max(80)).max(32).optional(),
    tools_available: z.array(z.string().max(80)).max(0).default([]),
    checkpoint_required: z.boolean().optional(),
    human_approval_default: z.boolean().optional(),
    success_criteria: z.array(z.string().max(500)).max(16).optional(),
  })
  .strict()
  .superRefine((stage, ctx) => {
    // Security: tools_available must stay empty — manifests cannot name executables.
    if (stage.tools_available.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Pipeline manifests cannot name tools or executables.",
        path: ["tools_available"],
      });
    }
  });

export const PipelineManifestSchema = z
  .object({
    name: z.string().min(1).max(80),
    version: z.string().min(1).max(40),
    description: z.string().max(2_000).optional(),
    category: z
      .enum([
        "talking_head",
        "generated",
        "hybrid",
        "screen_recording",
        "animation",
        "cinematic",
        "documentary",
        "custom",
      ])
      .optional(),
    stability: z.enum(["production", "beta"]).optional(),
    default_checkpoint_policy: z.string().max(40).optional(),
    stages: z.array(PipelineStageSchema).min(1).max(32),
  })
  .strict();
export type PipelineManifest = z.infer<typeof PipelineManifestSchema>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export function parsePipelineManifest(raw: unknown): PipelineManifest {
  const parsed = PipelineManifestSchema.safeParse(raw);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      `Invalid pipeline manifest: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  const names = new Set<string>();
  for (const stage of parsed.data.stages) {
    if (names.has(stage.name))
      throw new CommandError(
        "VALIDATION",
        `Duplicate pipeline stage name: ${stage.name}`,
      );
    names.add(stage.name);
  }
  return parsed.data;
}

export function stageNames(manifest: PipelineManifest): string[] {
  return manifest.stages.map((s) => s.name);
}

export function stageRequiresApproval(
  manifest: PipelineManifest,
  stage: string,
): boolean {
  const row = manifest.stages.find((s) => s.name === stage);
  if (!row)
    throw new CommandError(
      "VALIDATION",
      `Unknown stage ${stage} in pipeline ${manifest.name}.`,
    );
  return row.human_approval_default === true;
}

/** Yamakan-authored smoke pipeline (OpenMontage framework-smoke shape). */
export const FRAMEWORK_SMOKE_MANIFEST: PipelineManifest = parsePipelineManifest(
  {
    name: "framework-smoke",
    version: "1.0",
    description:
      "Minimal pipeline manifest used to exercise Director stage contracts.",
    category: "custom",
    stability: "beta",
    default_checkpoint_policy: "guided",
    stages: [
      {
        name: "research",
        produces: ["research_brief"],
        tools_available: [],
        checkpoint_required: true,
        human_approval_default: true,
        success_criteria: ["Produces a schema-valid research_brief artifact"],
      },
      {
        name: "script",
        required_artifacts_in: ["research_brief"],
        produces: ["script"],
        tools_available: [],
        checkpoint_required: true,
        human_approval_default: true,
        success_criteria: ["Produces a schema-valid script artifact"],
      },
      {
        name: "timeline",
        required_artifacts_in: ["script"],
        produces: ["timeline"],
        tools_available: [],
        checkpoint_required: true,
        human_approval_default: true,
        success_criteria: ["Places approved shots on the timeline"],
      },
    ],
  },
);

export function builtinManifest(name: string): PipelineManifest {
  if (name === "framework-smoke" || name === FRAMEWORK_SMOKE_MANIFEST.name)
    return FRAMEWORK_SMOKE_MANIFEST;
  throw new CommandError("NOT_FOUND", `Unknown pipeline manifest: ${name}`);
}
