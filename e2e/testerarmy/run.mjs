#!/usr/bin/env node
// YU-011 TesterArmy e2e: the Studio canvas journey against the real local
// Yamakan service and installed Microsoft Edge, with a hard service kill
// between saving and reopening. Afterwards the workspace is checked
// independently of the browser. Test-only; never packaged. No model, no
// telemetry, no browser download, no hosted service.
import { fork, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const evidence = join(here, ".e2e-yamakan");
rmSync(evidence, { recursive: true, force: true });
mkdirSync(evidence, { recursive: true });
if (!existsSync(join(repo, "dist", "index.html"))) {
  process.stderr.write("STUDIO-E2E: build the app first (npm run build)\n");
  process.exit(1);
}
const root = mkdtempSync(join(process.env.YAMAKAN_E2E_ROOT || tmpdir(), "yamakan-ta-"));
const workspace = join(root, "workspace");
const port = Number(process.env.YAMAKAN_E2E_PORT || 24400);
const url = `http://127.0.0.1:${port}`;
const pids = join(root, "edge-pids.txt");
const stateFile = join(root, "journey-state.json");
const failures = [];
const log = (line) => process.stdout.write(`STUDIO-E2E ${line}\n`);

async function startService() {
  const child = fork(join(repo, "server", "main.ts"), [], {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: workspace,
      YAMAKAN_PORT: String(port),
      YAMAKAN_AG_DOCS_QUALIFICATION: "1",
    },
    silent: true,
    windowsHide: true,
  });
  let out = "";
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (out += c));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`service startup timeout: ${out}`)), 15_000);
    const check = () => {
      if (out.includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", check);
    child.once("exit", (code) => reject(new Error(`service exited ${code}: ${out}`)));
  });
  if (!out.includes("QUALIFICATION RUN")) failures.push("the service did not announce the qualification switch");
  const { writeLaunchLink } = await import(pathToFileURL(join(repo, "core", "launch.ts")).href);
  await writeLaunchLink(workspace, url);
  const launch = readFileSync(join(workspace, "launch"), "utf8").split("\n")[0].trim();
  return { child, launch, output: () => out };
}

function runPhase(file, launch) {
  return new Promise((resolve) => {
    const run = spawn(
      process.execPath,
      [join(here, "node_modules", "e2e", "dist", "cli", "bin.js"), "run", file, "--output", join(evidence, file.replace(/\.e2e\.ts$/, ""))],
      {
        cwd: here,
        stdio: "inherit",
        env: {
          ...process.env,
          E2E_TELEMETRY_DISABLED: "1",
          YAMAKAN_E2E_URL: url,
          YAMAKAN_E2E_LAUNCH: launch,
          YAMAKAN_E2E_STATE: stateFile,
          YAMAKAN_E2E_PIDS: pids,
        },
      },
    );
    run.on("exit", (code) => resolve(code));
  });
}

