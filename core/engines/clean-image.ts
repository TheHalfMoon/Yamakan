// A picture to send elsewhere, made anew from its pixels. The founder chose that a photo's
// metadata does not go. Neither filtering a file nor having FFmpeg write a new one can promise
// that: a file has many places to hide text in, and FFmpeg carries a colour profile across.
// So FFmpeg, in its worker, only decodes: it turns the picture upright by what a JPEG says, fits
// it to the size the model takes, and gives back bare pixels, with nothing beside them. This
// writes those into a PNG of the three chunks that hold a picture.
// This cannot remove what the picture itself shows, such as a street sign or a face.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { RESOURCE_POLICY } from "../command/policy.ts";
import { mediaTools, workers } from "../process/workers.ts";

const DECODERS = new Map([
  ["image/png", { codec: "png", extension: "png" }],
  ["image/jpeg", { codec: "mjpeg", extension: "jpg" }],
]);
// Whatever went wrong: what FFmpeg or the system says can name this computer's paths.
const REFUSED = "That image could not be prepared, so nothing was sent.";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type: string, body: Buffer) {
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, sum]);
}

// Eight-bit RGB, row by row, with nothing beside it.
function pngOf(rgb: Buffer, width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = width * 3;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++)
    rgb.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function cleanImage(
  data: Uint8Array,
  mediaType: string,
  size: { width: number; height: number },
  folder: string,
): Promise<Buffer> {
  const decoder = DECODERS.get(mediaType);
  if (!decoder) throw new Error(REFUSED);
  const { width, height } = size;
  const source = path.join(folder, `source.${decoder.extension}`);
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(source, data);
    const chunks: Buffer[] = [];
    const result = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        // A damaged file is refused, not filled in with what the decoder can make up.
        "-err_detect",
        "explode",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-f",
        "image2",
        "-c:v",
        decoder.codec,
        "-i",
        path.basename(source),
        "-frames:v",
        "1",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},format=rgb24`,
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-f",
        "rawvideo",
        "-",
      ],
      cwd: folder,
      readable: [source],
      memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
      signal: AbortSignal.timeout(60_000),
      stderrLimit: 2000,
      onStdout: (piece) => chunks.push(piece),
    });
    const rgb = Buffer.concat(chunks);
    if (result.code !== 0 || rgb.length !== width * height * 3)
      throw new Error(REFUSED);
    return pngOf(rgb, width, height);
  } catch {
    throw new Error(REFUSED);
  } finally {
    // A virus scanner can hold it for a moment, and this is the person's own photo.
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => {});
  }
}
