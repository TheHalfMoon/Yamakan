// Verified relink (YU-025). A project medium that is missing, damaged or
// simply to be swapped is replaced by another medium already imported into
// the project (imports are hashed and probed; no client path is ever
// read). A replacement is first proposed: which clips change, whether the
// new medium is compatible with every use of the old one, and how the two
// differ, bound to the revision and both media versions and named by its
// hash. Applying it recomputes the proposal at the head and commits only an
// identical one, as one undoable revision that re-points those clips and
// records its provenance. The old medium stays in the project, so undo
// returns exactly the old source; nothing is replaced silently.
import { z } from "zod";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";
import type { CanonicalProject } from "./canonical.ts";
import { applyBatch, type Operation } from "./timeline/operations.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import { getSourceTimeAtClipTime } from "./retime/resolve.ts";
import { rational } from "./time.ts";

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const Media = z
  .object({
    assetId: Id,
    hash: Sha256,
    name: z.string().max(120),
    kind: z.enum(["image", "video", "audio"]),
    width: z.number().int(),
    height: z.number().int(),
    durationTicks: z.number().int(),
    hasAudio: z.boolean().nullable(),
  })
  .strict();

export const RelinkProposalSchema = z
  .object({
    format: z.literal("yamakan.relink-proposal"),
    formatVersion: z.literal(1),
    projectId: Id,
    revision: z.number().int().nonnegative(),
    from: Media,
    to: Media,
    clipIds: z.array(Id).min(1).max(200),
    // How the new medium differs (shown before approval; none refuses).
    differences: z
      .array(z.enum(["bytes", "name", "size", "aspect", "duration", "sound"]))
      .max(6),
    proposalHash: Sha256,
  })
  .strict();
export type RelinkProposal = z.infer<typeof RelinkProposalSchema>;

const invalid = (message: string) => new CommandError("VALIDATION", message);

const media = (a: CanonicalProject["assets"][number]) => ({
  assetId: a.id,
  hash: a.hash,
  name: a.name,
  kind: a.kind,
  width: a.width,
  height: a.height,
  durationTicks: a.durationTicks,
  hasAudio: a.hasAudio,
});

/**
 * The exact replacement of one medium by another in every clip that uses
 * it, refused unless the new one fits every use: the same kind, at least
 * as much source as any clip reads, and sound wherever a clip plays the
 * old one's sound. Checked on a copy of the head.
 */
export function proposeRelink(
  project: CanonicalProject,
  projectId: string,
  fromAssetId: string,
  toAssetId: string,
): RelinkProposal {
  const from = project.assets.find((a) => a.id === fromAssetId);
  const to = project.assets.find((a) => a.id === toAssetId);
  if (!from)
    throw new CommandError(
      "NOT_FOUND",
      "The medium to replace is not in this project.",
    );
  if (!to)
    throw new CommandError(
      "NOT_FOUND",
      "Import the replacement into this project first.",
    );
  if (from.id === to.id) throw invalid("A medium is replaced by another.");
  if (from.kind !== to.kind)
    throw invalid(
      `This ${from.kind} medium is replaced only by another ${from.kind} medium.`,
    );
  const clips = project.clips.filter((c) => c.assetId === from.id);
  if (!clips.length) throw invalid("No clip uses this medium.");
  const tracks = new Map(project.tracks.map((t) => [t.id, t.kind]));
  for (const c of clips) {
    if (to.kind !== "image") {
      const read =
        c.sourceStartTicks +
        getSourceTimeAtClipTime({
          clipTime: c.durationTicks,
          retime: { rate: c.speed ?? rational(1, 1) },
        });
      if (read > to.durationTicks)
        throw invalid(
          "The replacement is shorter than the source a clip reads; trim the clip or pick a longer medium.",
        );
    }
    const playsSound =
      tracks.get(c.trackId) === "audio" || c.sound?.enabled === true;
    if (playsSound && to.kind === "video" && to.hasAudio !== true)
      throw invalid(
        "A clip plays this medium's sound, and the replacement has none.",
      );
  }
  const differences: RelinkProposal["differences"] = [];
  if (from.hash !== to.hash) differences.push("bytes");
  if (from.name !== to.name) differences.push("name");
  if (from.width !== to.width || from.height !== to.height)
    differences.push("size");
  if (from.width * to.height !== to.width * from.height)
    differences.push("aspect");
  if (from.durationTicks !== to.durationTicks) differences.push("duration");
  if (from.hasAudio !== to.hasAudio) differences.push("sound");
  const body = {
    format: "yamakan.relink-proposal" as const,
    formatVersion: 1 as const,
    projectId,
    revision: project.revision,
    from: media(from),
    to: media(to),
    clipIds: clips.map((c) => c.id).sort(),
    differences,
  };
  const proposal = { ...body, proposalHash: sha256Hex(canonicalJson(body)) };
  // Locked tracks and anything else the timeline refuses, now.
  applyBatch(project, relinkOperations(proposal));
  return proposal;
}

export const relinkOperations = (p: RelinkProposal): Operation[] => [
  {
    type: "asset.relink",
    fromAssetId: p.from.assetId,
    toAssetId: p.to.assetId,
  },
];
