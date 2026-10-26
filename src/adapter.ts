import { mediaUrl } from "./session.ts";
import { framesPerSecond } from "../core/project.ts";
import type { Project } from "../core/project.ts";
import type { TimelineClip, TimelineTrack, MediaItem } from "./editor/types";
import { previewVolume } from "../core/render/parity.ts";
// With `proxies`, a video whose edit proxy is ready plays that proxy in
// the interactive preview (same times and trims; YU-017); everything else,
// and every export, uses the original.
// Seconds of the project's frames (the donor UI works in seconds).
const secondsAt = (p: Project) => {
  const fps = framesPerSecond(p);
  return (frames: number) => frames / fps;
};
export function editorView(
  p: Project,
  proxies: ReadonlySet<string> = new Set(),
) {
  const s = secondsAt(p);
  const tracks: TimelineTrack[] = p.tracks.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.kind,
    isMuted: t.muted,
    isLocked: t.locked,
    isSolo: Boolean(t.solo),
    isTargeted: Boolean(t.targeted),
  }));
  const media: MediaItem[] = p.assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.kind,
    source: "upload",
    url: mediaUrl(
      proxies.has(a.id) && a.kind === "video"
        ? `/api/v1/projects/${p.id}/assets/${a.id}/proxy`
        : `/api/v1/projects/${p.id}/assets/${a.id}`,
    ),
    hash: a.hash,
    peaksPath: `/api/v1/projects/${p.id}/assets/${a.id}/peaks`,
    duration: s(a.durationFrames),
  }));
  const clips: TimelineClip[] = p.clips.map((c) => ({
    id: c.id,
    trackId: c.trackId,
    mediaId: c.assetId || `title-${c.id}`,
    start: s(c.startFrame),
    end: s(c.startFrame + c.durationFrames),
    duration: s(c.durationFrames),
    // TimelineClip.speed is a float for the donor UI; canonical keeps Rational.
    speed: c.speed ? c.speed.num / c.speed.den : 1,
    sourceIn: s(c.sourceFrame),
    // Retimed clips still map source span via speed (sourceOut = in + duration*speed).
    sourceOut: s(
      c.sourceFrame +
        Math.round(
          c.durationFrames * (c.speed ? c.speed.num / c.speed.den : 1),
        ),
    ),
    effect: null,
    soundEnabled: Boolean(c.sound?.enabled),
    // The export's gain up to 0 dB (an audio clip's own, or a video's
    // embedded sound); above it, see core/render/parity.ts.
    volume: previewVolume(p, c),
    ...(c.title !== null
      ? {
          textConfig: {
            content: c.title,
            font: "sans-serif",
            size: Math.round(p.height / 15),
            color: "#ffffff",
            position: "bottom-center" as const,
            background: {
              enabled: true,
              color: "#000000",
              opacity: 0.65,
              paddingX: 12,
              paddingY: 12,
              radius: 0,
            },
          },
        }
      : {}),
  }));
  for (const c of p.clips.filter((c) => c.title !== null))
    media.push({
      id: `title-${c.id}`,
      name: c.title || "Title",
      type: "video",
      source: "upload",
      url: "",
    });
  return { tracks, media, clips };
}
