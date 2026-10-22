// Windows distributable bundle (W5): pinned runtime layout, manifest hashes,
// install/update/rollback/uninstall. Code signing and auto-update servers are
// intentionally out of scope.
//
// P10-08 residual: unsigned RC packaging (zip + per-user test install root) is
// allowed for internal/test use. It is NOT a release installer, NOT signed,
// and must NOT claim Profile A or public ship.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mediaTools } from "../core/process/workers.ts";
import { TITLE_FONT } from "../core/render/fonts.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUNDLE_FORMAT = "yamakan.bundle/1";
/** Marker file name written into every unsigned RC artifact. */
export const UNSIGNED_RC_MARKER = "UNSIGNED-RC.txt";
/** Default per-user test root — distinct from production installRoot(). */
export const UNSIGNED_RC_INSTALL_DIRNAME = "Yamakan-unsigned-rc";

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

// W5/R6: pinned Windows FFmpeg (R8/Q3). In-repo vendor pin from
// scripts/vendor/build-ffmpeg-win64-r8-msys2.sh (fontconfig, no DirectWrite).
export const EXTERNAL_BINARY_PINS = {
  ffmpeg: {
    url: "vendor/ffmpeg-win64-r8/ffmpeg.exe",
    sha256: "9378168c8ab648d25156001910c1f25ccee4c989b731f94ceaa1972ef1f5bb6b",
  },
  ffprobe: {
    url: "vendor/ffmpeg-win64-r8/ffprobe.exe",
    sha256: "fd9bb26feba6b9e3e6484d9fea622b425d82cb5c229b6d0f3bab3af7f4917171",
  },
  node: null as { url: string; sha256: string } | null,
};

export async function resolvePinnedMediaTools(): Promise<{
  node: PinnedBinary;
  ffmpeg: PinnedBinary;
  ffprobe: PinnedBinary;
}> {
  const tools = mediaTools();
  const node = await resolvePinnedNode();
  const ffmpeg = await hashFile(tools.ffmpeg);
  const ffprobe = await hashFile(tools.ffprobe);
  // R8 pin is Windows-only; Linux CI scaffolds against apt FFmpeg.
  if (process.platform === "win32") {
    if (
      EXTERNAL_BINARY_PINS.ffmpeg &&
      ffmpeg.sha256 !== EXTERNAL_BINARY_PINS.ffmpeg.sha256
    ) {
      throw new Error(
        `Bundle FFmpeg SHA-256 ${ffmpeg.sha256} does not match EXTERNAL_BINARY_PINS (${EXTERNAL_BINARY_PINS.ffmpeg.sha256}). Use the R8 vendor pin.`,
      );
    }
    if (
      EXTERNAL_BINARY_PINS.ffprobe &&
      ffprobe.sha256 !== EXTERNAL_BINARY_PINS.ffprobe.sha256
    ) {
      throw new Error(
        `Bundle ffprobe SHA-256 ${ffprobe.sha256} does not match EXTERNAL_BINARY_PINS (${EXTERNAL_BINARY_PINS.ffprobe.sha256}). Use the R8 vendor pin.`,
      );
    }
  }
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
  const ffmpegDir = path.join(outDir, "ffmpeg");
  await mkdir(ffmpegDir, { recursive: true });
  await copyFile(
    pinned.ffmpeg.sourcePath,
    path.join(outDir, pinned.ffmpeg.relativePath),
  );
  await copyFile(
    pinned.ffprobe.sourcePath,
    path.join(outDir, pinned.ffprobe.relativePath),
  );
  // Companion DLLs for the R8 mingw64 pin (loaded from the exe directory).
  // Only the allowlisted set in companions.txt, each hash-checked vs SHA256SUMS.
  if (process.platform === "win32") {
    await copyPinnedCompanions(
      path.dirname(pinned.ffmpeg.sourcePath),
      ffmpegDir,
    );
  }
}

async function readSha256Sums(dir: string) {
  const text = await readFile(path.join(dir, "SHA256SUMS"), "utf8");
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m) map.set(m[2].replace(/^\.\//, ""), m[1].toLowerCase());
  }
  return map;
}

