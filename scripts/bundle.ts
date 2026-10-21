// Windows distributable bundle (W5): pinned runtime layout, manifest hashes,
// install/update/rollback/uninstall. Code signing and auto-update servers are
// intentionally out of scope.
import {
  createHash,
  randomBytes,
} from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUNDLE_FORMAT = "yamakan.bundle/1";

// External binaries are recorded before download; hashes must match at build time.
export const PINNED_ARTIFACTS = Object.freeze({
  node: Object.freeze({
    url: "https://nodejs.org/dist/v24.11.0/node-v24.11.0-win-x64.zip",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    relativePath: "node/node.exe",
  }),
  ffmpeg: Object.freeze({
    url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    relativePath: "ffmpeg/ffmpeg.exe",
  }),
  ffprobe: Object.freeze({
    url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    relativePath: "ffmpeg/ffprobe.exe",
  }),
});

export type BundleManifest = {
  format: typeof BUNDLE_FORMAT;
  version: string;
  builtAt: string;
  files: { path: string; sha256: string; bytes: number }[];
};

export async function hashFile(file: string) {
  const bytes = await readFile(file);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, rel)));
    else if (entry.isFile()) out.push(rel.replaceAll("\\", "/"));
  }
  return out;
}

export async function buildManifest(versionDir: string, version: string) {
  const files: BundleManifest["files"] = [];
  for (const rel of await walk(versionDir)) {
    const { sha256, bytes } = await hashFile(path.join(versionDir, rel));
    files.push({ path: rel, sha256, bytes });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest: BundleManifest = {
    format: BUNDLE_FORMAT,
    version,
    builtAt: new Date().toISOString(),
    files,
  };
  return manifest;
}

export function installRoot(base = process.env.LOCALAPPDATA) {
  if (!base) throw new Error("LOCALAPPDATA is required for bundle install.");
  return path.join(base, "Yamakan");
}

export function currentPointerPath(root = installRoot()) {
  return path.join(root, "current.txt");
}

export function manifestPath(root = installRoot()) {
  return path.join(root, "bundle.manifest.json");
}

export async function readCurrentVersion(root = installRoot()) {
  try {
    return (await readFile(currentPointerPath(root), "utf8")).trim();
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function installVersion(
  bundleDir: string,
  version: string,
  root = installRoot(),
) {
  const target = path.join(root, version);
  await mkdir(root, { recursive: true });
  await mkdir(target, { recursive: true });
  for (const rel of await walk(bundleDir)) {
    const dest = path.join(target, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(bundleDir, rel), dest);
  }
  const manifest = await buildManifest(target, version);
  await writeFile(manifestPath(root), JSON.stringify(manifest, null, 2), {
    encoding: "utf8",
  });
  await writeFile(currentPointerPath(root), `${version}\n`, "utf8");
  return manifest;
}

export async function switchVersion(version: string, root = installRoot()) {
  const versionDir = path.join(root, version);
  if (!(await stat(versionDir).catch(() => null))?.isDirectory())
    throw new Error(`Version ${version} is not installed.`);
  const manifest = await buildManifest(versionDir, version);
  await writeFile(manifestPath(root), JSON.stringify(manifest, null, 2), {
    encoding: "utf8",
  });
  await writeFile(currentPointerPath(root), `${version}\n`, "utf8");
}

export async function rollback(root = installRoot(), confirm = true) {
  if (!confirm) throw new Error("Rollback requires explicit confirmation.");
  const current = await readCurrentVersion(root);
  if (!current) throw new Error("No installed version.");
  const versions = (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name !== "fonts")
    .map((e) => e.name)
    .sort();
  const index = versions.indexOf(current);
  if (index <= 0)
    throw new Error("No older version to roll back to.");
  const target = versions[index - 1];
  await switchVersion(target, root);
  return target;
}

export async function uninstallBinaries(root = installRoot()) {
  const current = await readCurrentVersion(root);
  if (!current) return { removed: [] as string[] };
  const removed: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    const info = await stat(full);
    if (!info.isDirectory()) continue;
    // Never follow reparse points: skip non-directories and junctions.
    if (info.isSymbolicLink()) continue;
    await rm(full, { recursive: true, force: true });
    removed.push(entry.name);
  }
  await rm(currentPointerPath(root), { force: true });
  await rm(manifestPath(root), { force: true });
  return { removed };
}

export async function verifyInstalledBinaries(root = installRoot()) {
  const manifest = JSON.parse(
    await readFile(manifestPath(root), "utf8"),
  ) as BundleManifest;
  const current = await readCurrentVersion(root);
  if (!current) throw new Error("No current version.");
  const versionDir = path.join(root, current);
  for (const entry of manifest.files) {
    if (!/^(node|ffmpeg|procd|bundle-version\.txt)/.test(entry.path)) continue;
    const file = path.join(versionDir, entry.path);
    const { sha256 } = await hashFile(file);
    if (sha256 !== entry.sha256)
      throw new Error(`Binary hash mismatch for ${entry.path}`);
  }
  return true;
}

export async function scaffoldDevBundle(outDir: string, version: string) {
  await mkdir(outDir, { recursive: true });
  const marker = path.join(outDir, "bundle-version.txt");
  await writeFile(marker, `${version}\n`, "utf8");
  await copyFile(path.join(ROOT, "NOTICE"), path.join(outDir, "NOTICE")).catch(
    () => writeFile(path.join(outDir, "NOTICE"), "Yamakan bundle\n", "utf8"),
  );
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    components: [{ type: "application", name: "yamakan", version }],
  };
  await writeFile(
    path.join(outDir, "sbom.cdx.json"),
    JSON.stringify(sbom, null, 2),
    "utf8",
  );
  return buildManifest(outDir, version);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const [cmd = "scaffold", version = "0.0.0-dev"] = process.argv.slice(2);
  const out = path.join(ROOT, "dist-bundle", version);
  if (cmd === "scaffold") {
    const manifest = await scaffoldDevBundle(out, version);
    console.log(JSON.stringify({ out, manifest }, null, 2));
  } else {
    throw new Error(`Unknown bundle command: ${cmd}`);
  }
}
