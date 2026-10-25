import assert from "node:assert/strict";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { ENVIRONMENT_FORMAT, REQUIRED_SCRIPTS, evaluateEnvironment, redactLocalPaths, scriptOutcome } from "../scripts/ultimate-environment.mjs";

const present = { present: true, sha256: "a".repeat(64) };

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