async function copyPinnedCompanions(vendorDir: string, destDir: string) {
  const listPath = path.join(vendorDir, "companions.txt");
  if (!existsSync(listPath)) return;
  const sums = await readSha256Sums(vendorDir);
  const names = (await readFile(listPath, "utf8"))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const name of names) {
    const src = path.join(vendorDir, name);
    const expected = sums.get(name);
    if (!expected) throw new Error(`Companion ${name} missing from SHA256SUMS`);
    const { sha256 } = await hashFile(src);
    if (sha256 !== expected)
      throw new Error(`Companion ${name} SHA-256 ${sha256} != pin ${expected}`);
    await copyFile(src, path.join(destDir, name));
  }
}

export async function installDevBundle(version: string, root = installRoot()) {
  const staging = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-stage-"));
  try {
    await scaffoldDevBundle(staging, version);
    return await installVersion(staging, version, root);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
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

export function unsignedRcInstallRoot(base = process.env.LOCALAPPDATA) {
  if (!base) throw new Error("LOCALAPPDATA is required for unsigned RC install.");
  return path.join(base, UNSIGNED_RC_INSTALL_DIRNAME);
}

/** Refuse admin/system install locations for unsigned RC test installs. */
export function assertSafeUnsignedRcInstallRoot(root: string) {
  const resolved = path.resolve(root);
  const lower = resolved.toLowerCase();
  const blocked = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.ProgramW6432,
    process.env.SystemRoot,
    process.env.windir,
  ]
    .filter(Boolean)
    .map((p) => path.resolve(p!).toLowerCase());
  for (const prefix of blocked) {
    if (lower === prefix || lower.startsWith(prefix + path.sep)) {
      throw new Error(
        `Unsigned RC install root must not be under a protected system path (${prefix}). Use a per-user test root such as %LOCALAPPDATA%\\${UNSIGNED_RC_INSTALL_DIRNAME}.`,
      );
    }
  }
  return resolved;
}

export type UnsignedRcArtifact = {
  kind: "unsigned-rc";
  version: string;
  layoutDir: string;
  zipPath: string | null;
  manifest: BundleManifest;
  claims: {
    release: false;
    signed: false;
    profileA: false;
  };
};

async function writeUnsignedRcMarker(outDir: string, version: string) {
  const body = [
    "Yamakan UNSIGNED release-candidate (RC) bundle artifact",
    "",
    "This is NOT a public release. It is NOT code-signed.",
    "Do not claim Profile A or a ship decision from this artifact.",
    `version: ${version}`,
    `format: ${BUNDLE_FORMAT}`,
    `builtAt: ${new Date().toISOString()}`,
    "",
  ].join("\n");
  await writeFile(path.join(outDir, UNSIGNED_RC_MARKER), body, "utf8");
}

function zipUnsignedRcLayout(layoutDir: string, zipPath: string) {
  if (process.platform !== "win32") {
    throw new Error("ZIP packaging for unsigned RC is Windows-only (PowerShell Compress-Archive).");
  }
  if (existsSync(zipPath)) {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Remove-Item -LiteralPath ${JSON.stringify(zipPath)} -Force`],
      { windowsHide: true },
    );
  }
  // Compress contents (not the parent folder name) so Expand-Archive yields the layout files.
  const ps = `
    $ErrorActionPreference = 'Stop'
    Compress-Archive -Path (Join-Path ${JSON.stringify(layoutDir)} '*') -DestinationPath ${JSON.stringify(zipPath)} -Force
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    windowsHide: true,
  });
}

