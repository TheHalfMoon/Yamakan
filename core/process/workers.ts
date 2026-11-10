// The service's media workers: FFmpeg and ffprobe resolved to absolute paths
// once, launched only through one ProcessOwner (core/process/owner.ts).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
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
  ffmpeg: "ecfa375733106e9b72317e28d430c036ae4277e4038349f3d5f30c84fa05cfd5",
  ffprobe: "c158d17f635be352866a2865151b33c97651ab22b3c2895b410d460ef393cfc6",
} as const;

// The vendored build's own list of every file and its hash. Windows loads the DLLs beside
// ffmpeg.exe first, so they are pinned too: this list by its hash here, and each file by the
// list. Change it only with a new build, as the executables' pins above.
const PINNED_SUMS_SHA256 =
  "5df757da9a31090dd4d2b3f9addde249329cb40cb360a489b28b263f5146937a";

function sha256File(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/**
 * Every file the list names has its hash, the list is the one pinned, and no DLL lies beside
 * them that the list does not name, as Windows would load that one too.
 */
export function assertCompanionsPinned(
  dir: string,
  sumsSha256 = PINNED_SUMS_SHA256,
) {
  const sums = path.join(dir, "SHA256SUMS");
  const refuse = (why: string) => {
    throw new Error(`${dir}: ${why} (vendor/ffmpeg-win64-r8).`);
  };
  if (!existsSync(sums)) refuse("SHA256SUMS is missing");
  // As committed, with LF line ends: a checkout that turned them into CRLF reads the same.
  const text = readFileSync(sums, "utf8").replace(/\r\n/g, "\n");
  if (createHash("sha256").update(text).digest("hex") !== sumsSha256)
    refuse("SHA256SUMS is not the pinned list");
  const listed = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = /^([a-f0-9]{64}) \*?(\S+)$/.exec(line.trim());
    if (!match || match[2].includes("/") || match[2].includes("\\"))
      refuse(`SHA256SUMS has a line it should not: ${line.slice(0, 80)}`);
    const [, hash, name] = match!;
    listed.add(name.toLowerCase());
    const file = path.join(dir, name);
    if (!existsSync(file)) refuse(`${name} is missing`);
    if (sha256File(file) !== hash) refuse(`${name} is not the pinned build`);
  }
  for (const name of readdirSync(dir))
    if (name.toLowerCase().endsWith(".dll") && !listed.has(name.toLowerCase()))
      refuse(`${name} is not part of the pinned build`);
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
    // Run from the vendored folder, the DLLs beside them are checked too. An installed bundle's
    // are checked against its manifest when the service starts.
    // By real path, so a junction, a short name or a \\?\ prefix reaches it too. Checked once
    // per process: a DLL planted later is not seen, as with the executables' own pins.
    const real = (dir: string) => {
      try {
        return realpathSync.native(dir).toLowerCase();
      } catch {
        return path.resolve(dir).toLowerCase();
      }
    };
    if (
      process.platform === "win32" &&
      [ffmpeg, ffprobe].some(
        (tool) => real(path.dirname(tool)) === real(VENDOR_FFMPEG_DIR),
      )
    )
      assertCompanionsPinned(VENDOR_FFMPEG_DIR);
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
