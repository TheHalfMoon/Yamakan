// YU-041: the engine-worker profile, qualified with no-model stand-ins. A
// worker may start a few descendants, all inside its kill-on-close job,
// restricted token and less-privileged AppContainer; none outlives the
// worker, a cancel, the service, procd itself, or the wall budget. Every
// denial has a positive control in the same environment, and a control
// that fails makes its denial count for nothing (reported, not asserted).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENGINE_WORKER_PROFILE,
  ProcessOwner,
  WALL_EXIT_CODE,
  profileHash,
  type WorkerProfile,
} from "../core/process/owner.ts";
import { CommandError } from "../core/command/errors.ts";

const windows = process.platform === "win32";
const probe = fileURLToPath(
  new URL("../native/procd/target/release/worker-probe.exe", import.meta.url),
);
const system32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
const powershell = path.join(
  system32,
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const schtasks = path.join(system32, "schtasks.exe");
const folders: string[] = [];
after(() =>
  Promise.all(
    folders.map((f) =>
      rm(f, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  ),
);
const temp = async (prefix: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  folders.push(dir);
  return dir;
};
const profile = (over: Partial<WorkerProfile> = {}): WorkerProfile => ({
  ...ENGINE_WORKER_PROFILE,
  ...over,
});
// Whether a process id is still a live worker-probe (an uncontained check;
// the image filter keeps a reused id from counting).
const alive = (pid: number, image = "worker-probe.exe") =>
  (
    spawnSync(
      "tasklist",
      ["/FI", `PID eq ${pid}`, "/FI", `IMAGENAME eq ${image}`, "/NH"],
      {
        encoding: "utf8",
      },
    ).stdout ?? ""
  ).includes(` ${pid} `);
const waitGone = async (pids: number[], ms = 8000) => {
  const until = Date.now() + ms;
  while (pids.some((p) => alive(p)) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 200));
  return pids.filter((p) => alive(p));
};
const appears = async (file: string, ms: number) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (existsSync(file)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return existsSync(file);
};
async function run(
  args: string[],
  options: {
    profile?: WorkerProfile;
    executable?: string;
    allow?: string[];
    readable?: string[];
    writable?: string[];
    cwd?: string;
    signal?: AbortSignal;
    // Called with each complete stdout line.
    onLine?: (line: string) => void;
    owner?: ProcessOwner;
  } = {},
) {
  const executable = options.executable ?? probe;
  const owner = options.owner ?? new ProcessOwner(options.allow ?? [probe]);
  let stdout = "";
  let pending = "";
  try {
    const result = await owner.run({
      executable,
      args,
      cwd: options.cwd ?? tmpdir(),
      profile: options.profile,
      readable: options.readable,
      writable: options.writable,
      signal: options.signal,
      stderrLimit: 8000,
      onStdout: (b) => {
        stdout += b;
        pending += b;
        let at;
        while ((at = pending.indexOf("\n")) >= 0) {
          options.onLine?.(pending.slice(0, at).trim());
          pending = pending.slice(at + 1);
        }
      },
    });
    return { ...result, stdout };
  } finally {
    if (!options.owner) owner.close();
  }
}
const pidsOf = (line: string) =>
  line
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

test(
  "the profile is versioned and hashed, declares its budgets, and out-of-bounds profiles are refused",
  { skip: !windows },
  async () => {
    assert.match(profileHash(ENGINE_WORKER_PROFILE), /^[0-9a-f]{64}$/);
    assert.notEqual(
      profileHash(profile({ maxProcesses: 5 })),
      profileHash(ENGINE_WORKER_PROFILE),
    );
    assert.notEqual(
      profileHash(profile({ memoryBytes: 1 << 30 })),
      profileHash(ENGINE_WORKER_PROFILE),
    );
    assert.ok(ENGINE_WORKER_PROFILE.memoryBytes > 0);
    assert.equal(ENGINE_WORKER_PROFILE.gpu, "none");
    for (const bad of [
      profile({ maxProcesses: 1 }),
      profile({ maxProcesses: 9 }),
      profile({ wallMs: 0 }),
      profile({ memoryBytes: 0 }),
      { ...ENGINE_WORKER_PROFILE, version: 2 } as unknown as WorkerProfile,
    ])
      await assert.rejects(
        run(["exit"], { profile: bad }),
        (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
      );
  },
);

test(
  "descendants: the engine profile admits its bound and no more; the media profile runs no child",
  { skip: !windows },
  async () => {
    // The media profile (unchanged) starts no process of its own: its job
    // admits one, and its token lacks registryRead.
    const media = await run(["tree", "2", "200"]);
    assert.equal(media.code, 0, media.stderr);
    assert.equal(media.stdout.split("|")[0], "0", media.stdout);
    // Its permitted descendants start together (tree waits for them).
    const engine = await run(["tree", "3", "200"], {
      profile: profile({ maxProcesses: 4 }),
    });
    assert.equal(engine.code, 0, engine.stderr);
    assert.equal(engine.stdout.split("|")[0], "3", engine.stdout);
    // Beyond the bound, the job refuses more processes: 4 is the worker and 3.
    const four = await run(["tree", "6", "1000"], {
      profile: profile({ maxProcesses: 4 }),
    });
    assert.equal(four.code, 0, four.stderr);
    assert.equal(four.stdout.split("|")[0], "3", four.stdout);
    const two = await run(["tree", "6", "1000"], {
      profile: profile({ maxProcesses: 2 }),
    });
    assert.equal(two.stdout.split("|")[0], "1", two.stdout);
  },
);

test(
  "under the engine profile, sentinels, TCP to an HTTP server and DNS stay denied, with positive controls",
  { skip: !windows },
  async (t) => {
    const outside = await temp("yamakan-sentinel-");
    const sentinel = path.join(outside, "sentinel.txt");
    await writeFile(sentinel, "SENTINEL");
    const granted = path.join(await temp("yamakan-granted-"), "input.txt");
    await writeFile(granted, "input");
    const writable = await temp("yamakan-staging-");
    const http = createServer((_q, r) => r.end("ok"));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const port = String((http.address() as { port: number }).port);
    try {
      const args = [
        "hostile",
        sentinel,
        sentinel,
        sentinel,
        sentinel,
        sentinel,
        granted,
        outside,
        outside,
        outside,
        writable,
        port,
        "",
      ];
      // Positive control: the same probe, uncontained, reaches all of it.
      const control = JSON.parse(
        spawnSync(probe, args, {
          encoding: "utf8",
          timeout: 30_000,
        }).stdout.trim(),
      );
      assert.equal(control.sentinel, true);
      assert.equal(control.loopback, true, "the HTTP server accepts TCP");
      assert.equal(control.child, true);
      await rm(path.join(writable, "ok.txt"), { force: true });
      const contained = await run(args, {
        profile: ENGINE_WORKER_PROFILE,
        readable: [granted],
        writable: [writable],
      });
      assert.equal(contained.code, 0, contained.stderr);
      const seen = JSON.parse(contained.stdout.trim());
      // Alive and doing its permitted work, so the denials below are the sandbox's.
      assert.equal(seen.granted, true);
      assert.equal(seen.writeOwn, true);
      assert.equal(seen.child, true, "a permitted descendant runs");
      for (const key of [
        "sentinel",
        "token",
        "launch",
        "database",
        "otherMedia",
        "profile",
        "workspace",
      ])
        assert.equal(seen[key], false, key);
      assert.equal(seen.writeWorkspace, false);
      assert.equal(seen.writeSentinelDir, false);
      assert.equal(seen.loopback, false, "no TCP to the HTTP server");
      // DNS: an outside name. Without network here, the control fails and the
      // denial proves nothing, so it is only asserted when the control works.
      const resolvesOutside =
        spawnSync(probe, ["dns", "example.com"], { encoding: "utf8" })
          .stdout === "resolved";
      const dns = await run(
        ["dns", resolvesOutside ? "example.com" : "localhost"],
        { profile: ENGINE_WORKER_PROFILE },
      );
      assert.equal(dns.stdout, "denied", "no name resolution");
      if (!resolvesOutside)
        t.diagnostic(
          "DNS control failed (no network): outside resolution not qualified",
        );
    } finally {
      http.close();
    }
  },
);

test(
  "no descendant outlives an exiting worker, a cancel, the service, procd, or the wall budget",
  { skip: !windows },
  async () => {
    // tasklist itself works here, or "gone" would mean nothing.
    assert.ok(alive(process.pid, "node.exe"), "tasklist sees this process");

    // A child left behind on purpose by a worker that exits 300 ms later.
    const seen: number[] = [];
    await run(["orphan", "60000"], {
      profile: ENGINE_WORKER_PROFILE,
      onLine: (line) => {
        const pid = Number(line);
        if (pid > 0 && alive(pid)) seen.push(pid);
      },
    });
    assert.equal(
      seen.length,
      1,
      "the orphan was alive before its worker exited",
    );
    assert.deepEqual(await waitGone(seen), [], "the job ended the orphan");

    // Cancelled while its descendants run.
    const controller = new AbortController();
    let cancelled: number[] = [];
    await run(["spawn-hold", "2", "60000"], {
      profile: ENGINE_WORKER_PROFILE,
      signal: controller.signal,
      onLine: (line) => {
        cancelled = pidsOf(line);
        assert.ok(
          cancelled.length === 2 && cancelled.every((p) => alive(p)),
          "running before the cancel",
        );
        controller.abort();
      },
    }).catch(() => null);
    assert.equal(cancelled.length, 2);
    assert.deepEqual(
      await waitGone(cancelled),
      [],
      "cancel ended every descendant",
    );

    // The service goes away (the owner closes procd's input).
    const owner = new ProcessOwner([probe]);
    let closed: number[] = [];
    await run(["spawn-hold", "2", "60000"], {
      owner,
      profile: ENGINE_WORKER_PROFILE,
      onLine: (line) => {
        closed = pidsOf(line);
        assert.ok(
          closed.length === 2 && closed.every((p) => alive(p)),
          "running before the service exit",
        );
        owner.close();
      },
    }).catch(() => null);
    assert.equal(closed.length, 2);
    assert.deepEqual(
      await waitGone(closed),
      [],
      "service exit ended every descendant",
    );

    // procd itself is killed: Windows closes its job handles, ending the jobs.
    const hard = new ProcessOwner([probe]);
    let killed: number[] = [];
    await run(["spawn-hold", "2", "60000"], {
      owner: hard,
      profile: ENGINE_WORKER_PROFILE,
      onLine: (line) => {
        killed = pidsOf(line);
        assert.ok(
          killed.length === 2 && killed.every((p) => alive(p)),
          "running before procd dies",
        );
        execFileSync("taskkill", ["/F", "/PID", String(hard.ownerPid)]);
      },
    }).catch(() => null);
    hard.close();
    assert.equal(killed.length, 2);
    assert.deepEqual(
      await waitGone(killed),
      [],
      "procd's death ended every descendant",
    );

    // The wall budget ends the whole job, and says so.
    let timed: number[] = [];
    const started = Date.now();
    const wall = await run(["spawn-hold", "2", "60000"], {
      profile: profile({ wallMs: 1500 }),
      onLine: (line) => {
        timed = pidsOf(line);
        assert.ok(
          timed.every((p) => alive(p)),
          "running before the budget",
        );
      },
    });
    assert.equal(wall.code, WALL_EXIT_CODE);
    assert.equal(wall.wallExceeded, true);
    assert.ok(Date.now() - started < 15_000, "ended near its budget");
    assert.deepEqual(
      await waitGone(timed),
      [],
      "the budget ended every descendant",
    );
  },
);

test(
  "services cannot start a process for an engine worker: WMI and Task Scheduler, with controls",
  { skip: !windows },
  async () => {
    const dir = await temp("yamakan-escape-");
    const out = path.join(dir, "out");
    await mkdir(out);
    // WMI (Win32_Process.Create runs the command from the WMI service,
    // outside any job of the caller).
    const wmi = (marker: string) => [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$ErrorActionPreference = 'Stop'; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = 'cmd.exe /c echo escaped > "${marker}"'}`,
    ];
    const control = path.join(dir, "wmi-control.txt");
    spawnSync(powershell, wmi(control), { windowsHide: true });
    assert.ok(
      await appears(control, 15000),
      "WMI starts a process for an ordinary process",
    );
    const viaWmi = path.join(out, "wmi.txt");
    const result = await run(wmi(viaWmi), {
      executable: powershell,
      allow: [powershell],
      profile: ENGINE_WORKER_PROFILE,
      cwd: dir,
      writable: [out],
    });
    assert.notEqual(result.code, 0);
    assert.equal(
      await appears(viaWmi, 8000),
      false,
      "no process started through WMI",
    );

    // Task Scheduler: a task created by the worker would run outside its job.
    const task = `YamakanEscapeTest-${process.pid}`;
    const marker = path.join(out, "task.txt");
    try {
      const created = await run(
        [
          "/Create",
          "/TN",
          task,
          "/SC",
          "ONCE",
          "/ST",
          "23:59",
          "/TR",
          `cmd.exe /c echo escaped > "${marker}"`,
          "/F",
        ],
        {
          executable: schtasks,
          allow: [schtasks],
          profile: ENGINE_WORKER_PROFILE,
          cwd: dir,
          writable: [out],
        },
      );
      assert.notEqual(created.code, 0, "the worker cannot create a task");
      const listed = spawnSync(schtasks, ["/Query", "/TN", task], {
        encoding: "utf8",
      });
      assert.notEqual(listed.status, 0, "no task exists");
    } finally {
      spawnSync(schtasks, ["/Delete", "/TN", task, "/F"]);
    }
  },
);

test(
  "COM local servers and job breakaway: denied, asserted where the control works here",
  { skip: !windows },
  async (t) => {
    // A local COM server would run outside the job. MMC20.Application needs
    // elevation and Shell.Application is not a local server on this host, so
    // the control usually fails: then the denial is recorded, not credited.
    const progid = "MMC20.Application";
    const comControl = spawnSync(probe, ["com", progid], {
      encoding: "utf8",
    }).stdout;
    const com = await run(["com", progid], { profile: ENGINE_WORKER_PROFILE });
    assert.notEqual(com.stdout, "created", "no local server for the worker");
    if (comControl !== "created")
      t.diagnostic(
        `COM control failed (${comControl}): local-server denial not qualified here`,
      );
    // Breakaway: procd's jobs never allow it. When this test runs inside a
    // job that forbids breakaway (CI shells do), the control fails too.
    const breakControl = spawnSync(probe, ["breakaway"], {
      encoding: "utf8",
    }).stdout;
    const broke = await run(["breakaway"], { profile: ENGINE_WORKER_PROFILE });
    assert.equal(broke.stdout, "denied", "no child leaves the job");
    if (breakControl !== "started")
      t.diagnostic(
        "breakaway control failed (the test runs in a job): denial not qualified here",
      );
  },
);

test(
  "a junction is never accepted as an engine worker's writable folder",
  { skip: !windows },
  async () => {
    const base = await temp("yamakan-junction-");
    const target = path.join(base, "target");
    await mkdir(target);
    const link = path.join(base, "link");
    await symlink(target, link, "junction");
    await assert.rejects(
      run(["exit"], { profile: ENGINE_WORKER_PROFILE, writable: [link] }),
      (e: unknown) => e instanceof CommandError,
    );
  },
);

test(
  "registryRead: what it opens (Users-readable HKLM) and what it does not",
  { skip: !windows },
  async () => {
    const product = [
      "hklm",
      "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
      "ProductName",
    ];
    // Control: an ordinary process reads it.
    assert.equal(
      spawnSync(probe, ["reg", ...product], { encoding: "utf8" }).stdout,
      "read",
    );
    // The capability is what grants it: the media profile cannot.
    assert.equal((await run(["reg", ...product])).stdout, "denied");
    assert.equal(
      (await run(["reg", ...product], { profile: ENGINE_WORKER_PROFILE }))
        .stdout,
      "read",
    );
    // An admin-only key stays closed to both.
    const sam = ["hklm", "SAM\\SAM\\Domains\\Account", "F"];
    assert.equal(
      spawnSync(probe, ["reg", ...sam], { encoding: "utf8" }).stdout,
      "denied",
    );
    assert.equal(
      (await run(["reg", ...sam], { profile: ENGINE_WORKER_PROFILE })).stdout,
      "denied",
    );
    // The user's own registry stays closed (control: readable uncontained).
    const key = `Software\\YamakanSandboxTest-${process.pid}`;
    assert.equal(
      spawnSync("reg", [
        "add",
        `HKCU\\${key}`,
        "/v",
        "Secret",
        "/d",
        "SENTINEL",
        "/f",
      ]).status,
      0,
    );
    try {
      assert.equal(
        spawnSync(probe, ["reg", "hkcu", key, "Secret"], { encoding: "utf8" })
          .stdout,
        "read",
      );
      assert.equal(
        (
          await run(["reg", "hkcu", key, "Secret"], {
            profile: ENGINE_WORKER_PROFILE,
          })
        ).stdout,
        "denied",
      );
      // Nothing can be written, in either hive.
      assert.equal(
        (
          await run(["reg-write", "hkcu", key], {
            profile: ENGINE_WORKER_PROFILE,
          })
        ).stdout,
        "denied",
      );
      assert.equal(
        (
          await run(["reg-write", "hklm", "SOFTWARE\\YamakanProbe"], {
            profile: ENGINE_WORKER_PROFILE,
          })
        ).stdout,
        "denied",
      );
    } finally {
      spawnSync("reg", ["delete", `HKCU\\${key}`, "/f"]);
    }
  },
);
