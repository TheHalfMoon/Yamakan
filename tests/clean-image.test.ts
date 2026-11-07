// What goes is made anew from the pixels, so nothing hidden in a file can go with it. Each
// hiding place here got through a filter of the file that an earlier review broke.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { mediaTools } from "../core/process/workers.ts";
import { closeWorkers } from "../core/process/workers.ts";
import { cleanImage } from "../core/engines/clean-image.ts";

const root = mkdtempSync(path.join(tmpdir(), "clean-image-"));
after(() => {
  closeWorkers();
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});
const SIZE = { width: 704, height: 480 };
const SECRET = "24.7136N 46.6753E My Phone 2026-11-06";

const ffmpeg = (...args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...args],
    {
      windowsHide: true,
    },
  );
const make = (name: string, source = "testsrc2=size=64x48") => {
  const file = path.join(root, name);
  ffmpeg("-f", "lavfi", "-i", source, "-frames:v", "1", file);
  return readFileSync(file);
};
const JPEG = make("real.jpg");
const PNG = make("real.png");

const clean = (data: Buffer, type: string) =>
  cleanImage(data, type, SIZE, path.join(root, `w-${Math.random()}`));

const segment = (marker: number, body: Buffer) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
const text = Buffer.from(SECRET, "latin1");

const exif = (orientation: number) => {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  return Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, text]);
};

const beforeScan = (extra: Buffer) =>
  Buffer.concat([JPEG.subarray(0, 2), extra, JPEG.subarray(2)]);
const atEnd = (extra: Buffer) => {
  const end = JPEG.lastIndexOf(Buffer.from([0xff, 0xd9]));
  return Buffer.concat([JPEG.subarray(0, end), extra, JPEG.subarray(end)]);
};
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
const afterHeader = (extra: Buffer) =>
  Buffer.concat([PNG.subarray(0, 33), extra, PNG.subarray(33)]);

// As a colour profile really travels, which is what FFmpeg's own PNG writer carried across.
const profile = Buffer.concat([text, Buffer.alloc(200, 7)]);
const pngProfile = chunk(
  "iCCP",
  Buffer.concat([Buffer.from("My Phone\0\0", "latin1"), deflateSync(profile)]),
);
const jpegProfile = segment(
  0xe2,
  Buffer.concat([
    Buffer.from("ICC_PROFILE\0", "latin1"),
    Buffer.from([1, 1]),
    profile,
  ]),
);

const HIDING: readonly (readonly [string, Buffer, string])[] = [
  ["a JPEG's colour profile", beforeScan(jpegProfile), "image/jpeg"],
  ["a PNG's colour profile", afterHeader(pngProfile), "image/png"],
  [
    "a PNG's mastering display",
    afterHeader(chunk("mDCv", Buffer.concat([text.subarray(0, 24)]))),
    "image/png",
  ],
  [
    "a PNG's light level",
    afterHeader(chunk("cLLi", text.subarray(0, 8))),
    "image/png",
  ],
  [
    "a PNG's stereo mode",
    afterHeader(chunk("sTER", Buffer.from([1]))),
    "image/png",
  ],
  [
    "a PNG's colour code",
    afterHeader(chunk("cICP", Buffer.from([9, 16, 0, 1]))),
    "image/png",
  ],
  ["Exif", beforeScan(segment(0xe1, exif(1))), "image/jpeg"],
  [
    "XMP",
    beforeScan(
      segment(
        0xe1,
        Buffer.concat([Buffer.from("http://ns.adobe.com/xap/1.0/\0"), text]),
      ),
    ),
    "image/jpeg",
  ],
  [
    "an Adobe segment's payload",
    beforeScan(
      segment(
        0xee,
        Buffer.concat([
          Buffer.from("Adobe\x00d\x00\x00\x00\x00\x01", "latin1"),
          text,
        ]),
      ),
    ),
    "image/jpeg",
  ],
  ["a comment", beforeScan(segment(0xfe, text)), "image/jpeg"],
  ["an unknown marker", beforeScan(segment(0xf0, text)), "image/jpeg"],
  ["a DNL marker", atEnd(segment(0xdc, text)), "image/jpeg"],
  [
    "an extra quantization table",
    beforeScan(
      segment(
        0xdb,
        Buffer.concat([
          Buffer.from([0x03]),
          text,
          Buffer.alloc(64 - text.length, 1),
        ]),
      ),
    ),
    "image/jpeg",
  ],
  ["after the scan's last byte", atEnd(text), "image/jpeg"],
  ["after the picture's end", Buffer.concat([JPEG, text]), "image/jpeg"],
  [
    "a PNG text chunk",
    afterHeader(chunk("tEXt", Buffer.concat([Buffer.from("Comment\0"), text]))),
    "image/png",
  ],
  ["an oversized tRNS", afterHeader(chunk("tRNS", text)), "image/png"],
  ["an oversized gAMA", afterHeader(chunk("gAMA", text)), "image/png"],
  [
    "IEND's own payload",
    Buffer.concat([PNG.subarray(0, PNG.length - 12), chunk("IEND", text)]),
    "image/png",
  ],
  [
    "an extra IDAT",
    Buffer.concat([
      PNG.subarray(0, PNG.length - 12),
      chunk("IDAT", text),
      PNG.subarray(PNG.length - 12),
    ]),
    "image/png",
  ],
  ["after a PNG's end", Buffer.concat([PNG, text]), "image/png"],
];

