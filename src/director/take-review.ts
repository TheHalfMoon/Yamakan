// A take replacement under review: read from the existing take commands and
// never stored. The proposal shown is the exact payload `yamakan.take.apply`
// receives; nothing here approves anything or makes a stage output.

export type TakeProposal = {
  format: "yamakan.take-proposal";
  formatVersion: 1;
  projectId: string;
  revision: number;
  documentId: string;
  storyContentHash: string;
  shotId: string;
  takeId: string;
  mappings: {
    clipId: string;
    startTicks: number;
    durationTicks: number;
    from: {
      assetId: string | null;
      assetHash: string | null;
      title: string | null;
      sourceStartTicks: number;
    };
    to: {
      assetId: string | null;
      assetHash: string | null;
      title: string | null;
      sourceStartTicks: number;
    };
  }[];
  proposalHash: string;
};

export type TakeRow = {
  documentId: string;
  shotId: string;
  shotName: string;
  takeId: string;
  assetHash: string | null;
  kind: string | null;
  current: boolean;
  // A shot that cannot be replaced says so instead of offering a review.
  assembled: boolean;
  problem: string | null;
};

const FLICKS_PER_SECOND = 705_600_000;

/** A time on the timeline, in seconds, for review. Ticks stay in the payload. */
export const ticksToSeconds = (ticks: number) =>
  (ticks / FLICKS_PER_SECOND).toFixed(3);

/** A media version, shortened for reading; the panel keeps the whole value. */
export const shortHash = (hash: string | null) =>
  hash === null ? "—" : hash.slice(0, 12);

// Only a well-formed answer is shown; anything else is "not known".
export function takeRows(value: unknown): TakeRow[] | null {
  const list = value as {
    documentId?: unknown;
    shots?: unknown;
  } | null;
  if (typeof list?.documentId !== "string" || !Array.isArray(list.shots))
    return null;
  const rows: TakeRow[] = [];
  for (const shot of list.shots as Record<string, unknown>[]) {
    if (
      typeof shot?.shotId !== "string" ||
      typeof shot.name !== "string" ||
      !Array.isArray(shot.takes)
    )
      return null;
    const timeline = shot.timeline as { currentTakeId?: unknown } | null;
    for (const take of shot.takes as Record<string, unknown>[]) {
      if (typeof take?.id !== "string") return null;
      rows.push({
        documentId: list.documentId,
        shotId: shot.shotId,
        shotName: shot.name,
        takeId: take.id,
        assetHash: typeof take.assetHash === "string" ? take.assetHash : null,
        kind: typeof take.kind === "string" ? take.kind : null,
        current: timeline?.currentTakeId === take.id,
        assembled: Boolean(timeline),
        problem: typeof shot.problem === "string" ? shot.problem : null,
      });
    }
  }
  return rows;
}

/** Whether a proposal still describes the head the panel knows of. */
export const proposalIsCurrent = (
  proposal: TakeProposal,
  projectId: string,
  revision: number | null,
) => proposal.projectId === projectId && proposal.revision === revision;
