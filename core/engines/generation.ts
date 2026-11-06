// A generation a person asked for: started explicitly, followed, cancelled, and
// its output brought into the project as an ordinary asset. It holds no model and
// no graph; an engine adapter decides whether anything can run. What it knows is in
// a ledger, recorded before anything is sent: the job table for a run elsewhere, so
// that a restart can follow it, and never send it again. See core/jobs.ts.
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
  type ExecutionStatus,
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

// Where an imported video came from. A story's take can hold its output and inputs,
// not the recipe, seed or prompt hash; a run elsewhere keeps these in its job record.
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

export type GenerationRecord = {
  generationId: string;
  projectId: string;
  recipe: GenerationRecipe;
  prompt: string | null;
  seed: number | null;
  width: number;
  height: number;
  durationFrames: number;
  firstFrameAssetId: string | null;
  inputs: GenerationLineage["inputs"];
  // The engine's name for it, once known. Before that, the attempt key is.
  executionRef: string | null;
  // "sending": recorded, and not known to have reached the engine. After a crash it
  // may or may not have; it is checked, and never sent again.
  phase: "sending" | "sent";
  startedAt: number;
  state: ExecutionStatus["state"];
  diagnostic: string | null;
  videoSha256: string | null;
  imported: { assetId: string; lineage: GenerationLineage } | null;
  // Where the engine has it, as this workspace was set up when it left.
  remote?: string | null;
  // Said beside every later answer, across a restart.
  notice?: string | null;
  // Asked to stop: whatever the engine then does, this is not imported, unless
  // that import had already reached the store.
  cancelled: boolean;
  dismissed: boolean;
  // A restored copy of a workspace: the run belongs to the original.
  held?: boolean;
};

export type GenerationLedger = {
  begin(record: GenerationRecord): void;
  update(id: string, change: Partial<GenerationRecord>): void;
  read(id: string): GenerationRecord | null;
  list(projectId: string): GenerationRecord[];
  lastSentAt(recipeId: string, except: string): number | undefined;
  // Other runs of this recipe still being followed, in any project of this workspace.
  following(recipeId: string, except: string): string[];
  // Runs on this machine are not kept past this service, so an ended one is asked again.
  remembersEnded: boolean;
};

// Whether a run may yet appear on the engine, even if a person has stopped following it.
// Only a refusal before it left, which fails it unsent, rules that out.
export const mayHaveLeft = (
  r: GenerationRecord,
  recipeId: string,
  except: string,
) =>
  r.recipe?.id === recipeId &&
  r.generationId !== except &&
  (r.phase === "sent" || r.state !== "failed");

// For an engine on this machine, whose runs do not outlive this service anyway.
export function memoryLedger(): GenerationLedger {
  const records = new Map<string, GenerationRecord>();
  return {
    begin: (r) => void records.set(r.generationId, r),
    update: (id, change) => {
      const r = records.get(id);
      if (r) records.set(id, { ...r, ...change });
    },
    read: (id) => records.get(id) ?? null,
    list: (projectId) =>
      [...records.values()].filter((r) => r.projectId === projectId).reverse(),
    lastSentAt: (recipeId, except) =>
      [...records.values()]
        .filter((r) => mayHaveLeft(r, recipeId, except))
        .at(-1)?.startedAt,
    following: () => [],
    remembersEnded: false,
  };
}

const ENDED: ReadonlySet<ExecutionStatus["state"]> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);
const NOT_STOPPED =
  "No longer followed here. The engine was not told to stop, and anything running there goes on until it ends.";
const HELD =
  "This workspace was restored from a backup, and the run belongs to the workspace it was copied from. It is not followed here, and was not sent again.";

