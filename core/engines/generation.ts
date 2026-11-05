// A generation a person asked for: started explicitly, followed, cancelled, and
// its output brought into the project as an ordinary asset. It holds no model and
// no graph; an engine adapter decides whether anything can run. In-process: a
// restart forgets a generation, whose output stays in the engine, unimported.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { assertLinkedMediaGeneratable } from "../continuity.ts";
import type { ProjectStore } from "../store.ts";
import { framesToTicks, rational } from "../time.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  type AssetRef,
  type EngineAdapterV2,
  type EngineRequestV2,
  type Operation,
} from "./contract-v2.ts";
import { engineReasonMessage } from "./reasons.ts";

export type GenerationRecipe = {
  id: string;
  hash: string;
  operation: Extract<Operation, "textToVideo" | "imageToVideo">;
  modelManifestHash: string;
};

export type GenerationRequest = {
  projectId: string;
  recipe: GenerationRecipe;
  prompt?: string;
  seed?: number;
  width: number;
  height: number;
  durationFrames: number;
  // The project's still that an image-to-video starts from.
  firstFrameAssetId?: string;
};

// Where an imported video came from. Returned to the caller and stored nowhere: a
// story's take can hold its output and inputs, not the recipe, seed or prompt hash.
export type GenerationLineage = {
  outputHash: string;
  inputs: { assetId: string; assetHash: string }[];
  recipeId: string;
  recipeHash: string;
  modelManifestHash: string;
  seed: number | null;
  // The prompt by hash, unsalted: a guessable prompt can be confirmed by trying it.
  promptHash: string | null;
};

type Tracked = {
  projectId: string;
  executionRef: string;
  request: GenerationRequest;
  inputs: GenerationLineage["inputs"];
  imported?: { assetId: string; lineage: GenerationLineage };
  importing?: Promise<{ assetId: string; lineage: GenerationLineage }>;
  // Asked to stop: whatever the engine then does, this is not imported, unless
  // that import had already reached the store.
  cancelled?: boolean;
};

