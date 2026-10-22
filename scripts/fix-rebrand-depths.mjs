import { readFileSync, writeFileSync, readdirSync } from "node:fs";

function walk(dir) {
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${d.name}`.replaceAll("\\", "/");
    if (d.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

function replaceIn(files, pairs) {
  for (const file of files) {
    let text = readFileSync(file, "utf8");
    let next = text;
    for (const [a, b] of pairs) next = next.split(a).join(b);
    if (next !== text) {
      writeFileSync(file, next);
      console.log("fixed", file);
    }
  }
}

replaceIn(walk("core/animation"), [
  ["../../../timeline/", "../timeline/"],
  ["../../../time.ts", "../time.ts"],
]);
replaceIn(walk("core/retime"), [["../../../time.ts", "../time.ts"]]);
replaceIn(
  walk("core/timeline").filter(
    (f) =>
      !f.startsWith("core/timeline/ripple/") &&
      !f.startsWith("core/timeline/group-move/"),
  ),
  [
    ["../../time.ts", "../time.ts"],
    ["../../canonical.ts", "../canonical.ts"],
  ],
);
replaceIn(walk("core/timeline/ripple"), [
  ["../../../time.ts", "../../time.ts"],
]);
replaceIn(walk("core/timeline/group-move"), [
  ["../../../time.ts", "../../time.ts"],
]);

const pp = "src/editor/components/PreviewPlayer.tsx";
let t = readFileSync(pp, "utf8");
const next = t.replace(
  "../../opencut/audio-stretch",
  "../../audio/audio-stretch",
);
if (next !== t) {
  writeFileSync(pp, next);
  console.log("fixed", pp);
}
