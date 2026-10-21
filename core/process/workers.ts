// The service's media workers: FFmpeg and ffprobe resolved to absolute paths
// once, launched only through one ProcessOwner (core/process/owner.ts).
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProcessOwner, resolveExecutable } from "./owner.ts";

const env = (name: string) =>
  process.env[`YAMAKAN_${name}`] || process.env[`DARZAIN_${name}`];

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** R8/Q3 pin: libass fontconfig provider, DirectWrite disabled (Windows). */
export const VENDOR_FFMPEG_DIR = path.join(ROOT, "vendor", "ffmpeg-win64-r8");

function vendorTool(name: "ffmpeg" | "ffprobe"): string | null {
  if (process.platform !== "win32") return null;
  const exe = path.join(VENDOR_FFMPEG_DIR, `${name}.exe`);
  return existsSync(exe) ? exe : null;
}

let tools: { ffmpeg: string; ffprobe: string } | null = null;
let owner: ProcessOwner | null = null;

export function mediaTools() {
  tools ??= {
    ffmpeg: resolveExecutable(
      env("FFMPEG") || vendorTool("ffmpeg") || "ffmpeg",
    ),
    ffprobe: resolveExecutable(
      env("FFPROBE") || vendorTool("ffprobe") || "ffprobe",
    ),
  };
  return tools;
}

export function workers(): ProcessOwner {
  if (!owner) {
    const { ffmpeg, ffprobe } = mediaTools();
    owner = new ProcessOwner([ffmpeg, ffprobe]);
  }
  return owner;
}

// Ends every running worker; called on service shutdown.
export function closeWorkers() {
  owner?.close();
  owner = null;
}
