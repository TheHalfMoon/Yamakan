// The service's media workers: FFmpeg and ffprobe resolved to absolute paths
// once, launched only through one ProcessOwner (core/process/owner.ts).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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

const PINNED_SHA256 = {
  ffmpeg: "e1ed8eb59f5a1c1d21dc0fe3f57d596452e108252d643074365bcb6e98faaa9c",
  ffprobe: "02e3a14c752bdb6b89d841a05d9647abda930b7918e841154eeed497c0b8ebe9",
} as const;

function sha256File(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function assertPinned(kind: "ffmpeg" | "ffprobe", exe: string) {
  if (process.platform !== "win32") return;
  const actual = sha256File(exe);
  const expected = PINNED_SHA256[kind];
  if (actual !== expected) {
    throw new Error(
      `${kind} at ${exe} has SHA-256 ${actual}; R8 requires ${expected} (vendor/ffmpeg-win64-r8).`,
    );
  }
}

function bundleTool(name: "ffmpeg" | "ffprobe"): string | null {
  const root = env("BUNDLE_INSTALL");
  if (!root) return null;
  const exe = path.join(path.resolve(root), "ffmpeg", `${name}.exe`);
  return existsSync(exe) ? exe : null;
}

function vendorTool(name: "ffmpeg" | "ffprobe"): string | null {
  if (process.platform !== "win32") return null;
  const exe = path.join(VENDOR_FFMPEG_DIR, `${name}.exe`);
  return existsSync(exe) ? exe : null;
}

let tools: { ffmpeg: string; ffprobe: string } | null = null;
let owner: ProcessOwner | null = null;

export function mediaTools() {
  if (!tools) {
    const ffmpegOverride = env("FFMPEG");
    const ffprobeOverride = env("FFPROBE");
    const ffmpeg =
      (ffmpegOverride && resolveExecutable(ffmpegOverride)) ||
      bundleTool("ffmpeg") ||
      vendorTool("ffmpeg") ||
      resolveExecutable("ffmpeg");
    const ffprobe =
      (ffprobeOverride && resolveExecutable(ffprobeOverride)) ||
      bundleTool("ffprobe") ||
      vendorTool("ffprobe") ||
      resolveExecutable("ffprobe");
    // Windows R8: refuse an unpinned FFmpeg (env override included).
    assertPinned("ffmpeg", ffmpeg);
    assertPinned("ffprobe", ffprobe);
    tools = { ffmpeg, ffprobe };
  }
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
