// The kinds of end a generation can have without a usable video (MPR-207): what each means,
// whether it may still have used the person's quota, and what trying again takes. The advice is
// the person's to follow: a retry is a new generation they start, and nothing here or anywhere
// sends again for a run that has ended.
import { CommandError } from "../command/errors.ts";
import { FailureClass } from "./contract-v2.ts";

export type RetryAdvice =
  // Something asked for has to change first.
  | "afterChange"
  // A limit has to pass first.
  | "afterWaiting"
  // Whether it is still going, or left a result, has to be looked at first.
  | "afterChecking"
  | "whenWanted";

type Entry = Readonly<{
  meaning: string;
  // Only where the run left this computer and was not refused as it was sent.
  mayStillBeBilled: boolean;
  retry: RetryAdvice;
}>;

export const FAILURE_CLASSES: Readonly<Record<FailureClass, Entry>> =
  Object.freeze({
    refusedByPolicy: Object.freeze({
      meaning: "Yamakan or the engine's adapter refused it before it was sent.",
      mayStillBeBilled: false,
      retry: "afterChange",
    }),
    quotaExhausted: Object.freeze({
      meaning: "The provider refused it: a quota or rate limit is used up.",
      mayStillBeBilled: false,
      retry: "afterWaiting",
    }),
    credentialRejected: Object.freeze({
      meaning: "The provider refused the credential it was sent with.",
      mayStillBeBilled: false,
      retry: "afterChange",
    }),
    contentRefused: Object.freeze({
      meaning: "The provider refused what the request asks for.",
      mayStillBeBilled: true,
      retry: "afterChange",
    }),
    providerRejected: Object.freeze({
      meaning:
        "The provider refused it for another reason, or took it and reported the run as failed.",
      mayStillBeBilled: true,
      retry: "afterChange",
    }),
    resourceExhausted: Object.freeze({
      meaning: "The run said it had not enough memory or another resource.",
      mayStillBeBilled: true,
      retry: "afterChange",
    }),
    timeout: Object.freeze({
      meaning: "The run passed its deadline.",
      mayStillBeBilled: true,
      retry: "afterChange",
    }),
    lostJob: Object.freeze({
      meaning:
        "The provider no longer reports this run, or reports another in its place.",
      mayStillBeBilled: true,
      retry: "afterChecking",
    }),
    invalidArtifact: Object.freeze({
      meaning:
        "The run ended, and its result is missing, unreadable, or not what was asked for or declared.",
      mayStillBeBilled: true,
      retry: "whenWanted",
    }),
    cancelled: Object.freeze({
      meaning: "The person stopped it, or stopped following it.",
      mayStillBeBilled: true,
      retry: "whenWanted",
    }),
    unknown: Object.freeze({
      meaning: "It ended, and no kind was recorded.",
      mayStillBeBilled: true,
      retry: "afterChecking",
    }),
  });

/** Whether this end may still have used what the person pays with, and which. */
export function effectiveBilling(end: {
  failureClass: FailureClass;
  // Where the run went, when that is off this computer.
  remote: string | null | undefined;
  // Whether it may have left.
  left: boolean;
  refusedAtSubmit: boolean;
}) {
  const mayStillBeBilled =
    FAILURE_CLASSES[end.failureClass].mayStillBeBilled &&
    Boolean(end.remote) &&
    end.left &&
    !end.refusedAtSubmit;
  return {
    mayStillBeBilled,
    // No currency exists in this build.
    billedIn: mayStillBeBilled ? ("providerQuota" as const) : ("none" as const),
  };
}

class SubmitRefusal {
  readonly failureClass: FailureClass;
  constructor(failureClass: FailureClass) {
    this.failureClass = failureClass;
  }
}

/** A refusal of a start, with its kind kept on the server's side of the public message. */
export const refusedSubmit = (failureClass: FailureClass, message: string) =>
  new CommandError("CAPABILITY_UNAVAILABLE", message, {
    cause: new SubmitRefusal(failureClass),
  });

/** The kind a refusal of a start carries, if it carries one. */
export const failureClassOf = (error: unknown): FailureClass | undefined =>
  error instanceof CommandError && error.cause instanceof SubmitRefusal
    ? error.cause.failureClass
    : undefined;

/** A stored kind, or unknown where it is missing or is not one. */
export const readFailureClass = (stored: unknown): FailureClass => {
  const read = FailureClass.safeParse(stored);
  return read.success ? read.data : "unknown";
};
