// A 3D model a person brings into the Cinema scene, checked before anything else reads it
// (Blender integration, 3D asset import). Only binary glTF 2.0 (.glb) is taken, and only a
// plain, self-contained one: one JSON chunk and at most one binary chunk, no reference to any
// other file or URL, no data URIs, no compression or texture formats that would run extra
// decoders, no skins, animations, morph targets, cameras or lights, every reference between
// its parts in range, and all data it describes stored in the file and bounded. What passes is
// counted, and its extent is measured from the positions themselves; nothing here runs the
// model's contents. Pure: the browser bundle can use it too.

export const GLB_LIMITS = Object.freeze({
  bytes: 64 * 1024 * 1024,
  jsonBytes: 4 * 1024 * 1024,
  jsonDepth: 32,
  jsonValues: 200_000,
  nodes: 10_000,
  nodeDepth: 64,
  meshes: 1_000,
  primitives: 10_000,
  materials: 256,
  textures: 256,
  samplers: 256,
  images: 32,
  imageBytes: 16 * 1024 * 1024,
  vertices: 2_000_000,
  triangles: 2_000_000,
  accessorCount: 10_000_000,
  // Bytes the importer would read for every attribute and index list, counted per use.
  decodedBytes: 256 * 1024 * 1024,
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
  // The model's extent, measured from its positions.
  min: [number, number, number];
  max: [number, number, number];
};

const fail = (message: string): never => {
  throw new GlbError(message);
};

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"

const COMPONENT_BYTES = new Map<unknown, number>([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);
const TYPE_COMPONENTS = new Map<unknown, number>([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);
// Vertex data a still mesh may carry; joints and weights belong to skins, which are refused.
const ATTRIBUTE = /^(POSITION|NORMAL|TANGENT|TEXCOORD_[0-7]|COLOR_[0-7])$/;
// The data types each kind of vertex data may have (glTF 2.0, meshes).
const ATTRIBUTE_TYPES: [RegExp, string[], number[]][] = [
  [/^NORMAL$/, ["VEC3"], [5126]],
  [/^TANGENT$/, ["VEC4"], [5126]],
  [/^TEXCOORD_/, ["VEC2"], [5126, 5121, 5123]],
  [/^COLOR_/, ["VEC3", "VEC4"], [5126, 5121, 5123]],
];
// A node's placement is bounded well inside float32, so Blender's transforms stay finite.
const TRANSFORM_LIMIT = 1e9;
const TRANSFORM_LENGTHS: [string, number][] = [
  ["matrix", 16],
  ["translation", 3],
  ["rotation", 4],
  ["scale", 3],
];
const TEXTURE_SLOTS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
];

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

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
const optIndex = (v: unknown, length: number, what: string) => {
  if (v !== undefined && !isIndex(v, length))
    fail(`The model's ${what} points at nothing.`);
};

// Walks the parsed JSON once: bounded depth and size, no "uri" anywhere (a reference to another
// file, a URL or a data URI), and no extension outside the allowlist wherever it is declared.
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
      // Stricter than glTF needs: an "extensions" key is checked even inside extras.
      if (k === "extensions") {
        if (depth === 0) fail("The model uses extensions on the whole file.");
        for (const name of Object.keys(obj(v)))
          if (!GLB_EXTENSIONS.includes(name))
            fail(
              `The model uses ${name}, which is not taken (no compression or extra texture formats).`,
            );
      }
      walk(v, depth + 1, count);
    }
}

