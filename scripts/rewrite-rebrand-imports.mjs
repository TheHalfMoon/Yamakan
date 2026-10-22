/**
 * One-shot import path rewriter for Yamakan rebrand path migrations.
 * Exact substring replacements ordered longest-first.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPLACEMENTS = [
  // Absolute-ish import path fragments (longest first)
  ["core/animation/", "core/animation/"],
  ["core/retime/", "core/retime/"],
  ["core/timeline/ripple/", "core/timeline/ripple/"],
  ["core/timeline/group-move/", "core/timeline/group-move/"],
  ["core/timeline/overlap", "core/timeline/overlap"],
  ["core/timeline/snapping", "core/timeline/snapping"],
  ["core/timeline/adapters", "core/timeline/adapters"],
  ["core/timeline/timeline-types", "core/timeline/timeline-types"],
  ["core/jobs/rules/", "core/jobs/rules/"],
  ["core/hash/", "core/hash/"],
  ["core/storage/", "core/storage/"],
  ["src/audio/", "src/audio/"],
  ["src/editor/", "src/editor/"],
  ["./animation/", "./animation/"],
  ["../animation/", "../animation/"],
  ["../../animation/", "../../animation/"],
  ["../retime/", "../retime/"],
  ["./retime/", "./retime/"],
  ["../timeline/ripple/", "../timeline/ripple/"],
  ["../timeline/group-move/", "../timeline/group-move/"],
  ["../timeline/overlap", "../timeline/overlap"],
  ["./timeline/overlap", "./timeline/overlap"],
  ["../timeline/snapping", "../timeline/snapping"],
  ["./timeline/snapping", "./timeline/snapping"],
  ["../timeline/adapters", "../timeline/adapters"],
  ["./timeline/adapters", "./timeline/adapters"],
  ["../jobs/rules/", "../jobs/rules/"],
  ["./jobs/rules/", "./jobs/rules/"],
  ["../hash/", "../hash/"],
  ["./hash/", "./hash/"],
  ["../storage/", "../storage/"],
  ["./storage/", "./storage/"],
  ["./editor/", "./editor/"],
  ["../editor/", "../editor/"],
  ["../../../core/retime/", "../../../core/retime/"],
  ["../../core/", "../../core/"],
  ["../core/animation/", "../core/animation/"],
  ["../core/retime/", "../core/retime/"],
  ["../core/hash/", "../core/hash/"],
  ["../core/storage/", "../core/storage/"],
  ["../core/jobs/rules/", "../core/jobs/rules/"],
  ["../core/timeline/", "../core/timeline/"],
  // package.json test glob
  ["src/editor/utils", "src/editor/utils"],
];

const EXT = /\.(?:[cm]?[jt]sx?|mjs|json|md)$/;
const SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "graft",
  "work",
  ".yamakan",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(".")) {
  let text = readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    if (text.includes(from)) text = text.split(from).join(to);
  }
  // Relative imports that used donors/opencut without core/ prefix from core/
  text = text.replaceAll(
    /from ["'](\.\.\/)+donors\/opencut\/animation\//g,
    (m) => m.replace("donors/opencut/animation/", "animation/"),
  );
  if (text !== before) {
    writeFileSync(file, text);
    changed++;
    console.log("updated", file.replaceAll("\\", "/"));
  }
}
console.log(`rewrote ${changed} files`);
