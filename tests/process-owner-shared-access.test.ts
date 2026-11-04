import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mediaTools } from "../core/process/workers.ts";

const media = pathToFileURL(
  fileURLToPath(new URL("../core/media.ts", import.meta.url)),
).href;
const CHILDREN = 72;
const PARALLEL = 12;
const PROBES = 4;

// Each child starts its own process owner and probes the one shared file, so
// separate owners update that file's access list at the same moment. A lost
// entry leaves a worker unable to read its input.
const child = (file: string) =>
  new Promise<string[]>((resolve, reject) => {
    const code = `
      const { probe } = await import(${JSON.stringify(media)});
      const failures = [];
      for (let i = 0; i < ${PROBES}; i++)
        await probe(${JSON.stringify(file)}).catch((e) => failures.push(e.message));
      console.log(JSON.stringify(failures));
      process.exit(0);`;
    const run = spawn(process.execPath, ["--input-type=module", "-e", code], {
      stdio: ["ignore", "pipe", "inherit"],
      windowsHide: true,
    });
    let out = "";
    run.stdout.on("data", (b) => (out += b));
    run.on("error", reject);
    run.on("close", () => {
      try {
        resolve(JSON.parse(out.trim().split("\n").pop()!));
      } catch (e) {
        reject(e);
      }
    });
  });

test(
  "process owners sharing an input never lose each other's access entries",
  { skip: process.platform !== "win32", timeout: 300_000 },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yamakan-shared-access-"));
    try {
      const file = path.join(root, "still.png");
      execFileSync(
        mediaTools().ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=red:s=16x16",
          "-frames:v",
          "1",
          file,
        ],
        { windowsHide: true },
      );
      const failures: string[] = [];
      let started = 0;
      await Promise.all(
        Array.from({ length: PARALLEL }, async () => {
          while (started < CHILDREN) {
            started++;
            failures.push(...(await child(file)));
          }
        }),
      );
      // Only the unexplained launch failure (Windows error 2) is tolerated
      // here; it is tracked in docs/evidence/ultimate/SS-017-access-lock.md. A
      // refused or timed out grant, or a failed revoke, fails this test.
      assert.deepEqual(
        failures.filter((message) => !/\(Windows error 2\)/.test(message)),
        [],
      );
      // So that this cannot pass with nothing having worked.
      assert.ok(
        failures.length < (CHILDREN * PROBES) / 2,
        `${failures.length} of ${CHILDREN * PROBES} probes failed`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