export async function extractUnsignedRcZip(
  zipPath: string,
  destDir: string,
): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("Unsigned RC ZIP extract is Windows-only (PowerShell Expand-Archive).");
  }
  await mkdir(destDir, { recursive: true });
  const ps = `
    $ErrorActionPreference = 'Stop'
    Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(destDir)} -Force
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    windowsHide: true,
  });
  return destDir;
}

/**
 * Pack an unsigned RC artifact from the existing scaffold layout/manifest.
 * Produces a directory under dist-unsigned-rc/<version>/layout and, on Windows, a ZIP.
 */
export async function packUnsignedRc(
  version: string,
  outBase = path.join(ROOT, "dist-unsigned-rc", version),
): Promise<UnsignedRcArtifact> {
  const layoutDir = path.join(outBase, "layout");
  await rm(outBase, { recursive: true, force: true });
  await mkdir(layoutDir, { recursive: true });
  const scaffolded = await scaffoldDevBundle(layoutDir, version);
  await writeUnsignedRcMarker(layoutDir, version);
  // Drop scaffold manifest, rebuild so UNSIGNED-RC.txt is in files[] and
  // bundle.manifest.json itself is written after the walk (same as scaffold).
  await rm(path.join(layoutDir, "bundle.manifest.json"), { force: true });
  const pinned = {
    node: scaffolded.pinned.node,
    ffmpeg: scaffolded.pinned.ffmpeg,
    ffprobe: scaffolded.pinned.ffprobe,
  };
  const withMarker = await buildManifest(layoutDir, version, pinned);
  await writeFile(
    path.join(layoutDir, "bundle.manifest.json"),
    JSON.stringify(withMarker, null, 2),
    "utf8",
  );
  let zipPath: string | null = null;
  if (process.platform === "win32") {
    zipPath = path.join(outBase, `yamakan-unsigned-rc-${version}.zip`);
    zipUnsignedRcLayout(layoutDir, zipPath);
  }
  return {
    kind: "unsigned-rc",
    version,
    layoutDir,
    zipPath,
    manifest: withMarker,
    claims: { release: false, signed: false, profileA: false },
  };
}

export async function installUnsignedRcFromLayout(
  layoutDir: string,
  version: string,
  root: string,
) {
  assertSafeUnsignedRcInstallRoot(root);
  const marker = path.join(layoutDir, UNSIGNED_RC_MARKER);
  if (!existsSync(marker)) {
    throw new Error(
      `Refusing install: missing ${UNSIGNED_RC_MARKER}. Use pack-unsigned-rc artifacts only.`,
    );
  }
  return installVersion(layoutDir, version, root);
}

/** Install from a packed ZIP into a safe test root (Windows). */
export async function installUnsignedRcFromZip(
  zipPath: string,
  version: string,
  root: string,
) {
  assertSafeUnsignedRcInstallRoot(root);
  const extractRoot = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-extract-"),
  );
  try {
    await extractUnsignedRcZip(zipPath, extractRoot);
    return await installUnsignedRcFromLayout(extractRoot, version, root);
  } finally {
    await rm(extractRoot, { recursive: true, force: true });
  }
}

/** Same check server/main.ts runs when YAMAKAN_BUNDLE_INSTALL is set. */
export async function launchVerifyUnsignedRc(root: string) {
  assertSafeUnsignedRcInstallRoot(root);
  return verifyInstalledBinaries(root);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const [cmd = "scaffold", version = "0.0.0-dev", ...rest] =
    process.argv.slice(2);
  const out = path.join(ROOT, "dist-bundle", version);
  if (cmd === "scaffold") {
    const manifest = await scaffoldDevBundle(out, version);
    console.log(JSON.stringify({ out, manifest }, null, 2));
  } else if (cmd === "install-dev") {
    const manifest = await installDevBundle(version);
    console.log(
      JSON.stringify(
        {
          installRoot: installRoot(),
          version,
          manifest,
          launchHint:
            "Set YAMAKAN_BUNDLE_INSTALL to the install root before npm start to verify pinned binaries at launch.",
        },
        null,
        2,
      ),
    );
  } else if (cmd === "pack-unsigned-rc") {
    const rcVersion = version.includes("unsigned")
      ? version
      : `${version}-unsigned-rc`;
    const artifact = await packUnsignedRc(rcVersion);
    console.log(JSON.stringify(artifact, null, 2));
  } else if (cmd === "install-unsigned-rc") {
    const layoutOrZip = rest[0];
    const root = rest[1] || unsignedRcInstallRoot();
    if (!layoutOrZip) {
      throw new Error(
        "Usage: bundle.ts install-unsigned-rc <version> <layoutDir|zipPath> [installRoot]",
      );
    }
    const rcVersion = version.includes("unsigned")
      ? version
      : `${version}-unsigned-rc`;
    const st = await stat(layoutOrZip);
    const manifest = st.isDirectory()
      ? await installUnsignedRcFromLayout(layoutOrZip, rcVersion, root)
      : await installUnsignedRcFromZip(layoutOrZip, rcVersion, root);
    console.log(
      JSON.stringify(
        {
          kind: "unsigned-rc",
          installRoot: path.resolve(root),
          version: rcVersion,
          claims: { release: false, signed: false, profileA: false },
          manifest,
          launchHint:
            "Set YAMAKAN_BUNDLE_INSTALL to the unsigned RC install root before npm start.",
        },
        null,
        2,
      ),
    );
  } else {
    throw new Error(`Unknown bundle command: ${cmd}`);
  }
}
