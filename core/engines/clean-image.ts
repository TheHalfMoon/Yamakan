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

// Only what a picture needs, before its pixels: nothing here can hold a word. FFmpeg writes these
// from a PNG with nothing beside its pixels, and this checks that it did, as a colour profile once
// came through it unasked. The size of APP0 is that of its fields alone, with no thumbnail.
const JPEG_APP0 = 0xe0;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_PICTURE_SEGMENTS = new Set([0xdb, 0xc0, 0xc4, 0xdd]);
export function jpegHoldsOnlyAPicture(jpeg: Uint8Array) {
  const b = Buffer.from(jpeg);
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return false;
  if (b.readUInt16BE(b.length - 2) !== 0xffd9) return false;
  for (let at = 2; at + 4 <= b.length;) {
    if (b[at] !== 0xff) return false;
    const marker = b[at + 1];
    if (marker === JPEG_START_OF_SCAN) return true;
    const length = b.readUInt16BE(at + 2);
    if (marker === JPEG_APP0) {
      if (length !== 16 || b.toString("latin1", at + 4, at + 9) !== "JFIF\0")
        return false;
    } else if (!JPEG_PICTURE_SEGMENTS.has(marker)) return false;
    at += 2 + length;
  }
  return false;
}

// Best first: 2 is as fine as FFmpeg's encoder goes, and 12 is where a picture starts to show it.
const JPEG_QUALITIES = [2, 3, 5, 8, 12];

// What is sent has to fit what Kaggle accepts in a script. A PNG loses nothing, so it goes as it
// is when it fits. A photo's rarely does, and then a JPEG of the same bare pixels goes instead.
export async function imageWithin(
  png: Buffer,
  maxBytes: number,
  folder: string,
  refused: string,
): Promise<{ data: Buffer; mediaType: "image/png" | "image/jpeg" }> {
  if (png.length <= maxBytes) return { data: png, mediaType: "image/png" };
  const source = path.join(folder, "clean.png");
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(source, png);
    for (const quality of JPEG_QUALITIES) {
      const chunks: Buffer[] = [];
      const result = await workers().run({
        executable: mediaTools().ffmpeg,
        args: [
          "-hide_banner",
          "-nostdin",
          "-loglevel",
          "error",
          "-threads",
          String(RESOURCE_POLICY.enforced.renderThreads),
          "-f",
          "image2",
          "-c:v",
          "png",
          "-i",
          path.basename(source),
          "-frames:v",
          "1",
          "-map_metadata",
          "-1",
          "-pix_fmt",
          "yuvj420p",
          "-c:v",
          "mjpeg",
          "-q:v",
          String(quality),
          "-flags",
          "+bitexact",
          "-fflags",
          "+bitexact",
          "-threads",
          String(RESOURCE_POLICY.enforced.renderThreads),
          "-f",
          "image2pipe",
          "-",
        ],
        cwd: folder,
        readable: [source],
        memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
        signal: AbortSignal.timeout(60_000),
        stderrLimit: 2000,
        onStdout: (piece) => chunks.push(piece),
      });
      const jpeg = Buffer.concat(chunks);
      if (result.code !== 0 || !jpegHoldsOnlyAPicture(jpeg))
        throw new Error(REFUSED);
      if (jpeg.length <= maxBytes)
        return { data: jpeg, mediaType: "image/jpeg" };
    }
    throw new Error(refused);
  } catch (e) {
    throw new Error((e as Error).message === refused ? refused : REFUSED);
  } finally {
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => {});
  }
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
