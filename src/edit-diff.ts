// YU-015: the editor's changes as canonical typed operations. A gesture
// edits the local 30 fps view (immediate feedback); when it completes, the
// difference between the service's head and that view is expressed as one
// batch of the same typed operations agents and tools use, and committed
// with compare-and-swap. The batch is verified before it is sent: applied
// to the head locally it must reproduce the view exactly, or it is not
// sent (the change stays a draft rather than being committed lossily).
import type { Project } from "../core/project.ts";
import { fromEditView } from "../core/canonical.ts";
import type { CanonicalProject } from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import type { Operation } from "../core/timeline/operations.ts";
import { canonicalJson } from "../core/hash/canonical.ts";

/** The tracks, clips, scenes and shots a batch changes, by id. */
export function touched(operations: Operation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of operations) {
    const o = op as Record<string, unknown>;
    for (const key of [
      "trackId",
      "clipId",
      "sceneId",
      "shotId",
      "newClipId",
      "anchorClipId",
      "targetTrackId",
      "audioClipId",
      "audioTrackId",
    ])
      if (typeof o[key] === "string") ids.add(o[key] as string);
    for (const list of ["clipIds", "newTrackIds"])
      if (Array.isArray(o[list]))
        for (const id of o[list] as unknown[]) ids.add(String(id));
  }
  return ids;
}

/** Operations per commit (the service's batch bound). */
export const MAX_GESTURE_OPERATIONS = 64;

type Canon = CanonicalProject;
type Clip = Canon["clips"][number];
type Track = Canon["tracks"][number];
type Scene = Canon["scenes"][number];

