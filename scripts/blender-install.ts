/**
 * Installs the pinned Blender build for Yamakan's Blender worker, from an official zip the
 * person has downloaded (Yamakan never downloads it itself):
 *
 *   npm run blender:install -- <path to blender-5.3.0-windows-x64.zip>
 *
 * The zip must be the pinned one (SHA-256). It is extracted into yamakan-procd's worker tools
 * folder, where its files inherit the read-and-execute grant the worker container has, and
 * blender.exe is checked against its own pin. Blender's own licence folder comes with it.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import {
  BLENDER_PIN,
  blenderRuntime,
  blenderTreeDigests,
  workerToolsRoot,
} from "../core/blender/runtime.ts";
import { mediaTools, workers } from "../core/process/workers.ts";

const zip = process.argv[2];
if (!zip || !existsSync(zip)) {
  console.error(
    `Usage: npm run blender:install -- <path to ${BLENDER_PIN.zip}>`,
  );
  process.exit(2);
}
if (process.platform !== "win32") {
  console.error("The Blender worker runs only on Windows for now.");
  process.exit(2);
}
const sha256 = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => hash.update(c))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

if ((await sha256(zip)) !== BLENDER_PIN.zipSha256) {
  console.error(
    `${zip} is not the pinned ${BLENDER_PIN.zip}; nothing was installed.`,
  );
  process.exit(1);
}
const root = workerToolsRoot();
if (!root) throw new Error("LOCALAPPDATA is not set.");
// The tools folder's grant reaches only files made after it is set: let procd set it first,
// by running one contained worker, before anything is extracted.
const grant = await workers().run({
  executable: mediaTools().ffprobe,
  args: ["-version"],
  cwd: root,
});
if (grant.code !== 0) {
  console.error(
    "The worker tools folder could not be prepared; nothing was installed.",
  );
  process.exit(1);
}
mkdirSync(root, { recursive: true });
const target = path.join(root, BLENDER_PIN.folder);
const staging = path.join(root, `${BLENDER_PIN.folder}.partial-${process.pid}`);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
try {
  // Windows' own tar reads zip files. The debug symbols (about 96 MB) are not needed.
  execFileSync(
    path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"),
    ["-xf", zip, "-C", staging, "--exclude", "*/blender.pdb"],
    { stdio: "inherit", windowsHide: true },
  );
  const inner = path.join(staging, BLENDER_PIN.zip.replace(/\.zip$/, ""));
  if (!existsSync(path.join(inner, "blender.exe")))
    throw new Error("The zip did not hold the expected folder.");
  // Every byte of the new copy is the pinned build's before it takes the old one's place.
  const found = await blenderTreeDigests(inner);
  if (
    found.listing !== BLENDER_PIN.listingSha256 ||
    found.code !== BLENDER_PIN.codeSha256 ||
    found.tree !== BLENDER_PIN.treeSha256
  )
    throw new Error("The extracted files are not the pinned build's.");
  // An old copy is set aside, not deleted where a render may be using it.
  if (existsSync(target)) {
    const aside = `${target}.old-${Date.now()}`;
    renameSync(target, aside);
    try {
      rmSync(aside, { recursive: true, force: true });
    } catch {
      console.warn(`An old copy is in use and was left at ${aside}.`);
    }
  }
  renameSync(inner, target);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
const runtime = await blenderRuntime();
if (!runtime.available) {
  console.error(runtime.message);
  process.exit(1);
}
console.log(
  `Installed Blender ${BLENDER_PIN.version} for Yamakan at ${runtime.install}`,
);
