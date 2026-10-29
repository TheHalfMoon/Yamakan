import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectMediaRuntimeDirectory,
  mediaPreflight,
} from "../scripts/media-runtime-preflight.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
function fixture(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "media-preflight-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = {
    "ffmpeg.exe": "mpeg",
    "ffprobe.exe": "probe",
    "libtest.dll": "dll",
  };
  for (const [name, value] of Object.entries(files))
    writeFileSync(path.join(dir, name), value);
  writeFileSync(
    path.join(dir, "companions.txt"),
    "# pinned companions\nlibtest.dll\n",
  );
  writeFileSync(
    path.join(dir, "SHA256SUMS"),
    Object.entries(files)
      .map(([name, value]) => `${hash(value)} *${name}`)
      .join("\n"),
  );
  return dir;
}

test("matching executable and companion hashes are ready", (t) => {
  const result = inspectMediaRuntimeDirectory(fixture(t));
  assert.equal(result.valid, true);
  assert.equal(result.files.length, 3);
  assert.deepEqual(result.issues, []);
});

for (const [mode, code] of [
  ["missing", "FILE_UNREADABLE"],
  ["corrupt", "HASH_MISMATCH"],
  ["pointer", "LFS_POINTER"],
]) {
  test(`${mode} companion blocks even when executables are hydrated`, (t) => {
    const dir = fixture(t);
    const file = path.join(dir, "libtest.dll");
    if (mode === "missing") rmSync(file);
    else
      writeFileSync(
        file,
        mode === "pointer"
          ? `version https://git-lfs.github.com/spec/v1\noid sha256:${"a".repeat(64)}\nsize 42\n`
          : "bad dll",
      );
    const result = inspectMediaRuntimeDirectory(dir);
    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some(
        (issue) => issue.code === code && issue.file === "libtest.dll",
      ),
    );
  });
}

for (const name of ["companions.txt", "SHA256SUMS"]) {
  test(`missing ${name} blocks`, (t) => {
    const dir = fixture(t);
    rmSync(path.join(dir, name));
    assert.equal(inspectMediaRuntimeDirectory(dir).valid, false);
  });
}

test("unhashed companion and empty or unsafe manifests block", (t) => {
  const dir = fixture(t);
  for (const contents of [
    "",
    "# no companions",
    "../outside.dll",
    "C:\\outside.dll",
    "libtest.dll:stream",
    "unhashed.dll",
    "libtest.dll\nlibtest.dll",
  ]) {
    writeFileSync(path.join(dir, "companions.txt"), contents);
    assert.equal(inspectMediaRuntimeDirectory(dir).valid, false, contents);
  }
  writeFileSync(path.join(dir, "companions.txt"), "libtest.dll");
  writeFileSync(path.join(dir, "SHA256SUMS"), `${hash("dll")} *../outside.dll`);
  assert.equal(inspectMediaRuntimeDirectory(dir).valid, false);
});

test("selected directories are checked before any version probe", (t) => {
  const dir = fixture(t);
  const other = path.join(dir, "override");
  mkdirSync(other);
  let probes = 0;
  const result = mediaPreflight({
    platform: "win32",
    manifestDirectory: dir,
    resolveTools: () => ({
      ffmpeg: path.join(dir, "ffmpeg.exe"),
      ffprobe: path.join(other, "ffprobe.exe"),
    }),
    recordTool: () => {
      probes++;
      return { present: true, version: "8" };
    },
  });
  assert.equal(result.mediaRuntime.valid, false);
  assert.equal(result.mediaRuntime.directories.length, 2);
  assert.equal(probes, 0);
});

test("resolver errors block without fallback or probing", () => {
  const result = mediaPreflight({
    platform: "win32",
    resolveTools: () => {
      throw new Error("pinned hash mismatch");
    },
    recordTool: () => {
      assert.fail("must not probe");
    },
  });
  assert.equal(result.mediaRuntime.valid, false);
  assert.equal(result.mediaRuntime.issues[0].code, "RESOLUTION_FAILED");
});

test("Linux keeps resolved tools without Windows manifest requirements", () => {
  const seen = [];
  const result = mediaPreflight({
    platform: "linux",
    resolveTools: () => ({ ffmpeg: "/bin/ffmpeg", ffprobe: "/bin/ffprobe" }),
    recordTool: (exe) => {
      seen.push(exe);
      return { present: true, version: "8" };
    },
  });
  assert.deepEqual(seen, ["/bin/ffmpeg", "/bin/ffprobe"]);
  assert.equal(result.mediaRuntime.checked, false);
  assert.equal(result.mediaRuntime.valid, null);
});

