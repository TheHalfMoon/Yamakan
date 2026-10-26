// YU-017: edit proxies and thumbnails. A proxy shows the source's frame at
// the same time (checked frame by frame on a fixture whose every frame has
// its own brightness), keeps audio, never replaces the original, and is
// refused or rebuilt rather than shown when it could mislead.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { mediaTools } from "../core/process/workers.ts";
import { probe } from "../core/media.ts";
import {
  assetThumbnail,
  buildProxy,
  cancelProxy,
  proxyFile,
  proxyStatus,
  resetProxiesForTests,
  type ProxyStatus,
} from "../core/media/proxies.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { CommandError, toCommandError } from "../core/command/errors.ts";

const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const handle of handles.reverse()) await handle.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});

// Every frame N draws a white bar at its own position (8N pixels, mod the
// width), so a frame shown at the wrong time is caught whatever the levels
// of either encode; a 440 Hz tone keeps audio in the proxy.
async function fixture(
  name: string,
  options: {
    size?: string;
    seconds?: number;
    rotate?: number;
    rate?: number;
    // Shift every timestamp (a source that starts after zero).
    startAt?: number;
  } = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-proxy-"));
  bases.push(root);
  const seconds = options.seconds ?? 4;
  let file = path.join(root, `${name}.mp4`);
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${options.size ?? "1280x720"}:r=${options.rate ?? 30}:d=${seconds}[bg];color=c=white:s=8x2160:r=${options.rate ?? 30}:d=${seconds}[bar];[bg][bar]overlay=x='mod(n*8\\,main_w)':y=0:shortest=1`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${seconds}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "10",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    ...(options.startAt ? ["-output_ts_offset", String(options.startAt)] : []),
    file,
  ]);
  if (options.rotate !== undefined) {
    const turned = path.join(root, `${name}-rotated.mp4`);
    ffmpeg([
      "-display_rotation",
      String(options.rotate),
      "-i",
      file,
      "-c",
      "copy",
      turned,
    ]);
    file = turned;
  }
  return { root, file };
}
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-proxy-ws-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Proxies");
  return { root, store, project };
}
async function imported(
  store: ProjectStore,
  projectId: string,
  file: string,
  name = "clip.mp4",
) {
  const { asset } = await store.importAsset(
    projectId,
    name,
    await readFile(file),
  );
  return asset;
}
async function settled(
  store: ProjectStore,
  projectId: string,
  assetId: string,
  ms = 120_000,
): Promise<ProxyStatus> {
  const until = Date.now() + ms;
  for (;;) {
    const s = await proxyStatus(store, projectId, assetId);
    if (s.state !== "queued" && s.state !== "building") return s;
    if (Date.now() > until) throw new Error("proxy build did not settle");
    await new Promise((r) => setTimeout(r, 100));
  }
}
// Where the bar is in the frame shown at `seconds` (accurate seek): the
// brightest of 160 columns.
function barColumn(file: string, seconds: number) {
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(seconds),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=160:1:flags=area,format=gray",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { windowsHide: true },
  );
  return raw.indexOf(Math.max(...raw));
}
const objectCount = async (store: ProjectStore, projectId: string) => {
  const dir = await store.file(projectId, "objects", "sha256");
  let n = 0;
  for (const prefix of await readdir(dir).catch(() => []))
    n += (await readdir(path.join(dir, prefix))).length;
  return n;
};

test("a proxy is built, verified and published; it shows the source's frame at every time, with its audio", async () => {
  resetProxiesForTests();
  const { file } = await fixture("frames");
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  const objects = await objectCount(store, project.id);
  assert.equal(
    (await proxyStatus(store, project.id, asset.id)).state,
    "absent",
  );
  const started = await buildProxy(store, project.id, asset.id);
  assert.ok(["queued", "building"].includes(started.state));
  const ready = await settled(store, project.id, asset.id);
  assert.equal(ready.state, "ready", ready.reason);
  assert.equal(ready.height, 540, "at most 540 lines");
  assert.equal(ready.width, 960, "the source's shape");
  assert.ok(Math.abs(ready.durationFrames! - asset.durationFrames) <= 2);
  assert.ok(
    Math.abs(
      ready.mapping!.sourceStartSeconds - ready.mapping!.proxyStartSeconds,
    ) <
      1 / 60,
  );
  const proxy = await proxyFile(store, project.id, asset.id);
  const original = (await store.assetFile(project.id, asset.id)).file;
  assert.notEqual(proxy, original);
  const info = await probe(proxy);
  assert.equal(info.hasAudio, true, "audio kept");
  assert.equal(info.variableFrameRate, false);
  // Trim points and in-between times: the same frame. (The measure tells
  // neighbouring frames apart, so a one-frame slip would fail.)
  assert.notEqual(barColumn(original, 1), barColumn(original, 1 + 1 / 30));
  for (const t of [0, 1 / 30, 1, 1.5 + 1 / 30, 2.5, 3.9]) {
    const a = barColumn(original, t);
    const b = barColumn(proxy, t);
    assert.equal(b, a, `t=${t}: source column ${a}, proxy column ${b}`);
  }
  // A cache, not a new asset: the project's objects are unchanged, and a
  // second build request reuses the ready proxy.
  assert.equal(await objectCount(store, project.id), objects);
  assert.equal((await buildProxy(store, project.id, asset.id)).state, "ready");
  const head = await store.load(project.id);
  assert.equal(head.assets.find((a) => a.id === asset.id)?.hash, asset.hash);
});

test("export and reference preview never read proxies", async () => {
  // The render path does not import the proxy module at all.
  for (const file of [
    "core/render.ts",
    "core/render/plan.ts",
    "core/render/preview.ts",
    "core/jobs.ts",
  ]) {
    const source = await readFile(
      new URL(`../${file}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /media\/proxies|cache["', ]+proxies/, file);
  }
});

