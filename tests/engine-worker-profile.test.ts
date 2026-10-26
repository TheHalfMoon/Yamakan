// YU-041: the engine-worker profile, qualified with no-model stand-ins. A
// worker may start a few descendants, all inside its kill-on-close job,
// restricted token and less-privileged AppContainer; none outlives the
// worker, a cancel, the service, procd itself, or the wall budget. Every
// denial has a positive control in the same environment, and a control
// that fails makes its denial count for nothing (reported, not asserted).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
// Whether a process id is still a live process of this image (an
// uncontained check; the image filter keeps a reused id from counting).
const alive = (pid: number, image = "worker-probe.exe") =>
  (
    spawnSync(
      "tasklist",
      ["/FI", `PID eq ${pid}`, "/FI", `IMAGENAME eq ${image}`, "/NH"],
      { encoding: "utf8" },
    ).stdout ?? ""
  ).includes(` ${pid} `);
const waitGone = async (pids: number[], ms = 8000) => {
  const until = Date.now() + ms;
  while (pids.some((p) => alive(p)) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 200));
  return pids.filter((p) => alive(p));
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
    // Called with each complete stdout line. It only records: a throw here
    // would escape the run.
    onLine?: (line: string) => void;
    owner?: ProcessOwner;
    // false counts stdout bytes without keeping them.
    keepStdout?: boolean;
  } = {},
) {
  const executable = options.executable ?? probe;
  const owner = options.owner ?? new ProcessOwner(options.allow ?? [probe]);
  let stdout = "";
  let bytes = 0;
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
        bytes += b.length;
        if (options.keepStdout === false) return;
        stdout += b;
        pending += b;
        let at;
        while ((at = pending.indexOf("\n")) >= 0) {
          options.onLine?.(pending.slice(0, at).trim());
          pending = pending.slice(at + 1);
        }
      },
    });
    return { ...result, stdout, bytes };
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
    // Beyond the bound, the job refuses more: 4 is the worker and 3.
    const four = await run(["tree", "6", "1000"], {
      profile: profile({ maxProcesses: 4 }),
    });
    assert.equal(four.code, 0, four.stderr);
    assert.equal(four.stdout.split("|")[0], "3", four.stdout);
    const two = await run(["tree", "6", "1000"], {
      profile: profile({ maxProcesses: 2 }),
    });
    assert.equal(two.code, 0, two.stderr);
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
      // denial proves nothing, so it is only credited when the control works.
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

    // A child left behind on purpose by a worker that exits 2 s later.
    const orphans: number[] = [];
    await run(["orphan", "60000"], {
      profile: ENGINE_WORKER_PROFILE,
      onLine: (line) => {
        const pid = Number(line);
        if (pid > 0 && alive(pid)) orphans.push(pid);
      },
    });
    assert.equal(
      orphans.length,
      1,
      "the orphan was alive before its worker exited",
    );
    assert.deepEqual(await waitGone(orphans), [], "the job ended the orphan");

    // Each case records whether its descendants were alive, then acts; the
    // assertions follow the run.
    const holding = async (
      act: (owner: ProcessOwner, controller: AbortController) => void,
      over: Partial<WorkerProfile> = {},
    ) => {
      const owner = new ProcessOwner([probe]);
      const controller = new AbortController();
      let pids: number[] = [];
      let wereAlive = false;
      const result = await run(["spawn-hold", "2", "60000"], {
        owner,
        profile: profile(over),
        signal: controller.signal,
        onLine: (line) => {
          pids = pidsOf(line);
          wereAlive = pids.length === 2 && pids.every((p) => alive(p));
          act(owner, controller);
        },
      }).catch((e: unknown) => e);
      owner.close();
      return { pids, wereAlive, result };
    };
    for (const [name, act] of [
      ["cancel", (_o: ProcessOwner, c: AbortController) => c.abort()],
      ["service exit", (o: ProcessOwner) => o.close()],
      [
        "procd killed",
        (o: ProcessOwner) =>
          void execFileSync("taskkill", ["/F", "/PID", String(o.ownerPid)]),
      ],
    ] as const) {
      const { pids, wereAlive } = await holding(act);
      assert.ok(wereAlive, `${name}: the descendants were running first`);
      assert.deepEqual(
        await waitGone(pids),
        [],
        `${name} ended every descendant`,
      );
    }
    // The wall budget ends the whole job, and says so.
    const started = Date.now();
    const walled = await holding(() => {}, { wallMs: 1500 });
    assert.ok(walled.wereAlive, "running before the budget");
    const result = walled.result as { code: number; wallExceeded: boolean };
    assert.equal(result.code, WALL_EXIT_CODE);
    assert.equal(result.wallExceeded, true);
    assert.ok(Date.now() - started < 15_000, "ended near its budget");
    assert.deepEqual(
      await waitGone(walled.pids),
      [],
      "the budget ended every descendant",
    );
  },
);

