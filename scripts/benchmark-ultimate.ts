// YU-090 benchmark harness CLI. Local and offline: it reads the frozen
// protocol and a recorded observations file and prints a report. It never
// runs a model, calls a provider or downloads anything.
//
//   node scripts/benchmark-ultimate.ts protocol
//   node scripts/benchmark-ultimate.ts analyze <observations.json>
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  analyse,
  parseObservations,
  parseProtocol,
} from "../core/quality/benchmark.ts";

const protocolFile = fileURLToPath(
  new URL("../docs/evidence/ultimate/benchmark-protocol.json", import.meta.url),
);
const [command, file] = process.argv.slice(2);
const { protocol, sha256 } = parseProtocol(
  await readFile(protocolFile, "utf8"),
);
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
    parseObservations(await readFile(file, "utf8")),
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
