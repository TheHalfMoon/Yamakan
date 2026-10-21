import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ENGINE_ROOT = path.resolve("src/studio/canvas-engine");

// Call-site / import forms only (avoids donor identifiers like "prefetch").
const FORBIDDEN =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b)|from\s+["']node:|import\s*\(\s*(?!["'])/;

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(ent.name) && !/\.test\./.test(ent.name)) out.push(p);
  }
  return out;
}

describe("studio canvas-engine boundaries", () => {
  it("forbids network and node: imports in production engine files", () => {
    const files = walk(ENGINE_ROOT);
    const hits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (FORBIDDEN.test(text)) hits.push(path.relative(ENGINE_ROOT, file));
    }
    expect(hits).toEqual([]);
  });

  it("does not import canvas-operations", () => {
    const files = walk(ENGINE_ROOT);
    const hits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("canvas-operations")) hits.push(path.relative(ENGINE_ROOT, file));
    }
    expect(hits).toEqual([]);
  });
});
