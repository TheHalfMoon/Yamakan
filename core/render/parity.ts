// Preview parity (YU-018): what the interactive canvas preview shows as the
// export will, and what it only approximates. The canvas is fast; the
// reference preview (core/render/preview.ts) is rendered by the export's
// own compiler and is what the export contains. This lists, per kind, the
// clips the canvas shows differently, so the editor can say so plainly
// instead of implying a match. Browser-safe: no Node imports.
import type { Project } from "../project.ts";
import { ANIMATION_ENABLED } from "../animation/flags.ts";

export const PREVIEW_PARITY_VERSION = "yamakan.preview-parity/v1";

// Shown as the export shows them: cuts, trims, track order, picture fit,
// constant retime, still images, embedded and separate sound, and clip
// gain from -60 to 0 dB.
export const PREVIEW_PARITY_SUBSET = Object.freeze([
  "cut",
  "trim",
  "trackOrder",
  "fitContain",
  "constantRetime",
  "stillImage",
  "sound",
  "gainUpToUnity",
] as const);

export type Approximation =
  // Titles are drawn with the browser's fonts, box and layout; the export
  // uses the pinned fonts through libass.
  | "titleFont"
  // A video placed on an audio track: the export plays only its sound,
  // the canvas also draws its picture.
  | "videoOnAudioTrack"
  // A retime below 1/4 or above 4x: the browser may silence or clamp it.
  | "extremeRetime"
  // Fade-ins and fade-outs are not played.
  | "audioFade"
  // Gain above 0 dB cannot be played louder than the source.
  | "gainAboveUnity"
  // Clip animation (opacity, transform) is not drawn.
  | "animation";

export type PreviewParity = {
  version: typeof PREVIEW_PARITY_VERSION;
  exact: boolean;
  approximations: { kind: Approximation; clipIds: string[] }[];
};

const audible = (p: Project, c: Project["clips"][number]) => {
  const track = p.tracks.find((t) => t.id === c.trackId);
  const asset = p.assets.find((a) => a.id === c.assetId);
  return { track, asset };
};

// The export's rule: mute removes a track; solo on any track of a kind
// keeps only the soloed tracks of that kind.
const exported = (p: Project, trackId: string) => {
  const track = p.tracks.find((t) => t.id === trackId);
  if (!track) return false;
  const soloed = p.tracks.some((t) => t.kind === track.kind && t.solo);
  return !track.muted && (!soloed || Boolean(track.solo));
};

export function previewParity(p: Project): PreviewParity {
  const found = new Map<Approximation, string[]>();
  const add = (kind: Approximation, id: string) =>
    found.set(kind, [...(found.get(kind) ?? []), id]);
  for (const c of p.clips) {
    if (!exported(p, c.trackId)) continue;
    if (c.title !== null) {
      add("titleFont", c.id);
      continue;
    }
    const { track, asset } = audible(p, c);
    if (!track || !asset) continue;
    if (track.kind === "audio" && asset.kind === "video")
      add("videoOnAudioTrack", c.id);
    if (c.speed) {
      const rate = c.speed.num / c.speed.den;
      if (rate < 0.25 || rate > 4) add("extremeRetime", c.id);
    }
    // Sound as the export takes it: an audio clip's own fields, or a video
    // clip's embedded sound when enabled.
    const sound =
      track.kind === "audio" || asset.kind === "audio"
        ? {
            gainDb: c.gainDb ?? 0,
            fadeIn: c.fadeInFrames ?? 0,
            fadeOut: c.fadeOutFrames ?? 0,
          }
        : c.sound?.enabled
          ? {
              gainDb: c.sound.gainDb ?? 0,
              fadeIn: c.sound.fadeInFrames ?? 0,
              fadeOut: c.sound.fadeOutFrames ?? 0,
            }
          : null;
    if (sound && (sound.fadeIn > 0 || sound.fadeOut > 0))
      add("audioFade", c.id);
    if (sound && sound.gainDb > 0) add("gainAboveUnity", c.id);
    if (ANIMATION_ENABLED && c.animation && Object.keys(c.animation).length)
      add("animation", c.id);
  }
  const approximations = [...found].map(([kind, clipIds]) => ({
    kind,
    clipIds,
  }));
  return {
    version: PREVIEW_PARITY_VERSION,
    exact: approximations.length === 0,
    approximations,
  };
}

// The gain the canvas plays a clip at (0..1), as the export would up to
// unity: an audio clip's own gain, or a video clip's embedded sound gain.
export function previewVolume(
  p: Project,
  c: Project["clips"][number],
): number | undefined {
  const { track, asset } = audible(p, c);
  const gainDb =
    track?.kind === "audio" || asset?.kind === "audio"
      ? c.gainDb
      : c.sound?.enabled
        ? c.sound.gainDb
        : undefined;
  if (gainDb === undefined) return undefined;
  return Math.min(1, Math.max(0, 10 ** (gainDb / 20)));
}
