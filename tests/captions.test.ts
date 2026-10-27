// YU-024: editable caption tracks. SRT and WebVTT parse to exact cue times
// with their original text kept; malformed, overlapping, styled, region and
// markup input is refused with its line; edits, splits and exports round
// trip mixed Arabic and Latin text; burned-in captions draw the same in the
// reference preview and the export.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CAPTION_LIMITS,
  CaptionDocumentSchema,
  exportCaptions,
  parseCaptions,
  storedCaptions,
  type CaptionDocument,
} from "../core/captions.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import type { Project } from "../core/project.ts";
import { compilePlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { fromEditView } from "../core/canonical.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  await closePreviews();
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});
const MS = 705_600; // flicks per millisecond
const F = 23_520_000; // one 30 fps frame
let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const refused = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};

const SRT = [
  "﻿1",
  "00:00:01,000 --> 00:00:02,500",
  "<i>مرحبا</i> world",
  "",
  "2",
  "00:00:02,500 --> 00:00:04,250",
  "Line one",
  "Line <b>two</b> &amp; more",
  "",
].join("\r\n");

const VTT = [
  "WEBVTT - a header",
  "Kind: captions",
  "",
  "NOTE a note",
  "spanning lines",
  "",
  "intro",
  "00:01.000 --> 00:02.000 align:start",
  "<v Narrator>نص عربي</v> and <c.loud>Latin</c>",
  "",
  "01:00:00.000 --> 01:00:00.040",
  "<00:00:00.010>late &lt;cue&gt;",
  "",
].join("\n");

test("SRT and WebVTT parse to exact times, keeping the original timestamps", () => {
  const srt = parseCaptions(SRT, "srt", ids);
  assert.deepEqual(
    srt.map((c) => [c.startTicks / MS, c.endTicks / MS, c.text]),
    [
      [1000, 2500, "مرحبا world"],
      [2500, 4250, "Line one\nLine two & more"],
    ],
  );
  assert.deepEqual(srt[0]!.source, {
    index: "1",
    start: "00:00:01,000",
    end: "00:00:02,500",
  });
  const vtt = parseCaptions(VTT, "vtt", ids);
  assert.deepEqual(
    vtt.map((c) => [c.startTicks / MS, c.endTicks / MS, c.text]),
    [
      [1000, 2000, "نص عربي and Latin"],
      [3_600_000, 3_600_040, "late <cue>"],
    ],
  );
  assert.equal(vtt[0]!.source?.index, "intro");
});

