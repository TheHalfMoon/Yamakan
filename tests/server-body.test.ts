import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { readBody } from "../server/body.ts";

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
