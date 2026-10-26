// v1 bridge (YU-040): runs v2 operation requests on a v1 graph adapter
// (today only the in-process fake) by lowering server-owned recipe
// templates. A request names a recipe by id and hash; it can never carry
// a graph. Inputs are read through the service's handles, bounded by the
// v1 adapter's upload limit, because v1 takes whole byte arrays.
import { createHash } from "node:crypto";
import { canonicalJson } from "../hash/canonical.ts";
import type {
  EngineAdapter,
  EngineGraph,
  EngineInputFile,
} from "./contract.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  EngineRequestV2Schema,
  constraintsHash,
  refusal,
} from "./contract-v2.ts";
import type {
  Artifact,
  CapabilityV2,
  Constraints,
  EngineAdapterV2,
  EngineRequestV2,
  ExecutionStatus,
  Operation,
} from "./contract-v2.ts";

// A server-owned recipe: which operation it implements, the measured
// constraints it was qualified for, and the graph template it lowers to
// (only allowlisted node classes, filled from the validated request).
export type Recipe = {
  id: string;
  operation: Operation;
  constraints: Constraints;
  outputMediaType: Artifact["mediaType"];
  template: (request: EngineRequestV2) => EngineGraph;
};

export const recipeHash = (recipe: Recipe) =>
  createHash("sha256")
    .update(
      canonicalJson({
        id: recipe.id,
        operation: recipe.operation,
        constraints: recipe.constraints,
        outputMediaType: recipe.outputMediaType,
        // The template's shape, from a fixed probe request.
        template: recipe.template.toString(),
      }),
    )
    .digest("hex");

// The recipes this build ships: fake-engine templates for tests only.
export const SERVER_RECIPES: readonly Recipe[] = Object.freeze([
  {
    id: "fake.textToVideo.v1",
    operation: "textToVideo",
    constraints: {
      maxWidth: 1280,
      maxHeight: 720,
      fps: [{ num: 30, den: 1 }],
      minDurationTicks: 1,
      maxDurationTicks: 705_600_000 * 10,
      audio: false,
      controls: ["guidance"],
    },
    outputMediaType: "video/mp4",
    template: () => ({
      nodes: {
        "1": { class_type: "YamakanFakeLoad", inputs: {} },
        "2": { class_type: "YamakanFakeSave", inputs: { image: ["1", 0] } },
      },
    }),
  },
  {
    id: "fake.imageToVideo.v1",
    operation: "imageToVideo",
    constraints: {
      maxWidth: 1280,
      maxHeight: 720,
      fps: [{ num: 30, den: 1 }],
      minDurationTicks: 1,
      maxDurationTicks: 705_600_000 * 10,
      audio: false,
      controls: [],
    },
    outputMediaType: "video/mp4",
    template: () => ({
      nodes: {
        "1": { class_type: "YamakanFakeLoad", inputs: { image: "input-0" } },
        "2": { class_type: "YamakanFakeSave", inputs: { image: ["1", 0] } },
      },
    }),
  },
]);

const v1State = (
  state: string,
  quarantined?: boolean,
): ExecutionStatus["state"] =>
  state === "completed"
    ? quarantined
      ? "failed"
      : "succeeded"
    : state === "queued" ||
        state === "running" ||
        state === "failed" ||
        state === "cancelled"
      ? state
      : "unknown";

