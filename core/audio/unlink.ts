// W18: unlink a video clip's embedded sound onto an audio track.
import type { CanonicalProject } from "../canonical.ts";
import { CommandError } from "../command/errors.ts";

export const AUDIO_UNLINK_ENABLED = true;

export type UnlinkSoundArgs = {
  videoClipId: string;
  audioTrackId: string;
  audioClipId: string;
};

/**
 * Creates an audio-track clip sharing the video clip's asset and source range,
 * and disables embedded sound on the video clip.
 */
export function unlinkVideoSound(
  project: CanonicalProject,
  args: UnlinkSoundArgs,
): CanonicalProject {
  if (!AUDIO_UNLINK_ENABLED)
    throw new CommandError("CAPABILITY_UNAVAILABLE", "Audio unlink is off.");
  const clip = project.clips.find((c) => c.id === args.videoClipId);
  if (!clip) throw new CommandError("NOT_FOUND", "Clip not found.");
  if (project.clips.some((c) => c.id === args.audioClipId))
    throw new CommandError("VALIDATION", "Audio clip id is already in use.");
  const track = project.tracks.find((t) => t.id === clip.trackId);
  const audioTrack = project.tracks.find((t) => t.id === args.audioTrackId);
  if (!track || track.kind !== "video")
    throw new CommandError("VALIDATION", "Unlink requires a video-track clip.");
  if (!audioTrack || audioTrack.kind !== "audio")
    throw new CommandError("VALIDATION", "Target must be an audio track.");
  if (!clip.assetId || clip.title !== null)
    throw new CommandError("VALIDATION", "Only video media clips can unlink.");
  const asset = project.assets.find((a) => a.id === clip.assetId);
  if (!asset || asset.kind !== "video" || asset.hasAudio !== true)
    throw new CommandError(
      "VALIDATION",
      "Video asset has no audio stream to unlink.",
    );
  if (!clip.sound)
    throw new CommandError("VALIDATION", "Video clip has no sound settings.");
  if (clip.sound.enabled === false)
    throw new CommandError(
      "VALIDATION",
      "Embedded sound is already disabled; unlink may already exist.",
    );

  const audioClip = {
    id: args.audioClipId,
    trackId: args.audioTrackId,
    assetId: clip.assetId,
    startTicks: clip.startTicks,
    durationTicks: clip.durationTicks,
    sourceStartTicks: clip.sourceStartTicks,
    title: null,
    gainDb: clip.sound.gainDb,
    fadeInTicks: clip.sound.fadeInTicks,
    fadeOutTicks: clip.sound.fadeOutTicks,
    sound: null,
    ...(clip.speed ? { speed: clip.speed } : {}),
  };

  return {
    ...project,
    formatVersion: 4,
    clips: [
      ...project.clips.map((c) =>
        c.id === args.videoClipId
          ? {
              ...c,
              sound: {
                ...c.sound!,
                enabled: false,
              },
            }
          : c,
      ),
      audioClip,
    ],
  };
}

/** Remove the unlinked audio clip and re-enable embedded sound on the video. */
export function relinkVideoSound(
  project: CanonicalProject,
  videoClipId: string,
  audioClipId: string,
): CanonicalProject {
  const video = project.clips.find((c) => c.id === videoClipId);
  const audio = project.clips.find((c) => c.id === audioClipId);
  if (!video || !audio) throw new CommandError("NOT_FOUND", "Clip not found.");
  if (video.assetId !== audio.assetId)
    throw new CommandError(
      "VALIDATION",
      "Relink requires matching asset ids on both clips.",
    );
  if (!video.sound)
    throw new CommandError("VALIDATION", "Video clip has no sound settings.");
  return {
    ...project,
    clips: project.clips
      .filter((c) => c.id !== audioClipId)
      .map((c) =>
        c.id === videoClipId
          ? {
              ...c,
              sound: {
                enabled: true,
                gainDb: audio.gainDb,
                fadeInTicks: audio.fadeInTicks,
                fadeOutTicks: audio.fadeOutTicks,
              },
            }
          : c,
      ),
  };
}
