// M16 / W13: OTIO JSON interchange (ladder E). Runtime has no OTIO dependency;
// CI's otio-oracle job installs opentimelineio as a read-only test oracle.
import { z } from "zod";
import type { CanonicalProject } from "../canonical.ts";
import { FLICKS_PER_SECOND } from "../time.ts";
import { CommandError } from "../command/errors.ts";

export const OTIO_RATE = FLICKS_PER_SECOND;
export const OTIO_LIMITS = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxObjects: 50_000,
  maxDepth: 32,
  maxString: 4_096,
});

type RationalTimeJson = {
  OTIO_SCHEMA: "RationalTime.1";
  rate: number;
  value: number;
};

type TimeRangeJson = {
  OTIO_SCHEMA: "TimeRange.1";
  start_time: RationalTimeJson;
  duration: RationalTimeJson;
};

type MediaReferenceJson = {
  OTIO_SCHEMA: "ExternalReference.1" | "MissingReference.1";
  name?: string;
  target_url?: string;
  metadata?: Record<string, string>;
};

type ClipJson = {
  OTIO_SCHEMA: "Clip.1";
  name: string;
  source_range: TimeRangeJson;
  media_reference: MediaReferenceJson;
  metadata?: Record<string, string>;
};

type GapJson = {
  OTIO_SCHEMA: "Gap.1";
  name: string;
  source_range: TimeRangeJson;
};

type ChildJson = ClipJson | GapJson;

type TrackJson = {
  OTIO_SCHEMA: "Track.1";
  name: string;
  kind: "Video" | "Audio";
  children: ChildJson[];
};

type TimelineJson = {
  OTIO_SCHEMA: "Timeline.1";
  name: string;
  tracks: {
    OTIO_SCHEMA: "Stack.1";
    children: TrackJson[];
  };
  metadata?: Record<string, string>;
};

export type OtioProposalClip = {
  trackKind: "video" | "audio";
  trackName: string;
  name: string;
  startTicks: number;
  durationTicks: number;
  sourceStartTicks: number;
  /** Matched Yamakan asset id, or null when unresolved. */
  assetId: string | null;
  /** True when target_url was present but never opened. */
  remoteUrlIgnored: boolean;
};

export type OtioProposal = {
  name: string;
  clips: OtioProposalClip[];
  unresolved: number;
};

function rational(value: number): RationalTimeJson {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new CommandError(
      "VALIDATION",
      "OTIO time must be a safe non-negative integer.",
    );
  return { OTIO_SCHEMA: "RationalTime.1", rate: OTIO_RATE, value };
}

function timeRange(start: number, duration: number): TimeRangeJson {
  return {
    OTIO_SCHEMA: "TimeRange.1",
    start_time: rational(start),
    duration: rational(duration),
  };
}

/** Export a canonical project as OTIO JSON (rational flick rate). */
export function toOtio(project: CanonicalProject): TimelineJson {
  const trackKind = (id: string) =>
    project.tracks.find((t) => t.id === id)?.kind === "audio"
      ? "Audio"
      : "Video";
  const tracks: TrackJson[] = project.tracks.map((t) => {
    const kind = t.kind === "audio" ? "Audio" : "Video";
    const children: ClipJson[] = project.clips
      .filter((c) => c.trackId === t.id && c.title === null && c.assetId)
      .sort((a, b) => a.startTicks - b.startTicks || a.id.localeCompare(b.id))
      .map((c) => {
        const asset = project.assets.find((a) => a.id === c.assetId);
        const media: MediaReferenceJson = asset
          ? {
              OTIO_SCHEMA: "ExternalReference.1",
              name: asset.name,
              target_url: `yamakan:asset:${asset.id}`,
              metadata: {
                yamakan_asset_id: asset.id,
                yamakan_content_hash: asset.hash,
              },
            }
          : { OTIO_SCHEMA: "MissingReference.1", name: "missing" };
        return {
          OTIO_SCHEMA: "Clip.1",
          name: asset?.name ?? c.id,
          source_range: timeRange(c.sourceStartTicks, c.durationTicks),
          media_reference: media,
          metadata: {
            yamakan_clip_id: c.id,
            yamakan_timeline_start: String(c.startTicks),
          },
        };
      });
    // Gap fillers: OTIO tracks are sequential; encode timeline start via
    // leading Gap when the first clip does not start at zero.
    const withGaps: ChildJson[] = [];
    let cursor = 0;
    for (const clip of children) {
      const start = Number(clip.metadata?.yamakan_timeline_start ?? 0);
      if (start > cursor) {
        withGaps.push({
          OTIO_SCHEMA: "Gap.1",
          name: "gap",
          source_range: timeRange(0, start - cursor),
        });
      }
      withGaps.push(clip);
      cursor = start + clip.source_range.duration.value;
    }
    return {
      OTIO_SCHEMA: "Track.1",
      name: t.name,
      kind,
      children: withGaps,
    };
  });
  void trackKind;
  return {
    OTIO_SCHEMA: "Timeline.1",
    name: project.name,
    tracks: { OTIO_SCHEMA: "Stack.1", children: tracks },
    metadata: {
      yamakan_project_id: project.id,
      yamakan_format_version: String(project.formatVersion),
    },
  };
}

