// Windows distributable bundle (W5): pinned runtime layout, manifest hashes,
// install/update/rollback/uninstall. Code signing and auto-update servers are
// intentionally out of scope.
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mediaTools } from "../core/process/workers.ts";
import { TITLE_FONT } from "../core/render/fonts.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUNDLE_FORMAT = "yamakan.bundle/1";

export type PinnedBinary = {
  sourcePath: string;
  relativePath: string;
  sha256: string;
  bytes: number;
};

export type BundleManifest = {
  format: typeof BUNDLE_FORMAT;
  version: string;
  builtAt: string;
  pinned: {
    node: PinnedBinary;
    ffmpeg: PinnedBinary;
    ffprobe: PinnedBinary;
  };
  files: { path: string; sha256: string; bytes: number }[];
};

export async function hashFile(file: string) {
  const bytes = await readFile(file);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

export async function resolvePinnedNode(): Promise<PinnedBinary> {
  const sourcePath = process.execPath;
  const hashed = await hashFile(sourcePath);
  return {
    sourcePath,
    relativePath: "node/node.exe",
    ...hashed,
  };
}

export async function resolvePinnedMediaTools(): Promise<{
  node: PinnedBinary;
  ffmpeg: PinnedBinary;
  ffprobe: PinnedBinary;
}> {
  const tools = mediaTools();
  const node = await resolvePinnedNode();
  const ffmpeg = await hashFile(tools.ffmpeg);
  const ffprobe = await hashFile(tools.ffprobe);
  return {
    node,
    ffmpeg: {
      sourcePath: tools.ffmpeg,
      relativePath: "ffmpeg/ffmpeg.exe",
      ...ffmpeg,
    },
    ffprobe: {
      sourcePath: tools.ffprobe,
      relativePath: "ffmpeg/ffprobe.exe",
      ...ffprobe,
    },
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

export async function buildManifest(
  versionDir: string,
  version: string,
  pinned: {
    node: PinnedBinary;
    ffmpeg: PinnedBinary;
    ffprobe: PinnedBinary;
  },
) {
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
    pinned,
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
  const manifestOnDisk = JSON.parse(
    await readFile(path.join(bundleDir, "bundle.manifest.json"), "utf8"),
  ) as BundleManifest;
  await writeFile(manifestPath(root), JSON.stringify(manifestOnDisk, null, 2), {
    encoding: "utf8",
  });
  await writeFile(currentPointerPath(root), `${version}\n`, "utf8");
  return manifestOnDisk;
}

export async function switchVersion(version: string, root = installRoot()) {
  const versionDir = path.join(root, version);
  if (!(await stat(versionDir).catch(() => null))?.isDirectory())
    throw new Error(`Version ${version} is not installed.`);
  const manifest = JSON.parse(
    await readFile(path.join(versionDir, "bundle.manifest.json"), "utf8"),
  ) as BundleManifest;
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
  if (index <= 0) throw new Error("No older version to roll back to.");
  const target = versions[index - 1];
  await switchVersion(target, root);
  return target;
}

// Removes a version tree without following junctions or symlinks (W5).
async function removeInstallTree(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) {
      await unlink(full);
      continue;
    }
    if (info.isDirectory()) await removeInstallTree(full);
    else await unlink(full);
  }
  await rmdir(dir);
}

export async function uninstallBinaries(root = installRoot()) {
  const current = await readCurrentVersion(root);
  if (!current) return { removed: [] as string[] };
  const removed: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) continue;
    if (!info.isDirectory()) continue;
    await removeInstallTree(full);
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
    if (!/^(node|ffmpeg|procd|bundle-version\.txt|fonts\/)/.test(entry.path))
      continue;
    const file = path.join(versionDir, entry.path);
    const { sha256 } = await hashFile(file);
    if (sha256 !== entry.sha256)
      throw new Error(`Binary hash mismatch for ${entry.path}`);
  }
  return true;
}

async function sbomFromPackageLock(version: string) {
  const lock = JSON.parse(
    await readFile(path.join(ROOT, "package-lock.json"), "utf8"),
  ) as {
    packages?: Record<
      string,
      { version?: string; license?: string; name?: string }
    >;
  };
  const components: {
    type: string;
    name: string;
    version: string;
    purl?: string;
  }[] = [
    {
      type: "application",
      name: "yamakan",
      version,
      purl: `pkg:npm/yamakan@${version}`,
    },
  ];
  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (!pkgPath || !meta.version) continue;
    const name = pkgPath.replace(/^node_modules\//, "");
    if (name === "") continue;
    components.push({
      type: "library",
      name,
      version: meta.version,
      purl: `pkg:npm/${name}@${meta.version}`,
    });
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "yamakan",
        version,
      },
    },
    components,
  };
}

async function copyPinnedFonts(outDir: string) {
  for (const font of TITLE_FONT.files) {
    const dest = path.join(outDir, "fonts", path.basename(font.file));
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(ROOT, font.file), dest);
  }
}

async function copyPinnedNode(outDir: string, pinned: PinnedBinary) {
  await mkdir(path.join(outDir, "node"), { recursive: true });
  await copyFile(pinned.sourcePath, path.join(outDir, pinned.relativePath));
}

async function copyPinnedMedia(
  outDir: string,
  pinned: {
    node: PinnedBinary;
    ffmpeg: PinnedBinary;
    ffprobe: PinnedBinary;
  },
) {
  await copyPinnedNode(outDir, pinned.node);
  await mkdir(path.join(outDir, "ffmpeg"), { recursive: true });
  await copyFile(
    pinned.ffmpeg.sourcePath,
    path.join(outDir, pinned.ffmpeg.relativePath),
  );
  await copyFile(
    pinned.ffprobe.sourcePath,
    path.join(outDir, pinned.ffprobe.relativePath),
  );
}

export async function scaffoldDevBundle(outDir: string, version: string) {
  await mkdir(outDir, { recursive: true });
  const pinned = await resolvePinnedMediaTools();
  await copyPinnedMedia(outDir, pinned);
  await copyPinnedFonts(outDir);
  const marker = path.join(outDir, "bundle-version.txt");
  await writeFile(marker, `${version}\n`, "utf8");
  await copyFile(path.join(ROOT, "NOTICE"), path.join(outDir, "NOTICE")).catch(
    () => writeFile(path.join(outDir, "NOTICE"), "Yamakan bundle\n", "utf8"),
  );
  const sbom = await sbomFromPackageLock(version);
  await writeFile(
    path.join(outDir, "sbom.cdx.json"),
    JSON.stringify(sbom, null, 2),
    "utf8",
  );
  const manifest = await buildManifest(outDir, version, pinned);
  await writeFile(
    path.join(outDir, "bundle.manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  return manifest;
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