const REFUSED_ANYWAY = new Set<string>([]);

// Every chunk of the result, by name.
const chunksOf = (png: Buffer) => {
  const names: string[] = [];
  let at = 8;
  while (at + 8 <= png.length) {
    names.push(png.toString("latin1", at + 4, at + 8));
    at += 12 + png.readUInt32BE(at);
  }
  return names;
};

// Exactly the three chunks that hold a picture, and exactly its pixels inside: the secret
// could not hide compressed, as a colour profile's did.
function assertOnlyPixels(made: Buffer) {
  assert.deepEqual(chunksOf(made), ["IHDR", "IDAT", "IEND"]);
  const length = made.readUInt32BE(33);
  const rows = inflateSync(made.subarray(41, 41 + length));
  assert.equal(rows.length, (704 * 3 + 1) * 480);
  assert.ok(!rows.includes(text));
  assert.ok(!made.includes(text));
}

for (const [name, data, type] of HIDING)
  test(`text hidden in ${name} does not go`, async () => {
    // A profile's text is compressed, and a short chunk holds none: the rest hold it plainly.
    if (!/profile|display|light level|stereo|colour code/.test(name))
      assert.ok(data.includes(text), "the file really holds it");
    // A file the decoder refuses cannot leave either, but that must not hide a test that does
    // nothing: the list below says which of these come through as pictures.
    const made = await clean(data, type).catch(() => null);
    if (!made) {
      assert.ok(REFUSED_ANYWAY.has(name), `${name} was refused, not cleaned`);
      return;
    }
    assertOnlyPixels(made);
  });

test("a real picture comes through, at the size the model takes", async () => {
  const made = await clean(JPEG, "image/jpeg");
  const file = path.join(root, "out.png");
  writeFileSync(file, made);
  assert.deepEqual(rgbAt(file, 352, 240).length, 3);
  assertOnlyPixels(made);
  assert.equal(made.readUInt32BE(16), 704);
  assert.equal(made.readUInt32BE(20), 480);
});

// The colour of one pixel, from the file as a decoder sees it.
function rgbAt(file: string, x: number, y: number) {
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-vf",
      `crop=1:1:${x}:${y},format=rgb24`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-",
    ],
    { windowsHide: true },
  );
  return [...raw];
}

test("a phone's sideways photo comes out upright, though the words that said so are gone", async () => {
  // Red on the left and blue on the right, marked to be turned a quarter clockwise, so upright
  // red is on top. The same file with no mark keeps red on the left.
  const plain = make(
    "halves.jpg",
    "color=c=red:s=64x64[a];color=c=blue:s=64x64[b];[a][b]hstack",
  );
  const marked = Buffer.concat([
    plain.subarray(0, 2),
    segment(0xe1, exif(6)),
    plain.subarray(2),
  ]);
  const look = async (data: Buffer) => {
    const file = path.join(root, `look-${Math.random()}.png`);
    writeFileSync(file, await clean(data, "image/jpeg"));
    const red = (pixel: number[]) => pixel[0] > pixel[2];
    return {
      topIsRed: red(rgbAt(file, 352, 40)),
      bottomIsRed: red(rgbAt(file, 352, 440)),
      leftIsRed: red(rgbAt(file, 40, 240)),
      rightIsRed: red(rgbAt(file, 664, 240)),
    };
  };
  const turned = await look(marked);
  assert.equal(turned.topIsRed, true);
  assert.equal(turned.bottomIsRed, false);
  const flat = await look(plain);
  assert.equal(flat.leftIsRed, true);
  assert.equal(flat.rightIsRed, false);
});

for (const [name, data, type] of [
  ["not an image at all", Buffer.from("words"), "image/png"],
  ["a JPEG called a PNG", JPEG, "image/png"],
  ["a PNG called a JPEG", PNG, "image/jpeg"],
  ["an empty file", Buffer.alloc(0), "image/jpeg"],
  ["another kind of image", PNG, "image/webp"],
  ["a kind named after an object's own property", PNG, "constructor"],
  [
    "a JPEG cut short",
    JPEG.subarray(0, Math.floor(JPEG.length / 2)),
    "image/jpeg",
  ],
  ["a PNG cut short", PNG.subarray(0, Math.floor(PNG.length / 2)), "image/png"],
] as const)
  test(`${name} is refused, in words that name no path`, async () => {
    await assert.rejects(clean(data, type), (e: Error) => {
      assert.equal(
        e.message,
        "That image could not be prepared, so nothing was sent.",
      );
      return true;
    });
  });

test("a failure of the worker itself is refused the same way, naming no path", async () => {
  // Its folder cannot be made: a file stands where it would go.
  const blocked = path.join(root, "a-file");
  writeFileSync(blocked, "x");
  await assert.rejects(
    cleanImage(JPEG, "image/jpeg", SIZE, path.join(blocked, "under")),
    (e: Error) => {
      assert.equal(
        e.message,
        "That image could not be prepared, so nothing was sent.",
      );
      return true;
    },
  );
});

test("the photo's own copy does not stay in the working folder", async () => {
  const folder = path.join(root, "kept");
  await cleanImage(JPEG, "image/jpeg", SIZE, folder);
  assert.equal(existsSync(folder), false);
  await cleanImage(Buffer.from("words"), "image/jpeg", SIZE, folder).catch(
    () => {},
  );
  assert.equal(existsSync(folder), false);
});