test("ready selected tools are probed at their resolved paths", (t) => {
  const dir = fixture(t);
  const selected = {
    ffmpeg: path.join(dir, "ffmpeg.exe"),
    ffprobe: path.join(dir, "ffprobe.exe"),
  };
  const seen = [];
  const result = mediaPreflight({
    platform: "win32",
    manifestDirectory: dir,
    resolveTools: () => selected,
    recordTool: (exe) => {
      seen.push(exe);
      return { present: true, version: "8" };
    },
  });
  assert.equal(result.mediaRuntime.valid, true);
  assert.equal(result.mediaRuntime.directories.length, 1);
  assert.deepEqual(seen, Object.values(selected));
});

for (const renamed of [false, true]) {
  test(`installed runtime uses external pins with renamed EXEs=${renamed}`, (t) => {
    const metadata = fixture(t);
    const installed = path.join(metadata, "installed", "ffmpeg");
    mkdirSync(installed, { recursive: true });
    const selected = {};
    for (const kind of ["ffmpeg", "ffprobe"]) {
      selected[kind] = path.join(
        installed,
        `${renamed ? "alias-" : ""}${kind}.exe`,
      );
      copyFileSync(path.join(metadata, `${kind}.exe`), selected[kind]);
    }
    copyFileSync(
      path.join(metadata, "libtest.dll"),
      path.join(installed, "libtest.dll"),
    );
    const seen = [];
    const result = mediaPreflight({
      platform: "win32",
      manifestDirectory: metadata,
      resolveTools: () => selected,
      recordTool: (exe) => {
        seen.push(exe);
        return { present: true, version: "8" };
      },
    });
    assert.equal(result.mediaRuntime.valid, true);
    assert.deepEqual(seen, Object.values(selected));
    // Selected-directory metadata cannot redefine the repository's pins.
    writeFileSync(path.join(installed, "libtest.dll"), "bad dll");
    writeFileSync(path.join(installed, "companions.txt"), "libtest.dll");
    writeFileSync(
      path.join(installed, "SHA256SUMS"),
      `${hash("bad dll")} *libtest.dll`,
    );
    const invalid = mediaPreflight({
      platform: "win32",
      manifestDirectory: metadata,
      resolveTools: () => selected,
      recordTool: () =>
        assert.fail("corrupt installed runtime must not execute"),
    });
    assert.equal(invalid.mediaRuntime.valid, false);
    assert.ok(
      invalid.mediaRuntime.directories[0].issues.some(
        (issue) => issue.code === "HASH_MISMATCH",
      ),
    );
  });
}

for (const mode of ["modern", "legacy", "bundle"]) {
  test(
    `production resolver preserves ${mode} selection and EXE pins`,
    { skip: process.platform !== "win32" },
    (t) => {
      const dir = fixture(t);
      const keys = [
        "YAMAKAN_FFMPEG",
        "YAMAKAN_FFPROBE",
        "DARZAIN_FFMPEG",
        "DARZAIN_FFPROBE",
        "YAMAKAN_BUNDLE_INSTALL",
        "DARZAIN_BUNDLE_INSTALL",
      ];
      const original = Object.fromEntries(
        keys.map((key) => [key, process.env[key]]),
      );
      t.after(() => {
        for (const key of keys) {
          if (original[key] === undefined) delete process.env[key];
          else process.env[key] = original[key];
        }
      });
      for (const key of keys) delete process.env[key];
      let selectedDir = dir;
      if (mode === "bundle") {
        selectedDir = path.join(dir, "ffmpeg");
        mkdirSync(selectedDir);
        writeFileSync(path.join(selectedDir, "ffmpeg.exe"), "mpeg");
        writeFileSync(path.join(selectedDir, "ffprobe.exe"), "probe");
        process.env.DARZAIN_BUNDLE_INSTALL = dir;
      } else {
        for (const name of ["FFMPEG", "FFPROBE"]) {
          process.env[`DARZAIN_${name}`] =
            mode === "modern"
              ? path.join(dir, "must-not-be-selected.exe")
              : path.join(dir, `${name.toLowerCase()}.exe`);
          if (mode === "modern")
            process.env[`YAMAKAN_${name}`] = path.join(
              dir,
              `${name.toLowerCase()}.exe`,
            );
        }
        process.env.YAMAKAN_BUNDLE_INSTALL = "must-not-be-selected";
      }
      const result = mediaPreflight({
        recordTool: () => assert.fail("fixture bytes must never execute"),
      });
      assert.equal(result.mediaRuntime.valid, false);
      assert.ok(
        result.mediaRuntime.issues[0].detail.includes(
          `ffmpeg at ${path.join(selectedDir, "ffmpeg.exe")} has SHA-256`,
        ),
      );
    },
  );
}
