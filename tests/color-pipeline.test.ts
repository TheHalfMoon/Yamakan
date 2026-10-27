// YU-023: the frozen SDR color policy (sdr-bt709-tv/v1) and bounded LUTs.
// A known color chart round-trips through export and the reference preview
// within a frozen tolerance whatever its source (RGB still, limited-range
// BT.709 video, full-range video, untagged SD video); the export is tagged
// BT.709 limited range; HDR and BT.2020 sources are refused at import; a
// .cube LUT is parsed strictly, stored as an immutable document, applied
// identically by export and preview, and refused when malformed or huge.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderRevision } from "../core/render.ts";
import { closePreviews, preview } from "../core/render/preview.ts";
import type { Project } from "../core/project.ts";
import {
  cubeText,
  hasHdrSideData,
  identityCube,
  parseCube,
  sourceColor,
  unsupportedColor,
} from "../core/effects/color.ts";
import { previewParity } from "../core/render/parity.ts";
import { setClipTransform } from "../src/edit-ops.ts";
import { IDENTITY_TRANSFORM } from "../core/effects/registry.ts";
import { DatabaseSync } from "node:sqlite";

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
const FRAME = 23_520_000; // flicks per 30 fps frame
const W = 1280; // the default 1280x720 output
// The chart: eight patches, each 40 pixels wide at 320x180.
const CHART = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
  [0, 0, 0],
  [128, 128, 128],
  [200, 100, 50],
  [50, 100, 200],
] as const;
// The frozen tolerance: 8-bit limited range and 4:2:0 at patch centres.
const TOLERANCE = 5;
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
  );
