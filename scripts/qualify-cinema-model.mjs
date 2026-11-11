/**
 * 3D models on the Cinema page, end to end in a real browser against the real service
 * (Windows, with the pinned Blender installed by `npm run blender:install`):
 *
 *   the service's own model routes (no session: refused; another type: refused; an unknown
 *   digest: not found) → a file that is not a model, refused on the page with the check's
 *   reason → a textured .glb chosen on the page, stored in the project, shown in the preview
 *   (its texture decoded under the page's own policy, nothing refused) → the scene saved,
 *   the page reloaded, the model shown again from the project → served back as
 *   model/gltf-binary, byte for byte the stored copy → rendered with Blender from the page,
 *   the model's texture in the video.
 *
 * Nothing here is mocked. The receipt is printed, and written only where
 * YAMAKAN_QUALIFY_RECEIPT points; screenshots go only where YAMAKAN_QUALIFY_SHOTS points
 * (never into the repository).
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import assert from "node:assert/strict";
import { YamakanClient } from "../sdk/client.ts";
import { mediaTools } from "../core/process/workers.ts";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const clean =
  execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim() === "";
const shots = process.env.YAMAKAN_QUALIFY_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const steps = [];
const step = (name, detail) => {
  steps.push(detail ? { name, ...detail } : { name });
  console.log(`- ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

// A green-textured bar as a .glb: a box mesh 2 x 0.5 x 0.5 coloured only by an embedded PNG.
function solidPng(rgb, side = 4) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([
    Buffer.from([0]),
    ...Array.from({ length: side }, () => Buffer.from(rgb)),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array(side).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function greenBar() {
  const [hx, hy, hz] = [1, 0.25, 0.25];
  const corners = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ];
  // prettier-ignore
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
  ];
  const image = solidPng([0, 220, 0]);
  const imageAt = 96 + 72 + 64;
  const bin = Buffer.alloc(imageAt + Math.ceil(image.length / 4) * 4);
  corners.flat().forEach((v, i) => bin.writeFloatLE(v, i * 4));
  indices.forEach((v, i) => bin.writeUInt16LE(v, 96 + i * 2));
  [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1].forEach((v, i) =>
    bin.writeFloatLE(v, 168 + i * 4),
  );
  image.copy(bin, imageAt);
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, TEXCOORD_0: 2 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.6,
        },
      },
    ],
    images: [{ bufferView: 3, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96 },
      { buffer: 0, byteOffset: 96, byteLength: 72 },
      { buffer: 0, byteOffset: 168, byteLength: 64 },
      { buffer: 0, byteOffset: imageAt, byteLength: image.length },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3" },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
      { bufferView: 2, componentType: 5126, count: 8, type: "VEC2" },
    ],
  };
  const text = Buffer.from(JSON.stringify(gltf), "utf8");
  const json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(json);
  const header = Buffer.alloc(20);
  const length = 20 + json.length + 8 + bin.length;
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binHeader, bin]);
}

// Green pixels in a PNG screenshot or the first frame of a video, decoded by FFmpeg.
function greenIn(file, input = []) {
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      ...input,
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=160:90",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 26, timeout: 60000 },
  );
  let green = 0;
  for (let i = 0; i + 2 < 160 * 90 * 3; i += 3)
    if (
      raw[i + 1] > 90 &&
      raw[i + 1] > 2 * raw[i] &&
      raw[i + 1] > 2 * raw[i + 2]
    )
      green++;
  return green;
}

const children = [];
async function start(port) {
  const root = mkdtempSync(join(tmpdir(), "yamakan-cinema-model-"));
  const workspace = join(root, "workspace");
  const child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env: {
        ...process.env,
        YAMAKAN_WORKSPACE: workspace,
        YAMAKAN_PORT: String(port),
      },
      silent: true,
      windowsHide: true,
    },
  );
  children.push(child);
  let errors = "";
  child.stderr.on("data", (c) => (errors += String(c)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`startup: ${errors}`)),
      30000,
    );
    child.stdout.on("data", (c) => {
      if (String(c).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`exited ${code}: ${errors}`));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(workspace, url);
  const launch = readFileSync(join(workspace, "launch"), "utf8")
    .split("\n")[0]
    .trim();
  const token = readFileSync(join(workspace, "token"), "utf8").trim();
  return {
    root,
    url,
    launch,
    token,
    client: new YamakanClient({ baseUrl: url, token }),
  };
}

const waitAttr = (page, id, name, value, timeout = 30000) =>
  page.waitForFunction(
    ([i, n, v]) =>
      document.querySelector(`[data-testid="${i}"]`)?.getAttribute(n) === v,
    [id, name, value],
    { timeout },
  );

let browser;
const receipt = {
  qualification: "CINEMA_MODEL_IMPORT",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  clean,
  steps,
  passed: false,
};
try {
  const { root, url, launch, token, client } = await start(24393);
  const capability = await client.call("yamakan.blender.capability", {});
  assert.equal(
    capability.available,
    true,
    `Blender is not installed here: ${capability.message}`,
  );
  const glb = greenBar();
  const digest = createHash("sha256").update(glb).digest("hex");

  // The service's own routes, as any caller meets them.
  const first = await client.call("yamakan.project.create", { name: "Models" });
  const models = `${url}/api/v1/projects/${first.id}/cinema/models`;
  const anonymous = await fetch(models, {
    method: "POST",
    headers: { "Content-Type": "model/gltf-binary" },
    body: glb,
  });
  assert.equal(anonymous.status, 401, "an upload without a session is refused");
  const wrongType = await fetch(models, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: glb,
  });
  assert.equal(wrongType.status, 400);
  assert.equal(wrongType.headers.get("connection"), "close");
  const anonymousRead = await fetch(`${models}/${"0".repeat(64)}`);
  assert.equal(
    anonymousRead.status,
    401,
    "a read without a session is refused",
  );
  const unknown = await fetch(`${models}/${"0".repeat(64)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(unknown.status, 404);
  step("service routes refuse no session, another type, and an unknown model", {
    anonymous: anonymous.status,
    anonymousRead: anonymousRead.status,
    wrongType: wrongType.status,
    unknown: unknown.status,
  });

  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  const refusals = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text()))
      refusals.push(m.text());
  });
  // The page's own policy violations, as events (not only their console text).
  await page.exposeFunction("yamakanPolicyRefused", (what) =>
    refusals.push(String(what)),
  );
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) =>
      window.yamakanPolicyRefused(`${e.violatedDirective} ${e.blockedURI}`),
    ),
  );
  const modelUploads = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/cinema/models"))
      modelUploads.push(r.url());
  });

  await page.goto(launch);
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Model page");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Model page", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.getByTestId("cinema-viewport").waitFor();
  await waitAttr(page, "cinema-project-state", "data-state", "new");
  const project = (await client.call("yamakan.project.list", {})).find(
    (p) => p.name === "Model page",
  );

  // A file that is not a model: refused on the page with the check's reason, nothing stored.
  await page.getByTestId("cinema-model-file").setInputFiles({
    name: "notes.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("this is a text file, not a binary glTF model at all"),
  });
  await page.getByTestId("cinema-error").waitFor();
  const refusedText = await page.getByTestId("cinema-error").textContent();
  assert.match(refusedText, /cannot be used as a 3D model.*not a \.glb/);
  assert.equal(modelUploads.length, 0, "a refused file is not uploaded");
  step("a file that is not a model is refused on the page", {
    message: refusedText.trim(),
  });

  // The textured model: stored, added, and shown in the preview.
  const before = join(root, "preview-before.png");
  await page.getByTestId("cinema-canvas").screenshot({ path: before });
  await page.getByTestId("cinema-model-file").setInputFiles({
    name: "Green bar.glb",
    mimeType: "model/gltf-binary",
    buffer: glb,
  });
  await page.waitForFunction(
    () => window.__yamakanCinema?.getShownModels() === 1,
    null,
    { timeout: 30000 },
  );
  const item = await page.evaluate(() =>
    window.__yamakanCinema.getScene().items.find((i) => i.model),
  );
  assert.equal(item.model, digest, "the item names the stored model");
  assert.equal(item.name, "Green bar");
  // Let the preview draw a few frames, then look at it.
  await page.waitForTimeout(500);
  const after = join(root, "preview-after.png");
  await page.getByTestId("cinema-canvas").screenshot({ path: after });
  if (shots)
    await page
      .getByTestId("cinema-viewport")
      .screenshot({ path: join(shots, "1-model-preview.png") });
  const greenBefore = greenIn(before);
  const greenAfter = greenIn(after);
  assert.ok(
    greenAfter > greenBefore + 40,
    `the preview shows the model's texture (${greenBefore} → ${greenAfter})`,
  );
  assert.deepEqual(refusals, [], "the page's policy refused nothing");
  step("model stored, added and shown with its texture", {
    digest,
    greenPixelsBefore: greenBefore,
    greenPixelsAfter: greenAfter,
  });

  // Saved, the page reloaded, and the model shown again from the project.
  await page.getByTestId("cinema-project-save").click();
  await waitAttr(page, "cinema-project-state", "data-state", "saved");
  await page.reload();
  await page.locator(".project-list button", { hasText: "Model page" }).click();
  await page
    .getByRole("heading", { name: "Model page", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await waitAttr(page, "cinema-project-state", "data-state", "saved");
  await page.waitForFunction(
    () => window.__yamakanCinema?.getShownModels() === 1,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);
  const reloaded = join(root, "preview-reloaded.png");
  await page.getByTestId("cinema-canvas").screenshot({ path: reloaded });
  const greenReloaded = greenIn(reloaded);
  assert.ok(
    greenReloaded > 40,
    `the reloaded preview shows the texture (${greenReloaded})`,
  );
  step("saved, reloaded, and shown again from the project with its texture", {
    greenPixels: greenReloaded,
  });

  // Served back as the project stored it.
  const served = await fetch(
    `${url}/api/v1/projects/${project.id}/cinema/models/${digest}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "model/gltf-binary");
  const bytes = Buffer.from(await served.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await client.cinemaModel(project.id, digest)))
      .digest("hex"),
    digest,
  );
  // Another project does not hold it.
  const elsewhere = await fetch(
    `${url}/api/v1/projects/${first.id}/cinema/models/${digest}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assert.equal(elsewhere.status, 404, "another project does not serve it");
  step("served back as model/gltf-binary, byte for byte", {
    bytes: bytes.length,
  });

  // Rendered with Blender from the page: the model's own texture is in the video.
  await page.getByTestId("cinema-blender-size").selectOption("small");
  await page.getByTestId("cinema-blender-seconds").selectOption("1");
  await page.getByTestId("cinema-blender-quality").selectOption("draft");
  await page.getByTestId("cinema-blender-move").selectOption("still");
  await page.getByTestId("cinema-blender-render").click();
  const started = Date.now();
  for (;;) {
    const state = await page
      .getByTestId("cinema-blender-state")
      .getAttribute("data-state");
    if (state && state !== "working") break;
    assert.ok(Date.now() - started < 600000, "render took over 10 minutes");
    await page.waitForTimeout(500);
  }
  assert.equal(
    await page.getByTestId("cinema-blender-state").getAttribute("data-state"),
    "done",
    await page.getByTestId("cinema-blender").textContent(),
  );
  const rendered = (
    await client.call("yamakan.project.open", { projectId: project.id })
  ).assets.find((a) => a.kind === "video");
  assert.ok(rendered, "the render is a project asset");
  const media = await fetch(
    `${url}/api/v1/projects/${project.id}/assets/${rendered.id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assert.equal(media.status, 200);
  const video = join(root, "render.mp4");
  writeFileSync(video, Buffer.from(await media.arrayBuffer()));
  const greenVideo = greenIn(video);
  if (shots)
    await page
      .getByTestId("cinema-blender")
      .screenshot({ path: join(shots, "2-rendered.png") });
  step("rendered with Blender from the page", {
    seconds: Math.round((Date.now() - started) / 1000),
    greenPixelsInVideo: greenVideo,
  });
  // Small (320 x 180, scaled to 160 x 90) and one model among the sample box: a few dozen pixels.
  assert.ok(greenVideo > 15, `the video shows the texture (${greenVideo})`);

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(refusals, [], "the page's policy refused nothing");
  receipt.passed = true;
} finally {
  await browser?.close().catch(() => {});
  for (const child of children) child.kill();
  console.log(JSON.stringify(receipt, null, 2));
  if (process.env.YAMAKAN_QUALIFY_RECEIPT)
    writeFileSync(
      process.env.YAMAKAN_QUALIFY_RECEIPT,
      JSON.stringify(receipt, null, 2),
    );
}
