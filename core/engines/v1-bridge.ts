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
  ArtifactSchema,
  AttemptFence,
  CapabilityV2Schema,
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  EngineRequestV2Schema,
  ExecutionStatusSchema,
  constraintsHash,
  diagnostic,
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
  // Bumped whenever the template's lowering changes.
  templateVersion: number;
  operation: Operation;
  constraints: Constraints;
  outputMediaType: Artifact["mediaType"];
  template: (request: EngineRequestV2) => EngineGraph;
};

// A fixed request each template is lowered from to fingerprint it.
const PROBE = {
  prompt: "probe",
  seed: 0,
  controls: {},
  inputs: [],
} as unknown as EngineRequestV2;

export const recipeHash = (recipe: Recipe) =>
  createHash("sha256")
    .update(
      canonicalJson({
        id: recipe.id,
        templateVersion: recipe.templateVersion,
        operation: recipe.operation,
        constraints: recipe.constraints,
        outputMediaType: recipe.outputMediaType,
        probe: recipe.template(PROBE),
      }),
    )
    .digest("hex");

// The recipes this build ships: fake-engine templates for tests only. Each
// lowers what the request says (prompt, seed, inputs), or does not offer it.
export const SERVER_RECIPES: readonly Recipe[] = Object.freeze([
  {
    id: "fake.textToVideo.v1",
    templateVersion: 1,
    operation: "textToVideo",
    constraints: {
      maxWidth: 1280,
      maxHeight: 720,
      fps: [{ num: 30, den: 1 }],
      minDurationTicks: 1,
      maxDurationTicks: 705_600_000 * 10,
      audio: false,
      controls: [],
      roles: [],
    },
    outputMediaType: "video/mp4",
    template: (r) => ({
      nodes: {
        "1": {
          class_type: "YamakanFakeLoad",
          inputs: {
            prompt: "prompt" in r ? (r.prompt ?? "") : "",
            seed: r.seed ?? 0,
          },
        },
        "2": { class_type: "YamakanFakeSave", inputs: { image: ["1", 0] } },
      },
    }),
  },
  {
    id: "fake.imageToVideo.v1",
    templateVersion: 1,
    operation: "imageToVideo",
    constraints: {
      maxWidth: 1280,
      maxHeight: 720,
      fps: [{ num: 30, den: 1 }],
      minDurationTicks: 1,
      maxDurationTicks: 705_600_000 * 10,
      audio: false,
      controls: [],
      // A last frame is not lowered, so it is not offered.
      roles: ["firstFrame"],
    },
    outputMediaType: "video/mp4",
    template: (r) => ({
      nodes: {
        "1": {
          class_type: "YamakanFakeLoad",
          inputs: {
            image: "input-0",
            prompt: "prompt" in r ? (r.prompt ?? "") : "",
            seed: r.seed ?? 0,
          },
        },
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
const extension: Record<Artifact["mediaType"], string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "video/mp4": ".mp4",
  "audio/wav": ".wav",
  "text/vtt": ".vtt",
};

export function bridgeV1(
  v1: EngineAdapter,
  recipes: readonly Recipe[] = SERVER_RECIPES,
): EngineAdapterV2 {
  const byId = new Map(
    recipes.map((r) => [r.id, { recipe: r, hash: recipeHash(r) }]),
  );
  const fence = new AttemptFence();
  const recipeOf = new Map<string, Recipe>();
  // Per execution: its artifacts by handle (named by index, so names from
  // v1 can never collide or escape), fetched once.
  const outputsOf = new Map<
    string,
    Map<string, { artifact: Artifact; bytes: Uint8Array }>
  >();
  const capabilityOf = (r: Recipe): CapabilityV2 => {
    const available = v1.capabilities().available;
    return CapabilityV2Schema.parse(
      available
        ? {
            operation: r.operation,
            available,
            constraints: r.constraints,
            constraintsHash: constraintsHash(r.constraints),
          }
        : {
            operation: r.operation,
            available,
            reason: "ENGINE_DISABLED",
            constraintsHash: constraintsHash(null),
          },
    );
  };
  const observe = async (ref: string): Promise<ExecutionStatus> => {
    if (!recipeOf.has(ref)) return { executionRef: ref, state: "unknown" };
    const s = await v1.status(ref);
    return ExecutionStatusSchema.parse({
      executionRef: ref,
      state: v1State(s.state, s.quarantined),
      ...(s.error ? { diagnostic: diagnostic(s.error) } : {}),
    });
  };
  const artifactsOf = async (ref: string) => {
    const cached = outputsOf.get(ref);
    if (cached) return cached;
    const recipe = recipeOf.get(ref);
    if (!recipe || (await observe(ref)).state !== "succeeded") return null;
    const map = new Map<string, { artifact: Artifact; bytes: Uint8Array }>();
    for (const [i, o] of (await v1.outputs(ref))
      .slice(0, ENGINE_V2_LIMITS.artifacts)
      .entries()) {
      const artifact = ArtifactSchema.parse({
        handle: `out-${i}${extension[recipe.outputMediaType]}`,
        mediaType: recipe.outputMediaType,
        byteLength: o.bytes.byteLength,
        sha256: o.sha256,
      });
      map.set(artifact.handle, { artifact, bytes: o.bytes });
    }
    outputsOf.set(ref, map);
    return map;
  };
  const adapter: EngineAdapterV2 = {
    contract: ENGINE_CONTRACT_V2,
    capabilities: () => recipes.map(capabilityOf),
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
      const claim = fence.claim(request);
      if (claim.kind === "done") return claim.result;
      const refused = refusal(request, capabilityOf(known.recipe));
      if (refused) return claim.settle({ refused });
      // v1 takes whole byte arrays: read each input through its handle,
      // bounded by the v1 upload limit, and check its hash.
      const limit = v1.capabilities().maxUploadBytes ?? 0;
      const inputs: EngineInputFile[] = [];
      for (const [i, { asset }] of request.inputs.entries()) {
        const parts: Uint8Array[] = [];
        let bytes = 0;
        for await (const chunk of context.openAsset(asset)) {
          bytes += chunk.byteLength;
          if (bytes > limit)
            return claim.settle({ refused: "INVALID_REQUEST" });
          parts.push(chunk);
        }
        const data = Buffer.concat(parts);
        if (createHash("sha256").update(data).digest("hex") !== asset.sha256)
          return claim.settle({ refused: "INVALID_REQUEST" });
        inputs.push({ name: `input-${i}`, bytes: data, sha256: asset.sha256 });
      }
      // Only the server's template becomes a graph. Each generation is its
      // own v1 job: v1 replays by key, so the key carries the generation.
      const v1Key = `g${createHash("sha256")
        .update(`${request.attemptKey}\u0000${request.leaseGeneration}`)
        .digest("hex")
        .slice(0, 40)}`;
      const { id } = await v1.submit({
        graph: known.recipe.template(request),
        inputs,
        attemptKey: v1Key,
      });
      recipeOf.set(id, known.recipe);
      return claim.settle({ executionRef: id });
    },
    status: observe,
    // After a restart this bridge knows nothing of an execution: unknown,
    // never a resubmit.
    reconcile: observe,
    async requestCancel(ref) {
      if (!recipeOf.has(ref))
        return { requested: true, localProcessExited: false };
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
      const map = await artifactsOf(ref);
      return map ? [...map.values()].map((o) => ({ ...o.artifact })) : [];
    },
    async *readArtifact(ref, handle) {
      const entry = (await artifactsOf(ref))?.get(handle);
      if (!entry) throw new Error("No such artifact.");
      for (
        let i = 0;
        i < entry.bytes.byteLength;
        i += ENGINE_V2_LIMITS.chunkBytes
      )
        yield entry.bytes.subarray(
          i,
          Math.min(entry.bytes.byteLength, i + ENGINE_V2_LIMITS.chunkBytes),
        );
    },
  };
  return adapter;
}
