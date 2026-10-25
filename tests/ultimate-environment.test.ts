import assert from "node:assert/strict";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { ENVIRONMENT_FORMAT, REQUIRED_SCRIPTS, evaluateEnvironment, lockfileDrift, redactLocalPaths, satisfiesNodeEngine, scriptOutcome } from "../scripts/ultimate-environment.mjs";

const present = { present: true, sha256: "a".repeat(64), version: "8.1.1" };

test("environment format and required scripts are explicit", () => {
  assert.equal(ENVIRONMENT_FORMAT, "yamakan.ultimate-environment/v1");
  assert.deepEqual(REQUIRED_SCRIPTS, [
    "typecheck",
    "lint",
    "format:check",
    "test",
    "build",
    "provenance:check",
    "brand:check",
    "test:e2e",
  ]);
});

test("missing dependency produces BLOCKED, never pass", () => {
  const result = evaluateEnvironment({
    dependency: { present: false, name: "zod" },
    helper: present,
    ffmpeg: present,
    ffprobe: present,
    disk: { freeBytes: 8 * 1024 ** 3, reserveBytes: 2 * 1024 ** 3 },
    scripts: [],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.pass, false);
  assert.ok(
    result.blockers.some(
      (b: { code: string }) => b.code === "DEPENDENCY_MISSING",
    ),
  );
});

test("missing native helper produces BLOCKED, never pass", () => {
  const result = evaluateEnvironment({
    dependency: { present: true, name: "zod" },
    helper: { present: false },
    ffmpeg: present,
    ffprobe: present,
    disk: { freeBytes: 8 * 1024 ** 3, reserveBytes: 2 * 1024 ** 3 },
    scripts: [{ name: "test", exitCode: 0 }],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.pass, false);
  assert.ok(
    result.blockers.some(
      (b: { code: string }) => b.code === "NATIVE_HELPER_MISSING",
    ),
  );
});

test("missing FFmpeg produces BLOCKED, never pass", () => {
  const result = evaluateEnvironment({
    dependency: { present: true, name: "zod" },
    helper: present,
    ffmpeg: { present: false },
    ffprobe: present,
    disk: { freeBytes: 8 * 1024 ** 3, reserveBytes: 2 * 1024 ** 3 },
    scripts: [],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.pass, false);
  assert.ok(
    result.blockers.some((b: { code: string }) => b.code === "FFMPEG_MISSING"),
  );
});

test("failures and skips are retained with reason", () => {
  const failed = scriptOutcome({
    name: "test",
    exitCode: 1,
    logPath: "work/ultimate/test.log",
  });
  const skipped = scriptOutcome({
    name: "test:e2e",
    skipped: true,
    reason: "Edge channel unavailable",
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.pass, false);
  assert.equal(failed.exitCode, 1);
  assert.equal(skipped.status, "SKIPPED");
  assert.equal(skipped.pass, false);
  assert.equal(skipped.reason, "Edge channel unavailable");
  const result = evaluateEnvironment({
    dependency: { present: true, name: "zod" },
    helper: present,
    ffmpeg: present,
    ffprobe: present,
    disk: { freeBytes: 8 * 1024 ** 3, reserveBytes: 2 * 1024 ** 3 },
    scripts: [failed, skipped],
  });
  assert.equal(result.pass, false);
  assert.equal(result.status, "RECORDED_WITH_FAILURES");
  assert.equal(result.scripts[0].status, "FAILED");
  assert.equal(result.scripts[1].status, "SKIPPED");
  assert.equal(result.scripts[1].reason, "Edge channel unavailable");
});

test("low disk reserve aborts as BLOCKED", () => {
  const result = evaluateEnvironment({
    dependency: { present: true, name: "zod" },
    helper: present,
    ffmpeg: present,
    ffprobe: present,
    disk: { freeBytes: 100, reserveBytes: 2 * 1024 ** 3 },
    scripts: [],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.pass, false);
  assert.ok(
    result.blockers.some((b: { code: string }) => b.code === "DISK_RESERVE"),
  );
});

test("public evidence redacts the worktree and profile folders", () => {
  const sep = String.fromCharCode(92);
  const win = (...parts: string[]) => parts.join(sep);
  const out = redactLocalPaths(
    {
      log: win("C:", "Users", "Dev", "Yamakan-yu", "work", "x.log"),
      tools: ["c:/users/dev/AppData/ffmpeg.exe"],
      other: win("C:", "Users", "Dev2", "x"),
      count: 3,
    },
    [
      { path: win("C:", "Users", "Dev", "Yamakan-yu"), label: "<repo>" },
      { path: win("C:", "Users", "Dev"), label: "~" },
    ],
  );
  assert.equal(out.log, `<repo>${sep}work${sep}x.log`);
  assert.deepEqual(out.tools, ["~/AppData/ffmpeg.exe"]);
  assert.equal(out.count, 3);
  // A sibling account whose name merely starts with the same text is a
  // different folder; only a whole-segment match may be replaced.
  assert.equal(out.other, win("C:", "Users", "Dev2", "x"));
});

test("a redirected worker tools cache is BLOCKED, never pass", () => {
  const result = evaluateEnvironment({
    dependency: { present: true, name: "zod" },
    helper: present,
    ffmpeg: present,
    ffprobe: present,
    workerTools: { checked: true, exists: true, redirected: true },
    scripts: [{ name: "test", exitCode: 0 }],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.pass, false);
  assert.ok(
    result.blockers.some(
      (b: { code: string }) => b.code === "WORKER_TOOLS_REDIRECTED",
    ),
  );
});

test("lockfile drift lists missing and mismatched packages only", () => {
  const files: Record<string, unknown> = {
    "r/package-lock.json": {
      packages: {
        "": { name: "app" },
        "node_modules/a": { version: "1.0.0" },
        "node_modules/b": { version: "2.0.0" },
        "node_modules/c": { version: "3.0.0" },
        "node_modules/mac-only": {
          version: "1.0.0",
          optional: true,
          os: ["darwin"],
        },
        "node_modules/arm-only": {
          version: "1.0.0",
          optional: true,
          os: ["win32"],
          cpu: ["arm64"],
        },
      },
    },
    "r/node_modules/a/package.json": { version: "1.0.0" },
    "r/node_modules/b/package.json": { version: "1.9.0" },
  };
  const read = (file: string) => files[file] ?? null;
  const result = lockfileDrift("r", read, "win32", "x64");
  assert.equal(result.checked, 3);
  assert.deepEqual(result.drift, [
    { package: "node_modules/b", pinned: "2.0.0", installed: "1.9.0" },
    { package: "node_modules/c", pinned: "3.0.0", installed: null },
  ]);
});

const ready = {
  dependency: { present: true, name: "zod" },
  helper: present,
  ffmpeg: present,
  ffprobe: present,
  disk: { freeBytes: 10 * 1024 ** 3 },
};
const all = (exitCode = 0) =>
  REQUIRED_SCRIPTS.map((name: string) => ({ name, exitCode }));

test("all required scripts passing is the only PASS", () => {
  const result = evaluateEnvironment({ ...ready, scripts: all() });
  assert.equal(result.status, "RECORDED");
  assert.equal(result.pass, true);
});

test("a passing subset of the required scripts is INCOMPLETE, never pass", () => {
  const result = evaluateEnvironment({
    ...ready,
    scripts: all().slice(0, 3),
  });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.pass, false);
  assert.ok(result.missingScripts.includes("test:e2e"));
  assert.equal(evaluateEnvironment({ ...ready, scripts: [] }).pass, false);
});

test("a row claiming PASSED with a failing exit code is re-derived as FAILED", () => {
  const scripts = all().map((row: { name: string }) =>
    row.name === "test"
      ? { name: "test", status: "PASSED", pass: true, exitCode: 1 }
      : row,
  );
  const result = evaluateEnvironment({ ...ready, scripts });
  assert.equal(result.pass, false);
  assert.equal(
    result.scripts.find((r: { name: string }) => r.name === "test").status,
    "FAILED",
  );
});

test("unknown free space, an unusable tool or an old Node is BLOCKED", () => {
  const codes = (input: object) =>
    evaluateEnvironment({ ...ready, scripts: all(), ...input }).blockers.map(
      (b: { code: string }) => b.code,
    );
  assert.ok(
    codes({ disk: { freeBytes: Number.NaN } }).includes("DISK_UNKNOWN"),
  );
  assert.ok(
    codes({ ffmpeg: { present: true, version: null } }).includes(
      "FFMPEG_MISSING",
    ),
  );
  assert.ok(
    codes({
      node: { version: "v22.1.0", engine: ">=24.11.0", satisfiesEngine: false },
    }).includes("NODE_ENGINE"),
  );
});

test("node engine check compares numerically", () => {
  assert.equal(satisfiesNodeEngine("v24.19.0", ">=24.11.0"), true);
  assert.equal(satisfiesNodeEngine("v24.11.0", ">=24.11.0"), true);
  assert.equal(satisfiesNodeEngine("v24.9.9", ">=24.11.0"), false);
  assert.equal(satisfiesNodeEngine("v100.0.0", ">=24.11.0"), true);
  assert.equal(satisfiesNodeEngine("v24.19.0", "^24"), false);
});

test("negated os/cpu lists exclude only the named platform", () => {
  const files: Record<string, unknown> = {
    "r/package-lock.json": {
      packages: {
        "node_modules/not-mac": {
          version: "1.0.0",
          optional: true,
          os: ["!darwin"],
        },
        "node_modules/not-win": {
          version: "1.0.0",
          optional: true,
          os: ["!win32"],
        },
      },
    },
  };
  const result = lockfileDrift(
    "r",
    (f: string) => files[f] ?? null,
    "win32",
    "x64",
  );
  assert.equal(result.checked, 1);
  assert.deepEqual(result.drift, [
    { package: "node_modules/not-mac", pinned: "1.0.0", installed: null },
  ]);
});
