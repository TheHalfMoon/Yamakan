// An image with nothing but its picture, to send elsewhere: a photo's location, device and
// dates would otherwise stay in a notebook's history. By allowlist, so a kind of metadata
// not thought of here does not go. Anything that cannot be read as what it says refuses,
// rather than going as it came. Its upright direction lives in what is removed, so that one
// number is read first, and travels beside the image.
export type StrippedImage = { image: Buffer; orientation: number };

class NotAnImage extends Error {
  constructor() {
    super("That image could not be read, so nothing was sent.");
  }
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// What draws the picture, and nothing that describes it.
const PNG_KEEP = new Set([
  "IHDR",
  "PLTE",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "IDAT",
  "IEND",
]);

function stripPng(data: Buffer): Buffer {
  const parts: Buffer[] = [PNG_SIGNATURE];
  let at = PNG_SIGNATURE.length;
  let ended = false;
  while (!ended) {
    if (at + 12 > data.length) throw new NotAnImage();
    const length = data.readUInt32BE(at);
    const end = at + 12 + length;
    if (end > data.length) throw new NotAnImage();
    const type = data.toString("latin1", at + 4, at + 8);
    if (PNG_KEEP.has(type)) parts.push(data.subarray(at, end));
    ended = type === "IEND";
    at = end;
  }
  return Buffer.concat(parts);
}

// The Exif orientation, 1 to 8, or 1 when it says nothing usable.
function exifOrientation(segment: Buffer): number {
  if (segment.toString("latin1", 0, 6) !== "Exif\0\0") return 1;
  const tiff = segment.subarray(6);
  if (tiff.length < 8) return 1;
  const order = tiff.toString("latin1", 0, 2);
  if (order !== "II" && order !== "MM") return 1;
  const little = order === "II";
  const u16 = (at: number) =>
    little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  const u32 = (at: number) =>
    little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);
  const directory = u32(4);
  if (directory + 2 > tiff.length) return 1;
  const count = u16(directory);
  for (let i = 0; i < count; i++) {
    const entry = directory + 2 + i * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function stripJpeg(data: Buffer): StrippedImage {
  const parts: Buffer[] = [data.subarray(0, 2)];
  let orientation = 1;
  let scanned = false;
  let at = 2;
  for (;;) {
    if (at + 2 > data.length || data[at] !== 0xff) throw new NotAnImage();
    // Any number of fill bytes may come before a marker.
    let code = at + 1;
    while (data[code] === 0xff) code++;
    const marker = data[code];
    if (marker === undefined) throw new NotAnImage();
    if (marker === 0xd9) {
      // An end with no picture before it is not an image. Whatever follows the end, such as
      // a second embedded image, does not go.
      if (!scanned) throw new NotAnImage();
      parts.push(data.subarray(at, code + 1));
      return { image: Buffer.concat(parts), orientation };
    }
    if (code + 3 > data.length) throw new NotAnImage();
    const length = data.readUInt16BE(code + 1);
    const end = code + 1 + length;
    if (length < 2 || end > data.length) throw new NotAnImage();
    const body = data.subarray(code + 3, end);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1 && orientation === 1)
      orientation = exifOrientation(body);
    // Comments and application data go, but for what tells a decoder its colours. The
    // tables between a progressive picture's scans are kept whole, read by their length.
    const keep =
      marker !== 0xfe &&
      (!isApp ||
        (marker === 0xee && body.toString("latin1", 0, 5) === "Adobe"));
    if (keep) parts.push(data.subarray(at, end));
    at = end;
    if (marker !== 0xda) continue;
    // A scan runs until the next real marker: in it, 0xff is followed by 0 or a restart.
    scanned = true;
    const scan = at;
    for (;;) {
      const next = data.indexOf(0xff, at);
      if (next < 0 || next + 1 >= data.length) throw new NotAnImage();
      const after = data[next + 1];
      if (after === 0 || (after >= 0xd0 && after <= 0xd7)) {
        at = next + 2;
        continue;
      }
      parts.push(data.subarray(scan, next));
      at = next;
      break;
    }
  }
}

export function stripImage(data: Buffer, mediaType: string): StrippedImage {
  try {
    if (mediaType === "image/png") {
      if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new NotAnImage();
      return { image: stripPng(data), orientation: 1 };
    }
    if (mediaType === "image/jpeg") {
      if (data[0] !== 0xff || data[1] !== 0xd8) throw new NotAnImage();
      return stripJpeg(data);
    }
  } catch (e) {
    if (e instanceof NotAnImage) throw e;
    throw new NotAnImage();
  }
  throw new NotAnImage();
}