const isRunning = (pid) =>
  (spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8" }).stdout ?? "").includes(` ${pid} `);
async function endBrowsers() {
  if (!existsSync(pids)) return 0;
  const rows = readFileSync(pids, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
  // Ask each browser to close over its own DevTools endpoint (this ends all
  // of its processes, which release the profile), then end what remains.
  const closeOverCdp = (endpoint) =>
    new Promise((resolve) => {
      let socket;
      try {
        socket = new WebSocket(endpoint);
      } catch {
        return resolve();
      }
      socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
      socket.onclose = () => resolve();
      socket.onerror = () => resolve();
      setTimeout(resolve, 5000);
    });
  for (const [pid, profile, endpoint] of rows) {
    if (endpoint) await closeOverCdp(endpoint);
    if (isRunning(pid)) spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
    // Edge can re-parent helpers that still hold the profile: end any Edge
    // whose command line names this exact profile.
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like ('*' + $env:PROFILE_DIR + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { stdio: "ignore", env: { ...process.env, PROFILE_DIR: profile } },
    );
    for (let i = 0; i < 40 && existsSync(profile); i++) {
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (existsSync(profile)) failures.push(`Edge profile left behind: ${profile}`);
  }
  rmSync(pids, { force: true });
  return rows.length;
}

let service;
try {
  service = await startService();
  log("phase 1: create, draw, save, conflicting save, reload");
  const first = await runPhase("studio-save.e2e.ts", service.launch);
  if (first !== 0) failures.push(`phase 1 exited ${first}`);
  await endBrowsers();

  // A real crash: the service process is terminated, not asked to stop.
  service.child.kill("SIGKILL");
  await once(service.child, "exit");
  log("service killed; restarting on the same workspace");
  service = await startService();
  const second = await runPhase("studio-reopen.e2e.ts", service.launch);
  if (second !== 0) failures.push(`phase 2 exited ${second}`);
  await endBrowsers();

  // Independent of the browser: what the workspace holds.
  const db = new DatabaseSync(join(workspace, "workspace.sqlite"), { readOnly: true });
  try {
    const head = db
      .prepare("SELECT s.bytes FROM snapshots s JOIN projects p ON p.snapshot_hash = s.hash")
      .all()
      .map((r) => JSON.parse(Buffer.from(r.bytes).toString("utf8")));
    const saved = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
    const project = head.find((p) => p.id === saved.projectId);
    const docs = project?.documents ?? [];
    if (project?.formatVersion !== 5 || docs.length !== 1 || docs[0].kind !== "studio")
      failures.push(`head is not a v5 project with one Studio document: ${JSON.stringify(docs)}`);
    if (docs[0]?.contentHash !== saved.otherHash) failures.push("the head does not reference the last committed canvas");
    const bitmaps = db.prepare("SELECT project_id, digest, byte_length FROM studio_bitmaps").all();
    if (bitmaps.length === 0) failures.push("no Studio bitmap was stored");
    for (const b of bitmaps) {
      const file = join(workspace, "projects", b.project_id, "objects", "sha256", b.digest.slice(0, 2), b.digest);
      const bytes = existsSync(file) ? readFileSync(file) : null;
      if (!bytes || createHash("sha256").update(bytes).digest("hex") !== b.digest || bytes.length !== b.byte_length)
        failures.push(`stored bitmap ${b.digest} is missing or does not match its digest`);
    }
    const doc = db.prepare("SELECT object_digests FROM creative_documents WHERE hash = ?").get(saved.otherHash ?? "");
    const named = doc ? JSON.parse(doc.object_digests) : [];
    if (named.length === 0 || !named.every((d) => bitmaps.some((b) => b.digest === d)))
      failures.push("the saved canvas does not name stored bitmaps");
    const receiving = db.prepare("SELECT count(*) AS n FROM document_uploads WHERE state = 'receiving'").get().n;
    if (receiving !== 0) failures.push(`${receiving} uploads left receiving`);
    writeFileSync(
      join(evidence, "summary.json"),
      JSON.stringify(
        {
          format: "yamakan.studio-e2e/v1",
          browser: "Microsoft Edge (installed), headless, over CDP",
          runner: "TesterArmy e2e 0.20.0 + @e2e-dev/web 0.14.0 (no model, telemetry disabled)",
          serviceKilledBetweenPhases: true,
          headFormatVersion: project?.formatVersion ?? null,
          documents: docs.length,
          storedBitmaps: bitmaps.length,
          canvasNamesStoredBitmaps: named.length,
          firstSaveHash: saved.firstHash ?? null,
          lastCommittedHash: saved.otherHash ?? null,
          strokePixel: saved.pixel ?? null,
          failures,
        },
        null,
        2,
      ) + "\n",
    );
    log(`workspace: v${project?.formatVersion} project, ${docs.length} Studio document, ${bitmaps.length} stored bitmaps, canvas names ${named.length}`);
  } finally {
    db.close();
  }
} catch (e) {
  failures.push(e instanceof Error ? e.message : String(e));
} finally {
  await endBrowsers();
  if (service && service.child.exitCode === null) {
    service.child.send?.("shutdown");
    await Promise.race([once(service.child, "exit"), new Promise((r) => setTimeout(r, 5000))]);
    if (service.child.exitCode === null) service.child.kill("SIGKILL");
  }
  for (let i = 0; i < 40 && existsSync(root); i++) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
if (failures.length) {
  process.stderr.write(`STUDIO-E2E FAILED\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}
log("PASSED");
