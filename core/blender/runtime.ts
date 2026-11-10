// The Blender runtime Yamakan's Blender worker uses (Blender integration, first slice): one
// pinned official build, installed once into the worker tools folder that yamakan-procd grants
// its AppContainer read and execute on, and run there in place (native/procd container.rs
// staged_tool). It is checked by hash before it is used.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The one Blender build this version of Yamakan runs. Change only with a new qualification. */
export const BLENDER_PIN = Object.freeze({
  version: "5.3.0",
  // Tag v5.3.0 = 02f0899d78e374b63e7181d9061e1f7ab03419cc.
  commit: "02f0899d78e374b63e7181d9061e1f7ab03419cc",
  // The official Windows x64 zip, as download.blender.org publishes it.
  zip: "blender-5.3.0-windows-x64.zip",
  zipSha256: "3ac567a63d59d9934f7b9213bfb27ba05760e1fb366f8f55c381573ec3eabfa8",
  // blender.exe inside it.
  exeSha256: "6670c69fbb562c0fd1fae1e35f5413a90781cdf7d44af151ee4c9c3b82a38174",
  folder: "blender-5.3.0-02f0899d",
});

/** The fixed script the worker runs; nothing else is ever handed to Blender. */
export const BLENDER_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/blender/yamakan_render.py",
);

/** Where procd's workers may run tools from (native/procd container.rs). */
export function workerToolsRoot(env: NodeJS.ProcessEnv = process.env) {
  const local = env.LOCALAPPDATA;
  return local ? path.join(local, "Yamakan", "worker-tools") : null;
}

export type BlenderRuntime =
  | { available: true; install: string; executable: string }
  | {
      available: false;
      reason: "NOT_WINDOWS" | "NOT_INSTALLED" | "NOT_THE_PINNED_BUILD";
      message: string;
    };

const sha256File = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

// The hash of a 120 MB executable is read once per size and modification time.
const verified = new Map<string, string>();

/**
 * The pinned runtime, if it is installed where the worker may run it and is the pinned build.
 * Only Windows: the worker's containment (procd, AppContainer, Job Object) is Windows-only.
 */
export async function blenderRuntime(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<BlenderRuntime> {
  if (platform !== "win32")
    return {
      available: false,
      reason: "NOT_WINDOWS",
      message:
        "Blender renders run only on Windows for now, where the worker is contained.",
    };
  const root = workerToolsRoot(env);
  const install = root ? path.join(root, BLENDER_PIN.folder) : null;
  const executable = install ? path.join(install, "blender.exe") : null;
  if (!install || !executable || !existsSync(executable))
    return {
      available: false,
      reason: "NOT_INSTALLED",
      message: `Blender ${BLENDER_PIN.version} is not installed for Yamakan. Install it with: npm run blender:install -- <path to ${BLENDER_PIN.zip}>`,
    };
  const stat = statSync(executable);
  const key = `${executable}|${stat.size}|${stat.mtimeMs}`;
  let hash = verified.get(key);
  if (hash === undefined) {
    hash = await sha256File(executable);
    verified.set(key, hash);
  }
  if (hash !== BLENDER_PIN.exeSha256)
    return {
      available: false,
      reason: "NOT_THE_PINNED_BUILD",
      message: `The installed Blender is not the pinned ${BLENDER_PIN.version} build; reinstall it from ${BLENDER_PIN.zip}.`,
    };
  return { available: true, install, executable };
}
