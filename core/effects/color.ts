// Color pipeline (YU-023). Browser-safe (no Node imports).
//
// Policy `sdr-bt709-tv/v1`, frozen:
// - Output. Every render is SDR Rec.709: BT.709 primaries, transfer and
//   matrix, limited ("tv") range, 8-bit 4:2:0, and is tagged so. Each
//   picture is converted to that once, explicitly, from what its source is.
// - Sources. A source's matrix and range come from its own tags, read at
//   import. An untagged YUV source is read as BT.709 when it is at least
//   720 lines high and as BT.601 below, in limited range; JPEG and "yuvj"
//   (JFIF) are full-range BT.601. RGB sources (PNG, WebP) have no matrix.
//   Higher bit depths are converted to 8 bits.
// - Refused at import. HDR (PQ, HLG, Dolby Vision or HDR10 side data),
//   BT.2020 and other gamuts, transfers and matrices outside what the
//   scaler converts: an allow-list, with no tone mapping, so nothing is
//   shown wrongly. Untagged HDR without side data cannot be detected.
//
// LUTs: a 3D `.cube` file is parsed strictly (bounded size, one form, no
// other keywords, no file references) and stored as an immutable `lut`
// creative document holding only its numbers. Renders write it back out in
// one canonical form; the original file is never used.
import { z } from "zod";
import { CommandError } from "../command/errors.ts";

export const COLOR_POLICY = "sdr-bt709-tv/v1";

// The scaler's names for the matrices it converts from.
export type SourceMatrix = "bt709" | "bt601" | "fcc" | "smpte240m";
export type SourceRange = "tv" | "pc";
/** How a source's pixels are read: null for RGB sources. */
export type SourceColor = {
  matrix: SourceMatrix;
  range: SourceRange;
  // Whether the matrix or range was assumed (untagged source).
  assumed: boolean;
} | null;

// What the policy reads, by ffprobe's names; any other value is refused
// (an allow-list: a transfer, gamut or matrix this build does not convert
// is never shown as if it were SDR Rec.709).
const SDR_TRANSFERS = new Set([
  "bt709",
  "smpte170m",
  "bt470bg",
  "bt470m",
  "iec61966-2-1",
  "gamma22",
  "gamma28",
  "unknown",
  "unspecified",
]);
const SDR_PRIMARIES = new Set([
  "bt709",
  "smpte170m",
  "bt470bg",
  "bt470m",
  "smpte240m",
  "unknown",
  "unspecified",
]);
// Matrices the scaler converts from: BT.709, the BT.601 family, SMPTE 240M.
const MATRICES: Readonly<Record<string, SourceMatrix>> = Object.freeze({
  bt709: "bt709",
  smpte170m: "bt601",
  bt470bg: "bt601",
  fcc: "fcc",
  smpte240m: "smpte240m",
});
const UNTAGGED = new Set(["unknown", "unspecified", "gbr"]);
// A recorded tag is data: only the map's own keys are read (never an
// inherited name such as "constructor"), and only its values come out.
const matrixOf = (tag: string): SourceMatrix | null =>
  Object.hasOwn(MATRICES, tag) ? MATRICES[tag]! : null;
// A probed name in a message, when it has the shape of one.
const named = (tag: string) =>
  /^[a-z0-9._-]{1,40}$/.test(tag) ? tag : "an unrecognised";
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);
const WIDE_GAMUT = new Set(["bt2020", "bt2020nc", "bt2020c"]);
// Side data that marks HDR even without HDR tags (Dolby Vision profile 5,
// HDR10 mastering metadata, HDR10+).
const HDR_SIDE_DATA =
  /dovi|dolby vision|mastering display|content light level|hdr10+|dynamic hdr/i;
const RGB_FORMATS =
  /^(rgb|bgr|argb|abgr|rgba|bgra|gbr|pal8|gray|ya|monob|monow|0rgb|rgb0|0bgr|bgr0)/;
