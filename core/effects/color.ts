// Color pipeline (YU-023). Browser-safe (no Node imports).
//
// Policy `sdr-bt709-tv/v1`, frozen:
// - Output. Every render is SDR Rec.709: BT.709 primaries, transfer and
//   matrix, limited ("tv") range, 8-bit 4:2:0, and is tagged so. Each
//   picture is converted to that once, explicitly, from what its source is.
// - Sources. A source's matrix and range come from its own tags, read at
//   import. An untagged YUV source is read as BT.709 when it is at least
//   720 lines high and as BT.601 below, in limited range (full range for
//   JPEG-style "yuvj" formats). RGB sources (PNG, WebP) have no matrix.
//   Higher bit depths are converted to 8 bits.
// - Refused at import. HDR transfers (PQ, HLG) and wide-gamut BT.2020
//   sources: there is no tone mapping, so they are not shown wrongly.
//
// LUTs: a 3D `.cube` file is parsed strictly (bounded size, one form, no
// other keywords, no file references) and stored as an immutable `lut`
// creative document holding only its numbers. Renders write it back out in
// one canonical form; the original file is never used.
import { z } from "zod";
import { CommandError } from "../command/errors.ts";

export const COLOR_POLICY = "sdr-bt709-tv/v1";

export type SourceMatrix = "bt709" | "bt601";
export type SourceRange = "tv" | "pc";
/** How a source's pixels are read: null for RGB sources. */
export type SourceColor = {
  matrix: SourceMatrix;
  range: SourceRange;
  // Whether the matrix or range was assumed (untagged source).
  assumed: boolean;
} | null;

// ffprobe's names for the transfers and primaries this build refuses.
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);
const WIDE_GAMUT = new Set(["bt2020", "bt2020nc", "bt2020c"]);
const BT601 = new Set(["smpte170m", "bt470bg", "bt470m", "fcc", "smpte240m"]);
const RGB_FORMATS =
  /^(rgb|bgr|argb|abgr|rgba|bgra|gbr|pal8|gray|ya|monob|monow|0rgb|rgb0|0bgr|bgr0)/;

export type ProbedColor = {
  pixelFormat: string;
  matrix: string;
  range: string;
  transfer: string;
  primaries: string;
};

/** The probe's color fields of a video stream, as reported (bounded). */
export function probedColor(stream: Record<string, unknown> | undefined) {
  const field = (key: string) =>
    typeof stream?.[key] === "string"
      ? (stream[key] as string).slice(0, 40)
      : "unknown";
  return {
    pixelFormat: field("pix_fmt"),
    matrix: field("color_space"),
    range: field("color_range"),
    transfer: field("color_transfer"),
    primaries: field("color_primaries"),
  } satisfies ProbedColor;
}

/** Why a source is outside the SDR policy, or null when it is inside. */
export function unsupportedColor(c: ProbedColor): string | null {
  if (HDR_TRANSFERS.has(c.transfer))
    return "HDR video (PQ or HLG) is not supported: Yamakan renders SDR Rec.709 only and has no tone mapping.";
  if (WIDE_GAMUT.has(c.primaries) || WIDE_GAMUT.has(c.matrix))
    return "Wide-gamut BT.2020 video is not supported: Yamakan renders SDR Rec.709 only.";
  return null;
}

/** How the policy reads a source's pixels (see the header). */
export function sourceColor(
  c: ProbedColor | null,
  fallback: { height: number; extension: string },
): SourceColor {
  const pix = c?.pixelFormat ?? "unknown";
  const ext = fallback.extension;
  // Without a recorded probe (an asset imported before YU-023), the file
  // type decides: PNG and WebP are RGB, JPEG is full-range BT.601.
  if (pix === "unknown") {
    if (ext === "png" || ext === "webp") return null;
    if (ext === "jpg" || ext === "jpeg")
      return { matrix: "bt601", range: "pc", assumed: true };
  } else if (RGB_FORMATS.test(pix)) return null;
  let matrix: SourceMatrix = fallback.height >= 720 ? "bt709" : "bt601";
  const tagged = c !== null && (c.matrix === "bt709" || BT601.has(c.matrix));
  if (tagged) matrix = c.matrix === "bt709" ? "bt709" : "bt601";
  const fullRangeType =
    pix.startsWith("yuvj") || ext === "jpg" || ext === "jpeg";
  let range: SourceRange = fullRangeType ? "pc" : "tv";
  const rangeTagged = c?.range === "tv" || c?.range === "pc";
  if (rangeTagged) range = c!.range as SourceRange;
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
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
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
      if (!m || title !== null || size || values.length)
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

function lutError(message: string) {
  return Object.assign(new Error(message), { lut: true as const });
}

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
