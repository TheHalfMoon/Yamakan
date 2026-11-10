import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  VENDOR_FFMPEG_DIR,
  assertCompanionsPinned,
} from "../core/process/workers.ts";

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const sha = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");

// A small stand-in for the vendored folder: two files, their list, and the list's pin.
function folder(
  files: Record<string, string> = { "a.dll": "A", "b.exe": "B" },
) {
  const dir = mkdtempSync(path.join(tmpdir(), "yamakan-companions-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files))
    writeFileSync(path.join(dir, name), body);
  const sums = Object.entries(files)
    .map(([name, body]) => `${sha(body)} *${name}\n`)
    .join("");
  writeFileSync(path.join(dir, "SHA256SUMS"), sums);
  return { dir, pin: sha(sums) };
}

test(
  "the vendored FFmpeg's DLLs are the pinned build",
  { skip: process.platform !== "win32" && "the vendored build is Windows'" },
  () => {
    assert.doesNotThrow(() => assertCompanionsPinned(VENDOR_FFMPEG_DIR));
  },
);

test("a folder whose files match their pinned list passes", () => {
  const { dir, pin } = folder();
  assert.doesNotThrow(() => assertCompanionsPinned(dir, pin));
});

test("a DLL changed after the list was made is refused", () => {
  const { dir, pin } = folder();
  writeFileSync(path.join(dir, "a.dll"), "changed");
  assert.throws(
    () => assertCompanionsPinned(dir, pin),
    /a\.dll is not the pinned build/,
  );
});

// Windows loads a DLL beside the executable before the system's: one planted there is refused.
test("a DLL the list does not name is refused", () => {
  const { dir, pin } = folder();
  writeFileSync(path.join(dir, "version.dll"), "planted");
  assert.throws(
    () => assertCompanionsPinned(dir, pin),
    /version\.dll is not part of the pinned build/,
  );
});

test("a list that is not the pinned one is refused, however it reads", () => {
  const { dir } = folder();
  writeFileSync(path.join(dir, "a.dll"), "changed");
  writeFileSync(
    path.join(dir, "SHA256SUMS"),
    `${sha("changed")} *a.dll\n${sha("B")} *b.exe\n`,
  );
  assert.throws(
    () =>
      assertCompanionsPinned(
        dir,
        sha(`${sha("A")} *a.dll\n${sha("B")} *b.exe\n`),
      ),
    /not the pinned list/,
  );
});

test("a missing file, a missing list, or a name with a folder in it is refused", () => {
  const missing = folder();
  rmSync(path.join(missing.dir, "a.dll"));
  assert.throws(
    () => assertCompanionsPinned(missing.dir, missing.pin),
    /a\.dll is missing/,
  );
  const nolist = folder();
  rmSync(path.join(nolist.dir, "SHA256SUMS"));
  assert.throws(
    () => assertCompanionsPinned(nolist.dir, nolist.pin),
    /SHA256SUMS is missing/,
  );
  const dir = mkdtempSync(path.join(tmpdir(), "yamakan-companions-"));
  dirs.push(dir);
  const sums = `${sha("x")} *../outside.dll\n`;
  writeFileSync(path.join(dir, "SHA256SUMS"), sums);
  assert.throws(
    () => assertCompanionsPinned(dir, sha(sums)),
    /a line it should not/,
  );
});

// GitHub's Windows runners check text out with CRLF line ends unless told otherwise.
test("a list checked out with CRLF line ends is the same list", () => {
  const { dir, pin } = folder();
  const file = path.join(dir, "SHA256SUMS");
  writeFileSync(file, readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
  assert.doesNotThrow(() => assertCompanionsPinned(dir, pin));
});
