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
  if (input.skipped) {
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
  if (!input.ffmpeg?.present) {
    blockers.push({
      code: "FFMPEG_MISSING",
      status: "BLOCKED",
    });
  }
  if (!input.ffprobe?.present) {
    blockers.push({
      code: "FFPROBE_MISSING",
      status: "BLOCKED",
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
  if (typeof freeBytes === "number" && freeBytes < reserveBytes) {
    blockers.push({
      code: "DISK_RESERVE",
      status: "BLOCKED",
      freeBytes,
      reserveBytes,
    });
  }

  const scripts = (input.scripts || []).map((row) =>
    row.status ? row : scriptOutcome(row),
  );
  const hasFailure = scripts.some((row) => row.status !== "PASSED");

  let status = "RECORDED";
  let pass = false;
  if (blockers.length) {
    status = "BLOCKED";
    pass = false;
  } else if (hasFailure) {
    status = "RECORDED_WITH_FAILURES";
    pass = false;
  } else if (scripts.length && scripts.every((row) => row.pass)) {
    status = "RECORDED";
    pass = true;
  }

  return {
    format: ENVIRONMENT_FORMAT,
    status,
    pass,
    blockers,
    scripts,
    dependency: input.dependency || null,
    helper: input.helper || null,
    ffmpeg: input.ffmpeg || null,
    ffprobe: input.ffprobe || null,
    disk: input.disk || null,
    workerTools: input.workerTools || null,
  };
}
