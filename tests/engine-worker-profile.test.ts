// YU-041: the engine-worker profile, qualified with no-model stand-ins. A
// worker may start a few descendants, all inside its kill-on-close job,
// restricted token and network-less AppContainer; none outlives the worker,
// a cancel, the service, or the wall budget. Every denial has a positive
// control in the same environment.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
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
// Whether a process id is still alive (an uncontained check).
const alive = (pid: number) =>
  (
    spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8" })
      .stdout ?? ""
  ).includes(` ${pid} `);
const waitGone = async (pids: number[], ms = 8000) => {
  const until = Date.now() + ms;
  while (pids.some(alive) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 200));
  return pids.filter(alive);
};
async function run(
  args: string[],
  options: {
    profile?: WorkerProfile;
    readable?: string[];
    writable?: string[];
    signal?: AbortSignal;
    onStdout?: (b: Buffer) => void;
    owner?: ProcessOwner;
  } = {},
) {
  const owner = options.owner ?? new ProcessOwner([probe]);
  let stdout = "";
  try {
    const result = await owner.run({
      executable: probe,
      args,
      cwd: tmpdir(),
      profile: options.profile,
      readable: options.readable,
      writable: options.writable,
      signal: options.signal,
      onStdout: (b) => {
        stdout += b;
        options.onStdout?.(b);
      },
    });
    return { ...result, stdout };
  } finally {
    if (!options.owner) owner.close();
  }
}

test(
  "the profile is versioned and hashed, and out-of-bounds profiles are refused",
  { skip: !windows },
  async () => {
    assert.match(profileHash(ENGINE_WORKER_PROFILE), /^[0-9a-f]{64}$/);
    assert.notEqual(
      profileHash(profile({ maxProcesses: 5 })),
      profileHash(ENGINE_WORKER_PROFILE),
    );
    for (const bad of [
      profile({ maxProcesses: 0 }),
      profile({ maxProcesses: 9 }),
      profile({ wallMs: 0 }),
    ])
      await assert.rejects(
        run(["exit"], { profile: bad }),
        (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
      );
  },
);

test(
  "descendants: the media profile admits none, the engine profile its bound and no more",
  { skip: !windows },
  async () => {
    // The media profile (unchanged): no child at all.
    const media = await run(["tree", "2", "200"]);
    assert.equal(media.code, 0, media.stderr);
    assert.equal(media.stdout.split("|")[0], "0", media.stdout);
    // The engine profile: its permitted descendants run.
    const engine = await run(["tree", "3", "200"], {
      profile: profile({ maxProcesses: 4 }),
    });
    assert.equal(engine.code, 0, engine.stderr);
    assert.equal(engine.stdout.split("|")[0], "3", engine.stdout);
    // Beyond the bound, the job refuses more processes.
    const capped = await run(["tree", "6", "500"], {
      profile: profile({ maxProcesses: 4 }),
    });
    assert.equal(capped.stdout.split("|")[0], "3", capped.stdout);
  },
);

test(
  "under the engine profile, sentinels and the network stay denied, with positive controls",
  { skip: !windows },
  async () => {
    const outside = await temp("yamakan-sentinel-");
    const sentinel = path.join(outside, "sentinel.txt");
    await writeFile(sentinel, "SENTINEL");
    const granted = path.join(await temp("yamakan-granted-"), "input.txt");
    await writeFile(granted, "input");
    const writable = await temp("yamakan-staging-");
    const listener = createServer((s) => s.end());
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const port = String((listener.address() as { port: number }).port);
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
      const free = spawnSync(probe, args, {
        encoding: "utf8",
        timeout: 30_000,
      });
      const control = JSON.parse(free.stdout.trim());
      assert.equal(control.sentinel, true);
      assert.equal(control.loopback, true);
      assert.equal(control.child, true);
      assert.equal(
        spawnSync(probe, ["dns", "localhost"], { encoding: "utf8" }).stdout,
        "resolved",
      );
      await rm(path.join(writable, "ok.txt"), { force: true });
      // The engine worker: alive, its staging written and its input read, its
      // descendants permitted, and nothing else.
      const contained = await run(args, {
        profile: ENGINE_WORKER_PROFILE,
        readable: [granted],
        writable: [writable],
      });
      assert.equal(contained.code, 0, contained.stderr);
      const seen = JSON.parse(contained.stdout.trim());
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
      assert.equal(seen.loopback, false, "no TCP to the loopback HTTP server");
      const dns = await run(["dns", "localhost"], {
        profile: ENGINE_WORKER_PROFILE,
      });
      assert.equal(dns.stdout, "denied", "no name resolution");
    } finally {
      listener.close();
    }
  },
);