test("a build interrupted by a restart is quarantined, then completes on the next request", async () => {
  resetProxiesForTests();
  const { file } = await fixture("restart", { seconds: 2 });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  const dir = await store.file(project.id, "cache", "proxies");
  await mkdir(dir, { recursive: true });
  // What a killed service leaves: a private build folder, and a video that
  // was renamed in but whose record never was.
  const partial = path.join(
    dir,
    `${"c".repeat(64)}.00000000-0000-4000-8000-000000000000.partial`,
  );
  await mkdir(partial);
  await writeFile(path.join(partial, "proxy.mp4"), "partial");
  const orphan = path.join(dir, `${"d".repeat(64)}.mp4`);
  await writeFile(orphan, "no record");
  assert.equal(
    (await proxyStatus(store, project.id, asset.id)).state,
    "absent",
  );
  assert.deepEqual(await readdir(dir), [], "both quarantined");
  await buildProxy(store, project.id, asset.id);
  assert.equal((await settled(store, project.id, asset.id)).state, "ready");
});

test("a build can be cancelled, leaving nothing behind", async () => {
  resetProxiesForTests();
  const { file } = await fixture("long", { seconds: 30 });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  await buildProxy(store, project.id, asset.id);
  // Wait until it is running, then stop it.
  const until = Date.now() + 30_000;
  while (
    (await proxyStatus(store, project.id, asset.id)).state !== "building" &&
    Date.now() < until
  )
    await new Promise((r) => setTimeout(r, 50));
  const stopped = await cancelProxy(store, project.id, asset.id);
  assert.equal(stopped.state, "absent");
  const dir = await store.file(project.id, "cache", "proxies");
  assert.deepEqual(await readdir(dir), [], "no partial or published proxy");
  await assert.rejects(
    proxyFile(store, project.id, asset.id),
    (e: unknown) => e instanceof CommandError && e.code === "NOT_FOUND",
  );
});