function countObjects(value: unknown, depth: number, state: { n: number }) {
  if (depth > OTIO_LIMITS.maxDepth)
    throw new CommandError("VALIDATION", "OTIO JSON nests too deeply.");
  if (value === null || typeof value !== "object") return;
  state.n += 1;
  if (state.n > OTIO_LIMITS.maxObjects)
    throw new CommandError("VALIDATION", "OTIO JSON has too many objects.");
  if (Array.isArray(value)) {
    for (const item of value) countObjects(item, depth + 1, state);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.length > OTIO_LIMITS.maxString)
      throw new CommandError("VALIDATION", "OTIO JSON key is too long.");
    if (typeof v === "string" && v.length > OTIO_LIMITS.maxString)
      throw new CommandError("VALIDATION", "OTIO JSON string is too long.");
    countObjects(v, depth + 1, state);
  }
}

const RationalSchema = z
  .object({
    OTIO_SCHEMA: z.literal("RationalTime.1"),
    rate: z.number(),
    value: z.number().int().nonnegative(),
  })
  .strict();

function ticksFromRational(rt: z.infer<typeof RationalSchema>): number {
  if (rt.rate !== OTIO_RATE)
    throw new CommandError(
      "VALIDATION",
      `OTIO rate must be ${OTIO_RATE} flicks per second.`,
    );
  if (!Number.isSafeInteger(rt.value))
    throw new CommandError(
      "VALIDATION",
      "OTIO time value is not a safe integer.",
    );
  return rt.value;
}

/**
 * Parse OTIO JSON into a reviewable proposal (never a direct project write).
 * Media matches by `yamakan:asset:<id>`, metadata asset id, or content hash.
 * `target_url` is never fetched.
 */
export function fromOtio(
  raw: string | Buffer,
  assets: { id: string; hash: string }[],
): OtioProposal {
  const text =
    typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
  if (Buffer.byteLength(text, "utf8") > OTIO_LIMITS.maxBytes)
    throw new CommandError("VALIDATION", "OTIO JSON exceeds 16 MiB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CommandError("VALIDATION", "OTIO JSON is malformed.");
  }
  countObjects(parsed, 0, { n: 0 });
  const root = parsed as TimelineJson;
  if (!root || root.OTIO_SCHEMA !== "Timeline.1")
    throw new CommandError("VALIDATION", "OTIO root must be Timeline.1.");
  const name =
    typeof root.name === "string" && root.name.length <= OTIO_LIMITS.maxString
      ? root.name
      : "Imported timeline";
  const byId = new Map(assets.map((a) => [a.id, a]));
  const byHash = new Map(assets.map((a) => [a.hash, a]));
  const clips: OtioProposalClip[] = [];
  let unresolved = 0;
  let timelineCursor = 0;
  for (const track of root.tracks?.children ?? []) {
    if (!track || track.OTIO_SCHEMA !== "Track.1") continue;
    const trackKind = track.kind === "Audio" ? "audio" : "video";
    const trackName =
      typeof track.name === "string"
        ? track.name.slice(0, OTIO_LIMITS.maxString)
        : "Track";
    timelineCursor = 0;
    for (const child of track.children ?? []) {
      if (!child || typeof child !== "object") continue;
      if ((child as GapJson).OTIO_SCHEMA === "Gap.1") {
        timelineCursor += ticksFromRational(
          RationalSchema.parse((child as GapJson).source_range.duration),
        );
        continue;
      }
      if ((child as ClipJson).OTIO_SCHEMA !== "Clip.1") continue;
      const clipChild = child as ClipJson;
      const duration = ticksFromRational(
        RationalSchema.parse(clipChild.source_range.duration),
      );
      const sourceStart = ticksFromRational(
        RationalSchema.parse(clipChild.source_range.start_time),
      );
      const startTicks = clipChild.metadata?.yamakan_timeline_start
        ? Number(clipChild.metadata.yamakan_timeline_start)
        : timelineCursor;
      if (!Number.isSafeInteger(startTicks) || startTicks < 0)
        throw new CommandError("VALIDATION", "OTIO clip start is invalid.");
      const ref = clipChild.media_reference;
      let assetId: string | null = null;
      let remoteUrlIgnored = false;
      if (ref?.OTIO_SCHEMA === "ExternalReference.1") {
        const metaId = ref.metadata?.yamakan_asset_id;
        const metaHash = ref.metadata?.yamakan_content_hash;
        const url = ref.target_url ?? "";
        if (metaId && byId.has(metaId)) assetId = metaId;
        else if (metaHash && byHash.has(metaHash))
          assetId = byHash.get(metaHash)!.id;
        else if (url.startsWith("yamakan:asset:")) {
          const id = url.slice("yamakan:asset:".length);
          if (byId.has(id)) assetId = id;
        } else if (
          url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("file:")
        ) {
          // Hostile: never open. Leave unresolved.
          remoteUrlIgnored = true;
        }
      }
      if (!assetId) unresolved += 1;
      clips.push({
        trackKind,
        trackName,
        name:
          typeof clipChild.name === "string"
            ? clipChild.name.slice(0, OTIO_LIMITS.maxString)
            : "Clip",
        startTicks,
        durationTicks: duration,
        sourceStartTicks: sourceStart,
        assetId,
        remoteUrlIgnored,
      });
      timelineCursor = startTicks + duration;
    }
  }
  return { name, clips, unresolved };
}

export function otioJson(project: CanonicalProject): string {
  return `${JSON.stringify(toOtio(project), null, 2)}\n`;
}