test("malformed, overlapping, styled, region, markup and oversized input is refused", () => {
  const bad: [string, string, "srt" | "vtt", string][] = [
    [
      "bad timestamp",
      "1\n00:00:01.0 --> 00:00:02,000\nx\n",
      "srt",
      "VALIDATION",
    ],
    [
      "minutes 60",
      "1\n00:60:01,000 --> 01:00:02,000\nx\n",
      "srt",
      "VALIDATION",
    ],
    [
      "ends first",
      "1\n00:00:02,000 --> 00:00:01,000\nx\n",
      "srt",
      "VALIDATION",
    ],
    ["no number", "x\n00:00:01,000 --> 00:00:02,000\nx\n", "srt", "VALIDATION"],
    ["no text", "1\n00:00:01,000 --> 00:00:02,000\n\n", "srt", "VALIDATION"],
    [
      "settings in SRT",
      "1\n00:00:01,000 --> 00:00:02,000 X1:1\nx\n",
      "srt",
      "VALIDATION",
    ],
    [
      "overlap",
      "1\n00:00:01,000 --> 00:00:03,000\na\n\n2\n00:00:02,000 --> 00:00:04,000\nb\n",
      "srt",
      "VALIDATION",
    ],
    [
      "ASS override",
      "1\n00:00:01,000 --> 00:00:02,000\n{\\pos(1,1)}x\n",
      "srt",
      "VALIDATION",
    ],
    [
      "script tag",
      "1\n00:00:01,000 --> 00:00:02,000\n<script>x</script>\n",
      "srt",
      "VALIDATION",
    ],
    ["no header", "00:01.000 --> 00:02.000\nx\n", "vtt", "VALIDATION"],
    [
      "style block (url)",
      "WEBVTT\n\nSTYLE\n::cue { background: url(http://x/y.png) }\n\n00:01.000 --> 00:02.000\nx\n",
      "vtt",
      "VALIDATION",
    ],
    [
      "region block",
      "WEBVTT\n\nREGION\nid:a\n\n00:01.000 --> 00:02.000\nx\n",
      "vtt",
      "VALIDATION",
    ],
    [
      "past ten hours",
      "1\n10:00:00,001 --> 10:00:01,000\nx\n",
      "srt",
      "VALIDATION",
    ],
    [
      "five lines",
      "1\n00:00:01,000 --> 00:00:02,000\na\nb\nc\nd\ne\n",
      "srt",
      "VALIDATION",
    ],
    [
      "huge cue",
      `1\n00:00:01,000 --> 00:00:02,000\n${"x".repeat(501)}\n`,
      "srt",
      "VALIDATION",
    ],
    [
      "huge file",
      "x".repeat(CAPTION_LIMITS.sourceBytes + 1),
      "srt",
      "LIMIT_EXCEEDED",
    ],
    [
      "too many cues",
      Array.from({ length: CAPTION_LIMITS.cues + 1 }, (_, i) => {
        // Cue i from i*10 ms to i*10+5 ms.
        const at = (ms: number) =>
          `00:${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
        return `${i + 1}\n${at(i * 10)} --> ${at(i * 10 + 5)}\nx\n`;
      }).join("\n"),
      "srt",
      "LIMIT_EXCEEDED",
    ],
  ];
  for (const [label, text, format, want] of bad)
    assert.equal(
      refused(() => parseCaptions(text, format, ids)),
      want,
      label,
    );
  // The refusal names the line.
  try {
    parseCaptions(
      "1\n00:00:01,000 --> 00:00:02,000\nok\n\n2\nnope\nx\n",
      "srt",
      ids,
    );
    assert.fail("refused");
  } catch (e) {
    assert.match((e as Error).message, /^Line 6:/);
  }
});

test("export round-trips times and mixed-script text; markup in text is written as text", () => {
  const doc: CaptionDocument = CaptionDocumentSchema.parse({
    format: "yamakan.captions",
    formatVersion: 1,
    name: "Bilingual",
    language: "ar",
    burnIn: false,
    source: null,
    cues: [
      {
        id: ids(),
        startTicks: 1000 * MS,
        endTicks: 2500 * MS,
        text: "مرحبا بالعالم\nHello (عالم) 2026",
        source: null,
      },
      {
        id: ids(),
        startTicks: 3_599_999 * MS,
        endTicks: 3_600_000 * MS,
        text: "a <b>tag</b> --> arrow & {\\an8}",
        source: null,
      },
    ],
  });
  for (const format of ["srt", "vtt"] as const) {
    const text = exportCaptions(doc, format);
    const back = parseCaptions(text, format, ids);
    assert.deepEqual(
      back.map((c) => [c.startTicks, c.endTicks]),
      doc.cues.map((c) => [c.startTicks, c.endTicks]),
      format,
    );
    assert.equal(back[0]!.text, doc.cues[0]!.text, format);
    // The tag and arrow come back as the same text, never as markup or a
    // timing line (only the word joiner that breaks "{\" is added).
    assert.equal(back[1]!.text, "a <b>tag</b> --> arrow & {⁠\\an8}", format);
  }
  // Markup in a cue's text is written as entities in both formats (so
  // "-->" cannot form), with a word joiner between "{" and "\" (so it
  // never reads as ASS override).
  for (const format of ["srt", "vtt"] as const) {
    const text = exportCaptions(doc, format);
    // WebVTT escapes every "&"; SRT leaves a plain one readable.
    assert.match(
      text,
      format === "vtt"
        ? /&lt;b&gt;tag&lt;\/b&gt; --&gt; arrow &amp; /
        : /&lt;b&gt;tag&lt;\/b&gt; --&gt; arrow & /,
    );
    assert.match(text, /\{⁠\\an8\}/);
  }
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-captions-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Captions" })
  ).result as Project;
  // A dark grey still for 3 s, so burned-in text shows on it.
  const still = path.join(root, "grey.png");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x202020:s=320x180",
      "-frames:v",
      "1",
      still,
    ],
    { windowsHide: true },
  );
  const { asset } = await store.importAsset(
    project.id,
    "grey.png",
    await readFile(still),
  );
  const h = await store.load(project.id);
  await execute(browser, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: h.revision,
    operations: [
      {
        type: "clip.add",
        clipId: ids(),
        trackId: h.tracks.find((t) => t.kind === "video")!.id,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 90 * F,
        sourceStartTicks: 0,
      },
    ],
  });
  return { root, store, queue, browser, projectId: project.id };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = (c: Ctx) => c.store.load(c.projectId);

test("import, edit, split and export through commands; the original file is kept", async () => {
  const c = await workspace();
  const documentId = ids();
  const imported = (
    await execute(c.browser, "yamakan.captions.import", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: null,
      name: "Arabic",
      language: "ar",
      format: "srt",
      text: SRT,
    })
  ).result as { document: { contentHash: string } };
  const read = () =>
    CaptionDocumentSchema.parse(
      JSON.parse(
        c.store.getDocument(c.projectId, documentId).bytes.toString("utf8"),
      ),
    );
  assert.equal(read().source?.text, SRT);
  // Edit the second cue's text and time.
  const doc = read();
  doc.cues[1] = { ...doc.cues[1]!, text: "سطر معدل", endTicks: 5000 * MS };
  const saved = (
    await execute(c.browser, "yamakan.captions.save", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: imported.document.contentHash,
      cues: doc.cues,
      burnIn: true,
    })
  ).result as { document: { contentHash: string } };
  // A stale content hash is refused.
  assert.equal(
    await code(
      head(c).then((h) =>
        execute(c.browser, "yamakan.captions.save", {
          projectId: c.projectId,
          expectedRevision: h.revision,
          documentId,
          expectedContentHash: imported.document.contentHash,
          name: "Stale",
        }),
      ),
    ),
    "REVISION_CONFLICT",
  );
  // Overlapping edited cues are refused.
  const overlapping = read().cues.map((x, i) =>
    i === 0 ? { ...x, endTicks: 3000 * MS } : x,
  );
  assert.equal(
    await code(
      head(c).then((h) =>
        execute(c.browser, "yamakan.captions.save", {
          projectId: c.projectId,
          expectedRevision: h.revision,
          documentId,
          expectedContentHash: saved.document.contentHash,
          cues: overlapping,
        }),
      ),
    ),
    "VALIDATION",
  );
  const split = (
    await execute(c.browser, "yamakan.captions.split", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: saved.document.contentHash,
      cueId: read().cues[0]!.id,
      atTicks: 1800 * MS,
      newCueId: ids(),
      texts: { before: "مرحبا", after: "world" },
    })
  ).result as { document: { contentHash: string } };
  assert.ok(split.document.contentHash);
  const after = read();
  assert.deepEqual(
    after.cues.map((x) => [x.startTicks / MS, x.endTicks / MS, x.text]),
    [
      [1000, 1800, "مرحبا"],
      [1800, 2500, "world"],
      [2500, 5000, "سطر معدل"],
    ],
  );
  assert.equal(after.source?.text, SRT, "the imported file is kept");
  const exported = (
    await execute(c.browser, "yamakan.captions.export", {
      projectId: c.projectId,
      documentId,
      format: "srt",
    })
  ).result as { text: string };
  assert.equal(
    exported.text,
    "1\n00:00:01,000 --> 00:00:01,800\nمرحبا\n\n2\n00:00:01,800 --> 00:00:02,500\nworld\n\n3\n00:00:02,500 --> 00:00:05,000\nسطر معدل\n",
  );
});

test("burned-in captions draw the same in the reference preview and the export", async () => {
  const c = await workspace();
  const rows = (
    frame: Buffer,
    w: number,
    h: number,
    y0: number,
    y1: number,
  ) => {
    let bright = 0;
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < w; x++) if (frame[(y * w + x) * 3]! > 180) bright++;
    return bright;
  };
  const frameOf = (file: string, at?: string) =>
    execFileSync(
      mediaTools().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        ...(at ? ["-ss", at] : []),
        "-i",
        file,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ],
      { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
    );
  const W = 1280,
    H = 720;
  const p0 = await head(c);
  const plain = frameOf(
    (await preview(c.store, c.projectId, p0.revision, "frame", 45)).file,
  );
  assert.equal(rows(plain, W, H, 560, 720), 0, "no caption without a track");
  await execute(c.browser, "yamakan.captions.import", {
    projectId: c.projectId,
    expectedRevision: p0.revision,
    documentId: ids(),
    expectedContentHash: null,
    name: "Burned",
    language: "ar",
    format: "srt",
    text: "1\n00:00:01,000 --> 00:00:02,000\nمرحبا Hello\n",
    burnIn: true,
  });
  const p1 = await head(c);
  const reference = frameOf(
    (await preview(c.store, c.projectId, p1.revision, "frame", 45)).file,
  );
  const out = await renderRevision(
    c.store,
    c.projectId,
    p1.revision,
    ["exports", "burned"],
    new AbortController().signal,
    () => {},
  );
  assert.equal(out.plan.titles?.cues.length, 1);
  const exported = frameOf(out.output, "1.5");
  const shown = rows(reference, W, H, 560, 720);
  assert.ok(shown > 200, `caption pixels ${shown}`);
  // The same text in the same place: bright-pixel counts within 10%.
  const inExport = rows(exported, W, H, 560, 720);
  assert.ok(
    Math.abs(inExport - shown) <= shown * 0.1,
    `${inExport} vs ${shown}`,
  );
  // Outside the cue's time, nothing is drawn.
  const later = frameOf(out.output, "2.5");
  assert.equal(rows(later, W, H, 560, 720), 0);
});

test("a version 13 workspace upgrades to 14 and stores caption tracks", async () => {
  const c = await workspace();
  await c.queue.close();
  c.store.close();
  const file = path.join(c.root, "workspace.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  for (const table of ["creative_documents", "document_uploads"]) {
    const { sql } = db
      .prepare("SELECT sql FROM sqlite_schema WHERE name = ?")
      .get(table) as { sql: string };
    db.exec(
      `CREATE TABLE ${table}_old ${sql
        .slice(sql.indexOf("("))
        .replace(
          "CHECK(length(kind) BETWEEN 1 AND 32 AND kind NOT GLOB '*[^A-Za-z]*')",
          "CHECK(kind IN ('studio', 'cinemaScene', 'story', 'referencePack'))",
        )}`,
    );
    db.exec(`INSERT INTO ${table}_old SELECT * FROM ${table}`);
    db.exec(`DROP TABLE ${table}`);
    db.exec(`ALTER TABLE ${table}_old RENAME TO ${table}`);
  }
  db.exec("PRAGMA user_version = 13");
  db.exec("COMMIT");
  assert.throws(() =>
    db
      .prepare(
        "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, bytes, byte_length) VALUES (?, 'captions', 1, '[]', x'00', 1)",
      )
      .run("d".repeat(64)),
  );
  db.close();
  const upgraded = new ProjectStore(c.root);
  handles.push(upgraded);
  await upgraded.initialize();
  const check = new DatabaseSync(file, { readOnly: true });
  try {
    assert.equal(
      (check.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
      14,
    );
    assert.deepEqual(check.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    check.close();
  }
  const browser = { ...c.browser, store: upgraded };
  const documentId = ids();
  await execute(browser, "yamakan.captions.import", {
    projectId: c.projectId,
    expectedRevision: (await upgraded.load(c.projectId)).revision,
    documentId,
    expectedContentHash: null,
    name: "After upgrade",
    language: "en",
    format: "vtt",
    text: "WEBVTT\n\n00:01.000 --> 00:02.000\nhello\n",
  });
  assert.equal(
    upgraded.getDocument(c.projectId, documentId).ref.kind,
    "captions",
  );
});

test("the native Arabic review fixtures parse to the same cues as SRT and WebVTT", async () => {
  const dir = "docs/evidence/h1-arabic-review-packet/captions";
  const srt = parseCaptions(
    await readFile(path.join(dir, "arabic-bilingual.srt"), "utf8"),
    "srt",
    ids,
  );
  const vtt = parseCaptions(
    await readFile(path.join(dir, "arabic-bilingual.vtt"), "utf8"),
    "vtt",
    ids,
  );
  assert.equal(srt.length, 5);
  assert.deepEqual(
    vtt.map((c) => [c.startTicks, c.endTicks, c.text]),
    srt.map((c) => [c.startTicks, c.endTicks, c.text]),
  );
  // The italic tag is removed; its text, and the diacritics, are kept.
  assert.equal(srt[4]!.text, "تشكيل: مُحَمَّدٌ، كِتَابٌ، قُرْآنٌ");
});

test("blank or padded lines, sub-millisecond times and hidden markup are refused; empty lines are dropped", () => {
  const cue = (text: string, startTicks = 1000 * MS, endTicks = 2000 * MS) => ({
    format: "yamakan.captions",
    formatVersion: 1,
    name: "T",
    language: "en",
    burnIn: false,
    source: null,
    cues: [{ id: ids(), startTicks, endTicks, text, source: null }],
  });
  for (const text of ["a\n\nb", " a", "a\n  \nb", "a "])
    assert.equal(
      CaptionDocumentSchema.safeParse(cue(text)).success,
      false,
      JSON.stringify(text),
    );
  assert.equal(
    CaptionDocumentSchema.safeParse(cue("a", 1000 * MS + 1)).success,
    false,
    "whole milliseconds only",
  );
  // Lines left empty by removed tags or entities are dropped on import.
  const [parsed] = parseCaptions(
    "1\n00:00:01,000 --> 00:00:02,000\na\n<i></i>\n&nbsp;\nb<br>c\n",
    "srt",
    ids,
  );
  assert.equal(parsed!.text, "a\nb\nc");
  // ASS markup hidden behind a removed tag is still refused.
  assert.equal(
    refused(() =>
      parseCaptions(
        "1\n00:00:01,000 --> 00:00:02,000\n{<i>\\an8}x\n",
        "srt",
        ids,
      ),
    ),
    "VALIDATION",
  );
  // A cue right after the WebVTT header, and a file without cues.
  assert.equal(
    refused(() =>
      parseCaptions("WEBVTT\n00:01.000 --> 00:02.000\nx\n", "vtt", ids),
    ),
    "VALIDATION",
  );
  assert.equal(
    refused(() => parseCaptions("WEBVTT\n", "vtt", ids)),
    "VALIDATION",
  );
  assert.equal(
    refused(() => parseCaptions("", "srt", ids)),
    "VALIDATION",
  );
  // Hours past 9 in WebVTT, exactly ten hours, touching cues, a digits-only
  // text line, CR line endings, and entities.
  const edge = parseCaptions(
    "WEBVTT\r\r09:59:57.000 --> 09:59:58.000\r1234\r\r09:59:58.000 --> 10:00:00.000\rA &quot;B&quot; &#39;C&#39;\r",
    "vtt",
    ids,
  );
  assert.deepEqual(
    edge.map((c) => [c.startTicks / MS, c.endTicks / MS, c.text]),
    [
      [35_997_000, 35_998_000, "1234"],
      [35_998_000, 36_000_000, `A "B" 'C'`],
    ],
  );
});

test("a hostile timing line is refused quickly", () => {
  const started = Date.now();
  const line = `00:00:01.000 --> 00:00:02.000${" ".repeat(100_000)}x y`;
  assert.equal(
    refused(() => parseCaptions(`WEBVTT\n\n${line}\ntext\n`, "vtt", ids)),
    "VALIDATION",
  );
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});

test("the full cue limit commits, a retried import replays, and burn-in refuses undrawable text", async () => {
  const c = await workspace();
  const at = (ms: number) =>
    `${String(Math.floor(ms / 3_600_000)).padStart(2, "0")}:${String(Math.floor(ms / 60_000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  const full = Array.from(
    { length: CAPTION_LIMITS.cues },
    (_, i) =>
      `${i + 1}\n${at(i * 200)} --> ${at(i * 200 + 150)}\nCue ${i + 1}\n`,
  ).join("\n");
  const documentId = ids();
  const args = {
    projectId: c.projectId,
    expectedRevision: (await head(c)).revision,
    documentId,
    expectedContentHash: null,
    name: "Long",
    language: "en",
    format: "srt",
    text: full,
  };
  const retrying = { ...c.browser, requestId: "import-long" };
  const first = (await execute(retrying, "yamakan.captions.import", args))
    .result as {
    project: { revision: number };
    document: { contentHash: string };
  };
  assert.equal(
    CaptionDocumentSchema.parse(
      JSON.parse(
        c.store.getDocument(c.projectId, documentId).bytes.toString("utf8"),
      ),
    ).cues.length,
    CAPTION_LIMITS.cues,
  );
  // A retry after a lost response replays the same revision and version.
  const again = (await execute(retrying, "yamakan.captions.import", args))
    .result as {
    project: { revision: number };
    document: { contentHash: string };
  };
  assert.equal(again.project.revision, first.project.revision);
  assert.equal(again.document.contentHash, first.document.contentHash);
  // An emoji the pinned font cannot draw: burn-in is refused, naming the cue.
  try {
    await execute(c.browser, "yamakan.captions.import", {
      ...args,
      expectedRevision: (await head(c)).revision,
      documentId: ids(),
      text: "1\n00:00:01,000 --> 00:00:02,000\nok\n\n2\n00:00:03,000 --> 00:00:04,000\n🎬 action\n",
      burnIn: true,
    });
    assert.fail("refused");
  } catch (e) {
    assert.equal(toCommandError(e).code, "VALIDATION");
    assert.match((e as Error).message, /^Cue 2 /);
  }
  // A forged copy of the imported file is refused by the generic commit.
  const doc = JSON.parse(
    c.store.getDocument(c.projectId, documentId).bytes.toString("utf8"),
  );
  doc.source.text = "forged";
  assert.equal(
    await code(
      c.store.commitDocument({
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        documentId,
        kind: "captions",
        schemaVersion: 1,
        expectedContentHash: first.document.contentHash,
        source: { bytes: Buffer.from(JSON.stringify(doc)) },
      }),
    ),
    "VALIDATION",
  );
});

test("burned-in cues change the plan, sit above the tracks and stop at the timeline's end", async () => {
  const c = await workspace();
  const fonts = await titleFonts();
  const p = fromEditView(await head(c));
  const without = compilePlan(p, "0".repeat(64), fonts).plan;
  const end = 90 * F; // the timeline is three seconds
  const { plan } = compilePlan(p, "0".repeat(64), fonts, {
    captions: [
      [
        { startTicks: 1000 * MS, endTicks: 2000 * MS, text: "one" },
        { startTicks: 2500 * MS, endTicks: 4000 * MS, text: "past the end" },
        { startTicks: 3000 * MS, endTicks: 3500 * MS, text: "after it" },
      ],
    ],
  });
  assert.notEqual(plan.planHash, without.planHash);
  assert.deepEqual(
    plan.titles!.cues.map((x) => [x.layer, x.startTicks, x.endTicks, x.text]),
    [
      [p.tracks.length, 1000 * MS, 2000 * MS, "one"],
      [p.tracks.length, 2500 * MS, end, "past the end"],
    ],
  );
});

test("line-end spaces, SRT ampersands, damaged tracks, names and header cues", async () => {
  const doc = (text: string, name = "T") => ({
    format: "yamakan.captions",
    formatVersion: 1,
    name,
    language: "en",
    burnIn: false,
    source: null,
    cues: [
      {
        id: ids(),
        startTicks: 1000 * MS,
        endTicks: 2000 * MS,
        text,
        source: null,
      },
    ],
  });
  assert.equal(CaptionDocumentSchema.safeParse(doc("a \nb")).success, false);
  for (const name of ["a\u202eb", "a\u200bb", "a\u2028b", "a\u0007b"])
    assert.equal(
      CaptionDocumentSchema.safeParse(doc("x", name)).success,
      false,
      JSON.stringify(name),
    );
  // SRT keeps a plain "&" readable and still round-trips an entity-like one.
  const track = CaptionDocumentSchema.parse(doc("Q&A &amp; AT&T"));
  const srt = exportCaptions(track, "srt");
  assert.match(srt, /Q&A &amp;amp; AT&T/);
  assert.equal(parseCaptions(srt, "srt", ids)[0]!.text, "Q&A &amp; AT&T");
  assert.equal(
    parseCaptions(exportCaptions(track, "vtt"), "vtt", ids)[0]!.text,
    "Q&A &amp; AT&T",
  );
  // A stored track that no longer reads is damage, not a client error.
  assert.equal(
    refused(() =>
      storedCaptions("f".repeat(64), () => Buffer.from("{not json")),
    ),
    "RECOVERY_REQUIRED",
  );
  // A timing line on a later header line is refused too.
  assert.equal(
    refused(() =>
      parseCaptions(
        "WEBVTT\nKind: captions\n00:01.000 --> 00:02.000\nx\n",
        "vtt",
        ids,
      ),
    ),
    "VALIDATION",
  );
  // The generic document commit cannot write a caption track.
  const c = await workspace();
  assert.equal(
    await code(
      head(c).then((h) =>
        execute(c.browser, "yamakan.document.commit", {
          projectId: c.projectId,
          expectedRevision: h.revision,
          documentId: ids(),
          kind: "captions",
          schemaVersion: 1,
          expectedContentHash: null,
          source: { contentHash: "c".repeat(64) },
        }),
      ),
    ),
    "VALIDATION",
  );
});
