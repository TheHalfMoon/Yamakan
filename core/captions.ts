// Caption tracks (YU-024): timed text imported from SRT or WebVTT, kept as a
// creative document of its project (immutable and content-addressed, like a
// story or a Studio canvas), editable cue by cue, exported back to SRT or
// WebVTT, and optionally burned in through the same typography path as
// titles (core/render/ass.ts: escaped plain text, pinned fonts).
//
// The parser is bounded and strict: a malformed timestamp, a cue that ends
// before it starts, overlapping cues, styling or region blocks (which can
// name URLs), ASS override markup and unknown tags are refused with the line
// they are on. Simple formatting tags (<b>, <i>, <u>, <c.x>, <v Name>, <lang
// x>, <ruby>, <rt>, and inline timestamps) are removed, keeping their text.
// The original file text is kept verbatim in the document, so nothing is
// lost; each cue also keeps its original index and timestamps.
import { z } from "zod";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";
import { FLICKS_PER_SECOND, Ticks } from "./time.ts";
import { plainTitle } from "./render/ass.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { DocumentRef } from "./document-ref.ts";

export const CAPTION_LIMITS = Object.freeze({
  // The subtitle file as received (UTF-8 bytes).
  sourceBytes: 512 * 1024,
  cues: 2000,
  // A cue's displayed text: characters and lines.
  cueText: 500,
  cueLines: 4,
  // The latest instant a cue may reach: ten hours.
  maxTicks: FLICKS_PER_SECOND * 36_000,
  // Canonical bytes of one caption document.
  documentBytes: 2 * 1024 * 1024,
});

const TICKS_PER_MS = FLICKS_PER_SECOND / 1000;

export const CaptionFormat = z.enum(["srt", "vtt"]);
export type CaptionFormat = z.infer<typeof CaptionFormat>;

// A BCP 47-like language tag (en, ar, ar-SA, zh-Hant).
const Language = z
  .string()
  .max(35)
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

const CueText = z
  .string()
  .min(1)
  .max(CAPTION_LIMITS.cueText)
  .refine((t) => t === plainTitle(t), "Cue text has control characters.")
  .refine(
    (t) => t.split("\n").length <= CAPTION_LIMITS.cueLines,
    `A cue has at most ${CAPTION_LIMITS.cueLines} lines.`,
  )
  .refine((t) => t.trim().length > 0, "A cue has text.");

