// A generation a person asked for: started explicitly, followed, cancelled, and
// its output brought into the project as an ordinary asset. It holds no model and
// no graph; an engine adapter decides whether anything can run. In-process: a
// restart forgets a generation, whose output stays in the engine, unimported.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { CommandError } from "../command/errors.ts";
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

type Tracked = {
  projectId: string;
  executionRef: string;
  imported?: { assetId: string };
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
}) {
  const { adapter, store, resourcePolicyHash } = options;
  const generations = new Map<string, Tracked>();

  const tracked = (id: string) => {
    const g = generations.get(id);
    if (!g) throw new CommandError("NOT_FOUND", "Generation not found.");
    return g;
  };

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
      return adapter.requestCancel(tracked(id).executionRef);
    },

    // The finished video joins the project as an asset, checked by its declared
    // length and hash. It reaches the timeline only by the person placing it.
    async importResult(id: string) {
      const g = tracked(id);
      if (g.imported) return g.imported;
      const { state } = await adapter.status(g.executionRef);
      if (state !== "succeeded")
        throw new CommandError(
          "VALIDATION",
          "Only a finished generation can be imported.",
        );
      const artifacts = (
        await adapter.enumerateArtifacts(g.executionRef)
      ).filter((a) => a.mediaType === "video/mp4");
      if (artifacts.length !== 1)
        throw new CommandError(
          "VALIDATION",
          "A generation must leave exactly one video to import.",
        );
      const [artifact] = artifacts;
      const folder = await mkdtemp(path.join(tmpdir(), "yamakan-generation-"));
      try {
        const file = path.join(folder, "output.mp4");
        const out = createWriteStream(file, { flags: "wx", mode: 0o600 });
        const hash = createHash("sha256");
        let bytes = 0;
        try {
          for await (const chunk of adapter.readArtifact(
            g.executionRef,
            artifact.handle,
          )) {
            bytes += chunk.byteLength;
            if (bytes > artifact.byteLength)
              throw new Error("An output is longer than it declared.");
            hash.update(chunk);
            if (!out.write(chunk)) await once(out, "drain");
          }
        } finally {
          out.end();
          await once(out, "close");
        }
        if (
          bytes !== artifact.byteLength ||
          hash.digest("hex") !== artifact.sha256
        )
          throw new CommandError(
            "VALIDATION",
            "The generated video does not match what the engine reported.",
          );
        const { asset } = await store.importAsset(
          g.projectId,
          `generated-${id.slice(0, 8)}.mp4`,
          createReadStream(file),
          bytes,
        );
        g.imported = { assetId: asset.id };
        return g.imported;
      } finally {
        await rm(folder, { recursive: true, force: true, maxRetries: 5 });
      }
    },
  };
}
