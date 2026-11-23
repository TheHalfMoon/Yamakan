// What a cancelled MCP request does here (MPR-501). What has not been sent is not sent. A read is
// stopped. A change that has been sent cannot be taken back: it is left to finish, and if it started something that has a cancel of its
// own, that is asked for once. Whatever happens, a cancelled request gets no answer.
import type { Operation } from "../sdk/client.ts";

type Twin = {
  cancel: Operation;
  // The cancel's input, from what the start was given and what it answered; null when the answer
  // does not name what it started.
  input: (
    args: Record<string, unknown>,
    result: unknown,
  ) => Record<string, unknown> | null;
};

const field = (value: unknown, name: string) => {
  const found =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[name]
      : undefined;
  return typeof found === "string" ? found : null;
};
const job = (of: (result: unknown) => unknown): Twin => ({
  cancel: "yamakan.job.cancel",
  input: (_args, result) => {
    const jobId = field(of(result), "id");
    return jobId ? { jobId } : null;
  },
});

/** The commands that start something, with the command that stops it. */
export const CANCEL_TWINS: Readonly<Partial<Record<Operation, Twin>>> =
  Object.freeze({
    "yamakan.export.video": job((r) => r),
    "yamakan.blender.render": job((r) => r),
    "yamakan.blender.track": job((r) => r),
    "yamakan.director.renderShot": job((r) =>
      typeof r === "object" && r !== null
        ? (r as Record<string, unknown>).job
        : undefined,
    ),
    "yamakan.export.batch": {
      cancel: "yamakan.export.batchCancel",
      input: (args, result) => {
        const projectId = field(args, "projectId");
        const batchId = field(result, "batchId");
        return projectId && batchId ? { projectId, batchId } : null;
      },
    },
    "yamakan.proxy.build": {
      cancel: "yamakan.proxy.cancel",
      input: (args) => {
        const projectId = field(args, "projectId");
        const assetId = field(args, "assetId");
        return projectId && assetId ? { projectId, assetId } : null;
      },
    },
  });

// Where a request is: its command not yet sent to the service, sent and not answered, or answered
// here.
export type Phase = "waiting" | "sent" | "answered";
export type CancelPlan =
  "abort" | "finish-then-cancel" | "finish-and-drop" | "ignore";

/** What to do with a request the client cancels. */
export function cancelPlan(
  operation: { name: string; mutation: boolean },
  phase: Phase,
): CancelPlan {
  if (phase === "answered") return "ignore";
  // Nothing has been asked of the service, so nothing has to be let finish.
  if (phase === "waiting" || !operation.mutation) return "abort";
  return Object.hasOwn(CANCEL_TWINS, operation.name)
    ? "finish-then-cancel"
    : "finish-and-drop";
}