// An untagged YUV source this tall or taller is read as BT.709 (HD).
const HD_LINES = 720;
// Each probed field is kept to this many characters.
export const PROBED_FIELD_LENGTH = 40;
export const PROBED_KEYS = [
  "pixelFormat",
  "matrix",
  "range",
  "transfer",
  "primaries",
] as const;

export type ProbedColor = Record<(typeof PROBED_KEYS)[number], string>;

/** The probe's color fields of a video stream, as reported (bounded). */
export function probedColor(
  stream: Record<string, unknown> | undefined,
): ProbedColor {
  const field = (key: string) =>
    typeof stream?.[key] === "string"
      ? (stream[key] as string).slice(0, PROBED_FIELD_LENGTH)
      : "unknown";
  return {
    pixelFormat: field("pix_fmt"),
    matrix: field("color_space"),
    range: field("color_range"),
    transfer: field("color_transfer"),
    primaries: field("color_primaries"),
  };
}

/** Whether a stream carries HDR side data (Dolby Vision, HDR10 metadata). */
export function hasHdrSideData(stream: Record<string, unknown> | undefined) {
  const list = stream?.side_data_list;
  return (
    Array.isArray(list) &&
    list.some(
      (x) =>
        typeof x?.side_data_type === "string" &&
        HDR_SIDE_DATA.test(x.side_data_type as string),
    )
  );
}

/** Why a source is outside the SDR policy, or null when it is inside. */
export function unsupportedColor(
  c: ProbedColor,
  hdrSideData = false,
): string | null {
  if (HDR_TRANSFERS.has(c.transfer) || hdrSideData)
    return "HDR video (PQ, HLG or Dolby Vision) is not supported: Yamakan renders SDR Rec.709 only and has no tone mapping.";
  if (WIDE_GAMUT.has(c.primaries) || WIDE_GAMUT.has(c.matrix))
    return "Wide-gamut BT.2020 video is not supported: Yamakan renders SDR Rec.709 only.";
  if (!SDR_PRIMARIES.has(c.primaries))
    return `Video with ${named(c.primaries)} primaries (a wide or other gamut) is not supported: Yamakan renders SDR Rec.709 only.`;
  if (!SDR_TRANSFERS.has(c.transfer))
    return `Video with the ${named(c.transfer)} transfer is not supported: Yamakan renders SDR Rec.709 only.`;
  if (!matrixOf(c.matrix) && !UNTAGGED.has(c.matrix))
    return `Video with the ${named(c.matrix)} matrix is not supported: Yamakan reads BT.709, BT.601 and SMPTE 240M.`;
  return null;
}

/** How the policy reads a source's pixels (see the header). */
export function sourceColor(
  c: ProbedColor | null,
  fallback: { height: number; extension: string },
): SourceColor {
  const pix = c?.pixelFormat ?? "unknown";
  const ext = fallback.extension;
  const jpeg = ext === "jpg" || ext === "jpeg" || pix.startsWith("yuvj");
  // Without a recorded probe (an asset imported before YU-023), the file
  // type decides: PNG and WebP are RGB, JPEG is full-range BT.601.
  if (pix === "unknown" && (ext === "png" || ext === "webp")) return null;
  if (pix !== "unknown" && RGB_FORMATS.test(pix)) return null;
  // JFIF is BT.601 whatever its size; other untagged YUV goes by height.
  let matrix: SourceMatrix = "bt601";
  if (!jpeg && fallback.height >= HD_LINES) matrix = "bt709";
  const read = c === null ? null : matrixOf(c.matrix);
  const tagged = read !== null;
  if (read) matrix = read;
  let range: SourceRange = jpeg ? "pc" : "tv";
  const rangeTagged = c?.range === "tv" || c?.range === "pc";
  if (rangeTagged) range = c.range as SourceRange;
  return { matrix, range, assumed: !tagged || !rangeTagged };
}

// ---------------------------------------------------------------- LUTs

