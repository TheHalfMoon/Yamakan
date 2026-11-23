// One save of a story's words, and what came of it (MPR-106): the form on the Story page and
// Create's offer both use it. A lost answer is asked for again under the same request id, which
// the service answers with what it did, so a save is never made twice.
import type { TextStory } from "./story-text.ts";

export type StoryClient = {
  call: (
    operation: string,
    args: Record<string, unknown>,
    requestId?: string,
  ) => Promise<unknown>;
};

export type SaveOutcome =
  | { kind: "saved"; revision: number; contentHash: string }
  // The story, or the project, is no longer as it was read.
  | { kind: "conflict" }
  | { kind: "full" }
  // The answer was lost twice: it may be saved.
  | { kind: "unknown" }
  // Nothing was written; the service's own words, where they are for a person.
  | { kind: "refused"; message: string | null };

// Refusals whose text is a plain sentence of the service. Others can hold a schema's issues or
// details of the host.
const SAID = new Set([
  "LIMIT_EXCEEDED",
  "NOT_FOUND",
  "CAPABILITY_UNAVAILABLE",
  "RECOVERY_REQUIRED",
  "BUSY",
]);
const MOST = 200;

export function saveFailure(error: unknown): SaveOutcome {
  const { code, message, requestId } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    requestId?: unknown;
  };
  // Only an answer of the service names a code and its request: without both, none came.
  if (typeof code !== "string" || typeof requestId !== "string")
    return { kind: "unknown" };
  if (code === "REVISION_CONFLICT") return { kind: "conflict" };
  const said = typeof message === "string" ? message : "";
  if (
    code === "LIMIT_EXCEEDED" &&
    /bytes of text; the limit is|^Canonical document exceeds/.test(said)
  )
    return { kind: "full" };
  return {
    kind: "refused",
    message: SAID.has(code) && said ? said.slice(0, MOST) : null,
  };
}

export async function saveStory(
  client: StoryClient,
  args: {
    projectId: string;
    expectedRevision: number;
    documentId: string;
    expectedContentHash: string;
    story: TextStory;
  },
): Promise<SaveOutcome> {
  const requestId = crypto.randomUUID();
  const send = () => client.call("yamakan.story.save", args, requestId);
  try {
    const answer = (await send().catch((e: unknown) => {
      if (saveFailure(e).kind !== "unknown") throw e;
      return send();
    })) as { project: { revision: number }; document: { contentHash: string } };
    return {
      kind: "saved",
      revision: answer.project.revision,
      contentHash: answer.document.contentHash,
    };
  } catch (e) {
    return saveFailure(e);
  }
}