const MEDIA_TYPES: Record<string, AssetRef["mediaType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function createGenerationService(options: {
  adapter: EngineAdapterV2;
  store: ProjectStore;
  resourcePolicyHash: string;
  ledger?: GenerationLedger;
  // Tests only.
  now?: () => number;
}) {
  const { adapter, store, resourcePolicyHash } = options;
  const ledger = options.ledger ?? memoryLedger();
  const importing = new Map<
    string,
    Promise<{ assetId: string; lineage: GenerationLineage }>
  >();
  const clock = options.now ?? Date.now;
  const permitted = (hashes: string[]) =>
    store.read((db) =>
      assertLinkedMediaGeneratable(db, hashes, (options.now ?? Date.now)()),
    );

  const tracked = (id: string) => {
    const g = ledger.read(id);
    if (!g) throw new CommandError("NOT_FOUND", "Generation not found.");
    return g;
  };
  const refOf = (g: GenerationRecord) => g.executionRef ?? g.generationId;
  const stopNote = (g: GenerationRecord) =>
    [g.diagnostic, NOT_STOPPED].filter(Boolean).join(" ");
  // Being sent by this service now: asking about one would only race its answer.
  const sending = new Set<string>();

  async function bringIn(id: string, g: GenerationRecord) {
    if (g.held) throw new CommandError("VALIDATION", HELD);
    if (g.cancelled)
      throw new CommandError(
        "VALIDATION",
        "A cancelled generation cannot be imported.",
      );
    if (ledger.remembersEnded && g.state !== "succeeded" && ENDED.has(g.state))
      throw new CommandError(
        "VALIDATION",
        "Only a finished generation can be imported.",
      );
    // No longer allowed since it started: what was made from it does not join.
    const inputs = g.inputs.map((i) => i.assetHash);
    permitted(inputs);
    const { state } = await adapter.status(refOf(g));
    if (state !== "succeeded")
      throw new CommandError(
        "VALIDATION",
        "Only a finished generation can be imported.",
      );
    const artifacts = (await adapter.enumerateArtifacts(refOf(g))).filter(
      (a) => a.mediaType === "video/mp4",
    );
    if (artifacts.length !== 1)
      throw new CommandError(
        "VALIDATION",
        "A generation must leave exactly one video to import.",
      );
    const [artifact] = artifacts;
    const finish = (assetId: string, outputHash: string) => {
      const imported = {
        assetId,
        lineage: {
          outputHash,
          inputs: g.inputs,
          recipeId: g.recipe.id,
          recipeHash: g.recipe.hash,
          modelManifestHash: g.recipe.modelManifestHash,
          seed: g.seed,
          promptHash:
            g.prompt === null
              ? null
              : createHash("sha256").update(g.prompt).digest("hex"),
        },
      };
      ledger.update(id, { imported, phase: "sent", state: "succeeded" });
      return imported;
    };
    // Brought in already, and the answer was lost or the service stopped before
    // recording it: it is the same video, so the same asset.
    const held = (await store.exportProject(g.projectId)).assets.find(
      (a: { hash: string; kind: string }) =>
        a.hash === artifact.sha256 && a.kind === "video",
    ) as { id: string } | undefined;
    if (held) return finish(held.id, artifact.sha256);
    const folder = await mkdtemp(path.join(tmpdir(), "yamakan-generation-"));
    try {
      const file = path.join(folder, "output.mp4");
      const hash = createHash("sha256");
      let bytes = 0;
      const checked = async function* () {
        for await (const chunk of adapter.readArtifact(
          refOf(g),
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
      if (ledger.read(id)?.cancelled)
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
        return finish(asset.id, asset.hash);
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

  async function statusOf(id: string) {
    const g = tracked(id);
    if (g.held)
      return {
        generationId: id,
        state: "unknown" as const,
        diagnostic: HELD,
        imported: g.imported,
      };
    if (ledger.remembersEnded && (ENDED.has(g.state) || g.cancelled))
      return {
        generationId: id,
        state: g.state,
        ...(g.diagnostic ? { diagnostic: g.diagnostic } : {}),
        imported: g.imported,
      };
    const { state, progress, diagnostic } = await adapter.status(refOf(g));
    const change: Partial<GenerationRecord> = {
      state,
      diagnostic: diagnostic ?? null,
    };
    // Its own result proves it arrived. A notebook's state does not: that could be
    // another run's, so an uncertain send stays uncertain until then.
    if (state === "succeeded") {
      change.phase = "sent";
      const [video] = (
        await adapter.enumerateArtifacts(refOf(g)).catch(() => [])
      ).filter((a) => a.mediaType === "video/mp4");
      change.videoSha256 = video?.sha256 ?? null;
    }
    if (g.phase === "sending" && state !== "failed" && state !== "succeeded")
      change.diagnostic = diagnostic ?? g.diagnostic;
    // While that was asked it may have been stopped, refused or dismissed, and that stands.
    const latest = tracked(id);
    if (
      ledger.remembersEnded &&
      (ENDED.has(latest.state) || latest.cancelled || latest.dismissed)
    )
      return {
        generationId: id,
        state: latest.state,
        ...(latest.diagnostic ? { diagnostic: latest.diagnostic } : {}),
        imported: latest.imported,
      };
    ledger.update(id, change);
    return {
      generationId: id,
      state,
      ...(progress === undefined ? {} : { progress }),
      ...(diagnostic === undefined ? {} : { diagnostic }),
      imported: g.imported,
    };
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
      // A notebook keeps one latest result, and another run would replace it. Asking
      // collects a run nobody has been watching, if it has finished.
      // A run sent from another account is on another notebook.
      const here = adapter.location?.(request.recipe.id) ?? null;
      const others = () =>
        ledger
          .following(request.recipe.id, "")
          .filter(
            (other) =>
              (tracked(other).remote ?? null)?.toLowerCase() ===
              here?.toLowerCase(),
          );
      for (const other of others())
        if (!sending.has(other)) await statusOf(other).catch(() => {});
      // Still going, or not collected: pushing now would lose its result for good.
      const [still] = others();
      if (still) {
        const holder = tracked(still).projectId;
        const name = await store
          .exportProject(holder)
          .then((p) => p.name as string)
          .catch(() => "another project");
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          `A run of this model is still being followed in "${name}". Wait for it, or stop following it there, which does not stop it on Kaggle.`,
        );
      }
      const id = randomUUID();
      const inputPins = (inputs as unknown as { asset: AssetRef }[]).map(
        ({ asset }) => ({
          assetId: asset.assetVersionId,
          assetHash: asset.sha256,
        }),
      );
      // Recorded before anything leaves: a crash from here on leaves a record.
      ledger.begin({
        generationId: id,
        projectId: request.projectId,
        recipe: request.recipe,
        prompt: request.prompt ?? null,
        seed: request.seed ?? null,
        width: request.width,
        height: request.height,
        durationFrames: request.durationFrames,
        firstFrameAssetId: request.firstFrameAssetId ?? null,
        inputs: inputPins,
        executionRef: null,
        phase: "sending",
        remote: here,
        startedAt: clock(),
        state: "queued",
        diagnostic: null,
        videoSha256: null,
        imported: null,
        cancelled: false,
        dismissed: false,
      });
      sending.add(id);
      const answer = await adapter
        .submit(
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
        )
        .catch((e: unknown) => {
          // Refused before anything was sent: it did not happen, so nothing is listed.
          ledger.update(id, {
            state: "failed",
            dismissed: true,
            diagnostic:
              e instanceof Error ? e.message : "It could not be started.",
          });
          throw e;
        })
        .finally(() => sending.delete(id));
      if ("refused" in answer) {
        ledger.update(id, {
          state: "failed",
          dismissed: true,
          diagnostic: engineReasonMessage(answer.refused),
        });
        // An upload refused because consent ended says that, not a general reason.
        permitted(
          (inputs as unknown as { asset: AssetRef }[]).map(
            (i) => i.asset.sha256,
          ),
        );
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          engineReasonMessage(answer.refused),
        );
      }
      // Not knowing whether it arrived stays "sending": it is followed, not resent.
      ledger.update(id, {
        executionRef: answer.executionRef,
        phase: answer.uncertain ? "sending" : "sent",
        // Stopped while it went: what that said still stands, and goes first.
        diagnostic:
          [
            tracked(id).cancelled ? tracked(id).diagnostic : null,
            answer.uncertain ?? answer.notice,
          ]
            .filter(Boolean)
            .join(" ") || null,
        notice: answer.notice ?? null,
      });
      return {
        generationId: id,
        ...(answer.uncertain ? { uncertain: answer.uncertain } : {}),
      };
    },

    status: statusOf,

    async cancel(id: string) {
      const g = tracked(id);
      if (g.held)
        return {
          requested: false,
          localProcessExited: true,
          remoteAcknowledged: false,
          remoteOutcome: "unknown" as const,
          billingOutcome: "notApplicable" as const,
        };
      // Already over: there is nothing to ask of the engine, and a refused run never left.
      if (ledger.remembersEnded && ENDED.has(g.state))
        return {
          requested: false,
          localProcessExited: true,
          remoteAcknowledged: false,
          remoteOutcome: "unknown" as const,
          billingOutcome: "notApplicable" as const,
        };
      ledger.update(id, { cancelled: true });
      const answer = await adapter.requestCancel(refOf(g));
      // The job list reads this: a cancelled job there must not read as a stopped run.
      if (answer.remoteOutcome !== "stopped" && !ENDED.has(g.state))
        ledger.update(id, { diagnostic: stopNote(tracked(id)) });
      return answer;
    },

    // What this project has had generated, newest first: enough to pick up after a
    // restart, and to finish recording what came in.
    list(projectId: string) {
      return ledger.list(projectId).filter((g) => !g.dismissed);
    },

    // Finished with here: it says nothing to the engine, and stops counting as work.
    dismiss(id: string) {
      const g = tracked(id);
      // A held copy's run stays held: this only takes it off the page.
      if (g.held) return ledger.update(id, { dismissed: true });
      ledger.update(id, {
        dismissed: true,
        ...(g.imported || g.state === "failed" ? {} : { cancelled: true }),
        ...(g.imported || g.cancelled || ENDED.has(g.state)
          ? {}
          : { diagnostic: stopNote(g) }),
      });
    },

    // The finished video joins the project as an asset, checked by its declared
    // length and hash. It reaches the timeline only by the person placing it.
    async importResult(id: string) {
      const g = tracked(id);
      if (g.imported) return g.imported;
      // Asked twice at once, it is still one asset.
      let pending = importing.get(id);
      if (!pending) {
        pending = bringIn(id, g).finally(() => importing.delete(id));
        importing.set(id, pending);
      }
      return pending;
    },
  };
}
