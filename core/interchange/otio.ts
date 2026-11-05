// M16 / W13: OTIO JSON interchange (ladder E). Runtime has no OTIO dependency;
// CI's otio-oracle job installs opentimelineio as a read-only test oracle.
import { z } from "zod";
import type { CanonicalProject } from "../canonical.ts";
import { FLICKS_PER_SECOND } from "../time.ts";
import { CommandError } from "../command/errors.ts";
import { ClipEffectsSchema, type ClipEffects } from "../effects/registry.ts";
import { TransitionSchema, type Transition } from "../transitions.ts";

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
  /** The clip's effects (YU-020), carried as Yamakan metadata. */
  effects?: ClipEffects;
  /** The dissolve into the clip (YU-021), carried as Yamakan metadata. */
  transition?: Transition;
};

export type OtioProposal = {
  name: string;
  clips: OtioProposalClip[];
  unresolved: number;
  /** What the file held that the proposal leaves out, by OTIO schema. */
  ignored: { schema: string; count: number }[];
};

/**
 * One thing a conversion does not carry. "dropped" is gone from the file;
 * "yamakanOnly" travels as metadata that only Yamakan reads back.
 */
export type OtioLoss = {
  subject: "project" | "track" | "clip";
  id: string;
  field: string;
  effect: "dropped" | "yamakanOnly";
};