// What a commit must reproduce. Clip order is not meaningful (clips on one
// track never overlap), so clips are compared by id.
function comparable(p: Canon) {
  const { revision: _revision, ...rest } = p;
  return canonicalJson({
    ...rest,
    clips: [...p.clips].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  });
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

function trackOps(a: Track | undefined, b: Track): Operation[] {
  const changes: Partial<
    Record<"name" | "muted" | "solo" | "targeted", unknown>
  > = {};
  if (a && a.name !== b.name) changes.name = b.name;
  if ((a?.muted ?? false) !== b.muted) changes.muted = b.muted;
  if ((a?.solo ?? false) !== b.solo) changes.solo = b.solo;
  if ((a?.targeted ?? false) !== b.targeted) changes.targeted = b.targeted;
  return Object.keys(changes).length
    ? [{ type: "track.update", trackId: b.id, ...changes } as Operation]
    : [];
}

// A clip as clip.add creates it, then the settings that differ from that.
function clipOps(head: Canon, c: Clip): Operation[] {
  const ops: Operation[] = [
    {
      type: "clip.add",
      clipId: c.id,
      trackId: c.trackId,
      assetId: c.assetId,
      title: c.title,
      startTicks: c.startTicks,
      durationTicks: c.durationTicks,
      sourceStartTicks: c.sourceStartTicks,
    },
  ];
  if (c.gainDb !== 0 || c.fadeInTicks !== 0 || c.fadeOutTicks !== 0)
    ops.push({
      type: "clip.setAudio",
      clipId: c.id,
      gainDb: c.gainDb,
      fadeInTicks: c.fadeInTicks,
      fadeOutTicks: c.fadeOutTicks,
    });
  if (c.sound) {
    const asset = head.assets.find((x) => x.id === c.assetId);
    const created = {
      enabled: asset?.hasAudio === true,
      gainDb: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
    };
    if (!same(created, c.sound))
      ops.push({ type: "clip.setSound", clipId: c.id, ...c.sound });
  }
  if (c.speed && !(c.speed.num === 1 && c.speed.den === 1))
    ops.push({ type: "clip.setSpeed", clipId: c.id, speed: c.speed });
  if (c.animation)
    ops.push({
      type: "clip.setAnimation",
      clipId: c.id,
      animation: c.animation,
    });
  if (c.effects)
    ops.push({ type: "clip.setEffects", clipId: c.id, effects: c.effects });
  if (c.transition)
    ops.push({
      type: "clip.setTransition",
      clipId: c.id,
      transition: c.transition,
    });
  return ops;
}

function sceneOps(a: Scene | undefined, b: Scene): Operation[] {
  const ops: Operation[] = [];
  if (!a) ops.push({ type: "scene.add", sceneId: b.id, name: b.name });
  const update: Record<string, unknown> = {};
  if (a && a.name !== b.name) update.name = b.name;
  if ((a?.referenceAssetId ?? null) !== b.referenceAssetId)
    update.referenceAssetId = b.referenceAssetId;
  if (!a || !same(a.camera, b.camera)) update.camera = b.camera;
  if (Object.keys(update).length)
    ops.push({ type: "scene.update", sceneId: b.id, ...update } as Operation);
  return ops;
}

/**
 * The typed operations that turn `head` into `draft`, verified, or null
 * when the change cannot be expressed exactly (or needs more than one
 * batch): the caller then keeps it as a draft for an explicit save.
 */
export function operationsBetween(
  head: Project,
  draft: Project,
): Operation[] | null {
  let a: Canon;
  let b: Canon;
  try {
    a = fromEditView(head);
    b = fromEditView(draft);
  } catch {
    return null;
  }
  if (comparable(a) === comparable(b)) return [];
  // In place first: the batch an agent or the CLI would send for the same
  // edit (clip.move, clip.trim, setters), so the stored bytes are the same
  // whichever client made it. Only when that cannot reproduce the view
  // exactly (clips trading places would overlap on the way) are changed
  // clips taken out and put back whole.
  for (const inPlace of [true, false]) {
    const ops = plan(a, b, inPlace);
    if (!ops || ops.length === 0 || ops.length > MAX_GESTURE_OPERATIONS)
      continue;
    try {
      const result = applyBatch(a, ops);
      if (
        inPlace
          ? exact(result) === exact(b)
          : comparable(result) === comparable(b)
      )
        return ops;
    } catch {
      // Refused on the way: try the other plan.
    }
  }
  return null;
}

// What an in-place batch must reproduce: everything, clip order included.
function exact(p: Canon) {
  const { revision: _revision, ...rest } = p;
  return canonicalJson(rest);
}

// The setters that turn clip `a` into `b` in place, or null when its track,
// asset or kind changed in a way only a re-add can express.
function inPlaceOps(a: Clip, b: Clip): Operation[] | null {
  if (a.assetId !== b.assetId || (a.title === null) !== (b.title === null))
    return null;
  const ops: Operation[] = [];
  const sameLength = a.durationTicks === b.durationTicks;
  const sameSource = a.sourceStartTicks === b.sourceStartTicks;
  if (a.trackId !== b.trackId || a.startTicks !== b.startTicks) {
    if (sameLength && sameSource)
      ops.push({
        type: "clip.move",
        clipId: b.id,
        ...(a.trackId !== b.trackId ? { trackId: b.trackId } : {}),
        startTicks: b.startTicks,
      });
    else if (a.trackId === b.trackId)
      ops.push({
        type: "clip.trim",
        clipId: b.id,
        startTicks: b.startTicks,
        endTicks: b.startTicks + b.durationTicks,
      });
    else return null;
  } else if (!sameLength) {
    if (!sameSource) return null;
    ops.push({
      type: "clip.trim",
      clipId: b.id,
      endTicks: b.startTicks + b.durationTicks,
    });
  } else if (!sameSource) return null;
  if (a.title !== b.title && b.title !== null)
    ops.push({ type: "clip.setTitle", clipId: b.id, title: b.title });
  if (
    a.gainDb !== b.gainDb ||
    a.fadeInTicks !== b.fadeInTicks ||
    a.fadeOutTicks !== b.fadeOutTicks
  )
    ops.push({
      type: "clip.setAudio",
      clipId: b.id,
      gainDb: b.gainDb,
      fadeInTicks: b.fadeInTicks,
      fadeOutTicks: b.fadeOutTicks,
    });
  if (!same(a.sound, b.sound)) {
    if (!b.sound) return null;
    ops.push({ type: "clip.setSound", clipId: b.id, ...b.sound });
  }
  const one = { num: 1, den: 1 };
  if (!same(a.speed ?? one, b.speed ?? one))
    ops.push({ type: "clip.setSpeed", clipId: b.id, speed: b.speed ?? one });
  if (!same(a.animation ?? null, b.animation ?? null))
    ops.push({
      type: "clip.setAnimation",
      clipId: b.id,
      animation: b.animation ?? null,
    });
  if (!same(a.effects ?? null, b.effects ?? null))
    ops.push({
      type: "clip.setEffects",
      clipId: b.id,
      effects: b.effects ?? null,
    });
  if (!same(a.transition ?? null, b.transition ?? null))
    ops.push({
      type: "clip.setTransition",
      clipId: b.id,
      transition: b.transition ?? null,
    });
  return ops;
}

function plan(a: Canon, b: Canon, inPlace: boolean): Operation[] | null {
  const aClips = new Map(a.clips.map((c) => [c.id, c]));
  const bClips = new Map(b.clips.map((c) => [c.id, c]));
  const aTracks = new Map(a.tracks.map((t) => [t.id, t]));
  const bTracks = new Map(b.tracks.map((t) => [t.id, t]));
  const aScenes = new Map(a.scenes.map((s) => [s.id, s]));
  const ops: Operation[] = [];
  // Tracks unlocked by this change (or removed while locked) are unlocked
  // first; new tracks exist before clips land on them.
  for (const t of a.tracks)
    if (t.locked && (!bTracks.has(t.id) || !bTracks.get(t.id)!.locked))
      ops.push({ type: "track.update", trackId: t.id, locked: false });
  for (const t of b.tracks)
    if (!aTracks.has(t.id))
      ops.push({
        type: "track.add",
        trackId: t.id,
        name: t.name,
        kind: t.kind,
      });
  const changed = b.clips.filter((c) => {
    const before = aClips.get(c.id);
    return before && !same(before, c);
  });
  const readded = new Set<string>();
  for (const c of a.clips)
    if (!bClips.has(c.id)) ops.push({ type: "clip.remove", clipId: c.id });
  for (const c of changed) {
    const set = inPlace ? inPlaceOps(aClips.get(c.id)!, c) : null;
    if (set) ops.push(...set);
    else if (inPlace) return null;
    else {
      ops.push({ type: "clip.remove", clipId: c.id });
      readded.add(c.id);
    }
  }
  for (const c of b.clips)
    if (!aClips.has(c.id) || readded.has(c.id)) ops.push(...clipOps(a, c));
  // Scenes and shots, including shot membership a clip.remove cleared.
  for (const s of a.scenes)
    if (!b.scenes.some((x) => x.id === s.id))
      ops.push({ type: "scene.remove", sceneId: s.id });
  for (const s of b.scenes) {
    const before = aScenes.get(s.id);
    ops.push(...sceneOps(before, s));
    const beforeShots = new Map((before?.shots ?? []).map((x) => [x.id, x]));
    for (const shot of before?.shots ?? [])
      if (!s.shots.some((x) => x.id === shot.id))
        ops.push({ type: "shot.remove", shotId: shot.id });
    for (const shot of s.shots) {
      const prior = beforeShots.get(shot.id);
      if (!prior)
        ops.push({
          type: "shot.add",
          sceneId: s.id,
          shotId: shot.id,
          name: shot.name,
          clipIds: shot.clipIds,
        });
      else if (
        prior.name !== shot.name ||
        !same(prior.clipIds, shot.clipIds) ||
        shot.clipIds.some((id) => readded.has(id))
      )
        ops.push({
          type: "shot.update",
          shotId: shot.id,
          name: shot.name,
          clipIds: shot.clipIds,
        });
    }
  }
  // Track properties, removals, and locks last (a locked track takes no edits).
  for (const t of b.tracks) ops.push(...trackOps(aTracks.get(t.id), t));
  for (const t of a.tracks)
    if (!bTracks.has(t.id)) ops.push({ type: "track.remove", trackId: t.id });
  for (const t of b.tracks)
    if (t.locked && !aTracks.get(t.id)?.locked)
      ops.push({ type: "track.update", trackId: t.id, locked: true });
  return ops;
}