export const LUT_LIMITS = Object.freeze({
  // The .cube text accepted, its lines and each line's length.
  sourceBytes: 1536 * 1024,
  lines: 40_000,
  lineLength: 256,
  minSize: 2,
  maxSize: 33,
});

const Name = z
  .string()
  .trim()
  .min(1)
  .max(120)
  // eslint-disable-next-line no-control-regex
  .refine((s) => !/[\u0000-\u001f\u007f‪-‮⁦-⁩]/.test(s), {
    message: "A LUT name has no control or direction characters.",
  });

// The stored document: a 3D table of size³ RGB entries (red fastest, as in
// .cube), each channel quantized to 16 bits (0..65535 for 0..1), base64.
export const LutDocumentSchema = z
  .object({
    format: z.literal("yamakan.lut"),
    formatVersion: z.literal(1),
    name: Name,
    size: z.number().int().min(LUT_LIMITS.minSize).max(LUT_LIMITS.maxSize),
    data: z.string().max(4 * Math.ceil((LUT_LIMITS.maxSize ** 3 * 6) / 3)),
  })
  .strict()
  .superRefine((d, ctx) => {
    const bytes = base64Length(d.data);
    if (bytes !== d.size ** 3 * 6)
      ctx.addIssue({
        code: "custom",
        message: "A LUT holds exactly size³ entries.",
      });
  });
export type LutDocument = z.infer<typeof LutDocumentSchema>;

function base64Length(s: string): number {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4) return -1;
  let pad = 0;
  if (s.endsWith("==")) pad = 2;
  else if (s.endsWith("=")) pad = 1;
  return (s.length / 4) * 3 - pad;
}

const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d{1,3})?$/;
// A tolerance for values a hair outside 0..1 from the tool that wrote them.
const EDGE = 1e-4;

/**
 * Parses a .cube LUT strictly: TITLE, LUT_3D_SIZE (2 to 33), and
 * DOMAIN_MIN 0 0 0 / DOMAIN_MAX 1 1 1 only, comments, then exactly size³
 * lines of three numbers in 0..1. Anything else is refused with its line.
 */
