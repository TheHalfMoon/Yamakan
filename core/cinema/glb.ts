// A 3D model a person brings into the Cinema scene, checked before anything else reads it
// (Blender integration, 3D asset import). Only binary glTF 2.0 (.glb) is taken, and only a
// plain, self-contained one: one JSON chunk and at most one binary chunk, no reference to any
// other file or URL, no data URIs, no compression or texture formats that would run extra
// decoders, no skins, animations, cameras or lights, and every index and range inside the file.
// What passes is counted and bounded; nothing here runs the model's contents. Pure: the browser
// bundle can use it too.

export const GLB_LIMITS = Object.freeze({
  bytes: 64 * 1024 * 1024,
  jsonBytes: 4 * 1024 * 1024,
  jsonDepth: 32,
  jsonValues: 200_000,
  nodes: 10_000,
  meshes: 1_000,
  primitives: 10_000,
  materials: 256,
  images: 32,
  imageBytes: 16 * 1024 * 1024,
  vertices: 2_000_000,
  triangles: 2_000_000,
  accessorCount: 10_000_000,
});

// Extensions that only describe materials or texture placement; none of them adds a decoder.
export const GLB_EXTENSIONS = Object.freeze([
  "KHR_materials_emissive_strength",
  "KHR_materials_unlit",
  "KHR_texture_transform",
]);

export class GlbError extends Error {}

export type GlbSummary = {
  bytes: number;
  meshes: number;
  primitives: number;
  vertices: number;
  triangles: number;
  materials: number;
  images: number;
  // The model's extent, from its positions' min and max (glTF requires them).
  min: [number, number, number];
  max: [number, number, number];
};

const fail = (message: string): never => {
  throw new GlbError(message);
};

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"

const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// Walks the parsed JSON once: bounded depth and size, and no "uri" anywhere (a reference to
// another file, a URL or a data URI).
function walk(value: Json, depth: number, count: { n: number }) {
  if (++count.n > GLB_LIMITS.jsonValues)
    fail("The model's description is too large.");
  if (depth > GLB_LIMITS.jsonDepth)
    fail("The model's description is nested too deeply.");
  if (Array.isArray(value)) for (const v of value) walk(v, depth + 1, count);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (k === "uri")
        fail(
          "The model refers to another file or a URL; only a self-contained .glb is taken.",
        );
      walk(v, depth + 1, count);
    }
}

const isIndex = (v: unknown, length: number) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < length;
const arr = (v: unknown): unknown[] =>
  Array.isArray(v)
    ? v
    : v === undefined
      ? []
      : fail("The model's description is malformed.");
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail("The model's description is malformed.");
const nonNegInt = (v: unknown, what: string) =>
  Number.isInteger(v) && (v as number) >= 0
    ? (v as number)
    : fail(`The model's ${what} is not a whole number.`);

