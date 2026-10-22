// W7.1: git-sized release evidence at the current head — export hashes, ffprobe
// JSON, one title-frame hash, a minimal CLI transcript, and pointers to the
// process/offline capture in t10-release.json. MP4 bytes stay out of git.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import { renderRevision } from "../core/render.ts";
import { ProjectStore } from "../core/store.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";

const DIR = "docs/evidence/qualification";
const INDEX = `${DIR}/w7-release-evidence.json`;
const HASHES = `${DIR}/w7-export-hashes.json`;
const FFPROBE = `${DIR}/w7-export-ffprobe.json`;
const FRAMES = `${DIR}/w7-title-frame-hashes.json`;
const TRANSCRIPT = `${DIR}/w7-session-transcript.json`;
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ".", `:!${DIR}`);
if (dirty)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

const tools = mediaTools();
const commit = git("rev-parse", "HEAD");
const root = await mkdtemp(path.join(tmpdir(), "yamakan-w7-evidence-"));
try {
  const store = new ProjectStore(root);
  await store.initialize();
  const created = await store.create("W7 evidence");
  const saved = await store.save(
    {
      ...created,
      clips: [
        {
          id: crypto.randomUUID(),
          trackId: created.tracks[0].id,
          assetId: null,
          startFrame: 0,
          durationFrames: 60,
          sourceFrame: 0,
          title: "مرحبا Yamakan",
        },
      ],
    },
    created.revision,
  );
  const project = await store.load(saved.id);
  const canonicalHash = sha256Hex(canonicalJson(project));
  const { output, plan, receipt } = await renderRevision(
    store,
    saved.id,
    saved.revision,
    ["exports", "w7"],
    new AbortController().signal,
    () => {},
  );
  const ffprobeJson = JSON.parse(
    execFileSync(
      tools.ffprobe,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        output,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
  const framePath = path.join(root, "title-frame.png");
  execFileSync(
    tools.ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      "0.5",
      "-i",
      output,
      "-frames:v",
      "1",
      framePath,
    ],
    { windowsHide: true },
  );
  const frameBytes = await readFile(framePath);
  const mp4Bytes = await readFile(output);
  const transcript = [
    {
      channel: "cli",
      operation: "yamakan.project.create",
      parameters: { name: "W7 evidence" },
      outcome: "ok",
      projectId: saved.id,
    },
    {
      channel: "cli",
      operation: "yamakan.project.save",
      parameters: { revision: created.revision },
      outcome: "ok",
      revision: saved.revision,
    },
    {
      channel: "render",
      operation: "yamakan.render.export",
      parameters: { planHash: plan.planHash },
      outcome: "ok",
      artifactSha256: sha256(mp4Bytes),
    },
  ];
  await mkdir(DIR, { recursive: true });
  await writeFile(
    HASHES,
    `${JSON.stringify(
      {
        receipt: "yamakan.release-export-hashes/1",
        commit,
        measuredAt: new Date().toISOString(),
        export: {
          path: "exports/w7/export.mp4",
          sha256: sha256(mp4Bytes),
          bytes: mp4Bytes.length,
          planHash: plan.planHash,
          renderReceipt: receipt,
        },
        canonical: {
          projectId: saved.id,
          revision: saved.revision,
          sha256: canonicalHash,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(FFPROBE, `${JSON.stringify(ffprobeJson, null, 2)}\n`);
  await writeFile(
    FRAMES,
    `${JSON.stringify(
      {
        receipt: "yamakan.release-title-frames/1",
        commit,
        frames: [
          {
            atSeconds: 0.5,
            sha256: sha256(frameBytes),
            bytes: frameBytes.length,
            note: "PNG extracted from the W7 export; not committed (hash only).",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    TRANSCRIPT,
    `${JSON.stringify(
      {
        receipt: "yamakan.release-session-transcript/1",
        commit,
        measuredAt: new Date().toISOString(),
        entries: transcript,
        mcp: "MCP parity replay for journey steps 2–11 remains open; this transcript records the export fixture path only.",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    INDEX,
    `${JSON.stringify(
      {
        receipt: "yamakan.release-evidence-bundle/1",
        commit,
        measuredAt: new Date().toISOString(),
        artifacts: {
          exportHashes: HASHES.replaceAll("\\", "/"),
          ffprobe: FFPROBE.replaceAll("\\", "/"),
          titleFrameHashes: FRAMES.replaceAll("\\", "/"),
          sessionTranscript: TRANSCRIPT.replaceAll("\\", "/"),
          audioReport: "docs/evidence/qualification/q1-has-audio.json",
          avSyncReport: "docs/evidence/qualification/av-sync.json",
          processLifecycle:
            "docs/evidence/qualification/t10-release.json (offline.serviceTree and tests)",
        },
        notInGit: ["export MP4 bytes (hash in w7-export-hashes.json)"],
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({ commit, index: INDEX }, null, 2));
  store.close();
} finally {
  closeWorkers();
  await rm(root, { recursive: true, force: true }).catch(() => {});
}
