// YU-090 benchmark harness CLI. Local and offline: it reads the frozen
// protocol and a recorded observations file and prints a report. It never
// runs a model, calls a provider or downloads anything.
//
//   node scripts/benchmark-ultimate.ts protocol
//   node scripts/benchmark-ultimate.ts analyze <observations.json>
import { open, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  BENCHMARK_LIMITS,
  analyse,
  parseObservations,
  parseProtocol,
} from "../core/quality/benchmark.ts";

// A regular file of bounded size, read through one handle.
async function readBounded(file: string) {
  const handle = await open(file, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile())
      throw new Error("The observations must be a regular file.");
    if (info.size > BENCHMARK_LIMITS.bytes)
      throw new Error("The observations file is too large to analyse.");
    const bytes = Buffer.alloc(info.size);
    const { bytesRead } = await handle.read(bytes, 0, info.size, 0);
    return bytes.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

const protocolFile = fileURLToPath(
  new URL("../docs/evidence/ultimate/benchmark-protocol.json", import.meta.url),
);
const [command, file] = process.argv.slice(2);
const { protocol, sha256 } = parseProtocol(
  await readFile(protocolFile, "utf8"),
);
try {
  if (command === "protocol") {
    console.log(
      JSON.stringify(
        {
          format: protocol.format,
          version: protocol.version,
          sha256,
          categories: protocol.categories.map((c) => `${c.id} ${c.name}`),
        },
        null,
        2,
      ),
    );
  } else if (command === "analyze" && file) {
    const report = analyse(
      parseObservations(await readBounded(file)),
      protocol,
      sha256,
    );
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(
      "Usage: node scripts/benchmark-ultimate.ts protocol | analyze <observations.json>",
    );
    process.exit(2);
  }
} catch (e) {
  // One bounded line: never the file's contents or every schema issue.
  const issues = (e as { issues?: { path: unknown[]; message: string }[] })
    .issues;
  const message = issues
    ? issues
        .slice(0, 10)
        .map(
          (i) => `${i.path.join(".").slice(0, 60)}: ${i.message.slice(0, 120)}`,
        )
        .join("; ") +
      (issues.length > 10 ? ` (and ${issues.length - 10} more)` : "")
    : String((e as Error).message ?? e).slice(0, 300);
  console.error(`benchmark: ${message}`);
  process.exit(1);
}
