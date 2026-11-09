import assert from "node:assert/strict";
import test from "node:test";
import { boundedOutput } from "../core/engines/clean-image.ts";

test("a worker's output is kept up to its limit", () => {
  const out = boundedOutput(6);
  out.take(Buffer.from("abc"));
  out.take(Buffer.from("def"));
  assert.equal(out.over, false);
  assert.equal(out.bytes().toString(), "abcdef");
});

// One that writes more than it rightly could is not stored at all, however much more comes.
test("past its limit, nothing is kept and it says so", () => {
  const out = boundedOutput(6);
  out.take(Buffer.from("abcd"));
  out.take(Buffer.from("efg"));
  out.take(Buffer.alloc(1024 * 1024));
  assert.equal(out.over, true);
  assert.equal(out.bytes().length, 0);
});