/** Checks a .glb file and returns what it holds, or throws a GlbError saying why it is refused. */
export function checkGlb(file: Uint8Array): GlbSummary {
  if (file.byteLength > GLB_LIMITS.bytes)
    fail("The model is larger than 64 MiB.");
  if (file.byteLength < 20) fail("This is not a .glb file.");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint32(0, true) !== MAGIC) fail("This is not a .glb file.");
  if (view.getUint32(4, true) !== 2) fail("Only glTF 2.0 models are taken.");
  if (view.getUint32(8, true) !== file.byteLength)
    fail("The model's length does not match its header.");

  // The JSON chunk, then at most one BIN chunk that ends the file.
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK)
    fail("The model's first chunk is not its description.");
  if (
    jsonLength % 4 !== 0 ||
    jsonLength > GLB_LIMITS.jsonBytes ||
    20 + jsonLength > file.byteLength
  )
    fail("The model's description chunk is malformed or too large.");
  let bin: Uint8Array | null = null;
  const afterJson = 20 + jsonLength;
  if (afterJson < file.byteLength) {
    if (afterJson + 8 > file.byteLength)
      fail("The model has a truncated chunk.");
    const binLength = view.getUint32(afterJson, true);
    if (view.getUint32(afterJson + 4, true) !== BIN_CHUNK)
      fail("The model's second chunk is not binary data.");
    if (binLength % 4 !== 0 || afterJson + 8 + binLength !== file.byteLength)
      fail("The model's binary chunk does not end the file.");
    bin = file.subarray(afterJson + 8, afterJson + 8 + binLength);
  }

  let gltf: Record<string, unknown>;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      file.subarray(20, afterJson),
    );
    gltf = obj(JSON.parse(text));
  } catch (e) {
    if (e instanceof GlbError) throw e;
    return fail("The model's description is not valid JSON.");
  }
  walk(gltf as Json, 0, { n: 0 });

  if (obj(gltf.asset).version !== "2.0")
    fail("Only glTF 2.0 models are taken.");
  for (const key of ["extensionsUsed", "extensionsRequired"])
    for (const ext of arr(gltf[key]))
      if (typeof ext !== "string" || !GLB_EXTENSIONS.includes(ext))
        fail(
          `The model uses ${String(ext)}, which is not taken (no compression or extra texture formats).`,
        );
  for (const key of ["skins", "animations", "cameras"])
    if (arr(gltf[key]).length)
      fail(
        `The model has ${key}; only still meshes and materials are taken for now.`,
      );

  // One buffer at most: the BIN chunk.
  const buffers = arr(gltf.buffers).map(obj);
  if (buffers.length > 1) fail("The model has more than one buffer.");
  const bufferLength = buffers.length
    ? nonNegInt(buffers[0].byteLength, "buffer length")
    : 0;
  if (buffers.length && (!bin || bufferLength > bin.byteLength))
    fail("The model's buffer is not its binary chunk.");

  const views = arr(gltf.bufferViews).map(obj);
  for (const v of views) {
    if (v.buffer !== 0 || !buffers.length)
      fail("A buffer view points outside the model.");
    const offset =
      v.byteOffset === undefined
        ? 0
        : nonNegInt(v.byteOffset, "buffer view offset");
    const length = nonNegInt(v.byteLength, "buffer view length");
    if (offset + length > bufferLength)
      fail("A buffer view runs past the model's data.");
    if (v.byteStride !== undefined) {
      const stride = nonNegInt(v.byteStride, "buffer view stride");
      if (stride < 4 || stride > 252 || stride % 4 !== 0)
        fail("A buffer view has an invalid stride.");
    }
  }

  const accessors = arr(gltf.accessors).map(obj);
  for (const a of accessors) {
    if (a.sparse !== undefined)
      fail("The model uses sparse data, which is not taken for now.");
    const size = COMPONENT_BYTES[a.componentType as number];
    const components = TYPE_COMPONENTS[a.type as string];
    if (!size || !components) fail("An accessor has an unknown data type.");
    const count = nonNegInt(a.count, "accessor count");
    if (count < 1 || count > GLB_LIMITS.accessorCount)
      fail("An accessor's count is out of range.");
    if (a.bufferView === undefined) continue;
    if (!isIndex(a.bufferView, views.length))
      fail("An accessor points at no buffer view.");
    const bv = views[a.bufferView as number];
    const element = size * components;
    const stride =
      bv.byteStride === undefined ? element : (bv.byteStride as number);
    const offset =
      a.byteOffset === undefined
        ? 0
        : nonNegInt(a.byteOffset, "accessor offset");
    if (offset + (count - 1) * stride + element > (bv.byteLength as number))
      fail("An accessor runs past its buffer view.");
  }

  const images = arr(gltf.images).map(obj);
  if (images.length > GLB_LIMITS.images) fail("The model has too many images.");
  for (const img of images) {
    if (img.mimeType !== "image/png" && img.mimeType !== "image/jpeg")
      fail("A model image is not PNG or JPEG.");
    if (!isIndex(img.bufferView, views.length))
      fail("A model image is not stored inside the file.");
    const bv = views[img.bufferView as number];
    const start = bv.byteOffset === undefined ? 0 : (bv.byteOffset as number);
    const length = bv.byteLength as number;
    if (length > GLB_LIMITS.imageBytes) fail("A model image is too large.");
    const head = bin!.subarray(start, start + 4);
    const png =
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47;
    const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (
      (img.mimeType === "image/png" && !png) ||
      (img.mimeType === "image/jpeg" && !jpeg)
    )
      fail("A model image's bytes are not what it says it is.");
  }

  const materials = arr(gltf.materials);
  if (materials.length > GLB_LIMITS.materials)
    fail("The model has too many materials.");
  const nodes = arr(gltf.nodes).map(obj);
  if (nodes.length > GLB_LIMITS.nodes) fail("The model has too many nodes.");
  for (const n of nodes) {
    if (n.camera !== undefined || n.skin !== undefined)
      fail("The model has cameras or skins; only still meshes are taken.");
    if (obj(n.extensions ?? {}).KHR_lights_punctual !== undefined)
      fail("The model has lights; only meshes are taken.");
  }
  if (!arr(gltf.scenes).length) fail("The model has no scene.");

  const meshes = arr(gltf.meshes).map(obj);
  if (!meshes.length) fail("The model has no mesh.");
  if (meshes.length > GLB_LIMITS.meshes) fail("The model has too many meshes.");
  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes)
    for (const p of arr(m.primitives).map(obj)) {
      if (++primitives > GLB_LIMITS.primitives)
        fail("The model has too many parts.");
      const mode = p.mode === undefined ? 4 : p.mode;
      if (mode !== 4) fail("Only triangle meshes are taken.");
      if (p.extensions !== undefined && Object.keys(obj(p.extensions)).length)
        fail(
          "A mesh part uses an extension (such as compression), which is not taken.",
        );
      const position = obj(p.attributes).POSITION;
      if (!isIndex(position, accessors.length))
        fail("A mesh part has no positions.");
      const pos = accessors[position as number];
      if (
        pos.type !== "VEC3" ||
        pos.componentType !== 5126 ||
        pos.bufferView === undefined
      )
        fail("A mesh part's positions are not 3D floats in the file.");
      const pmin = arr(pos.min);
      const pmax = arr(pos.max);
      if (
        pmin.length !== 3 ||
        pmax.length !== 3 ||
        ![...pmin, ...pmax].every((x) => Number.isFinite(x))
      )
        fail("A mesh part's positions have no finite bounds.");
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], pmin[i] as number);
        max[i] = Math.max(max[i], pmax[i] as number);
      }
      const count = pos.count as number;
      vertices += count;
      triangles += Math.floor(
        (p.indices === undefined
          ? count
          : (accessors[p.indices as number]?.count as number)) / 3,
      );
      // Over the limits before any index is read.
      if (vertices > GLB_LIMITS.vertices)
        fail("The model has too many vertices.");
      if (triangles > GLB_LIMITS.triangles)
        fail("The model has too many triangles.");
      if (p.indices !== undefined) {
        if (!isIndex(p.indices, accessors.length))
          fail("A mesh part's indices point at nothing.");
        const idx = accessors[p.indices as number];
        if (
          idx.type !== "SCALAR" ||
          ![5121, 5123, 5125].includes(idx.componentType as number) ||
          idx.bufferView === undefined
        )
          fail("A mesh part's indices are malformed.");
        // Every index points at one of the part's own vertices.
        const bv = views[idx.bufferView as number];
        const size = COMPONENT_BYTES[idx.componentType as number];
        const stride =
          bv.byteStride === undefined ? size : (bv.byteStride as number);
        const base =
          (bv.byteOffset === undefined ? 0 : (bv.byteOffset as number)) +
          (idx.byteOffset === undefined ? 0 : (idx.byteOffset as number));
        const data = new DataView(
          bin!.buffer,
          bin!.byteOffset,
          bin!.byteLength,
        );
        for (let i = 0; i < (idx.count as number); i++) {
          const at = base + i * stride;
          const value =
            size === 1
              ? data.getUint8(at)
              : size === 2
                ? data.getUint16(at, true)
                : data.getUint32(at, true);
          if (value >= count)
            fail("A mesh part's indices point past its vertices.");
        }
      }
    }

  return {
    bytes: file.byteLength,
    meshes: meshes.length,
    primitives,
    vertices,
    triangles,
    materials: materials.length,
    images: images.length,
    min,
    max,
  };
}
