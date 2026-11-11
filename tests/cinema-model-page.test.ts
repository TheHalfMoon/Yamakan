// The Cinema page's 3D models: a file is checked as the service checks it, a stored model is
// added as an item naming it, and the preview fits it to a 1 m box as the Blender render does.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CINEMA_PAGE_MAX_MODELS,
  addCinemaModel,
  cinemaModelCount,
  cinemaModelName,
  cinemaModelProblem,
  createModelCache,
  fitToMetre,
  imageTextures,
  parseCinemaModel,
} from "../src/cinema/cinemaModels.ts";
import { freshCinemaScene } from "../src/cinema/cinemaProject.ts";
import { CINEMA_PAGE_MAX_ITEMS } from "../src/cinema/cinemaObjects.ts";
import { parseScene3D } from "../core/scene3d.ts";
import { MESSAGES } from "../src/i18n.ts";
const { en, ar } = MESSAGES;

// A box mesh of the given half sizes, its vertices moved by `offset`, as a .glb.
function bar(half = [1, 0.25, 0.25], offset = [0, 0, 0], nodeScale = 1) {
  const [hx, hy, hz] = half;
  const corners = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ].map(([x, y, z]) => [x + offset[0], y + offset[1], z + offset[2]]);
  // prettier-ignore
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
  ];
  const bin = Buffer.alloc(96 + 72);
  corners.flat().forEach((v, i) => bin.writeFloatLE(v, i * 4));
  indices.forEach((v, i) => bin.writeUInt16LE(v, 96 + i * 2));
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        mesh: 0,
        ...(nodeScale !== 1
          ? { scale: [nodeScale, nodeScale, nodeScale] }
          : {}),
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96 },
      { buffer: 0, byteOffset: 96, byteLength: 72 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: corners.reduce((m, c) => m.map((v, i) => Math.min(v, c[i]))),
        max: corners.reduce((m, c) => m.map((v, i) => Math.max(v, c[i]))),
      },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
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
  return new Uint8Array(Buffer.concat([header, json, binHeader, bin]));
}
const D = (c: string) => c.repeat(64);
const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

test("a stored model becomes a scene item the service accepts, named after its file", () => {
  const scene = addCinemaModel(
    freshCinemaScene(),
    cinemaModelName("Chair.GLB"),
    D("a"),
  );
  const item = scene.items.at(-1)!;
  assert.equal(item.name, "Chair");
  assert.equal(item.model, D("a"));
  assert.equal(item.assetId, null);
  assert.equal("color" in item, false);
  // Standing on the floor, like a 1 m box.
  assert.equal(item.position.y, 0.5);
  assert.equal(parseScene3D(scene).items.at(-1)!.model, D("a"));
  assert.equal(cinemaModelName(".glb"), "Model");
  assert.throws(() => addCinemaModel(freshCinemaScene(), "x", "not-a-digest"));
});

test("the page adds at most eight models (a render's most) and no more objects than it edits", () => {
  let scene = freshCinemaScene();
  for (let i = 0; i < CINEMA_PAGE_MAX_MODELS; i++)
    scene = addCinemaModel(scene, `m${i}`, D("b"));
  assert.equal(cinemaModelCount(scene), 8);
  assert.throws(
    () => addCinemaModel(scene, "one more", D("c")),
    /at most 8 3D models/,
  );
  const crowded = {
    ...freshCinemaScene(),
    items: Array.from({ length: CINEMA_PAGE_MAX_ITEMS }, (_, i) => ({
      ...scene.items[0],
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      model: undefined,
    })),
  };
  assert.throws(() => addCinemaModel(crowded, "x", D("d")), /most objects/);
});

test("a chosen file is checked as the service checks it, with the check's reason", () => {
  assert.equal(cinemaModelProblem(bar()), null);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array(40).fill(0)]);
  assert.deepEqual(cinemaModelProblem(png), {
    key: "cinema.model.refused",
    detail: "This is not a .glb file.",
  });
  assert.deepEqual(cinemaModelProblem(new Uint8Array(64 * 1024 * 1024 + 1)), {
    key: "cinema.model.tooLarge",
  });
});