export type OtioLossReport = {
  carried: { tracks: number; clips: number };
  losses: OtioLoss[];
  /** The media the file refers to, by content, since it holds none of it. */
  media: { assetId: string; name: string; hash: string; bytes: number }[];
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
            // OTIO has no matching effect; Yamakan's own is carried as
            // metadata so a round trip keeps it (YU-020).
            ...(c.effects
              ? { yamakan_effects: JSON.stringify(c.effects) }
              : {}),
            ...(c.transition
              ? { yamakan_transition: JSON.stringify(c.transition) }
              : {}),
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

/** What `toOtio` would leave behind, in a fixed order, without converting. */
export function otioLossReport(project: CanonicalProject): OtioLossReport {
  const losses: OtioLoss[] = [];
  const lose = (
    subject: OtioLoss["subject"],
    id: string,
    field: string,
    effect: OtioLoss["effect"] = "dropped",
  ) => losses.push({ subject, id, field, effect });
  lose("project", project.id, "output");
  lose("project", project.id, "language");
  if (project.scenes.length) lose("project", project.id, "scenes");
  for (const d of project.documents)
    lose("project", project.id, `document:${d.id}`);
  for (const t of project.tracks)
    for (const field of ["muted", "locked", "solo", "targeted"] as const)
      if (t[field]) lose("track", t.id, field);
  const known = new Set(project.assets.map((a) => a.id));
  const carried = project.clips.filter((c) => c.title === null && c.assetId);
  for (const c of project.clips) {
    if (c.title !== null) lose("clip", c.id, "title");
    else if (!c.assetId || !known.has(c.assetId)) lose("clip", c.id, "media");
    if (c.gainDb !== 0) lose("clip", c.id, "gain");
    if (c.fadeInTicks !== 0 || c.fadeOutTicks !== 0)
      lose("clip", c.id, "fades");
    if (
      c.sound &&
      (!c.sound.enabled ||
        c.sound.gainDb !== 0 ||
        c.sound.fadeInTicks !== 0 ||
        c.sound.fadeOutTicks !== 0)
    )
      lose("clip", c.id, "sound");
    if (c.speed && c.speed.num !== c.speed.den) lose("clip", c.id, "speed");
    if (c.animation) lose("clip", c.id, "animation");
    if (c.effects) lose("clip", c.id, "effects", "yamakanOnly");
    if (c.transition) lose("clip", c.id, "transition", "yamakanOnly");
  }
  const order = { project: 0, track: 1, clip: 2 };
  losses.sort(
    (a, b) =>
      order[a.subject] - order[b.subject] ||
      a.id.localeCompare(b.id) ||
      a.field.localeCompare(b.field),
  );
  const used = new Set(carried.map((c) => c.assetId));
  return {
    carried: { tracks: project.tracks.length, clips: carried.length },
    losses,
    media: project.assets
      .filter((a) => used.has(a.id))
      .map((a) => ({
        assetId: a.id,
        name: a.name,
        hash: a.hash,
        bytes: a.bytes,
      }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)),
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

// A time from the file, whose shape is not yet known to be a time.
function ticksFrom(value: unknown): number {
  const parsed = RationalSchema.safeParse(value);
  if (!parsed.success)
    throw new CommandError("VALIDATION", "OTIO time is invalid.");
  return ticksFromRational(parsed.data);
}

function rangeOf(child: { source_range?: unknown }, label: string) {
  const range = child.source_range as
    { start_time?: unknown; duration?: unknown } | null | undefined;
  if (!range || typeof range !== "object")
    throw new CommandError("VALIDATION", `OTIO ${label} has no source range.`);
  return range;
}

function childrenOf(value: unknown, label: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value))
    throw new CommandError("VALIDATION", `OTIO ${label} must be a list.`);
  return value;
}

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
  const ignoredBySchema = new Map<string, number>();
  const ignore = (value: unknown) => {
    const schema = (value as { OTIO_SCHEMA?: unknown } | null)?.OTIO_SCHEMA;
    const key =
      typeof schema === "string"
        ? schema.slice(0, OTIO_LIMITS.maxString)
        : "unknown";
    ignoredBySchema.set(key, (ignoredBySchema.get(key) ?? 0) + 1);
  };
  for (const entry of childrenOf(root.tracks?.children, "stack")) {
    const track = entry as TrackJson;
    if (!track || track.OTIO_SCHEMA !== "Track.1") {
      ignore(entry);
      continue;
    }
    const trackKind = track.kind === "Audio" ? "audio" : "video";
    const trackName =
      typeof track.name === "string"
        ? track.name.slice(0, OTIO_LIMITS.maxString)
        : "Track";
    timelineCursor = 0;
    for (const child of childrenOf(track.children, "track")) {
      if (!child || typeof child !== "object") {
        ignore(child);
        continue;
      }
      if ((child as GapJson).OTIO_SCHEMA === "Gap.1") {
        timelineCursor += ticksFrom(rangeOf(child, "gap").duration);
        if (!Number.isSafeInteger(timelineCursor))
          throw new CommandError("VALIDATION", "OTIO clip start is invalid.");
        continue;
      }
      if ((child as ClipJson).OTIO_SCHEMA !== "Clip.1") {
        ignore(child);
        continue;
      }
      const clipChild = child as ClipJson;
      const range = rangeOf(clipChild, "clip");
      const duration = ticksFrom(range.duration);
      const sourceStart = ticksFrom(range.start_time);
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
        } else if (url) {
          // A web address, a host path or anything else: never opened.
          remoteUrlIgnored = true;
        }
      }
      if (!assetId) unresolved += 1;
      // Effects come back only as Yamakan's own validated stack; anything
      // else there is refused, never half-read.
      const effectsText = (
        clipChild.metadata as Record<string, unknown> | undefined
      )?.yamakan_effects;
      let effects: ClipEffects | undefined;
      if (effectsText !== undefined) {
        const parsedEffects =
          typeof effectsText === "string" &&
          effectsText.length <= OTIO_LIMITS.maxString
            ? ClipEffectsSchema.safeParse(
                (() => {
                  try {
                    return JSON.parse(effectsText);
                  } catch {
                    return null;
                  }
                })(),
              )
            : null;
        if (!parsedEffects?.success)
          throw new CommandError(
            "VALIDATION",
            "OTIO clip effects are invalid.",
          );
        effects = parsedEffects.data;
      }
      const transitionText = (
        clipChild.metadata as Record<string, unknown> | undefined
      )?.yamakan_transition;
      let transition: Transition | undefined;
      if (transitionText !== undefined) {
        const parsed =
          typeof transitionText === "string" &&
          transitionText.length <= OTIO_LIMITS.maxString
            ? TransitionSchema.safeParse(
                (() => {
                  try {
                    return JSON.parse(transitionText);
                  } catch {
                    return null;
                  }
                })(),
              )
            : null;
        if (!parsed?.success)
          throw new CommandError(
            "VALIDATION",
            "OTIO clip transition is invalid.",
          );
        transition = parsed.data;
      }
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
        ...(effects ? { effects } : {}),
        ...(transition ? { transition } : {}),
      });
      timelineCursor = startTicks + duration;
    }
  }
  const ignored = [...ignoredBySchema]
    .map(([schema, count]) => ({ schema, count }))
    .sort((a, b) => a.schema.localeCompare(b.schema));
  return { name, clips, unresolved, ignored };
}

export function otioJson(project: CanonicalProject): string {
  return `${JSON.stringify(toOtio(project), null, 2)}\n`;
}