/** Checks a .glb file and returns what it holds, or throws a GlbError saying why it is refused. */
export function checkGlb(file: Uint8Array): GlbSummary {
  if (!(file instanceof Uint8Array)) fail("This is not a .glb file.");
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
  let bin: Uint8Array = new Uint8Array(0);
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
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);

  // A byte-order mark is refused: Blender's JSON reader would not take it.
  if (file[20] === 0xef && file[21] === 0xbb && file[22] === 0xbf)
    fail("The model's description is not valid JSON.");
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
  if (buffers.length && bufferLength > bin.byteLength)
    fail("The model's buffer is not its binary chunk.");

  const views = arr(gltf.bufferViews).map((raw) => {
    const v = obj(raw);
    if (v.buffer !== 0 || !buffers.length)
      fail("A buffer view points outside the model.");
    const offset =
      v.byteOffset === undefined
        ? 0
        : nonNegInt(v.byteOffset, "buffer view offset");
    const length = nonNegInt(v.byteLength, "buffer view length");
    if (offset + length > bufferLength)
      fail("A buffer view runs past the model's data.");
    let stride: number | undefined;
    if (v.byteStride !== undefined) {
      stride = nonNegInt(v.byteStride, "buffer view stride");
      if (stride < 4 || stride > 252 || stride % 4 !== 0)
        fail("A buffer view has an invalid stride.");
    }
    return { offset, length, stride };
  });

  // Every accessor is stored in the file (no zero-filled ones), fits its view, and is aligned.
  const accessors = arr(gltf.accessors).map((raw) => {
    const a = obj(raw);
    if (a.sparse !== undefined)
      fail("The model uses sparse data, which is not taken for now.");
    const size = COMPONENT_BYTES.get(a.componentType);
    const components = TYPE_COMPONENTS.get(a.type);
    if (size === undefined || components === undefined)
      return fail("An accessor has an unknown data type.");
    const count = nonNegInt(a.count, "accessor count");
    if (count < 1 || count > GLB_LIMITS.accessorCount)
      fail("An accessor's count is out of range.");
    if (!isIndex(a.bufferView, views.length))
      fail("An accessor's data is not stored in the file.");
    const bv = views[a.bufferView as number];
    const element = size * components;
    const stride = bv.stride ?? element;
    if (stride < element) fail("An accessor's elements overlap.");
    const offset =
      a.byteOffset === undefined
        ? 0
        : nonNegInt(a.byteOffset, "accessor offset");
    if ((bv.offset + offset) % size !== 0)
      fail("An accessor's data is not aligned.");
    if (offset + (count - 1) * stride + element > bv.length)
      fail("An accessor runs past its buffer view.");
    return {
      raw: a,
      size,
      count,
      element,
      stride,
      start: bv.offset + offset,
      viewStride: bv.stride,
    };
  });

  const images = arr(gltf.images).map(obj);
  if (images.length > GLB_LIMITS.images) fail("The model has too many images.");
  for (const img of images) {
    if (img.mimeType !== "image/png" && img.mimeType !== "image/jpeg")
      fail("A model image is not PNG or JPEG.");
    if (!isIndex(img.bufferView, views.length))
      fail("A model image is not stored inside the file.");
    const bv = views[img.bufferView as number];
    if (bv.length > GLB_LIMITS.imageBytes) fail("A model image is too large.");
    const head = bin.subarray(bv.offset, bv.offset + Math.min(bv.length, 4));
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
  const samplers = arr(gltf.samplers).map(obj);
  if (samplers.length > GLB_LIMITS.samplers)
    fail("The model has too many samplers.");
  const textures = arr(gltf.textures).map(obj);
  if (textures.length > GLB_LIMITS.textures)
    fail("The model has too many textures.");
  for (const t of textures) {
    if (!isIndex(t.source, images.length))
      fail("A texture's image points at nothing.");
    optIndex(t.sampler, samplers.length, "texture sampler");
  }
  const materials = arr(gltf.materials).map(obj);
  if (materials.length > GLB_LIMITS.materials)
    fail("The model has too many materials.");
  for (const m of materials) {
    const pbr = obj(m.pbrMetallicRoughness ?? {});
    // Each slot is checked wherever it appears, so a valid copy cannot hide the one read.
    for (const slot of TEXTURE_SLOTS)
      for (const info of [m[slot], pbr[slot]]) {
        if (info === undefined) continue;
        if (!isIndex(obj(info).index, textures.length))
          fail("A material's texture points at nothing.");
        if (obj(info).texCoord !== undefined)
          nonNegInt(obj(info).texCoord, "texture coordinate set");
      }
  }

  // Meshes: triangle parts, attributes in the file with matching counts, nothing morphing.
  const meshes = arr(gltf.meshes).map(obj);
  if (!meshes.length) fail("The model has no mesh.");
  if (meshes.length > GLB_LIMITS.meshes) fail("The model has too many meshes.");
  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  let decoded = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const measured = new Set<number>();
  const use = (index: number) => {
    const a = accessors[index];
    decoded += a.count * a.element;
    if (decoded > GLB_LIMITS.decodedBytes)
      fail("The model describes more data than is taken.");
  };
  for (const m of meshes) {
    if (m.weights !== undefined) fail("The model has morph targets.");
    if (!arr(m.primitives).length) fail("A mesh has no parts.");
    for (const p of arr(m.primitives).map(obj)) {
      if (++primitives > GLB_LIMITS.primitives)
        fail("The model has too many parts.");
      const mode = p.mode === undefined ? 4 : p.mode;
      if (mode !== 4) fail("Only triangle meshes are taken.");
      if (p.targets !== undefined) fail("The model has morph targets.");
      optIndex(p.material, materials.length, "mesh part's material");
      const attributes = obj(p.attributes);
      if (!isIndex(attributes.POSITION, accessors.length))
        fail("A mesh part has no positions.");
      const positionIndex = attributes.POSITION as number;
      const pos = accessors[positionIndex];
      if (pos.raw.type !== "VEC3" || pos.raw.componentType !== 5126)
        fail("A mesh part's positions are not 3D floats.");
      const count = pos.count;
      for (const [name, index] of Object.entries(attributes)) {
        if (!ATTRIBUTE.test(name))
          fail(`A mesh part has ${name} data, which is not taken.`);
        if (!isIndex(index, accessors.length))
          fail("A mesh part's data points at nothing.");
        const a = accessors[index as number];
        if (a.count !== count)
          fail("A mesh part's data does not match its vertices.");
        for (const [pattern, types, components] of ATTRIBUTE_TYPES)
          if (
            pattern.test(name) &&
            (!types.includes(a.raw.type as string) ||
              !components.includes(a.raw.componentType as number))
          )
            fail(`A mesh part's ${name} data has the wrong type.`);
        // Whole-number coordinates and colours are only meaningful as 0..1 (glTF).
        if (
          /^(TEXCOORD|COLOR)_/.test(name) &&
          a.raw.componentType !== 5126 &&
          a.raw.normalized !== true
        )
          fail(`A mesh part's ${name} data is not normalized.`);
      }
      const idx =
        p.indices === undefined
          ? undefined
          : isIndex(p.indices, accessors.length)
            ? accessors[p.indices as number]
            : fail("A mesh part's indices point at nothing.");
      if (
        idx &&
        (idx.raw.type !== "SCALAR" ||
          ![5121, 5123, 5125].includes(idx.raw.componentType as number) ||
          idx.viewStride !== undefined)
      )
        fail("A mesh part's indices are malformed.");
      vertices += count;
      triangles += Math.floor((idx ? idx.count : count) / 3);
      // Over the limits before any data is read.
      if (vertices > GLB_LIMITS.vertices)
        fail("The model has too many vertices.");
      if (triangles > GLB_LIMITS.triangles)
        fail("The model has too many triangles.");
      for (const index of Object.values(attributes)) use(index as number);
      if (idx) use(p.indices as number);

      // The extent comes from the positions themselves, each accessor read once.
      if (!measured.has(positionIndex)) {
        measured.add(positionIndex);
        for (let i = 0; i < count; i++)
          for (let c = 0; c < 3; c++) {
            const x = data.getFloat32(pos.start + i * pos.stride + c * 4, true);
            if (!Number.isFinite(x))
              fail("A mesh part has a position that is not a number.");
            if (x < min[c]) min[c] = x;
            if (x > max[c]) max[c] = x;
          }
      }
      // Every index points at one of the part's own vertices.
      if (idx)
        for (let i = 0; i < idx.count; i++) {
          const at = idx.start + i * idx.size;
          const value =
            idx.size === 1
              ? data.getUint8(at)
              : idx.size === 2
                ? data.getUint16(at, true)
                : data.getUint32(at, true);
          if (value >= count)
            fail("A mesh part's indices point past its vertices.");
        }
    }
  }

  // Nodes: in range, each with one parent at most, no loops, bounded depth, and no cameras,
  // skins, lights or morph weights.
  const nodes = arr(gltf.nodes).map(obj);
  if (nodes.length > GLB_LIMITS.nodes) fail("The model has too many nodes.");
  const parent = Array.from({ length: nodes.length }, () => -1);
  // How much each node can enlarge what is below it; multiplied down each chain.
  const growth = Array.from({ length: nodes.length }, () => 1);
  nodes.forEach((n, i) => {
    if (n.camera !== undefined || n.skin !== undefined)
      fail("The model has cameras or skins; only still meshes are taken.");
    if (n.weights !== undefined) fail("The model has morph targets.");
    optIndex(n.mesh, meshes.length, "node's mesh");
    for (const [key, length] of TRANSFORM_LENGTHS) {
      if (n[key] === undefined) continue;
      const values = arr(n[key]);
      if (
        values.length !== length ||
        !values.every(
          (x) => typeof x === "number" && Math.abs(x) <= TRANSFORM_LIMIT,
        )
      )
        fail(`A node's ${key} is malformed or out of range.`);
    }
    if (
      n.matrix !== undefined &&
      (n.translation !== undefined ||
        n.rotation !== undefined ||
        n.scale !== undefined)
    )
      fail("A node has both a matrix and a separate placement.");
    if (n.rotation !== undefined) {
      const length = Math.hypot(...(n.rotation as number[]));
      if (Math.abs(length - 1) > 1e-3) fail("A node's rotation is not a unit.");
    }
    const enlarging =
      n.matrix !== undefined
        ? (n.matrix as number[]).slice(0, 12).map((x) => Math.abs(x) * 3)
        : n.scale !== undefined
          ? (n.scale as number[]).map(Math.abs)
          : [];
    growth[i] = Math.max(1, ...enlarging);
    for (const c of arr(n.children)) {
      if (!isIndex(c, nodes.length)) fail("A node's child points at nothing.");
      if (c === i || parent[c as number] !== -1)
        fail("A node has more than one parent.");
      parent[c as number] = i;
    }
  });
  for (let i = 0; i < nodes.length; i++) {
    let depth = 0;
    let scale = growth[i];
    for (let at = parent[i]; at !== -1; at = parent[at]) {
      if (++depth > GLB_LIMITS.nodeDepth)
        fail("The model's nodes are nested too deeply or in a loop.");
      scale *= growth[at];
      if (scale > TRANSFORM_LIMIT)
        fail("The model's nodes enlarge it out of range.");
    }
  }
  const scenes = arr(gltf.scenes).map(obj);
  if (!scenes.length) fail("The model has no scene.");
  optIndex(gltf.scene, scenes.length, "default scene");
  for (const s of scenes) {
    const roots = arr(s.nodes);
    for (const n of roots)
      if (!isIndex(n, nodes.length) || parent[n as number] !== -1)
        fail("A scene's node points at nothing or is not a root.");
    if (new Set(roots).size !== roots.length)
      fail("A scene lists the same node twice.");
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
