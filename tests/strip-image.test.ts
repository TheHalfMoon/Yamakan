// A photo's metadata does not go, as the founder chose, and the picture stays the same.
// Real files from a real encoder, with metadata added the way cameras add it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { deflateSync } from "node:zlib";
import { mediaTools } from "../core/process/workers.ts";
import { stripImage } from "../core/engines/strip-image.ts";

const root = mkdtempSync(path.join(tmpdir(), "strip-image-"));
after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));

const make = (name: string) => {
  const file = path.join(root, name);
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=64x48",
      "-frames:v",
      "1",
      file,
    ],
    { windowsHide: true },
  );
  return readFileSync(file);
};
const JPEG = make("real.jpg");
const PNG = make("real.png");

const pixels = (data: Buffer, extension: string) => {
  const file = path.join(root, `d-${Math.random()}.${extension}`);
  writeFileSync(file, data);
  return execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "md5", "-"],
    { windowsHide: true, encoding: "utf8" },
  ).trim();
};

const SECRET = "24.7136N 46.6753E My Phone 2026-11-06";

const segment = (marker: number, body: Buffer) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
// A real Exif block: orientation, then text beside it.
const exif = (orientation: number, little = true) => {
  const tiff = Buffer.alloc(8 + 2 + 12 * 2 + 4);
  const u16 = (v: number, at: number) =>
    little ? tiff.writeUInt16LE(v, at) : tiff.writeUInt16BE(v, at);
  const u32 = (v: number, at: number) =>
    little ? tiff.writeUInt32LE(v, at) : tiff.writeUInt32BE(v, at);
  tiff.write(little ? "II" : "MM", 0, "latin1");
  u16(42, 2);
  u32(8, 4);
  u16(2, 8);
  u16(0x010f, 10); // Make
  u16(2, 12);
  u32(4, 14);
  u32(0, 18);
  u16(0x0112, 22); // Orientation
  u16(3, 24);
  u32(1, 26);
  u16(orientation, 30);
  return Buffer.concat([
    Buffer.from("Exif\0\0", "latin1"),
    tiff,
    Buffer.from(SECRET, "latin1"),
  ]);
};
const withJpegMetadata = (orientation = 6, little = true) =>
  Buffer.concat([
    JPEG.subarray(0, 2),
    segment(0xe1, exif(orientation, little)),
    segment(
      0xe1,
      Buffer.from(`http://ns.adobe.com/xap/1.0/\0${SECRET}`, "latin1"),
    ),
    segment(0xed, Buffer.from(`Photoshop 3.0\0${SECRET}`, "latin1")),
    segment(0xe2, Buffer.from(`ICC_PROFILE\0${SECRET}`, "latin1")),
    segment(0xfe, Buffer.from(SECRET, "latin1")),
    JPEG.subarray(2),
    // As a phone keeps a second image after the first.
    Buffer.from(`\xff\xd8${SECRET}\xff\xd9`, "latin1"),
  ]);