test("misleading proxies are refused: missing, wrong source, damaged, variable rate, damaged source", async () => {
  resetProxiesForTests();
  const { store, project } = await workspace();
  const { file } = await fixture("a", { seconds: 2 });
  const a = await imported(store, project.id, file, "a.mp4");
  // Missing: nothing to serve; the player keeps the original.
  await assert.rejects(
    proxyFile(store, project.id, a.id),
    (e: unknown) => e instanceof CommandError && e.code === "NOT_FOUND",
  );
  await buildProxy(store, project.id, a.id);
  assert.equal((await settled(store, project.id, a.id)).state, "ready");
  // A different source (a relink to other bytes) never gets a's proxy.
  const { file: other } = await fixture("b", { seconds: 2, size: "640x360" });
  const b = await imported(store, project.id, other, "b.mp4");
  assert.equal((await proxyStatus(store, project.id, b.id)).state, "absent");
  // A damaged proxy (size no longer its record's) is removed, not served.
  await truncate(await proxyFile(store, project.id, a.id), 1000);
  assert.equal((await proxyStatus(store, project.id, a.id)).state, "absent");
  await assert.rejects(proxyFile(store, project.id, a.id));
  // A variable-frame-rate source that skipped its conversion is refused.
  const vfr = path.join(path.dirname(other), "vfr.mp4");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x240:rate=30:duration=2",
    "-vf",
    "select='not(mod(n\\,3))+eq(n\\,1)'",
    "-fps_mode",
    "vfr",
    "-pix_fmt",
    "yuv420p",
    vfr,
  ]);
  const staged = await store.stageAsset(
    project.id,
    "vfr.mp4",
    await readFile(vfr),
  );
  assert.equal(staged.probe.variableFrameRate, true);
  await store.attachAsset(project.id, staged.asset);
  await buildProxy(store, project.id, staged.asset.id);
  const refused = await settled(store, project.id, staged.asset.id);
  assert.equal(refused.state, "unsupported");
  assert.match(refused.reason!, /frame rate varies/);
  // Remembered: asking again does not run the build again.
  assert.equal(
    (await buildProxy(store, project.id, staged.asset.id)).state,
    "unsupported",
  );
  // A damaged source: the store refuses its object before any build.
  const { file: c } = await fixture("c", { seconds: 3 });
  const cut = await imported(store, project.id, c, "c.mp4");
  const { file: object } = await store.assetFile(project.id, cut.id);
  const bytes = await readFile(object);
  await writeFile(object, bytes.subarray(0, Math.floor(bytes.length / 2)));
  await assert.rejects(
    buildProxy(store, project.id, cut.id),
    (e: unknown) => e instanceof CommandError && e.code === "RECOVERY_REQUIRED",
  );
});

test("a rotated phone video gets an upright proxy", async () => {
  resetProxiesForTests();
  const { file } = await fixture("phone", {
    seconds: 2,
    size: "640x360",
    rotate: 90,
  });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  assert.equal(asset.width, 360, "the asset is upright");
  await buildProxy(store, project.id, asset.id);
  const ready = await settled(store, project.id, asset.id);
  assert.equal(ready.state, "ready", ready.reason);
  // Portrait 360x640 within 540 lines: 304x540 (even width).
  assert.equal(ready.height, 540);
  assert.equal(ready.width, 304);
});