const CueSchema = z
  .object({
    id: Id,
    startTicks: Ticks.max(CAPTION_LIMITS.maxTicks),
    endTicks: Ticks.max(CAPTION_LIMITS.maxTicks),
    text: CueText,
    // Where the cue came from: its index and timestamps as written.
    source: z
      .object({
        index: z.string().max(32).nullable(),
        start: z.string().max(32),
        end: z.string().max(32),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .refine((c) => c.endTicks > c.startTicks, "A cue ends after it starts.");
export type CaptionCue = z.infer<typeof CueSchema>;

export const CaptionDocumentSchema = z
  .object({
    format: z.literal("yamakan.captions"),
    formatVersion: z.literal(1),
    name: z.string().trim().min(1).max(120),
    language: Language,
    // Drawn into the picture at export and in the reference preview.
    burnIn: z.boolean(),
    // The imported file, verbatim (null for a track made in the editor).
    source: z
      .object({
        format: CaptionFormat,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        text: z.string().max(CAPTION_LIMITS.sourceBytes),
      })
      .strict()
      .nullable(),
    cues: z.array(CueSchema).max(CAPTION_LIMITS.cues),
  })
  .strict()
  .superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (new Set(d.cues.map((c) => c.id)).size !== d.cues.length)
      fail("Cue identifiers must be unique.");
    for (let i = 1; i < d.cues.length; i++) {
      const prev = d.cues[i - 1]!;
      const cue = d.cues[i]!;
      if (cue.startTicks < prev.startTicks) fail("Cues are in time order.");
      else if (cue.startTicks < prev.endTicks)
        fail(
          `Cues ${i} and ${i + 1} overlap; a caption track shows one cue at a time.`,
        );
    }
  });
export type CaptionDocument = z.infer<typeof CaptionDocumentSchema>;

/** Pure validation of a parsed caption document (documents.ts bounds it). */
export function validateCaptions(value: unknown) {
  const parsed = CaptionDocumentSchema.safeParse(value);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues.map((i) => i.message).join("; ") ||
        "Invalid caption track.",
    );
  return { content: parsed.data, assetIds: [], objectDigests: [] };
}

const refuse = (line: number, message: string): never => {
  throw new CommandError("VALIDATION", `Line ${line}: ${message}`);
};

// hh:mm:ss,mmm (SRT) or [hh:]mm:ss.mmm (WebVTT), exactly, to ticks.
function timestamp(text: string, format: CaptionFormat, line: number) {
  const m =
    format === "srt"
      ? /^(\d{1,2}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(text)
      : /^(?:(\d{1,2}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(text);
  if (!m) return refuse(line, `"${text.slice(0, 40)}" is not a timestamp.`);
  const ms =
    ((Number(m[1] ?? 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 +
    Number(m[4]);
  const ticks = ms * TICKS_PER_MS;
  if (ticks > CAPTION_LIMITS.maxTicks)
    refuse(line, "A cue may not reach past ten hours.");
  return ticks;
}

// Formatting tags removed (their text kept); anything else is refused.
const SIMPLE_TAG =
  /<\/?(?:b|i|u|ruby|rt)>|<\/?(?:c|v|lang)(?:[.\s][^<>]{0,80})?>|<\/?font(?:\s[^<>]{0,120})?>|<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/gi;

function cueText(lines: string[], first: number): string {
  const joined = lines.join("\n");
  if (/\{\\/.test(joined))
    refuse(first, "ASS override markup ({\\…}) is not accepted in captions.");
  // Tags are checked before entities are decoded, so "&lt;b&gt;" is text.
  const untagged = joined.replace(SIMPLE_TAG, "");
  if (/<\/?[A-Za-z!?]/.test(untagged))
    refuse(first, "This cue has a tag that captions do not accept.");
  const text = untagged
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&lrm;/g, "‎")
    .replace(/&rlm;/g, "‏")
    .replace(/&amp;/g, "&");
  const plain = plainTitle(text).trim();
  if (!plain) refuse(first, "A cue has no text.");
  if (plain.length > CAPTION_LIMITS.cueText)
    refuse(first, `A cue has more than ${CAPTION_LIMITS.cueText} characters.`);
  if (plain.split("\n").length > CAPTION_LIMITS.cueLines)
    refuse(first, `A cue has more than ${CAPTION_LIMITS.cueLines} lines.`);
  return plain;
}

/**
 * Parses an SRT or WebVTT file into cues (bounded; refused with the line on
 * anything malformed). `newId` names each cue.
 */
export function parseCaptions(
  raw: string,
  format: CaptionFormat,
  newId: () => string,
): CaptionCue[] {
  if (Buffer.byteLength(raw, "utf8") > CAPTION_LIMITS.sourceBytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `A caption file is at most ${CAPTION_LIMITS.sourceBytes} bytes.`,
    );
  const lines = raw.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  let i = 0;
  const blank = () => i < lines.length && lines[i]!.trim() === "";
  if (format === "vtt") {
    if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0] ?? ""))
      refuse(1, 'A WebVTT file starts with "WEBVTT".');
    i = 1;
    // The header's own lines, up to the first blank line.
    while (i < lines.length && !blank()) i++;
  }
  const cues: CaptionCue[] = [];
  while (i < lines.length) {
    while (blank()) i++;
    if (i >= lines.length) break;
    const head = i + 1;
    let line = lines[i]!;
    if (format === "vtt") {
      if (/^NOTE(?:\s|$)/.test(line)) {
        while (i < lines.length && !blank()) i++;
        continue;
      }
      if (/^(?:STYLE|REGION)(?:\s|$)/.test(line))
        refuse(
          head,
          "Styling and region blocks are not accepted (they can load other files).",
        );
    }
    let index: string | null = null;
    if (!line.includes("-->")) {
      index = line.trim().slice(0, 32);
      if (format === "srt" && !/^\d{1,6}$/.test(index))
        refuse(head, "An SRT cue starts with its number.");
      i++;
      line = lines[i] ?? "";
    }
    const timing =
      /^\s*(\S+)\s+-->\s+(\S+)(?:\s+(.*))?$/.exec(line) ??
      refuse(i + 1, "A cue's timing line is missing or malformed.");
    if (format === "srt" && timing[3])
      refuse(i + 1, "SRT cue timings take no settings.");
    const startTicks = timestamp(timing[1]!, format, i + 1);
    const endTicks = timestamp(timing[2]!, format, i + 1);
    if (endTicks <= startTicks) refuse(i + 1, "A cue ends after it starts.");
    i++;
    const textLines: string[] = [];
    const first = i + 1;
    while (i < lines.length && !blank()) {
      if (lines[i]!.includes("-->"))
        refuse(i + 1, "A cue's text may not contain a timing line.");
      textLines.push(lines[i]!);
      i++;
    }
    if (!textLines.length) refuse(first, "A cue has no text.");
    if (cues.length >= CAPTION_LIMITS.cues)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `A caption track has at most ${CAPTION_LIMITS.cues} cues.`,
      );
    const prev = cues[cues.length - 1];
    if (prev && startTicks < prev.endTicks)
      refuse(
        head,
        "This cue starts before the previous one ends; overlapping cues are not accepted.",
      );
    cues.push({
      id: newId(),
      startTicks,
      endTicks,
      text: cueText(textLines, first),
      source: { index, start: timing[1]!, end: timing[2]! },
    });
  }
  return cues;
}

// Milliseconds of a tick count (cue times are whole milliseconds when
// imported; an edited time is rounded to the nearest millisecond).
const msOf = (ticks: number) => Math.round(ticks / TICKS_PER_MS);
function stamp(ticks: number, format: CaptionFormat) {
  const ms = msOf(ticks);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const r = ms % 1000;
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(h)}:${two(m)}:${two(s)}${format === "srt" ? "," : "."}${String(r).padStart(3, "0")}`;
}

// Text written into a cue: never a timing line, a blank line or a tag.
function writable(text: string, format: CaptionFormat) {
  const escaped =
    format === "vtt"
      ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : text.replace(/</g, "‹").replace(/>/g, "›");
  // A brace before a backslash is broken with a word joiner, so no export
  // reads back as ASS override markup; an arrow never reads as a timing.
  return escaped.replace(/\{\\/g, "{⁠\\").replace(/-->/g, "--​>");
}

/** The track as an SRT or WebVTT file. */
export function exportCaptions(
  doc: CaptionDocument,
  format: CaptionFormat,
): string {
  const blocks = doc.cues.map((c, n) => {
    const timing = `${stamp(c.startTicks, format)} --> ${stamp(c.endTicks, format)}`;
    const text = writable(c.text, format);
    return format === "srt"
      ? `${n + 1}\n${timing}\n${text}`
      : `${timing}\n${text}`;
  });
  return format === "vtt"
    ? `WEBVTT\n\n${blocks.join("\n\n")}\n`
    : `${blocks.join("\n\n")}\n`;
}

/** Splits a cue at an instant inside it; each part keeps its own text. */
export function splitCue(
  doc: CaptionDocument,
  cueId: string,
  atTicks: number,
  newCueId: string,
  texts?: { before: string; after: string },
): CaptionDocument {
  const at = doc.cues.findIndex((c) => c.id === cueId);
  const cue = doc.cues[at];
  if (!cue) throw new CommandError("NOT_FOUND", "No such cue.");
  if (!(atTicks > cue.startTicks && atTicks < cue.endTicks))
    throw new CommandError("VALIDATION", "A cue is split inside its time.");
  const before = { ...cue, endTicks: atTicks, text: texts?.before ?? cue.text };
  const after = {
    ...cue,
    id: newCueId,
    startTicks: atTicks,
    text: texts?.after ?? cue.text,
  };
  const cues = [...doc.cues];
  cues.splice(at, 1, before, after);
  return CaptionDocumentSchema.parse({ ...doc, cues });
}

/**
 * The burned-in caption tracks of a revision, for its render plan: each
 * caption document the revision names with burnIn on, read by its content
 * hash (so a render shows that revision's captions), in document id order.
 */
export function burnedInCaptions(
  project: CanonicalProject,
  read: (ref: DocumentRef) => Buffer,
): { startTicks: number; endTicks: number; text: string }[][] {
  return project.documents
    .filter((d) => d.kind === "captions")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((ref) => {
      let doc: CaptionDocument;
      try {
        doc = CaptionDocumentSchema.parse(
          JSON.parse(read(ref).toString("utf8")),
        );
      } catch (e) {
        if (e instanceof CommandError) throw e;
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "A stored caption track is damaged; restore a verified backup.",
        );
      }
      return doc.burnIn
        ? doc.cues.map(({ startTicks, endTicks, text }) => ({
            startTicks,
            endTicks,
            text,
          }))
        : [];
    })
    .filter((track) => track.length);
}
