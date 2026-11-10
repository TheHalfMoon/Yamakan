import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { guardUpload, readBody, uploadDeadlineMs } from "../server/body.ts";

test("a command's body is read whole", async () => {
  const req = new PassThrough();
  const read = readBody(req, 100, 1000);
  req.write("{");
  req.end('"a":1}');
  assert.equal((await read).toString(), '{"a":1}');
});

test("a body past its size is refused", async () => {
  const req = new PassThrough();
  const read = readBody(req, 4, 1000);
  req.end("12345");
  await assert.rejects(read, /size limit/);
});

// A byte now and then restarts an idle timeout; the deadline is for the whole body.
test("a body that keeps trickling in is cut off at its deadline", async () => {
  const req = new PassThrough();
  const started = Date.now();
  const read = readBody(req, 1000, 300);
  const drip = setInterval(() => req.write("x"), 50);
  try {
    await assert.rejects(read, /took too long/);
  } finally {
    clearInterval(drip);
  }
  const took = Date.now() - started;
  assert.ok(took >= 250 && took < 2000, `${took} ms`);
  assert.equal(req.destroyed, true, "its connection is let go");
});

test("an upload trickling in is cut off at its deadline", async () => {
  const req = new PassThrough();
  guardUpload(req, 1000, 300);
  const drip = setInterval(() => req.write("x"), 50);
  req.resume();
  let why: Error | null = null;
  try {
    await new Promise<void>((resolve) =>
      req.once("error", (e) => {
        why = e;
        resolve();
      }),
    );
  } finally {
    clearInterval(drip);
  }
  assert.match(String(why), /took too long to arrive/);
  assert.equal(req.destroyed, true);
});

// The work after the body has come, such as probing it, is not cut short by the deadline.
test("an upload that has all arrived is not cut off afterwards", async () => {
  // Kept open once ended, so only the deadline could destroy it.
  const req = new PassThrough({ autoDestroy: false });
  const errors: unknown[] = [];
  req.on("error", (e) => errors.push(e));
  guardUpload(req, 1000, 200);
  req.resume();
  req.end("whole");
  await new Promise((r) => setTimeout(r, 400));
  assert.deepEqual(errors, []);
  assert.equal(req.destroyed, false);
});

test("an upload's deadline grows with its size", () => {
  assert.equal(uploadDeadlineMs(0), 120_000);
  assert.equal(uploadDeadlineMs(256 * 1024), 121_000);
  // Two gibibytes: well over two hours.
  assert.ok(uploadDeadlineMs(2 * 1024 ** 3) > 2 * 3600_000);
});
