// A picture to send elsewhere, made anew from its pixels. The founder chose that a photo's
// metadata does not go. Filtering a file cannot promise that, since a file has many places
// to hide text in, so nothing of the file goes: FFmpeg decodes it in its worker, turns it
// upright by what the file says, fits it to the size the model takes, and writes a new PNG.
// This cannot remove what the picture itself shows, such as a street sign or a face.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { mediaTools, workers } from "../process/workers.ts";

const DECODERS: Record<string, { codec: string; extension: string }> = {
  "image/png": { codec: "png", extension: "png" },
  "image/jpeg": { codec: "mjpeg", extension: "jpg" },
};
const UNREADABLE = "That image could not be read, so nothing was sent.";

export async function cleanImage(
  data: Uint8Array,
  mediaType: string,
  size: { width: number; height: number },
  folder: string,
): Promise<Buffer> {
  const decoder = DECODERS[mediaType];
  if (!decoder) throw new Error(UNREADABLE);
  const { width, height } = size;
  await mkdir(folder, { recursive: true });
  const source = path.join(folder, `source.${decoder.extension}`);
  try {
    await writeFile(source, data);
    const chunks: Buffer[] = [];
    const result = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-f",
        "image2",
        "-c:v",
        decoder.codec,
        "-i",
        path.basename(source),
        "-frames:v",
        "1",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1,format=rgb24`,
        "-map_metadata",
        "-1",
        "-fflags",
        "+bitexact",
        "-flags:v",
        "+bitexact",
        "-c:v",
        "png",
        "-f",
        "image2pipe",
        "-",
      ],
      cwd: folder,
      readable: [source],
      memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
      signal: AbortSignal.timeout(60_000),
      stderrLimit: 2000,
      onStdout: (chunk) => chunks.push(chunk),
    });
    const image = Buffer.concat(chunks);
    // Its words can name this computer's paths, so they do not go in the message.
    if (result.code !== 0 || image.length === 0) throw new Error(UNREADABLE);
    return image;
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}
