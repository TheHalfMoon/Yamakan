// The Cinema page's Blender render (Blender integration): the choices it offers, as the render
// settings the service accepts (core/blender/scene.ts), and what a render job says, as the page
// shows it. Pure, so it is tested without a page.

export const BLENDER_SIZES = {
  small: { width: 320, height: 180 },
  medium: { width: 640, height: 360 },
  large: { width: 1280, height: 720 },
} as const;
export type BlenderSize = keyof typeof BLENDER_SIZES;

/** Samples per pixel: fewer is faster and grainier. */
export const BLENDER_QUALITY = { draft: 8, good: 16, best: 32 } as const;
export type BlenderQuality = keyof typeof BLENDER_QUALITY;

export const BLENDER_SECONDS = [1, 2, 4] as const;
export const BLENDER_FPS = [24, 30] as const;
export const BLENDER_ORBITS = [0, 45, 90, 180] as const;

export type BlenderChoices = {
  size: BlenderSize;
  seconds: (typeof BLENDER_SECONDS)[number];
  fps: (typeof BLENDER_FPS)[number];
  quality: BlenderQuality;
  orbitDegrees: (typeof BLENDER_ORBITS)[number];
};

export const DEFAULT_BLENDER_CHOICES: BlenderChoices = {
  size: "small",
  seconds: 1,
  fps: 30,
  quality: "draft",
  orbitDegrees: 90,
};

/** The settings the service is sent: never more than 120 frames (4 s at 30 fps). */
export function blenderSettings(choices: BlenderChoices) {
  const size = BLENDER_SIZES[choices.size];
  return {
    width: size.width,
    height: size.height,
    fps: choices.fps,
    frames: Math.min(120, choices.seconds * choices.fps),
    samples: BLENDER_QUALITY[choices.quality],
    orbitDegrees: choices.orbitDegrees,
  };
}

export type BlenderJob = {
  id: string;
  state: string;
  progress?: number;
  error?: string | null;
  artifact?: string | null;
};

export type BlenderView =
  | { kind: "working"; percent: number }
  | { kind: "done"; assetId: string }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" };

/** What the page shows for a render job. A finished one names the asset it made. */
export function blenderView(job: BlenderJob): BlenderView {
  if (job.state === "COMPLETED") {
    const assetId = /^asset:([0-9a-f-]{36})$/.exec(job.artifact ?? "")?.[1];
    return assetId
      ? { kind: "done", assetId }
      : { kind: "failed", message: "The render finished without a video." };
  }
  if (job.state === "FAILED")
    return { kind: "failed", message: job.error || "The render failed." };
  if (job.state === "CANCELLED") return { kind: "cancelled" };
  return {
    kind: "working",
    percent: Math.max(0, Math.min(99, Math.round((job.progress ?? 0) * 100))),
  };
}