test(
  "an engine worker's output is capped: past it the run fails; a media worker's output is not",
  { skip: !windows },
  async () => {
    const flood = await run(["flood", "80"], {
      profile: ENGINE_WORKER_PROFILE,
      keepStdout: false,
    }).catch((e: unknown) => e);
    assert.ok(
      flood instanceof CommandError && flood.code === "LIMIT_EXCEEDED",
      String(flood),
    );
    // Below the cap it runs to the end.
    const under = await run(["flood", "8"], {
      profile: ENGINE_WORKER_PROFILE,
      keepStdout: false,
    });
    assert.equal(under.code, 0, under.stderr);
    assert.equal(under.bytes, 8 * 1024 * 1024);
    // The media profile (an FFmpeg decode streams more than 64 MiB) is unchanged.
    const media = await run(["flood", "80"], { keepStdout: false });
    assert.equal(media.code, 0, media.stderr);
    assert.equal(media.bytes, 80 * 1024 * 1024);
  },
);

test(
  "services cannot start a process for an engine worker: WMI and Task Scheduler, with controls",
  { skip: !windows },
  async () => {
    // WMI: Win32_Process.Create would run a command from the WMI service,
    // outside the worker's job. The worker cannot even connect to root\cimv2.
    // (PowerShell and cscript do not start under the profile at all, so the
    // native probe makes the call.)
    assert.equal(
      spawnSync(probe, ["wmi"], { encoding: "utf8" }).stdout,
      "connected",
      "WMI control",
    );
    const wmi = await run(["wmi"], { profile: ENGINE_WORKER_PROFILE });
    assert.match(wmi.stdout, /^denied 0x/, "no connection to the WMI service");

    // Task Scheduler: a task the worker created would run outside its job.
    const dir = await temp("yamakan-escape-");
    const task = `YamakanEscapeTest-${process.pid}`;
    const create = (name: string) => [
      "/Create",
      "/TN",
      name,
      "/SC",
      "ONCE",
      "/ST",
      "23:59",
      "/TR",
      `cmd.exe /c echo escaped > ${path.join(dir, "task.txt")}`,
      "/F",
    ];
    try {
      // Control: an ordinary process can create (and delete) a task.
      const ok = spawnSync(schtasks, create(`${task}-control`), {
        encoding: "utf8",
      });
      assert.equal(ok.status, 0, `Task Scheduler control: ${ok.stderr}`);
      const created = await run(create(task), {
        executable: schtasks,
        allow: [schtasks],
        profile: ENGINE_WORKER_PROFILE,
        cwd: dir,
      });
      // schtasks ran and was refused by the Task Scheduler (not a failed start).
      assert.notEqual(created.code, 0);
      assert.match(created.stderr, /Access is denied/, created.stderr);
      const listed = spawnSync(schtasks, ["/Query", "/TN", task], {
        encoding: "utf8",
      });
      assert.notEqual(listed.status, 0, "the worker created no task");
    } finally {
      spawnSync(schtasks, ["/Delete", "/TN", task, "/F"]);
      spawnSync(schtasks, ["/Delete", "/TN", `${task}-control`, "/F"]);
    }
  },
);

test(
  "COM local servers and job breakaway: denied, credited where the control works here",
  { skip: !windows },
  async (t) => {
    // A local COM server would run outside the job. MMC20.Application needs
    // elevation on this host, so the control usually fails: then the denial
    // is recorded, not credited.
    const progid = "MMC20.Application";
    const comControl = spawnSync(probe, ["com", progid], {
      encoding: "utf8",
    }).stdout;
    const com = await run(["com", progid], { profile: ENGINE_WORKER_PROFILE });
    assert.match(
      com.stdout,
      /^denied /,
      "activation refused (not a missing class)",
    );
    if (comControl !== "created")
      t.diagnostic(
        `COM control failed (${comControl}): local-server denial not qualified here`,
      );
    // Breakaway: procd's jobs never allow it (ERROR_ACCESS_DENIED). When this
    // test runs inside a job that forbids breakaway, the control fails too.
    const breakControl = spawnSync(probe, ["breakaway"], {
      encoding: "utf8",
    }).stdout;
    const broke = await run(["breakaway"], { profile: ENGINE_WORKER_PROFILE });
    assert.equal(broke.stdout, "denied 5", "no child leaves the job");
    if (breakControl !== "started")
      t.diagnostic(
        `breakaway control failed (${breakControl}): denial not qualified here`,
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
    // Control: the real folder is accepted.
    assert.equal(
      (
        await run(["exit"], {
          profile: ENGINE_WORKER_PROFILE,
          writable: [target],
        })
      ).code,
      0,
    );
    await assert.rejects(
      run(["exit"], { profile: ENGINE_WORKER_PROFILE, writable: [link] }),
      (e: unknown) =>
        e instanceof CommandError &&
        /writable folder is missing or is a link/.test(e.message),
    );
  },
);

test(
  "registryRead: what it opens (keys whose ACL grants it or app packages) and what it does not",
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
