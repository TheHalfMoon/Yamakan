// A picture to send elsewhere, made anew from its pixels. The founder chose that a photo's
// metadata does not go. Neither filtering a file nor having FFmpeg write a new one can promise
// that: a file has many places to hide text in, and FFmpeg carries a colour profile across.
// So FFmpeg, in its worker, only decodes: it turns the picture upright by what a JPEG says, fits
// it to the size the model takes, and gives back bare pixels, with nothing beside them. This
// writes those into a PNG of the three chunks that hold a picture. `imageWithin` then has FFmpeg
// make a JPEG of that PNG when it is too large to send.
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

// What FFmpeg's encoder writes here, in the shapes it writes them, and nothing else: no comment, no
// camera's segment, no colour profile, no second picture, nothing after the end. FFmpeg writes this
// from a PNG with nothing beside its pixels, and this checks that it did, as a colour profile once
// came through it unasked. The headers' bytes are fixed. A table's values and the scan's bytes are
// the picture's own, and this cannot tell what those say: a forged file could hide words in them.
// It shows only what FFmpeg was given no way to put here, and a segment it should not have written.
const JFIF = ["4a46494600010100000100010000", "4a46494600010200000100010000"];
// Three components: 4:2:0, with one of the two sets of tables each.
const FRAME_COMPONENTS = /^01220002110[01]03110[01]$/;
const SCAN_HEADER = /^0301(?:00|11)02(?:00|11)03(?:00|11)003f00$/;
// Each of the four Huffman tables at most once: the two kinds, for the two sets.
const HUFFMAN_TABLES = new Set([0x00, 0x01, 0x10, 0x11]);
export function jpegHoldsOnlyAPicture(
  jpeg: Uint8Array,
  size: { width: number; height: number },
) {
  const b = Buffer.from(jpeg);
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return false;
  let framed = false;
  const huffman = new Set<number>();
  const quantisation = new Set<number>();
  for (let at = 2; at + 4 <= b.length;) {
    if (b[at] !== 0xff) return false;
    const marker = b[at + 1];
    const length = b.readUInt16BE(at + 2);
    const end = at + 2 + length;
    if (length < 2 || end > b.length) return false;
    if (marker === 0xe0) {
      // JFIF, as this encoder writes it: every byte fixed, so none is free to hold anything.
      if (!JFIF.includes(b.toString("hex", at + 4, end))) return false;
    } else if (marker === 0xdb) {
      // Quantisation: each table one byte, then 64 of eight bits.
      if (length === 2 || (length - 2) % 65 !== 0) return false;
      // The two sets of tables, each at most once.
      for (let t = at + 4; t < end; t += 65) {
        if (b[t] > 1 || quantisation.has(b[t])) return false;
        quantisation.add(b[t]);
      }
    } else if (marker === 0xc0) {
      // The one frame: eight bits, this size, three components.
      if (framed || length !== 17 || b[at + 4] !== 8 || b[at + 9] !== 3)
        return false;
      if (!FRAME_COMPONENTS.test(b.toString("hex", at + 10, end))) return false;
      if (
        b.readUInt16BE(at + 5) !== size.height ||
        b.readUInt16BE(at + 7) !== size.width
      )
        return false;
      framed = true;
    } else if (marker === 0xc4) {
      // Huffman: each table says how long it is, and they must fill the segment exactly.
      if (length === 2) return false;
      let t = at + 4;
      while (t < end) {
        if (t + 17 > end) return false;
        if (!HUFFMAN_TABLES.has(b[t]) || huffman.has(b[t])) return false;
        huffman.add(b[t]);
        let codes = 0;
        for (let i = 1; i <= 16; i++) codes += b[t + i];
        t += 17 + codes;
      }
      if (t !== end) return false;
    } else if (marker === 0xda) {
      // The one scan, then its bytes to the end. Encoded bytes never hold a marker.
      if (!framed || !quantisation.size || !huffman.size || length !== 12)
        return false;
      if (!SCAN_HEADER.test(b.toString("hex", at + 4, end))) return false;
      const last = b.length - 2;
      if (end > last || b.readUInt16BE(last) !== 0xffd9) return false;
      for (let t = end; t < last; t++)
        if (b[t] === 0xff && b[t + 1] !== 0) return false;
      return true;
    } else return false;
    at = end;
  }
  return false;
}

// Best first: 2 is as fine as FFmpeg's encoder goes, and 12 is where a picture starts to show it.
export const JPEG_QUALITIES = [2, 3, 5, 8, 12];

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
          "-codec_whitelist",
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
          // One thread, or this encoder adds restart markers, which vary with the machine.
          "-threads",
          "1",
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
      if (
        result.code !== 0 ||
        !jpegHoldsOnlyAPicture(jpeg, {
          width: png.readUInt32BE(16),
          height: png.readUInt32BE(20),
        })
      )
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
        "-codec_whitelist",
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
