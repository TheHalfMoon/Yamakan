// W18: loudnorm lands within ±1 LU of the default target on a synthetic tone.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mediaTools, closeWorkers } from "../core/process/workers.ts";
import {
  DEFAULT_LOUDNORM_TARGET,
  applyPassFilter,
  measurePassFilter,
  parseLoudnormJson,
} from "../core/audio/loudnorm.ts";

const root = await mkdtemp(path.join(tmpdir(), "yamakan-w18-loud-"));
const ffmpeg = mediaTools().ffmpeg;
const src = path.join(root, "loud.wav");
const out = path.join(root, "norm.wav");
const receipt = path.join(
  "docs",
  "evidence",
  "qualification",
  "w18-loudnorm.json",
);

try {
  execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3:sample_rate=48000",
      "-af",
      "volume=12dB",
      src,
    ],
    { windowsHide: true },
  );
  const measure = execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      src,
      "-af",
      measurePassFilter(DEFAULT_LOUDNORM_TARGET),
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  // FFmpeg prints loudnorm JSON on stderr; execFileSync merges into thrown
  // Error when exit≠0, but measure exits 0 with JSON on stderr — capture via
  // spawn-style by redirecting: Node puts stderr in error only on failure.
  // Use a second invocation that forces stderr into the return via shell.
  const { spawnSync } = await import("node:child_process");
  const measuredRun = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      src,
      "-af",
      measurePassFilter(DEFAULT_LOUDNORM_TARGET),
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  void measure;
  const measured = parseLoudnormJson(measuredRun.stderr ?? "");
  const filter = applyPassFilter({
    target: { ...DEFAULT_LOUDNORM_TARGET },
    measured,
  });
  execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", filter, out],
    { windowsHide: true },
  );
  const verify = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      out,
      "-af",
      measurePassFilter(DEFAULT_LOUDNORM_TARGET),
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const after = parseLoudnormJson(verify.stderr ?? "");
  const delta = Math.abs(after.input_i - DEFAULT_LOUDNORM_TARGET.I);
  const pass = delta <= 1;
  const body = {
    format: "yamakan.qualification.w18-loudnorm/v1",
    targetI: DEFAULT_LOUDNORM_TARGET.I,
    measuredBefore: measured.input_i,
    measuredAfter: after.input_i,
    deltaLu: delta,
    pass,
  };
  await writeFile(receipt, `${JSON.stringify(body, null, 2)}\n`);
  if (!pass) {
    console.error("W18 loudnorm failed", body);
    process.exitCode = 1;
  } else {
    console.log("W18 loudnorm pass", body);
  }
} finally {
  closeWorkers();
  await rm(root, { recursive: true, force: true });
}
