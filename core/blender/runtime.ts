// The Blender runtime Yamakan's Blender worker uses (Blender integration, first slice): one
// pinned official build, installed once into the worker tools folder that yamakan-procd grants
// its AppContainer read and execute on, and run there in place (native/procd container.rs
// staged_tool). It is checked by hash before it is used.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
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
  // The installed tree (without blender.pdb), three ways, each a SHA-256 over sorted lines
  // "path<TAB>size<TAB>sha256" (or "path<TAB>size" for the listing): every file's name and size;
  // the code Windows runs (*.exe, *.dll, *.pyd); and every file's bytes.
  listingSha256:
    "001463b63578da4b153438b85568c5472fcae430fad521e76d2d4794a81a6333",
  codeSha256:
    "2989ca232d2ff35b9e355e0716b61aedc8b28aeaafd3ec1bdbc72f0d53afcc10",
  treeSha256:
    "c4695f9483998adfde0870861f55bc7dd0ea53646f2a0592054f3d12a9323a74",
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

type TreeFile = { rel: string; size: number; file: string };

// Every file of the install, refusing a link, a junction or anything not a plain file or folder.
async function treeOf(install: string): Promise<TreeFile[]> {
  const files: TreeFile[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink())
        throw new Error("The Blender install holds a link.");
      if (stat.isDirectory()) await walk(file);
      else if (stat.isFile() && stat.nlink === 1)
        files.push({
          rel: path.relative(install, file).split(path.sep).join("/"),
          size: stat.size,
          file,
        });
      else throw new Error("The Blender install holds a file it should not.");
    }
  };
  await walk(install);
  return files.sort((x, y) => (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0));
}
const digest = (lines: string[]) =>
  createHash("sha256")
    .update(lines.join("\n") + "\n")
    .digest("hex");
const CODE = /\.(exe|dll|pyd)$/i;

/** The three digests of an install (also how the pins above were made). */
export async function blenderTreeDigests(
  install: string,
  which: { code?: boolean; full?: boolean } = { code: true, full: true },
) {
  const files = await treeOf(install);
  const listing = digest(files.map((f) => `${f.rel}\t${f.size}`));
  const hashed = async (list: TreeFile[]) =>
    digest(
      await Promise.all(
        list.map(
          async (f) => `${f.rel}\t${f.size}\t${await sha256File(f.file)}`,
        ),
      ),
    );
  return {
    files: files.length,
    listing,
    code: which.code
      ? await hashed(files.filter((f) => CODE.test(f.rel)))
      : null,
    tree: which.full ? await hashed(files) : null,
  };
}

// When this service last read every byte of the install and found the pinned tree.
let fullyVerifiedAt = 0;
const FULL_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * Checked before every render: the install's files are the pinned listing (nothing added,
 * removed, resized or linked) and the code Windows runs is the pinned bytes. Every byte of the
 * whole tree is read once a day, and on the first render after the service starts. What this does
 * not catch: a same-user process changing a script or data file without changing its size,
 * between two full checks. What it runs then still runs inside the contained worker.
 */
export async function verifyBlenderForRun(
  install: string,
  now = Date.now(),
): Promise<string | null> {
  const full = now - fullyVerifiedAt > FULL_EVERY_MS;
  let found;
  try {
    found = await blenderTreeDigests(install, { code: true, full });
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (found.listing !== BLENDER_PIN.listingSha256)
    return "The Blender install's files are not the pinned build's.";
  if (found.code !== BLENDER_PIN.codeSha256)
    return "The Blender install's programs are not the pinned build's.";
  if (full) {
    if (found.tree !== BLENDER_PIN.treeSha256)
      return "The Blender install's files are not the pinned build's.";
    fullyVerifiedAt = now;
  }
  return null;
}
