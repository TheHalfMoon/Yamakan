/**
 * YU-001 capture: reproduce the isolated Windows test environment.
 * Records genuine outcomes. Missing helper/FFmpeg/dependency is BLOCKED.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISK_RESERVE_BYTES,
  ENVIRONMENT_FORMAT,
  REQUIRED_SCRIPTS,
  evaluateEnvironment,
  scriptOutcome,
} from "./ultimate-environment.mjs";
import { hashFile, nativeHashes, redactSecrets } from "./ultimate-baseline.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(repo, "work", "ultimate");
const logDir = path.join(work, "logs");
const outFile = path.join(repo, "docs/evidence/ultimate/environment.json");
const require = createRequire(import.meta.url);

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function which(command) {
  const probe = spawnSync("where.exe", [command], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (probe.status !== 0) return null;
  return (
    probe.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || null
  );
}

function toolRecord(exe) {
  if (!exe || !existsSync(exe)) return { present: false, path: exe || null };
  let version = null;
  try {
    version = execFileSync(exe, ["-hide_banner", "-version"], {
      encoding: "utf8",
      windowsHide: true,
    })
      .split("\n")[0]
      .trim();
  } catch {
    version = null;
  }
  return {
    present: true,
    path: exe,
    sha256: hashFile(exe),
    version,
  };
}

function diskFree(rootPath) {
  const drive = path.parse(rootPath).root;
  const out = execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `(Get-PSDrive -Name '${drive[0]}').Free`],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  return Number(out);
}

function runScript(name) {
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${name.replaceAll(":", "-")}.log`);
  const started = Date.now();
  const result = spawnSync("npm", ["run", "-s", name], {
    cwd: repo,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      TEMP: work,
      TMP: work,
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  const body = [
    `command: npm run -s ${name}`,
    `cwd: ${repo}`,
    `exit: ${result.status}`,
    `durationMs: ${Date.now() - started}`,
    "--- stdout ---",
    result.stdout || "",
    "--- stderr ---",
    result.stderr || "",
  ].join("\n");
  writeFileSync(logPath, body);
  return scriptOutcome({
    name,
    exitCode: result.status,
    logPath: path.relative(repo, logPath).replaceAll("\\", "/"),
    reason: result.status === 0 ? null : `exit ${result.status}`,
  });
}

const candidateSha = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
const dirty = git("status", "--porcelain");
const freeBytes = diskFree(repo);
let helpers = nativeHashes(repo);
let helper = helpers[0] || { present: false };
const nativeBuild = { attempted: false, exitCode: null, logPath: null };
if (!helper.present && freeBytes >= DISK_RESERVE_BYTES) {
  nativeBuild.attempted = true;
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "build-native.log");
  const built = spawnSync("npm", ["run", "-s", "build:native"], {
    cwd: repo,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    env: { ...process.env, TEMP: work, TMP: work },
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(
    logPath,
    `exit ${built.status}\n${built.stdout || ""}\n${built.stderr || ""}`,
  );
  nativeBuild.exitCode = built.status;
  nativeBuild.logPath = path.relative(repo, logPath).replaceAll("\\", "/");
  helpers = nativeHashes(repo);
  helper = helpers[0] || { present: false };
}
let zodPresent = false;
try {
  require.resolve("zod", { paths: [repo] });
  zodPresent = true;
} catch {
  zodPresent = false;
}

const ffmpeg = toolRecord(process.env.YAMAKAN_FFMPEG || which("ffmpeg"));
const ffprobe = toolRecord(process.env.YAMAKAN_FFPROBE || which("ffprobe"));

const precheck = evaluateEnvironment({
  dependency: { present: zodPresent, name: "zod" },
  helper,
  ffmpeg,
  ffprobe,
  disk: { freeBytes, reserveBytes: DISK_RESERVE_BYTES, root: repo },
  scripts: [],
});

const scripts = [];
if (precheck.status !== "BLOCKED") {
  for (const name of REQUIRED_SCRIPTS) {
    scripts.push(runScript(name));
  }
} else {
  for (const name of REQUIRED_SCRIPTS) {
    scripts.push(
      scriptOutcome({
        name,
        skipped: true,
        reason: `environment ${precheck.status}: ${precheck.blockers.map((b) => b.code).join(",")}`,
      }),
    );
  }
}

const evaluation = evaluateEnvironment({
  dependency: { present: zodPresent, name: "zod" },
  helper,
  ffmpeg,
  ffprobe,
  disk: { freeBytes, reserveBytes: DISK_RESERVE_BYTES, root: repo },
  scripts,
});

const manifest = redactLocalPaths(
  redactSecrets({
    ...evaluation,
    format: ENVIRONMENT_FORMAT,
    capturedAt: new Date().toISOString(),
    candidate: {
      sha: candidateSha,
      tree,
      dirty: dirty.length > 0,
      dirtyStatus: dirty || "",
    },
    runtime: {
      os: `${os.type()} ${os.release()}`,
      node: process.version,
      cwd: repo,
      isolatedWorkspace: repo,
    },
    native: helpers,
    nativeBuild,
    notes: [
      "Failures and skips are retained with reasons.",
      "Missing helper, FFmpeg or dependency cannot produce PASS.",
      "No weights, providers or paid services were invoked.",
      "Local paths are redacted: <repo> is the isolated worktree, ~ the user profile.",
    ],
  }),
  [
    { path: repo, label: "<repo>" },
    { path: os.homedir(), label: "~" },
  ],
);

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      wrote: path.relative(repo, outFile).replaceAll("\\", "/"),
      status: manifest.status,
      pass: manifest.pass,
      blockers: manifest.blockers,
      scripts: manifest.scripts.map((s) => ({
        name: s.name,
        status: s.status,
        exitCode: s.exitCode,
      })),
    },
    null,
    2,
  ),
);
if (manifest.pass !== true && manifest.status === "BLOCKED") {
  process.exit(2);
}
if (manifest.pass !== true) process.exit(1);
