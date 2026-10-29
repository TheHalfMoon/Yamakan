/** Read-only development preflight; this does not qualify sandboxed execution. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const vendorDirectory = fileURLToPath(
  new URL("../vendor/ffmpeg-win64-r8/", import.meta.url),
);

const leaf = (name) => /^[a-z0-9][a-z0-9+_.-]*$/i.test(name);
const lines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

export function inspectMediaRuntimeDirectory(
  directory,
  executables = { "ffmpeg.exe": "ffmpeg.exe", "ffprobe.exe": "ffprobe.exe" },
  manifestDirectory = directory,
) {
  const issues = [];
  const files = [];
  const result = () => ({
    directory,
    manifestDirectory,
    valid: issues.length === 0,
    files,
    issues,
  });
  let names;
  const sums = new Map();
  try {
    // Adapt bundle.ts's companions.txt / SHA256SUMS contract, but fail closed
    // when trusted metadata is absent. Installed bundles copy only binaries,
    // so metadata may live outside the selected executable directory.
    names = lines(
      readFileSync(path.join(manifestDirectory, "companions.txt"), "utf8"),
    );
    if (
      !names.length ||
      names.length > 128 ||
      new Set(names.map((name) => name.toLowerCase())).size !== names.length ||
      names.some((name) => !leaf(name) || !name.toLowerCase().endsWith(".dll"))
    ) {
      throw new Error("companions.txt must list unique DLL leaf names");
    }
    for (const line of lines(
      readFileSync(path.join(manifestDirectory, "SHA256SUMS"), "utf8"),
    )) {
      const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line);
      const name = match?.[2].replace(/^\.\//, "");
      if (!match || !leaf(name) || sums.has(name.toLowerCase()))
        throw new Error("invalid or duplicate SHA256SUMS entry");
      sums.set(name.toLowerCase(), match[1].toLowerCase());
    }
    const listed = new Set(names.map((name) => name.toLowerCase()));
    if (
      [...sums.keys()].some(
        (name) => name.endsWith(".dll") && !listed.has(name),
      )
    )
      throw new Error("SHA256SUMS DLL omitted from companions.txt");
  } catch (error) {
    issues.push({ code: "MANIFEST_INVALID", detail: error.message });
    return result();
  }
  for (const [pinName, file] of [
    ...Object.entries(executables),
    ...names.map((name) => [name, name]),
  ]) {
    const expected = sums.get(pinName.toLowerCase());
    if (!expected || !leaf(file)) {
      issues.push({ code: "HASH_MISSING", file });
      continue;
    }
    try {
      const filename = path.join(directory, file);
      if (!lstatSync(filename).isFile()) throw new Error("not a regular file");
      const data = readFileSync(filename);
      const actual = createHash("sha256").update(data).digest("hex");
      files.push({ file, expected, actual });
      if (
        data
          .subarray(0, 128)
          .toString("utf8")
          .startsWith("version https://git-lfs.github.com/spec/v1")
      ) {
        issues.push({ code: "LFS_POINTER", file });
      } else if (actual !== expected)
        issues.push({ code: "HASH_MISMATCH", file });
    } catch (error) {
      issues.push({ code: "FILE_UNREADABLE", file, detail: error.message });
    }
  }
  return result();
}

export function mediaPreflight({
  platform = process.platform,
  // Lazy loading also lets a missing production dependency become BLOCKED
  // evidence instead of aborting the qualification module at import time.
  resolveTools = () => require("../core/process/workers.ts").mediaTools(),
  manifestDirectory = vendorDirectory,
  recordTool,
}) {
  const mediaRuntime = {
    checked: platform === "win32",
    valid: null,
    directories: [],
    issues: [],
  };
  let selected;
  try {
    // Reuse production precedence, legacy aliases, and Windows EXE hard pins.
    // Resolving does not spawn a worker or execute either binary.
    selected = resolveTools();
    if (platform === "win32") {
      const directories = new Map();
      for (const [kind, exe] of Object.entries(selected)) {
        const directory = path.dirname(exe);
        const entries = directories.get(directory) || {};
        entries[`${kind}.exe`] = path.basename(exe);
        directories.set(directory, entries);
      }
      mediaRuntime.directories = [...directories].map(([directory, entries]) =>
        inspectMediaRuntimeDirectory(directory, entries, manifestDirectory),
      );
      mediaRuntime.valid = mediaRuntime.directories.every(
        (entry) => entry.valid,
      );
    }
  } catch (error) {
    mediaRuntime.checked = true;
    mediaRuntime.valid = false;
    mediaRuntime.issues.push({
      code: "RESOLUTION_FAILED",
      detail: error.message,
    });
  }
  const blocked = { present: false, version: null };
  return {
    mediaRuntime,
    ffmpeg:
      mediaRuntime.valid === false ? blocked : recordTool(selected.ffmpeg),
    ffprobe:
      mediaRuntime.valid === false ? blocked : recordTool(selected.ffprobe),
  };
}