test("the preview loads a model and fits it to a 1 m box at its middle, as the render does", async () => {
  const sized = (o: THREE.Object3D) => {
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    return {
      size: box
        .getSize(new THREE.Vector3())
        .toArray()
        .map((v) => +v.toFixed(4)),
      centre: box
        .getCenter(new THREE.Vector3())
        .toArray()
        .map((v) => +v.toFixed(4) + 0),
    };
  };
  const plain = await parseCinemaModel(buffer(bar()));
  assert.deepEqual(sized(plain), { size: [1, 0.25, 0.25], centre: [0, 0, 0] });
  // Far from the origin and fifty times larger inside the file: the same fitted box.
  const moved = await parseCinemaModel(
    buffer(bar([0.25, 1, 0.25], [6, 0, 0], 50)),
  );
  assert.deepEqual(sized(moved), { size: [0.25, 1, 0.25], centre: [0, 0, 0] });
  let meshes = 0;
  moved.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++;
  });
  assert.equal(meshes, 1);
  // A file the check refuses is not parsed at all.
  await assert.rejects(parseCinemaModel(new ArrayBuffer(64)), /not a \.glb/);
  assert.throws(() => fitToMetre(new THREE.Group()), /no size/);
});

test("the model strings exist in English and Arabic", () => {
  const keys = Object.keys(en).filter(
    (k) => k.startsWith("cinema.model.") || k === "cinema.objects.addModel",
  );
  assert.equal(keys.length, 10);
  for (const key of keys) assert.ok((ar as Record<string, string>)[key], key);
});

test("a loaded model is shared while items show it, freed after the last, and a failed load retried", async () => {
  const loads: string[] = [];
  const freed: string[] = [];
  const add = (v: string) => freed.push(v);
  let fail = true;
  const cache = createModelCache(async (key) => {
    loads.push(key);
    if (key === "p:bad" && fail) throw new Error("not reachable");
    return key;
  }, add);
  const tick = () => new Promise((r) => setImmediate(r));
  const a = cache.acquire("p:one");
  const b = cache.acquire("p:one");
  assert.equal(await a.value, await b.value);
  assert.deepEqual(loads, ["p:one"]);
  a.release();
  a.release(); // twice is once
  await tick();
  assert.deepEqual(freed, [], "still shown by one item");
  b.release();
  await tick();
  assert.deepEqual(freed, ["p:one"], "freed after the last");
  assert.equal(cache.size(), 0);
  // A failed load is forgotten; letting go of it never takes a count from the newer load.
  const failed = cache.acquire("p:bad");
  await assert.rejects(failed.value);
  fail = false;
  const retried = cache.acquire("p:bad");
  assert.equal(await retried.value, "p:bad", "tried again");
  failed.release();
  await tick();
  const all: string[] = freed;
  assert.ok(!all.includes("p:bad"), "the newer load is still shown");
  assert.deepEqual(loads, ["p:one", "p:bad", "p:bad"]);
  cache.acquire("q:two");
  cache.clear();
  await tick();
  assert.ok(all.includes("q:two") && all.includes("p:bad"));
});

test("embedded images load as <img> elements, which the page's image policy allows", () => {
  const manager = new THREE.LoadingManager();
  const parser = { textureLoader: null as unknown, options: { manager } };
  assert.equal(imageTextures(parser).name, "yamakan_image_textures");
  assert.ok(parser.textureLoader instanceof THREE.TextureLoader);
  assert.equal((parser.textureLoader as THREE.TextureLoader).manager, manager);
});

test("a model's name leaves out invisible format characters and is never cut inside one", () => {
  assert.equal(cinemaModelName("\u202Egnp.exe.glb"), "gnp.exe");
  assert.equal(cinemaModelName("a\u200Bb\uFEFF.glb"), "ab");
  const long = "😀".repeat(130) + ".glb";
  const name = cinemaModelName(long);
  assert.equal(Array.from(name).length, 120);
  assert.ok(!/[\uD800-\uDBFF]$/.test(name), "no half of a pair at the end");
});

test("the page tells zod to validate without compiling, before anything else is loaded", async () => {
  const { readFile } = await import("node:fs/promises");
  const main = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(main.split("\n")[0], 'import "./zod-browser.ts";');
  await import("../src/zod-browser.ts");
  const { config } = await import("zod");
  assert.equal(config().jitless, true);
});