export function bridgeV1(
  v1: EngineAdapter,
  recipes: readonly Recipe[] = SERVER_RECIPES,
): EngineAdapterV2 {
  const byId = new Map(
    recipes.map((r) => [r.id, { recipe: r, hash: recipeHash(r) }]),
  );
  const fences = new Map<string, { generation: number; ref: string }>();
  const recipeOf = new Map<string, Recipe>();
  const capabilities = (): CapabilityV2[] => {
    const v1Available = v1.capabilities().available;
    return recipes.map((r) => ({
      operation: r.operation,
      available: v1Available,
      ...(v1Available ? {} : { reason: "ENGINE_DISABLED" as const }),
      constraints: r.constraints,
      constraintsHash: constraintsHash(r.constraints),
    }));
  };
  const diagnostic = (text?: string) =>
    text?.slice(0, ENGINE_V2_LIMITS.diagnosticChars);
  return {
    contract: ENGINE_CONTRACT_V2,
    capabilities,
    async submit(raw, context) {
      const parsed = EngineRequestV2Schema.safeParse(raw);
      if (!parsed.success) return { refused: "INVALID_REQUEST" };
      const request = parsed.data;
      const known = byId.get(request.recipeId);
      if (
        !known ||
        known.hash !== request.recipeHash ||
        known.recipe.operation !== request.operation
      )
        return { refused: "RECIPE_UNKNOWN" };
      const fence = fences.get(request.attemptKey);
      if (fence && request.leaseGeneration < fence.generation)
        return { refused: "STALE_ATTEMPT" };
      if (fence && request.leaseGeneration === fence.generation)
        return { executionRef: fence.ref };
      const capability = capabilities().find(
        (c) => c.operation === request.operation,
      );
      const refused = refusal(request, capability);
      if (refused) return { refused };
      // v1 takes whole byte arrays: read each input through its handle,
      // bounded by the v1 upload limit, and check its hash.
      const limit = v1.capabilities().maxUploadBytes ?? 0;
      const inputs: EngineInputFile[] = [];
      for (const [i, { asset }] of request.inputs.entries()) {
        const parts: Uint8Array[] = [];
        let bytes = 0;
        for await (const chunk of context.openAsset(asset)) {
          bytes += chunk.byteLength;
          if (bytes > limit) return { refused: "INVALID_REQUEST" };
          parts.push(chunk);
        }
        const data = Buffer.concat(parts);
        if (createHash("sha256").update(data).digest("hex") !== asset.sha256)
          return { refused: "INVALID_REQUEST" };
        inputs.push({ name: `input-${i}`, bytes: data, sha256: asset.sha256 });
      }
      // Only the server's template becomes a graph.
      const { id } = await v1.submit({
        graph: known.recipe.template(request),
        inputs,
        attemptKey: request.attemptKey,
      });
      fences.set(request.attemptKey, {
        generation: request.leaseGeneration,
        ref: id,
      });
      recipeOf.set(id, known.recipe);
      return { executionRef: id };
    },
    async status(ref) {
      const s = await v1.status(ref);
      return {
        executionRef: ref,
        state: v1State(s.state, s.quarantined),
        ...(s.error ? { diagnostic: diagnostic(s.error) } : {}),
      };
    },
    async reconcile(ref) {
      const s = await v1.status(ref);
      return {
        executionRef: ref,
        state: v1State(s.state, s.quarantined),
        ...(s.error ? { diagnostic: diagnostic(s.error) } : {}),
      };
    },
    async requestCancel(ref) {
      const s = await v1.cancel(ref);
      return {
        requested: true,
        localProcessExited:
          s.state === "cancelled" ||
          s.state === "completed" ||
          s.state === "failed",
        billingOutcome: "notApplicable",
      };
    },
    async enumerateArtifacts(ref) {
      const s = await v1.status(ref);
      if (v1State(s.state, s.quarantined) !== "succeeded") return [];
      const recipe = recipeOf.get(ref)!;
      return (await v1.outputs(ref))
        .slice(0, ENGINE_V2_LIMITS.artifacts)
        .map((o) => ({
          handle: o.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-")
            .slice(0, 64),
          mediaType: recipe.outputMediaType,
          byteLength: o.bytes.byteLength,
          sha256: o.sha256,
        }));
    },
    async *readArtifact(ref, handle) {
      const artifacts = await this.enumerateArtifacts(ref);
      const index = artifacts.findIndex((a) => a.handle === handle);
      if (index < 0) throw new Error("No such artifact.");
      const bytes = (await v1.outputs(ref))[index]!.bytes;
      for (let i = 0; i < bytes.byteLength; i += ENGINE_V2_LIMITS.chunkBytes)
        yield bytes.subarray(
          i,
          Math.min(bytes.byteLength, i + ENGINE_V2_LIMITS.chunkBytes),
        );
    },
  };
}
