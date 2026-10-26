// M13 / W10: local generative engine adapter. No real engine runs until
// gate E-SEC and founder decision F. The fake engine implements this surface
// for tests and the engine-absent capability path.
import { z } from "zod";

export const ENGINE_CONTRACT = "yamakan.engine-adapter/v1";

export const EngineCapabilitySchema = z
  .object({
    id: z.string().min(1).max(64),
    available: z.boolean(),
    reason: z.string().max(500).optional(),
    maxUploadBytes: z.number().int().positive().optional(),
    allowlistedNodes: z.array(z.string().min(1).max(120)).max(500).optional(),
  })
  .strict();
export type EngineCapability = z.infer<typeof EngineCapabilitySchema>;

export const EngineJobStateSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type EngineJobState = z.infer<typeof EngineJobStateSchema>;

export type EngineGraph = {
  /** Node class_type allowlist is enforced by the adapter before submit. */
  nodes: Record<
    string,
    { class_type: string; inputs: Record<string, unknown> }
  >;
};

export type EngineInputFile = {
  name: string;
  bytes: Uint8Array;
  sha256: string;
};

export type EngineSubmitRequest = {
  graph: EngineGraph;
  inputs: EngineInputFile[];
  /** Idempotency / fencing key for crash retry. */
  attemptKey: string;
};

export type EngineStatus = {
  id: string;
  state: EngineJobState;
  error?: string;
  /** Present when the adapter quarantined a probe-failed output. */
  quarantined?: boolean;
};

export type EngineOutput = {
  name: string;
  bytes: Uint8Array;
  sha256: string;
};

/**
 * Local engine adapter. Real ComfyUI wiring is `comfyui.ts` and stays disabled
 * until E-SEC. Tests use `fake.ts`.
 */
export type EngineAdapter = {
  readonly contract: typeof ENGINE_CONTRACT;
  capabilities(): EngineCapability;
  submit(request: EngineSubmitRequest): Promise<{ id: string }>;
  status(id: string): Promise<EngineStatus>;
  cancel(id: string): Promise<EngineStatus>;
  outputs(id: string): Promise<EngineOutput[]>;
};

/** Feature flag: real engines stay off; Studio/Director test against fake. */
export const ENGINE_ENABLED = false;

export function engineAbsentCapability(
  reason = "Local generative engine is not enabled (E-SEC and founder decision F).",
): EngineCapability {
  return { id: "absent", available: false, reason };
}
