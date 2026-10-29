/**
 * YU-001 — Isolated dependency/native/browser environment evaluation.
 * Missing helper, FFmpeg or dependency is BLOCKED, never PASS.
 */
export const ENVIRONMENT_FORMAT = "yamakan.ultimate-environment/v1";

export const REQUIRED_SCRIPTS = Object.freeze([
  "typecheck",
  "lint",
  "format:check",
  "test",
  "build",
  "provenance:check",
  "brand:check",
  "test:e2e",
]);

export const DISK_RESERVE_BYTES = 2 * 1024 * 1024 * 1024;

// Public evidence must not carry this machine's account or folder names.
// Every string occurrence of a listed local root becomes its placeholder,
// matched case-insensitively and with either path separator.
export function redactLocalPaths(value, roots) {
  const rules = (roots || [])
    .filter((r) => r && typeof r.path === "string" && r.path.length > 2)
    .sort((a, b) => b.path.length - a.path.length)
    .map((r) => ({
      pattern: new RegExp(
        r.path
          .replace(/[\\/]+$/, "")
          .split(/[\\/]+/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[\\\\/]+") + "(?![^\\\\/\\s\"'])",
        "gi",
      ),
      label: r.label,
    }));
  const walk = (item) => {
    if (typeof item === "string") {
      return rules.reduce(
        (text, rule) => text.replace(rule.pattern, rule.label),
        item,
      );
    }
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([k, v]) => [k, walk(v)]),
      );
    }
    return item;
  };
  return walk(value);
}

export function scriptOutcome(input) {
  // A skip is never a pass, so a row already marked SKIPPED stays one.
  if (input.skipped || input.status === "SKIPPED") {
    return {
      name: input.name,
      status: "SKIPPED",
      pass: false,
      reason: input.reason || "SKIPPED",
      exitCode: input.exitCode ?? null,
      logPath: input.logPath || null,
    };
  }
  const exitCode = input.exitCode;
  if (exitCode === 0) {
    return {
      name: input.name,
      status: "PASSED",
      pass: true,
      exitCode: 0,
      reason: null,
      logPath: input.logPath || null,
    };
  }
  return {
    name: input.name,
    status: "FAILED",
    pass: false,
    exitCode,
    reason: input.reason || `exit ${exitCode}`,
    logPath: input.logPath || null,
  };
}

export function evaluateEnvironment(input) {
  const blockers = [];
  if (!input.dependency?.present) {
    blockers.push({
      code: "DEPENDENCY_MISSING",
      status: "BLOCKED",
      detail: input.dependency?.name || "dependency",
    });
  }
  if (!input.helper?.present) {
    blockers.push({
      code: "NATIVE_HELPER_MISSING",
      status: "BLOCKED",
      detail: input.helper?.path || "yamakan-procd",
    });
  }
  // A tool counts only if it ran and reported a version.
  if (!input.ffmpeg?.present || !input.ffmpeg?.version) {
    blockers.push({
      code: "FFMPEG_MISSING",
      status: "BLOCKED",
    });
  }
  if (!input.ffprobe?.present || !input.ffprobe?.version) {
    blockers.push({
      code: "FFPROBE_MISSING",
      status: "BLOCKED",
    });
  }
  if (input.node && input.node.satisfiesEngine !== true) {
    blockers.push({
      code: "NODE_ENGINE",
      status: "BLOCKED",
      detail: `node ${input.node.version} does not satisfy ${input.node.engine}`,
    });
  }
  if (input.mediaRuntime?.checked && input.mediaRuntime.valid !== true) {
    blockers.push({
      code: "MEDIA_RUNTIME_INVALID",
      status: "BLOCKED",
      detail: "selected media runtime failed its pinned file preflight",
    });
  }
  // procd stages every worker executable in this per-user cache and grants
  // only it to the worker sandbox; a link there redirects that grant and
  // makes every sandboxed launch fail.
  if (input.workerTools?.redirected) {
    blockers.push({
      code: "WORKER_TOOLS_REDIRECTED",
      status: "BLOCKED",
      detail: "the worker tools cache is a link or junction, not a folder",
    });
  }
  const freeBytes = input.disk?.freeBytes;
  const reserveBytes = input.disk?.reserveBytes ?? DISK_RESERVE_BYTES;
  if (input.disk && !Number.isFinite(freeBytes)) {
    blockers.push({ code: "DISK_UNKNOWN", status: "BLOCKED" });
  } else if (typeof freeBytes === "number" && freeBytes < reserveBytes) {
    blockers.push({
      code: "DISK_RESERVE",
      status: "BLOCKED",
      freeBytes,
      reserveBytes,
    });
  }

  // Outcomes are always derived from exit codes, never taken as claimed.
  const scripts = (input.scripts || []).map(scriptOutcome);
  const required = input.requiredScripts || REQUIRED_SCRIPTS;
  const missing = required.filter(
    (name) => !scripts.some((r) => r.name === name),
  );
  const hasFailure = scripts.some((row) => row.status !== "PASSED");

  let status;
  if (blockers.length) status = "BLOCKED";
  else if (hasFailure) status = "RECORDED_WITH_FAILURES";
  else if (missing.length) status = "INCOMPLETE";
  else status = "RECORDED";
  const pass = status === "RECORDED";

  return {
    format: ENVIRONMENT_FORMAT,
    status,
    pass,
    blockers,
    scripts,
    missingScripts: missing,
    node: input.node || null,
    dependency: input.dependency || null,
    helper: input.helper || null,
    ffmpeg: input.ffmpeg || null,
    ffprobe: input.ffprobe || null,
    mediaRuntime: input.mediaRuntime || null,
    disk: input.disk || null,
    workerTools: input.workerTools || null,
  };
}

// Every package the lockfile pins for this platform must be installed at
// its pinned version: a stale node_modules (installed before a pin changed)
// otherwise passes typecheck and fails only some tests, far from the cause.
export function lockfileDrift(
  repoRoot,
  readJson,
  platform = process.platform,
  arch = process.arch,
) {
  const lock = readJson(`${repoRoot}/package-lock.json`);
  const drift = [];
  let checked = 0;
  for (const [key, entry] of Object.entries(lock?.packages || {})) {
    if (!key.startsWith("node_modules/")) continue;
    // Optional packages for another OS or CPU (fsevents, arm64 bindings)
    // are never installed here.
    const fits = (list, value) => {
      if (!Array.isArray(list)) return true;
      if (list.includes(`!${value}`)) return false;
      const positive = list.filter((x) => !String(x).startsWith("!"));
      return positive.length === 0 || positive.includes(value);
    };
    if (entry.optional && !(fits(entry.os, platform) && fits(entry.cpu, arch)))
      continue;
    checked += 1;
    const installed = readJson(`${repoRoot}/${key}/package.json`);
    if (!installed)
      drift.push({ package: key, pinned: entry.version, installed: null });
    else if (installed.version !== entry.version)
      drift.push({
        package: key,
        pinned: entry.version,
        installed: installed.version,
      });
  }
  return { checked, drift };
}

// Minimal ">=x.y.z" check for package.json engines.node.
export function satisfiesNodeEngine(version, engine) {
  const m = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(String(engine || "").trim());
  const v = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version || ""));
  if (!m || !v) return false;
  for (let i = 1; i <= 3; i++) {
    if (Number(v[i]) !== Number(m[i])) return Number(v[i]) > Number(m[i]);
  }
  return true;
}