const MEDIA_TYPES: Record<string, AssetRef["mediaType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function createGenerationService(options: {
  adapter: EngineAdapterV2;
  store: ProjectStore;
  resourcePolicyHash: string;
  // Tests only.
  now?: () => number;
}) {
  const { adapter, store, resourcePolicyHash } = options;
  const generations = new Map<string, Tracked>();
  const permitted = (hashes: string[]) =>
    store.read((db) =>
      assertLinkedMediaGeneratable(db, hashes, (options.now ?? Date.now)()),
    );

  const tracked = (id: string) => {
    const g = generations.get(id);
    if (!g) throw new CommandError("NOT_FOUND", "Generation not found.");
    return g;
  };

  async function bringIn(id: string, g: Tracked) {
    if (g.cancelled)
      throw new CommandError(
        "VALIDATION",
        "A cancelled generation cannot be imported.",
      );
    // No longer allowed since it started: what was made from it does not join.
    const inputs = g.inputs.map((i) => i.assetHash);
    permitted(inputs);
    const { state } = await adapter.status(g.executionRef);
    if (state !== "succeeded")
      throw new CommandError(
        "VALIDATION",
        "Only a finished generation can be imported.",
      );
    const artifacts = (await adapter.enumerateArtifacts(g.executionRef)).filter(
      (a) => a.mediaType === "video/mp4",
    );
    if (artifacts.length !== 1)
      throw new CommandError(
        "VALIDATION",
        "A generation must leave exactly one video to import.",
      );
    const [artifact] = artifacts;
    const folder = await mkdtemp(path.join(tmpdir(), "yamakan-generation-"));
    try {
      const file = path.join(folder, "output.mp4");
      const hash = createHash("sha256");
      let bytes = 0;
      const checked = async function* () {
        for await (const chunk of adapter.readArtifact(
          g.executionRef,
          artifact.handle,
        )) {
          bytes += chunk.byteLength;
          if (bytes > artifact.byteLength)
            throw new CommandError(
              "VALIDATION",
              "The generated video does not match what the engine reported.",
            );
          hash.update(chunk);
          yield chunk;
        }
      };
      // Any failure of either side ends both, and is this call's to report.
      await pipeline(
        Readable.from(checked()),
        createWriteStream(file, { flags: "wx", mode: 0o600 }),
      );
      if (
        bytes !== artifact.byteLength ||
        hash.digest("hex") !== artifact.sha256
      )
        throw new CommandError(
          "VALIDATION",
          "The generated video does not match what the engine reported.",
        );
      if (g.cancelled)
        throw new CommandError(
          "VALIDATION",
          "A cancelled generation cannot be imported.",
        );
      // The copy can take a while, and consent can end during it.
      permitted(inputs);
      const source = createReadStream(file);
      // Until the store reads it, an error opening the file has no other listener.
      source.on("error", () => {});
      try {
        const { asset } = await store.importAsset(
          g.projectId,
          `generated-${id.slice(0, 8)}.mp4`,
          source,
          bytes,
        );
        const { recipe, seed, prompt } = g.request;
        g.imported = {
          assetId: asset.id,
          lineage: {
            outputHash: asset.hash,
            inputs: g.inputs,
            recipeId: recipe.id,
            recipeHash: recipe.hash,
            modelManifestHash: recipe.modelManifestHash,
            seed: seed ?? null,
            promptHash:
              prompt === undefined
                ? null
                : createHash("sha256").update(prompt).digest("hex"),
          },
        };
        return g.imported;
      } finally {
        source.destroy();
      }
    } finally {
      // Failing to tidy a temporary folder does not hide what actually happened.
      await rm(folder, { recursive: true, force: true, maxRetries: 5 }).catch(
        () => {},
      );
    }
  }

  return {
    // The person's own request: nothing here runs on any other trigger.
    async start(request: GenerationRequest) {
      const project = await store.exportProject(request.projectId);
      const { num, den } = project.output.fps;
      const fps = { num, den };
      const inputs: EngineRequestV2["inputs"] = [] as never;
      const held = new Map<string, string>();
      if (request.recipe.operation === "imageToVideo") {
        if (!request.firstFrameAssetId)
          throw new CommandError(
            "VALIDATION",
            "An image-to-video needs a still to start from.",
          );
        const { asset, file } = await store.assetFile(
          request.projectId,
          request.firstFrameAssetId,
        );
        // A person's media goes to an engine only while their consent allows it.
        permitted([asset.hash]);
        const mediaType = MEDIA_TYPES[asset.extension];
        if (!mediaType)
          throw new CommandError(
            "VALIDATION",
            "An image-to-video starts from a PNG or JPEG still.",
          );
        held.set(asset.id, file);
        (inputs as unknown[]).push({
          role: "firstFrame",
          asset: { assetVersionId: asset.id, sha256: asset.hash, mediaType },
        });
      } else if (request.firstFrameAssetId)
        throw new CommandError(
          "VALIDATION",
          "A text-to-video does not start from a still.",
        );
      const id = randomUUID();
      const answer = await adapter.submit(
        {
          contract: ENGINE_CONTRACT_V2,
          operation: request.recipe.operation,
          recipeId: request.recipe.id,
          recipeHash: request.recipe.hash,
          modelManifestHash: request.recipe.modelManifestHash,
          attemptKey: id,
          leaseGeneration: 1,
          deadlineMs: ENGINE_V2_LIMITS.deadlineMs,
          resourcePolicyHash,
          ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
          ...(request.seed === undefined ? {} : { seed: request.seed }),
          inputs,
          output: {
            kind: "video",
            width: request.width,
            height: request.height,
            fps,
            durationTicks: framesToTicks(
              request.durationFrames,
              rational(num, den),
            ),
            audio: false,
          },
        } as EngineRequestV2,
        {
          openAsset: (asset) => {
            const file = held.get(asset.assetVersionId);
            if (!file) throw new Error("An input is not this request's.");
            // Checked again as it is about to be read for the engine.
            permitted([asset.sha256]);
            return createReadStream(file);
          },
        },
      );
      if ("refused" in answer)
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          engineReasonMessage(answer.refused),
        );
      generations.set(id, {
        projectId: request.projectId,
        executionRef: answer.executionRef,
        request,
        inputs: (inputs as unknown as { asset: AssetRef }[]).map(
          ({ asset }) => ({
            assetId: asset.assetVersionId,
            assetHash: asset.sha256,
          }),
        ),
      });
      return { generationId: id };
    },

    async status(id: string) {
      const g = tracked(id);
      const { state, progress, diagnostic } = await adapter.status(
        g.executionRef,
      );
      return {
        generationId: id,
        state,
        ...(progress === undefined ? {} : { progress }),
        ...(diagnostic === undefined ? {} : { diagnostic }),
        imported: g.imported ?? null,
      };
    },

    async cancel(id: string) {
      const g = tracked(id);
      g.cancelled = true;
      return adapter.requestCancel(g.executionRef);
    },

    // The finished video joins the project as an asset, checked by its declared
    // length and hash. It reaches the timeline only by the person placing it.
    async importResult(id: string) {
      const g = tracked(id);
      if (g.imported) return g.imported;
      // Asked twice at once, it is still one asset.
      g.importing ??= bringIn(id, g).finally(() => {
        g.importing = undefined;
      });
      return g.importing;
    },
  };
}
