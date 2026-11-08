// A file is read only with the decoders Yamakan supports. FFmpeg 7.1.1 has known overflows in
// its JPEG 2000 and OpenEXR decoders, and a MOV can carry either: the container list alone let
// them run on an imported file, in the probe itself.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, mkdtempSync, rmSync, statSync } from "node:fs";
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
        return true;
      },
    );
});
