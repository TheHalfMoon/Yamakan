// A file is read only with the decoders Yamakan supports. FFmpeg 7.1.1 has known overflows in
// its JPEG 2000 and OpenEXR decoders, and a MOV can carry either: the container list alone let
// them run on an imported file, in the probe itself.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";
import { ProjectStore } from "../core/store.ts";

const root = mkdtempSync(path.join(tmpdir(), "media-decoders-"));
after(() => {
  closeWorkers();
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    // Windows can still hold a folder: tidying up is not what this tests.
  }
});

const made = (name: string, ...codec: string[]) => {
  const file = path.join(root, name);
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=64x48:d=1",
      ...codec,
      file,
    ],
    { windowsHide: true },
  );
  return file;
};

async function importing(file: string) {
  const store = new ProjectStore(path.join(root, `w-${Math.random()}`));
  await store.initialize();
  try {
    const project = await store.create("Decoders");
    return await store.importAsset(
      project.id,
      path.basename(file),
      createReadStream(file),
      statSync(file).size,
    );
  } finally {
    store.close();
  }
}

test("a video in a supported codec still imports", async () => {
  const { asset } = await importing(made("ok.mov", "-c:v", "libx264"));
  assert.equal(asset.width, 64);
});

test("JPEG 2000 and OpenEXR in a MOV are refused before their decoders run", async () => {
  for (const [name, codec] of [
    ["j2k.mov", ["-c:v", "jpeg2000"]],
    ["exr.mov", ["-pix_fmt", "gbrpf32le", "-c:v", "exr"]],
  ] as const)
    await assert.rejects(
      importing(made(name, ...codec)),
      (
        e: Error & {
          code?: string;
        },
      ) => {
        assert.equal(e.code, "MEDIA_INVALID", `${name}: ${e.message}`);
        // The probe itself refused to open the decoder: the codec check after it would
        // refuse too, but only once that decoder had already run.
        assert.match(e.message, /Media probe failed/, name);
        return true;
      },
    );
});

// A file imported before this, already in a project, reaches a render, a proxy or a waveform
// without the import's refusal: only the list on that input stands in the way. So every FFmpeg
// input in core/ carries it, but for these, which read only what Yamakan itself generated.
const OWN_INPUTS: readonly RegExp[] = [/"lavfi"/, /"file:pcm\.wav"/];

test("every FFmpeg input in the service reads with the decoder list", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : e.name.endsWith(".ts")
          ? [path.join(dir, e.name)]
          : [],
    );
  const missing: string[] = [];
  let inputs = 0;
  for (const file of files("core")) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      // An ffmpeg input, and the arguments just before and after it.
      if (line.trim() === '"-i",') {
        inputs++;
        const around = lines.slice(Math.max(0, i - 12), i + 2).join("\n");
        if (
          !around.includes('"-codec_whitelist"') &&
          !OWN_INPUTS.some((own) => own.test(around))
        )
          missing.push(where);
      }
      // An ffprobe run: its arguments may come before or after naming it.
      if (line.includes("executable: mediaTools().ffprobe")) {
        inputs++;
        const args = lines.slice(Math.max(0, i - 25), i + 30).join("\n");
        if (!args.includes('"-codec_whitelist"')) missing.push(where);
      }
    });
  }
  assert.ok(
    inputs >= 15,
    `found ${inputs} inputs: the search has stopped seeing them`,
  );
  assert.deepEqual(missing, []);
});