const ffprobe = (file: string) =>
  JSON.parse(
    execFileSync(
      mediaTools().ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=pix_fmt,color_range,color_space,color_transfer,color_primaries",
        "-of",
        "json",
        file,
      ],
      { windowsHide: true },
    ).toString(),
  ).streams[0] as Record<string, string>;

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-color-"));
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
    await execute(browser, "yamakan.project.create", { name: "Color" })
  ).result as Project;
  const chart = path.join(root, "chart.png");
  ffmpeg([
    ...CHART.flatMap(([r, g, b]) => [
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}:s=40x180`,
    ]),
    "-filter_complex",
    "hstack=inputs=8",
    "-frames:v",
    "1",
    chart,
  ]);
  return { root, store, queue, browser, projectId: project.id, chart };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;
const head = (c: Ctx) => c.store.load(c.projectId);

// The chart as a video of a given form.
function chartVideo(c: Ctx, name: string, args: string[], size = "320x180") {
  const file = path.join(c.root, name);
  ffmpeg([
    "-loop",
    "1",
    "-i",
    c.chart,
    "-t",
    "1",
    "-r",
    "30",
    "-vf",
    `scale=${size.replace("x", ":")}:flags=neighbor${args[0] ?? ""}`,
    ...args.slice(1),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-qp",
    "0",
    file,
  ]);
  return file;
}

// Color tags written into the stream itself (H.264 VUI), as cameras do.
const vui = (p: number, t: number, m: number) => [
  "",
  "-pix_fmt",
  "yuv420p",
  "-bsf:v",
  `h264_metadata=colour_primaries=${p}:transfer_characteristics=${t}:matrix_coefficients=${m}`,
];

async function place(c: Ctx, file: string, name: string) {
  const { asset } = await c.store.importAsset(
    c.projectId,
    name,
    await readFile(file),
  );
  const p = await head(c);
  await execute(c.browser, "yamakan.project.applyBatch", {
    projectId: c.projectId,
    expectedRevision: p.revision,
    operations: [
      ...p.clips.map((x) => ({ type: "clip.remove", clipId: x.id })),
      {
        type: "clip.add",
        clipId: crypto.randomUUID(),
        trackId: p.tracks.find((t) => t.kind === "video")!.id,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 15 * FRAME,
        sourceStartTicks: 0,
      },
    ],
  });
  return asset;
}

// RGB of a decoded frame (FFmpeg reads the file's own tags).
function rgb(file: string, extra: string[] = []): Buffer {
  return ffmpeg([
    "-i",
    file,
    "-frames:v",
    "1",
    ...extra,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
}
const patches = (frame: Buffer) =>
  CHART.map((_, p) => {
    const i = (360 * W + Math.round((p + 0.5) * 160)) * 3;
    return [frame[i]!, frame[i + 1]!, frame[i + 2]!];
  });
function assertChart(frame: Buffer, label: string) {
  patches(frame).forEach((got, p) =>
    got.forEach((v, ch) =>
      assert.ok(
        Math.abs(v - CHART[p]![ch]!) <= TOLERANCE,
        `${label}: patch ${p} is ${got}, want ${CHART[p]}`,
      ),
    ),
  );
}

async function exported(c: Ctx) {
  const p = await head(c);
  return renderRevision(
    c.store,
    c.projectId,
    p.revision,
    ["exports", `r${p.revision}-${crypto.randomUUID()}`],
    new AbortController().signal,
    () => {},
  );
}
async function previewRgb(c: Ctx) {
  const p = await head(c);
  return rgb(
    (await preview(c.store, c.projectId, p.revision, "frame", 5)).file,
  );
}

test("a color chart round-trips from every SDR source form within the frozen tolerance, tagged BT.709 limited range", async () => {
  const c = await workspace();
  const forms: [string, string, string[], string?][] = [
    ["an RGB still", "chart.png", []],
    [
      "limited-range BT.709 video",
      "bt709.mp4",
      [
        ":out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-color_range",
        "tv",
      ],
      "1280x720",
    ],
    [
      "full-range video",
      "full.mp4",
      [
        ":out_color_matrix=bt709:out_range=pc,format=yuvj420p",
        "-colorspace",
        "bt709",
        "-color_range",
        "pc",
      ],
      "1280x720",
    ],
    [
      "untagged SD video (read as BT.601)",
      "sd.mp4",
      [":out_color_matrix=bt601:out_range=tv,format=yuv420p"],
      "640x360",
    ],
  ];
  for (const [label, name, args, size] of forms) {
    const file =
      name === "chart.png" ? c.chart : chartVideo(c, name, args, size);
    await place(c, file, name);
    const { output, plan } = await exported(c);
    assert.equal(plan.colorPolicy, "sdr-bt709-tv/v1");
    assert.equal(plan.compilerVersion, "yamakan.render-compiler/2");
    const tags = ffprobe(output);
    assert.deepEqual(
      [
        tags.color_space,
        tags.color_primaries,
        tags.color_transfer,
        tags.color_range,
      ],
      ["bt709", "bt709", "bt709", "tv"],
      label,
    );
    assertChart(rgb(output), `${label} (export)`);
    // An HD player that assumes BT.709 sees the same colors.
    assertChart(
      rgb(output, ["-vf", "scale=in_color_matrix=bt709:in_range=tv"]),
      `${label} (read as BT.709)`,
    );
    assertChart(await previewRgb(c), `${label} (reference preview)`);
  }
});

test("HDR and BT.2020 sources are refused at import; the policy is recorded per layer", async () => {
  const c = await workspace();
  for (const [name, tags, pattern] of [
    ["pq.mp4", vui(9, 16, 9), /^CAPABILITY_UNAVAILABLE: HDR video/],
    ["hlg.mp4", vui(9, 18, 9), /^CAPABILITY_UNAVAILABLE: HDR video/],
    ["wide.mp4", vui(9, 1, 9), /^CAPABILITY_UNAVAILABLE: Wide-gamut BT\.2020/],
  ] as const) {
    const file = chartVideo(c, name, tags);
    assert.match(
      await failure(
        c.store.importAsset(c.projectId, name, await readFile(file)),
      ),
      pattern,
      name,
    );
  }
  const asset = await place(
    c,
    chartVideo(c, "tagged.mp4", [
      ":out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-colorspace",
      "bt709",
      "-color_range",
      "tv",
    ]),
    "tagged.mp4",
  );
  const { plan } = await exported(c);
  assert.deepEqual(plan.layers.find((x) => x.assetId === asset.id)!.color, {
    matrix: "bt709",
    range: "tv",
    assumed: false,
  });
});

async function importLut(c: Ctx, text: string, name = "Grade") {
  const documentId = crypto.randomUUID();
  const out = (
    await execute(c.browser, "yamakan.lut.import", {
      projectId: c.projectId,
      expectedRevision: (await head(c)).revision,
      documentId,
      expectedContentHash: null,
      name,
      text,
    })
  ).result as { document: { contentHash: string } };
  return { documentId, contentHash: out.document.contentHash };
}
async function setLut(
  c: Ctx,
  lut: { documentId: string; contentHash: string } | null,
) {
  const p = await head(c);
  return execute(c.browser, "yamakan.clip.setEffects", {
    projectId: c.projectId,
    expectedRevision: p.revision,
    clipId: p.clips[0]!.id,
    effects: lut ? [{ type: "lut", version: 1, ...lut }] : null,
  });
}
// A 2³ LUT inverting every channel (exact under interpolation).
const INVERT = [
  'TITLE "Invert"',
  "LUT_3D_SIZE 2",
  "DOMAIN_MIN 0 0 0",
  "DOMAIN_MAX 1 1 1",
  ...[0, 1].flatMap((b) =>
    [0, 1].flatMap((g) => [0, 1].map((r) => `${1 - r} ${1 - g} ${1 - b}`)),
  ),
].join("\n");

test("a LUT is stored as an immutable document and applied the same in export and reference preview", async () => {
  const c = await workspace();
  await place(c, c.chart, "chart.png");
  // An identity LUT leaves the chart as it was.
  const identityRef = await importLut(c, identityCube(17), "Identity");
  await setLut(c, identityRef);
  const identity = await exported(c);
  assertChart(rgb(identity.output), "identity LUT (export)");
  assertChart(await previewRgb(c), "identity LUT (preview)");
  const ref = identity.plan.layers[0]!.lut!;
  assert.match(ref.contentHash, /^[a-f0-9]{64}$/);
  // Inverting: each patch becomes 255 minus itself.
  const invert = await importLut(c, INVERT);
  await setLut(c, invert);
  const inverted = await exported(c);
  const want = CHART.map((x) => x.map((v) => 255 - v));
  for (const frame of [rgb(inverted.output), await previewRgb(c)])
    patches(frame).forEach((got, p) =>
      got.forEach((v, ch) =>
        assert.ok(
          Math.abs(v - want[p]![ch]!) <= TOLERANCE,
          `inverted patch ${p}: ${got}`,
        ),
      ),
    );
  // The document holds only its numbers, in one canonical form.
  const doc = (
    await execute(c.browser, "yamakan.document.get", {
      projectId: c.projectId,
      documentId: invert.documentId,
    })
  ).result as { kind: string; content: Record<string, unknown> };
  assert.equal(doc.kind, "lut");
  assert.deepEqual(Object.keys(doc.content).sort(), [
    "data",
    "format",
    "formatVersion",
    "name",
    "size",
  ]);
  assert.equal(doc.content.name, "Invert");
  const again = parseCube(cubeText(doc.content as never), "x");
  assert.equal(again.data, doc.content.data);
  // Undo returns the identity LUT; the canvas says it applies no LUT.
  const p = await head(c);
  await execute(c.browser, "yamakan.project.undo", {
    projectId: c.projectId,
    expectedRevision: p.revision,
  });
  const undone = await head(c);
  assert.deepEqual(undone.clips[0]!.effects, [
    { type: "lut", version: 1, ...identityRef },
  ]);
  assert.deepEqual(
    previewParity(undone).approximations.find((x) => x.kind === "lut")?.clipIds,
    [undone.clips[0]!.id],
  );
});

test("malformed, huge or referencing LUTs, and LUT effects without their document, are refused", async () => {
  const c = await workspace();
  await place(c, c.chart, "chart.png");
  const refused = async (text: string, pattern: RegExp) =>
    assert.match(await failure(importLut(c, text)), pattern, text.slice(0, 60));
  await refused("LUT_1D_SIZE 4\n0 0 0", /only 3D LUTs/);
  await refused("LUT_3D_SIZE 34", /from 2 to 33/);
  await refused("LUT_3D_SIZE 2\n0 0 0", /needs 8/);
  await refused(`${INVERT}\n0 0 0`, /more entries/);
  await refused(
    INVERT.replace("DOMAIN_MAX 1 1 1", "DOMAIN_MAX 2 2 2"),
    /domain/,
  );
  await refused(INVERT.replace(/0 0 0$/, "0 0 1.5"), /between 0 and 1/);
  await refused(INVERT.replace(/0 0 0$/, "0 0 1e999"), /between 0 and 1/);
  await refused(INVERT.replace(/0 0 0$/, "0 0 NaN"), /unsupported line/);
  await refused(`INCLUDE ../other.cube\n${INVERT}`, /unsupported line/);
  await refused(`LUT_3D_INPUT_RANGE 0 1\n${INVERT}`, /unsupported line/);
  await refused(`${"#".repeat(300)}\n${INVERT}`, /too long/);
  await refused('TITLE "x"', /no LUT_3D_SIZE/);
  await refused(`LUT_3D_SIZE 2\n${"0 0 0\n".repeat(300_000)}`, /^VALIDATION/);
  // Only the LUT command writes LUTs.
  const lut0 = await importLut(c, INVERT);
  assert.match(
    await failure(
      execute(c.browser, "yamakan.document.commit", {
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        documentId: crypto.randomUUID(),
        kind: "lut",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: lut0.contentHash },
      }),
    ),
    /imported with yamakan.lut.import/,
  );
  // An effect must name a LUT document of this project, once.
  const lut = await importLut(c, INVERT);
  assert.match(
    await failure(setLut(c, { ...lut, contentHash: "0".repeat(64) })),
    /LUT document of this project|another version of this LUT/,
  );
  assert.match(
    await failure(
      setLut(c, {
        documentId: crypto.randomUUID(),
        contentHash: lut.contentHash,
      }),
    ),
    /LUT document of this project|another version of this LUT/,
  );
  const p = await head(c);
  assert.match(
    await failure(
      execute(c.browser, "yamakan.clip.setEffects", {
        projectId: c.projectId,
        expectedRevision: p.revision,
        clipId: p.clips[0]!.id,
        effects: [
          { type: "lut", version: 1, ...lut },
          { type: "lut", version: 1, ...lut },
        ],
      }),
    ),
    /at most one LUT/,
  );
});

test("a LUT keeps an overlay's transparency, and the editor's transform keeps a clip's LUT", async () => {
  const c = await workspace();
  await place(c, c.chart, "chart.png");
  // A half-transparent white still on a second video track, above.
  const veil = path.join(c.root, "veil.png");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "color=c=white@0.5:s=320x180,format=rgba",
    "-frames:v",
    "1",
    veil,
  ]);
  const { asset } = await c.store.importAsset(
    c.projectId,
    "veil.png",
    await readFile(veil),
  );
  const p = await head(c);
  const top = crypto.randomUUID(),
    veilClip = crypto.randomUUID();
  await execute(c.browser, "yamakan.project.applyBatch", {
    projectId: c.projectId,
    expectedRevision: p.revision,
    operations: [
      { type: "track.add", trackId: top, name: "Veil", kind: "video" },
      {
        type: "clip.add",
        clipId: veilClip,
        trackId: top,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 15 * FRAME,
        sourceStartTicks: 0,
      },
    ],
  });
  const plain = patches(rgb((await exported(c)).output));
  // Half white over the chart: each channel moves halfway to 255.
  plain.forEach((got, n) =>
    got.forEach((v, ch) =>
      assert.ok(
        Math.abs(v - (CHART[n]![ch]! + 255) / 2) <= 2 * TOLERANCE,
        `veiled patch ${n}: ${got}`,
      ),
    ),
  );
  const lut = await importLut(c, identityCube(9), "Identity");
  const q = await head(c);
  await execute(c.browser, "yamakan.clip.setEffects", {
    projectId: c.projectId,
    expectedRevision: q.revision,
    clipId: veilClip,
    effects: [{ type: "lut", version: 1, ...lut }],
  });
  const graded = patches(rgb((await exported(c)).output));
  graded.forEach((got, n) =>
    got.forEach((v, ch) =>
      assert.ok(
        Math.abs(v - plain[n]![ch]!) <= TOLERANCE,
        `LUT on the veil changed patch ${n}: ${got} vs ${plain[n]}`,
      ),
    ),
  );
  // The editor's transform panel keeps the LUT beside the transform.
  const edited = setClipTransform(await head(c), veilClip, {
    ...IDENTITY_TRANSFORM,
    scale: 500,
  });
  assert.deepEqual(
    edited.clips.find((x) => x.id === veilClip)!.effects!.map((e) => e.type),
    ["transform", "lut"],
  );
  const reset = setClipTransform(edited, veilClip, IDENTITY_TRANSFORM);
  assert.deepEqual(
    reset.clips.find((x) => x.id === veilClip)!.effects!.map((e) => e.type),
    ["lut"],
  );
});

test("a JPEG and an asset without recorded color are read by the policy's defaults; other transfers, gamuts and matrices are refused", async () => {
  const c = await workspace();
  const jpeg = path.join(c.root, "chart.jpg");
  ffmpeg([
    "-i",
    c.chart,
    "-vf",
    "scale=1280:720:flags=neighbor",
    "-q:v",
    "1",
    jpeg,
  ]);
  const jpegAsset = await place(c, jpeg, "chart.jpg");
  const first = await exported(c);
  // JFIF: tagged BT.601 (bt470bg) full range.
  assert.deepEqual(first.plan.layers[0]!.color, {
    matrix: "bt601",
    range: "pc",
    assumed: false,
  });
  assertChart(rgb(first.output), "JPEG (export)");
  // An asset imported before YU-023 has no recorded color: the file type
  // and height decide, the same way.
  const db = new DatabaseSync(path.join(c.root, "workspace.sqlite"));
  db.prepare("UPDATE asset_versions SET probe = NULL WHERE version_id = ?").run(
    jpegAsset.id,
  );
  db.close();
  const legacy = await exported(c);
  assert.deepEqual(legacy.plan.layers[0]!.color, {
    matrix: "bt601",
    range: "pc",
    assumed: true,
  });
  assertChart(rgb(legacy.output), "JPEG without recorded color (export)");
  for (const [name, tags, pattern] of [
    ["linear.mp4", vui(1, 8, 1), /linear transfer/],
    ["p3.mp4", vui(12, 1, 1), /smpte432 primaries/],
    ["ycgco.mp4", vui(1, 1, 8), /ycgco matrix/],
  ] as const) {
    const file = chartVideo(c, name, tags);
    assert.match(
      await failure(
        c.store.importAsset(c.projectId, name, await readFile(file)),
      ),
      pattern,
      name,
    );
  }
});

test("re-importing a LUT a clip uses is refused with a way forward", async () => {
  const c = await workspace();
  await place(c, c.chart, "chart.png");
  const lut = await importLut(c, INVERT);
  await setLut(c, lut);
  assert.match(
    await failure(
      execute(c.browser, "yamakan.lut.import", {
        projectId: c.projectId,
        expectedRevision: (await head(c)).revision,
        documentId: lut.documentId,
        expectedContentHash: lut.contentHash,
        name: "Identity",
        text: identityCube(5),
      }),
    ),
    /another version of this LUT/,
  );
});

test("HDR side data is detected without HDR tags, and recorded tags only ever map to the policy's enums", () => {
  for (const type of [
    "DOVI configuration record",
    "Mastering display metadata",
    "Content light level metadata",
    "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)",
  ])
    assert.equal(
      hasHdrSideData({ side_data_list: [{ side_data_type: type }] }),
      true,
      type,
    );
  assert.equal(
    hasHdrSideData({ side_data_list: [{ side_data_type: "Display Matrix" }] }),
    false,
  );
  assert.equal(hasHdrSideData({}), false);
  const sdr = {
    pixelFormat: "yuv420p",
    matrix: "bt709",
    range: "tv",
    transfer: "bt709",
    primaries: "bt709",
  };
  assert.match(unsupportedColor(sdr, true) ?? "", /HDR video/);
  // A tampered record naming an inherited property is refused, never read.
  for (const matrix of ["constructor", "toString", "__proto__"]) {
    assert.match(
      unsupportedColor({ ...sdr, matrix }) ?? "",
      /matrix is not supported/,
    );
    const read = sourceColor(
      { ...sdr, matrix },
      { height: 1080, extension: "mp4" },
    );
    assert.ok(
      read && ["bt709", "bt601", "fcc", "smpte240m"].includes(read.matrix),
    );
    assert.equal(read!.assumed, true);
  }
});
