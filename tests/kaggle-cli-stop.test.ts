import test, { after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { kaggleCli } from "../core/engines/kaggle.ts";

const dir = mkdtempSync(path.join(tmpdir(), "kaggle-cli-stop-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The Kaggle CLI on Windows is a launcher with Python as its child: stopping it must end both.
// Node stands in for both here; nothing reaches Kaggle. The child is started detached, outside
// the job Node keeps its own children in, so ending the parent alone would leave it running.
test("a stopped CLI ends with the process it started", async () => {
  const beat = path.join(dir, "beat");
  const pidFile = path.join(dir, "pid");
  const child =
    "const fs=require('fs');fs.writeFileSync(process.argv[2],String(process.pid));" +
    "setInterval(()=>fs.writeFileSync(process.argv[1],String(Date.now())),20)";
  const parent =
    "const {spawn}=require('child_process');" +
    `spawn(process.execPath,['-e',${JSON.stringify(child)},process.argv[1],process.argv[2]],{stdio:'ignore',detached:true});` +
    "setInterval(()=>{},1000)";
  const stop = new AbortController();
  const running = kaggleCli(process.execPath)(
    ["-e", parent, beat, pidFile],
    60_000,
    stop.signal,
  );
  running.catch(() => {});
  try {
    for (let i = 0; i < 200 && !existsSync(beat); i++) await sleep(25);
    assert.ok(existsSync(beat), "the child began");
    stop.abort();
    await assert.rejects(running);
    await sleep(800);
    const first = readFileSync(beat, "utf8");
    await sleep(400);
    assert.equal(readFileSync(beat, "utf8"), first, "the child has ended too");
  } finally {
    // Never leave it running, whatever the result.
    if (existsSync(pidFile))
      try {
        process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
      } catch {}
  }
});
