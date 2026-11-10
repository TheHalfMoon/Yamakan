/**
 * The software bill of materials Yamakan ships (CycloneDX 1.5): every runtime npm package, from
 * the lockfile alone (so it is the same on every machine), and the vendored FFmpeg build's
 * files with the SHA-256 its pinned list gives. The random serial number and the time npm adds
 * are left out, so the same lockfile always makes the same file.
 *
 *   node scripts/sbom.mjs          writes docs/evidence/sbom/yamakan-runtime.cdx.json
 *   node scripts/sbom.mjs --check  fails if that file is not what the lockfile makes now
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  ROOT,
  "docs",
  "evidence",
  "sbom",
  "yamakan-runtime.cdx.json",
);
const VENDOR = path.join(ROOT, "vendor", "ffmpeg-win64-r8");
const PACKAGE = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
);

function npmSbom() {
  // Fixed arguments only. npm is a .cmd on Windows, which Node runs only through a shell.
  const text = execFileSync(
    "npm",
    [
      "sbom",
      "--sbom-format",
      "cyclonedx",
      "--omit",
      "dev",
      "--package-lock-only",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      shell: process.platform === "win32",
    },
  );
  return JSON.parse(text);
}

function vendored() {
  const sums = readFileSync(path.join(VENDOR, "SHA256SUMS"), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  return sums
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = /^([a-f0-9]{64}) \*?(\S+)$/.exec(line.trim());
      if (!match) throw new Error(`SHA256SUMS line not understood: ${line}`);
      const [, hash, name] = match;
      return {
        type: "file",
        "bom-ref": `file:vendor/ffmpeg-win64-r8/${name}`,
        name: `vendor/ffmpeg-win64-r8/${name}`,
        // Its files have several licences (FFmpeg GPL-3.0-or-later, zlib, libpng, brotli MIT,
        // the GCC runtime exception...): none is claimed here for any one of them.
        description:
          "A file of the vendored FFmpeg 7.1.5 build; licences in vendor/ffmpeg-win64-r8/README.md.",
        hashes: [{ alg: "SHA-256", content: hash }],
      };
    });
}

// The same input makes the same bytes: no serial, no time, components in one order.
function normalise(bom) {
  const { serialNumber: _serial, ...rest } = bom;
  const { timestamp: _time, ...metadata } = rest.metadata ?? {};
  // npm names the top component after the folder the checkout is in; every clone and CI
  // would differ. It is named from package.json, as its purl already is.
  if (metadata.component) metadata.component.name = PACKAGE.name;
  // The npm version alone would make a Node upgrade look like a dependency change.
  if (Array.isArray(metadata.tools))
    metadata.tools = metadata.tools.map(({ version: _v, ...tool }) => tool);
  const components = [...(rest.components ?? []), ...vendored()].sort((a, b) =>
    String(a["bom-ref"] ?? a.purl ?? a.name).localeCompare(
      String(b["bom-ref"] ?? b.purl ?? b.name),
    ),
  );
  const dependencies = (rest.dependencies ?? [])
    .map((d) => ({ ...d, dependsOn: [...(d.dependsOn ?? [])].sort() }))
    .sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
  return { ...rest, metadata, components, dependencies };
}

const made = JSON.stringify(normalise(npmSbom()), null, 2) + "\n";
if (process.argv.includes("--check")) {
  let committed = "";
  try {
    committed = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  } catch {}
  if (committed !== made) {
    console.error(
      `${path.relative(ROOT, OUT)} is not what the lockfile and the vendored list make now. Run: npm run sbom`,
    );
    process.exit(1);
  }
  console.log(`SBOM matches: ${path.relative(ROOT, OUT)}`);
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, made);
  const count = JSON.parse(made).components.length;
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${count} components).`);
}