const crc = (data: Buffer) => {
  let c = ~0;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
};
const chunk = (type: string, body: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(typed));
  return Buffer.concat([length, typed, sum]);
};
const withPngMetadata = () => {
  const firstChunkEnd = 8 + 25;
  return Buffer.concat([
    PNG.subarray(0, firstChunkEnd),
    chunk("tEXt", Buffer.from(`Comment\0${SECRET}`, "latin1")),
    chunk(
      "iTXt",
      Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${SECRET}`, "latin1"),
    ),
    chunk(
      "zTXt",
      Buffer.concat([Buffer.from("Comment\0\0"), deflateSync(SECRET)]),
    ),
    chunk("eXIf", Buffer.from(SECRET, "latin1")),
    chunk("tIME", Buffer.from(SECRET, "latin1").subarray(0, 7)),
    PNG.subarray(firstChunkEnd),
    Buffer.from(SECRET, "latin1"),
  ]);
};

test("a JPEG's metadata goes, its picture stays, and its direction is read first", () => {
  const data = withJpegMetadata();
  assert.ok(data.includes(SECRET), "the file really holds it");
  const { image, orientation } = stripImage(data, "image/jpeg");
  assert.ok(!image.includes(SECRET));
  assert.equal(orientation, 6);
  assert.equal(pixels(image, "jpg"), pixels(JPEG, "jpg"));
  for (const marker of [0xe1, 0xe2, 0xed, 0xfe])
    assert.ok(
      !image
        .subarray(0, image.indexOf(Buffer.from([0xff, 0xda])))
        .includes(Buffer.from([0xff, marker])),
      `no 0x${marker.toString(16)} segment before the picture`,
    );
});

test("a JPEG's direction reads from either byte order, and a nonsense one is ignored", () => {
  assert.equal(
    stripImage(withJpegMetadata(8, false), "image/jpeg").orientation,
    8,
  );
  assert.equal(
    stripImage(withJpegMetadata(3, true), "image/jpeg").orientation,
    3,
  );
  assert.equal(stripImage(withJpegMetadata(99), "image/jpeg").orientation, 1);
  assert.equal(stripImage(JPEG, "image/jpeg").orientation, 1);
});

test("a PNG's metadata goes, and its picture stays", () => {
  const data = withPngMetadata();
  assert.ok(data.includes(SECRET), "the file really holds it");
  const { image, orientation } = stripImage(data, "image/png");
  assert.ok(!image.includes(SECRET));
  assert.equal(orientation, 1);
  assert.equal(pixels(image, "png"), pixels(PNG, "png"));
  for (const type of ["tEXt", "iTXt", "zTXt", "eXIf", "tIME"])
    assert.ok(!image.includes(type), type);
});

test("a compressed PNG comment cannot pass by not being readable", () => {
  const { image } = stripImage(withPngMetadata(), "image/png");
  assert.ok(!image.includes(deflateSync(SECRET)));
});

for (const [name, data, type] of [
  ["not an image at all", Buffer.from("words"), "image/png"],
  ["a JPEG called a PNG", JPEG, "image/png"],
  ["a PNG called a JPEG", PNG, "image/jpeg"],
  ["a PNG cut short", PNG.subarray(0, 40), "image/png"],
  ["a JPEG cut short", JPEG.subarray(0, 40), "image/jpeg"],
  ["a JPEG with no end", JPEG.subarray(0, JPEG.length - 2), "image/jpeg"],
  ["an empty file", Buffer.alloc(0), "image/jpeg"],
  ["another kind of image", PNG, "image/webp"],
] as const)
  test(`${name} is refused, rather than going as it came`, () => {
    assert.throws(() => stripImage(data, type), /could not be read/);
  });

test("metadata between a picture's scans goes, and its tables stay whole", () => {
  const end = JPEG.lastIndexOf(Buffer.from([0xff, 0xd9]));
  // A table whose own bytes look like the end of the picture, as a progressive file's can.
  const table = segment(0xc4, Buffer.from([0x00, 0xff, 0xd9, 0xff, 0xe1]));
  const data = Buffer.concat([
    JPEG.subarray(0, end),
    segment(0xfe, Buffer.from(SECRET, "latin1")),
    table,
    segment(0xe1, Buffer.from(SECRET, "latin1")),
    JPEG.subarray(end),
  ]);
  const { image } = stripImage(data, "image/jpeg");
  assert.ok(!image.includes(SECRET));
  assert.ok(image.includes(table), "the table is kept whole");
  assert.deepEqual(image.subarray(-2), Buffer.from([0xff, 0xd9]));
});

test("a JPEG's restart markers and stuffed bytes do not end its picture", () => {
  const start = JPEG.indexOf(Buffer.from([0xff, 0xda]));
  const header = JPEG.readUInt16BE(start + 2);
  const scanAt = start + 2 + header;
  const data = Buffer.concat([
    JPEG.subarray(0, scanAt),
    Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd3, 0x56]),
    JPEG.subarray(scanAt),
  ]);
  const { image } = stripImage(data, "image/jpeg");
  // Those seven bytes stay, against the same file stripped without them.
  assert.equal(image.length, stripImage(JPEG, "image/jpeg").image.length + 7);
});

test("a segment claiming more than the file holds is refused", () => {
  const bad = Buffer.concat([
    JPEG.subarray(0, 2),
    Buffer.from([0xff, 0xe1, 0xff, 0xff]),
    Buffer.alloc(4),
  ]);
  assert.throws(() => stripImage(bad, "image/jpeg"), /could not be read/);
});