export function parseCube(text: string, fallbackName: string): LutDocument {
  if (new TextEncoder().encode(text).length > LUT_LIMITS.sourceBytes)
    throw lutError(
      `A LUT file is at most ${LUT_LIMITS.sourceBytes / 1024} KiB.`,
    );
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines.length > LUT_LIMITS.lines + 64)
    throw lutError("A LUT file has too many lines.");
  let title: string | null = null;
  let size = 0;
  const values: number[] = [];
  lines.forEach((raw, i) => {
    const n = i + 1;
    if (raw.length > LUT_LIMITS.lineLength)
      throw lutError(`Line ${n} is too long.`);
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(/\s+/);
    const key = parts[0]!;
    if (key === "TITLE") {
      const m = /^TITLE\s+"([^"]*)"$/.exec(line);
      if (!m || title !== null || values.length)
        throw lutError(`Line ${n}: TITLE is one quoted name before the table.`);
      title = m[1]!;
      return;
    }
    if (key === "LUT_3D_SIZE") {
      const s = Number(parts[1]);
      if (
        parts.length !== 2 ||
        !/^\d+$/.test(parts[1]!) ||
        s < LUT_LIMITS.minSize ||
        s > LUT_LIMITS.maxSize ||
        size ||
        values.length
      )
        throw lutError(
          `Line ${n}: LUT_3D_SIZE is one size from ${LUT_LIMITS.minSize} to ${LUT_LIMITS.maxSize}, before the table.`,
        );
      size = s;
      return;
    }
    if (key === "DOMAIN_MIN" || key === "DOMAIN_MAX") {
      const want = key === "DOMAIN_MIN" ? 0 : 1;
      if (
        parts.length !== 4 ||
        parts.slice(1).some((p) => !NUMBER.test(p) || Number(p) !== want) ||
        values.length
      )
        throw lutError(
          `Line ${n}: only the 0 to 1 domain is supported (${key} ${want} ${want} ${want}).`,
        );
      return;
    }
    if (key === "LUT_1D_SIZE")
      throw lutError(`Line ${n}: only 3D LUTs are supported.`);
    if (parts.length !== 3 || parts.some((p) => !NUMBER.test(p)))
      throw lutError(
        `Line ${n}: unsupported line (only TITLE, LUT_3D_SIZE, DOMAIN_MIN, DOMAIN_MAX and three numbers per entry).`,
      );
    if (!size) throw lutError(`Line ${n}: LUT_3D_SIZE comes before the table.`);
    if (values.length >= size ** 3 * 3)
      throw lutError(`Line ${n}: more entries than ${size}³.`);
    for (const p of parts) {
      const v = Number(p);
      if (!Number.isFinite(v) || v < -EDGE || v > 1 + EDGE)
        throw lutError(`Line ${n}: entries are between 0 and 1.`);
      values.push(Math.min(1, Math.max(0, v)));
    }
  });
  if (!size) throw lutError("The file has no LUT_3D_SIZE.");
  if (values.length !== size ** 3 * 3)
    throw lutError(
      `The table has ${values.length / 3} entries; LUT_3D_SIZE ${size} needs ${size ** 3}.`,
    );
  const quantized = new Uint8Array(values.length * 2);
  values.forEach((v, i) => {
    const q = Math.round(v * 65535);
    quantized[i * 2] = q & 0xff;
    quantized[i * 2 + 1] = q >> 8;
  });
  const name = (title ?? fallbackName).trim().slice(0, 120) || "LUT";
  return LutDocumentSchema.parse({
    format: "yamakan.lut",
    formatVersion: 1,
    name: Name.safeParse(name).success ? name : "LUT",
    size,
    data: toBase64(quantized),
  });
}

/** The canonical .cube text a render gives FFmpeg (no title, no domain). */
export function cubeText(lut: LutDocument): string {
  const bytes = fromBase64(lut.data);
  const out = [`LUT_3D_SIZE ${lut.size}`];
  for (let i = 0; i < bytes.length; i += 6) {
    const ch = (k: number) =>
      ((bytes[i + k]! | (bytes[i + k + 1]! << 8)) / 65535).toFixed(6);
    out.push(`${ch(0)} ${ch(2)} ${ch(4)}`);
  }
  return `${out.join("\n")}\n`;
}

/** An identity LUT of `size`, for tests and as a neutral reference. */
export function identityCube(size: number): string {
  const lines = [`LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++)
        lines.push([r, g, b].map((v) => (v / (size - 1)).toFixed(6)).join(" "));
  return lines.join("\n");
}

/** A .cube file this build does not accept (reported as VALIDATION). */
export class LutError extends Error {}
const lutError = (message: string) => new LutError(message);

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    s += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : "=";
    s += i + 2 < bytes.length ? B64[n & 63]! : "=";
  }
  return s;
}
function fromBase64(s: string): Uint8Array {
  const out = new Uint8Array(base64Length(s));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => B64.indexOf(s[i + k]!));
    const n =
      (v[0]! << 18) | (v[1]! << 12) | ((v[2]! & 63) << 6) | (v[3]! & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length && s[i + 2] !== "=") out[o++] = (n >> 8) & 255;
    if (o < out.length && s[i + 3] !== "=") out[o++] = n & 255;
  }
  return out;
}

/** Validation of a parsed `lut` creative document (core/documents.ts). */
export function validateLut(value: unknown) {
  const parsed = LutDocumentSchema.safeParse(value);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid LUT.",
    );
  return { content: parsed.data, assetIds: [], objectDigests: [] };
}

// A stored LUT is at most this many canonical bytes (a 33³ table).
export const LUT_DOCUMENT_BYTES = 512 * 1024;