test(
  "no descendant outlives its worker, a cancel, the service, or the wall budget",
  { skip: !windows },
  async () => {
    // A child left behind on purpose by a worker that exits at once.
    const orphan = await run(["orphan", "60000"], {
      profile: ENGINE_WORKER_PROFILE,
    });
    const left = Number(orphan.stdout);
    assert.ok(left > 0, orphan.stdout);
    assert.deepEqual(await waitGone([left]), [], "the job ended the orphan");

    // Cancelled while its descendants run.
    const controller = new AbortController();
    let pids: number[] = [];
    const cancelled = run(["spawn-hold", "2", "60000"], {
      profile: ENGINE_WORKER_PROFILE,
      signal: controller.signal,
      onStdout: (b) => {
        pids = String(b).trim().split(",").map(Number).filter(Boolean);
        controller.abort();
      },
    });
    await cancelled.catch(() => null);
    assert.equal(pids.length, 2);
    assert.deepEqual(await waitGone(pids), [], "cancel ended every descendant");

    // The service goes away (the owner closes procd's input).
    const owner = new ProcessOwner([probe]);
    let held: number[] = [];
    const running = run(["spawn-hold", "2", "60000"], {
      owner,
      profile: ENGINE_WORKER_PROFILE,
      onStdout: (b) => {
        held = String(b).trim().split(",").map(Number).filter(Boolean);
        owner.close();
      },
    });
    await running.catch(() => null);
    assert.equal(held.length, 2);
    assert.deepEqual(
      await waitGone(held),
      [],
      "service exit ended every descendant",
    );

    // The wall budget ends the whole job.
    let timed: number[] = [];
    const started = Date.now();
    const wall = await run(["spawn-hold", "2", "60000"], {
      profile: profile({ wallMs: 1500 }),
      onStdout: (b) =>
        (timed = String(b).trim().split(",").map(Number).filter(Boolean)),
    });
    assert.equal(wall.code, WALL_EXIT_CODE);
    assert.ok(Date.now() - started < 15_000, "ended near its budget");
    assert.deepEqual(
      await waitGone(timed),
      [],
      "the budget ended every descendant",
    );
  },
);

test(
  "registryRead does not open the user's own registry to the worker",
  { skip: !windows },
  async () => {
    const key = `Software\\YamakanSandboxTest-${process.pid}`;
    const set = spawnSync(
      "reg",
      ["add", `HKCU\\${key}`, "/v", "Secret", "/d", "SENTINEL", "/f"],
      { encoding: "utf8" },
    );
    assert.equal(set.status, 0, set.stderr);
    try {
      // Positive control: the same probe, uncontained, reads the value.
      assert.equal(
        spawnSync(probe, ["reg", key, "Secret"], { encoding: "utf8" }).stdout,
        "read",
      );
      const contained = await run(["reg", key, "Secret"], {
        profile: ENGINE_WORKER_PROFILE,
      });
      assert.equal(contained.code, 0, contained.stderr);
      assert.equal(contained.stdout, "denied");
    } finally {
      spawnSync("reg", ["delete", `HKCU\\${key}`, "/f"]);
    }
  },
);