test("thumbnails: one small JPEG per second, bounded, cached, video only", async () => {
  resetProxiesForTests();
  const { file } = await fixture("thumbs", { seconds: 3 });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  const first = await assetThumbnail(store, project.id, asset.id, 1);
  assert.equal(first.cached, false);
  assert.equal(first.bytes[0], 0xff);
  assert.equal(first.bytes[1], 0xd8);
  assert.ok(first.bytes.length < 256 * 1024);
  assert.equal(
    (await assetThumbnail(store, project.id, asset.id, 1)).cached,
    true,
  );
  for (const bad of [-1, 3, 1.5])
    await assert.rejects(
      assetThumbnail(store, project.id, asset.id, bad),
      (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
    );
});

test("the proxy commands: status for readers, build and cancel need render rights, inputs are strict", async () => {
  resetProxiesForTests();
  const { store, project } = await workspace();
  const { file } = await fixture("cmd", { seconds: 1 });
  const asset = await imported(store, project.id, file);
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const reader = {
    store,
    queue,
    principal: {
      id: "local-client" as const,
      scopes: new Set(["project:read" as const]),
    },
  };
  const all = {
    store,
    queue,
    principal: { id: "local-client" as const, scopes: new Set(Scopes) },
  };
  const ids = { projectId: project.id, assetId: asset.id };
  assert.equal(
    ((await execute(reader, "yamakan.proxy.status", ids)).result as ProxyStatus)
      .state,
    "absent",
  );
  await assert.rejects(
    execute(reader, "yamakan.proxy.build", ids),
    (e: unknown) => e instanceof CommandError && e.code === "SCOPE_DENIED",
  );
  await assert.rejects(
    execute(all, "yamakan.proxy.build", { ...ids, path: "C:\\x.mp4" }),
    (e: unknown) =>
      e instanceof Error && toCommandError(e).code === "VALIDATION",
  );
  await execute(all, "yamakan.proxy.build", ids);
  assert.equal((await settled(store, project.id, asset.id)).state, "ready");
  await queue.close();
});

test("the proxy toggle changes only which file a video plays: clips, trims and timing are the same", async () => {
  const { editorView } = await import("../src/adapter.ts");
  const { store, project } = await workspace();
  const { file } = await fixture("toggle", { seconds: 1 });
  const asset = await imported(store, project.id, file);
  const p = await store.load(project.id);
  const track = p.tracks.find((t) => t.kind === "video")!;
  p.clips.push({
    id: crypto.randomUUID(),
    trackId: track.id,
    assetId: asset.id,
    startFrame: 12,
    durationFrames: 9,
    sourceFrame: 7,
    title: null,
  });
  const off = editorView(p);
  const on = editorView(p, new Set([asset.id]));
  assert.deepEqual(on.clips, off.clips, "trims and positions unchanged");
  assert.deepEqual(on.tracks, off.tracks);
  const media = (v: typeof on) => v.media.find((m) => m.id === asset.id)!;
  assert.match(media(on).url, /\/assets\/[^/]+\/proxy$/);
  assert.match(media(off).url, /\/assets\/[^/]+$/);
  assert.equal(media(on).duration, media(off).duration);
});

test("a 60 fps video maps frame for frame", async () => {
  resetProxiesForTests();
  const { file } = await fixture("sixty", {
    seconds: 2,
    rate: 60,
    size: "960x540",
  });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  await buildProxy(store, project.id, asset.id);
  const ready = await settled(store, project.id, asset.id);
  assert.equal(ready.state, "ready", ready.reason);
  assert.ok(ready.mapping!.frames >= 119, String(ready.mapping!.frames));
  const proxy = await proxyFile(store, project.id, asset.id);
  const original = (await store.assetFile(project.id, asset.id)).file;
  assert.notEqual(barColumn(original, 1), barColumn(original, 1 + 1 / 60));
  for (const t of [0, 1 / 60, 0.5, 1 + 1 / 60, 1.9]) {
    const a = barColumn(original, t);
    assert.equal(barColumn(proxy, t), a, `t=${t}`);
  }
});

test("a video that starts after time zero is refused with its reason", async () => {
  resetProxiesForTests();
  const { file } = await fixture("late", {
    seconds: 2,
    startAt: 0.5,
    size: "640x360",
  });
  const { store, project } = await workspace();
  const asset = await imported(store, project.id, file);
  await buildProxy(store, project.id, asset.id);
  const refused = await settled(store, project.id, asset.id);
  assert.equal(refused.state, "unsupported", refused.reason);
  assert.match(refused.reason!, /starts after time zero/);
});

test("cancelling a queued build returns at once; builds are per project", async () => {
  resetProxiesForTests();
  const { file: long } = await fixture("first", { seconds: 30 });
  const { file: next } = await fixture("second", {
    seconds: 2,
    size: "640x360",
  });
  const one = await workspace();
  const two = await workspace();
  const running = await imported(one.store, one.project.id, long, "long.mp4");
  const waiting = await imported(one.store, one.project.id, next, "short.mp4");
  // The same bytes in another project.
  const twin = await imported(two.store, two.project.id, long, "long.mp4");
  await buildProxy(one.store, one.project.id, running.id);
  await buildProxy(one.store, one.project.id, waiting.id);
  const until = Date.now() + 30_000;
  while (
    (await proxyStatus(one.store, one.project.id, running.id)).state !==
      "building" &&
    Date.now() < until
  )
    await new Promise((r) => setTimeout(r, 50));
  assert.equal(
    (await proxyStatus(one.store, one.project.id, waiting.id)).state,
    "queued",
  );
  // The other project's copy is not "building": that build is not its own.
  assert.equal(
    (await proxyStatus(two.store, two.project.id, twin.id)).state,
    "absent",
  );
  const started = Date.now();
  const left = await cancelProxy(one.store, one.project.id, waiting.id);
  assert.equal(left.state, "absent");
  assert.ok(Date.now() - started < 2000, "no wait for the running build");
  // A cancel in the other project leaves this project's build running.
  await cancelProxy(two.store, two.project.id, twin.id);
  assert.equal(
    (await proxyStatus(one.store, one.project.id, running.id)).state,
    "building",
  );
  assert.equal(
    (await cancelProxy(one.store, one.project.id, running.id)).state,
    "absent",
  );
});
