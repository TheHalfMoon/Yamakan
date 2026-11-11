// The .glb check: a plain, self-contained model passes and is counted; hostile or unsupported
// files are refused before anything else reads them.
import test from "node:test";
import assert from "node:assert/strict";
import { GLB_LIMITS, GlbError, checkGlb } from "../core/cinema/glb.ts";

type Gltf = Record<string, unknown>;

// One triangle: three float positions (36 bytes) and three u16 indices (6 bytes, padded to 8).
function triangleBin(indices = [0, 1, 2]) {
  const bin = new Uint8Array(44);
  const view = new DataView(bin.buffer);
  [0, 0, 0, 1, 0, 0, 0, 2, 0].forEach((v, i) =>
    view.setFloat32(i * 4, v, true),
  );
  indices.forEach((v, i) => view.setUint16(36 + i * 2, v, true));
  return bin;
}

function triangle(): Gltf {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 2, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  };
}

const pad = (bytes: Uint8Array, fill: number) => {
  const out = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4).fill(fill);
  out.set(bytes);
  return out;
};

function glb(gltf: unknown, bin: Uint8Array | null = triangleBin()) {
  const json = pad(new TextEncoder().encode(JSON.stringify(gltf)), 0x20);
  const binChunk = bin ? pad(bin, 0) : null;
  const length =
    12 + 8 + json.byteLength + (binChunk ? 8 + binChunk.byteLength : 0);
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, json.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(json, 20);
  if (binChunk) {
    const at = 20 + json.byteLength;
    view.setUint32(at, binChunk.byteLength, true);
    view.setUint32(at + 4, 0x004e4942, true);
    out.set(binChunk, at + 8);
  }
  return out;
}

const refused = (file: Uint8Array, pattern: RegExp) =>
  assert.throws(
    () => checkGlb(file),
    (e: unknown) => e instanceof GlbError && pattern.test(e.message),
  );
const changed = (edit: (g: Gltf & Record<string, any>) => void) => {
  const g = triangle() as Gltf & Record<string, any>;
  edit(g);
  return glb(g);
};

test("a plain triangle passes and is counted, with its extent", () => {
  assert.deepEqual(checkGlb(glb(triangle())), {
    bytes: glb(triangle()).byteLength,
    meshes: 1,
    primitives: 1,
    vertices: 3,
    triangles: 1,
    materials: 0,
    images: 0,
    min: [0, 0, 0],
    max: [1, 2, 0],
  });
});

test("a model inside a larger buffer (an offset view) is read in place", () => {
  const file = glb(triangle());
  const bigger = new Uint8Array(file.byteLength + 16);
  bigger.set(file, 8);
  assert.equal(checkGlb(bigger.subarray(8, 8 + file.byteLength)).triangles, 1);
});

test("a model without indices counts triangles from its vertices", () => {
  const g = changed((g) => {
    delete g.meshes[0].primitives[0].indices;
  });
  assert.equal(checkGlb(g).triangles, 1);
});

test("a PNG texture stored in the file and an allowed extension pass", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const bin = new Uint8Array(52);
  bin.set(triangleBin());
  bin.set(png, 44);
  const g = triangle() as Record<string, any>;
  g.buffers[0].byteLength = 52;
  g.bufferViews.push({ buffer: 0, byteOffset: 44, byteLength: 8 });
  g.images = [{ bufferView: 2, mimeType: "image/png" }];
  g.textures = [{ source: 0 }];
  g.materials = [
    {
      pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
      extensions: { KHR_materials_unlit: {} },
    },
  ];
  g.extensionsUsed = ["KHR_materials_unlit"];
  const summary = checkGlb(glb(g, bin));
  assert.equal(summary.images, 1);
  assert.equal(summary.materials, 1);
});

test("files that are not a well-formed .glb are refused", () => {
  const good = glb(triangle());
  refused(new Uint8Array(10), /not a \.glb/);
  const magic = good.slice();
  magic[0] = 0x00;
  refused(magic, /not a \.glb/);
  const version = good.slice();
  new DataView(version.buffer).setUint32(4, 1, true);
  refused(version, /glTF 2\.0/);
  const length = good.slice();
  new DataView(length.buffer).setUint32(8, good.byteLength + 4, true);
  refused(length, /length does not match/);
  // A glTF text file (.gltf) is not taken either.
  refused(
    new TextEncoder().encode(JSON.stringify(triangle()) + "    "),
    /not a \.glb/,
  );
});

test("broken chunks are refused", () => {
  const good = glb(triangle());
  const firstType = good.slice();
  new DataView(firstType.buffer).setUint32(16, 0x004e4942, true);
  refused(firstType, /first chunk/);
  const misaligned = good.slice();
  const dv = new DataView(misaligned.buffer);
  dv.setUint32(12, dv.getUint32(12, true) - 2, true);
  refused(misaligned, /description chunk/);
  const pastEnd = good.slice();
  new DataView(pastEnd.buffer).setUint32(12, good.byteLength, true);
  refused(pastEnd, /description chunk/);
  // A third chunk after the binary data.
  const trailing = new Uint8Array(good.byteLength + 12);
  trailing.set(good);
  const tv = new DataView(trailing.buffer);
  tv.setUint32(8, trailing.byteLength, true);
  tv.setUint32(good.byteLength, 4, true);
  tv.setUint32(good.byteLength + 4, 0x004e4942, true);
  refused(trailing, /does not end the file/);
  // A second chunk that is not binary data.
  const secondType = good.slice();
  const jsonLength = new DataView(good.buffer).getUint32(12, true);
  new DataView(secondType.buffer).setUint32(
    20 + jsonLength + 4,
    0x4e4f534a,
    true,
  );
  refused(secondType, /second chunk/);
  // A header for the second chunk cut short.
  const json = glb(triangle(), null);
  const cut = new Uint8Array(json.byteLength + 4);
  cut.set(json);
  new DataView(cut.buffer).setUint32(8, cut.byteLength, true);
  refused(cut, /truncated/);
});

test("a description that is not JSON, or not UTF-8, is refused", () => {
  const good = glb(triangle());
  const notJson = good.slice();
  notJson[20] = "x".charCodeAt(0);
  refused(notJson, /not valid JSON/);
  const notUtf8 = good.slice();
  notUtf8[21] = 0xff;
  refused(notUtf8, /not valid JSON/);
  refused(glb([1, 2, 3]), /malformed/);
});

test("any reference to another file, a URL or a data URI is refused, wherever it is", () => {
  refused(
    changed((g) => {
      g.buffers[0].uri = "model.bin";
    }),
    /another file or a URL/,
  );
  refused(
    changed((g) => {
      g.buffers[0].uri = "data:application/octet-stream;base64,AAAA";
    }),
    /another file or a URL/,
  );
  refused(
    changed((g) => {
      g.images = [{ uri: "https://example.com/t.png" }];
    }),
    /another file or a URL/,
  );
  refused(
    changed((g) => {
      g.extras = { deep: [{ uri: "file:///C:/Windows/win.ini" }] };
    }),
    /another file or a URL/,
  );
});

test("a description nested too deeply or too large is refused", () => {
  refused(
    changed((g) => {
      let deep: unknown = 0;
      for (let i = 0; i < GLB_LIMITS.jsonDepth + 2; i++) deep = [deep];
      g.extras = deep;
    }),
    /nested too deeply/,
  );
  refused(
    changed((g) => {
      g.extras = Array.from({ length: GLB_LIMITS.jsonValues + 1 }).fill(0);
    }),
    /too large/,
  );
});

test("compression, extra texture formats and unknown extensions are refused", () => {
  for (const ext of [
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
    "KHR_texture_basisu",
    "EXT_texture_webp",
    "KHR_lights_punctual",
  ]) {
    refused(
      changed((g) => {
        g.extensionsUsed = [ext];
      }),
      new RegExp(ext),
    );
    refused(
      changed((g) => {
        g.extensionsRequired = [ext];
      }),
      new RegExp(ext),
    );
  }
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].extensions = {
        KHR_draco_mesh_compression: { bufferView: 0, attributes: {} },
      };
    }),
    /KHR_draco_mesh_compression/,
  );
});

test("skins, animations, cameras and lights are refused", () => {
  for (const key of ["skins", "animations", "cameras"])
    refused(
      changed((g) => {
        g[key] = [{}];
      }),
      new RegExp(key),
    );
  refused(
    changed((g) => {
      g.nodes[0].camera = 0;
    }),
    /cameras or skins/,
  );
  refused(
    changed((g) => {
      g.nodes[0].skin = 0;
    }),
    /cameras or skins/,
  );
  refused(
    changed((g) => {
      g.nodes[0].extensions = { KHR_lights_punctual: { light: 0 } };
    }),
    /lights/,
  );
});

test("buffers, views and accessors that point outside the file are refused", () => {
  refused(
    changed((g) => {
      g.buffers.push({ byteLength: 4 });
    }),
    /more than one buffer/,
  );
  refused(
    changed((g) => {
      g.buffers[0].byteLength = 4096;
    }),
    /not its binary chunk/,
  );
  refused(glb(triangle(), null), /not its binary chunk/);
  refused(
    changed((g) => {
      g.bufferViews[0].buffer = 1;
    }),
    /outside the model/,
  );
  refused(
    changed((g) => {
      g.bufferViews[1].byteLength = 64;
    }),
    /runs past the model's data/,
  );
  refused(
    changed((g) => {
      g.bufferViews[0].byteOffset = -4;
    }),
    /whole number/,
  );
  refused(
    changed((g) => {
      g.bufferViews[0].byteStride = 2;
    }),
    /invalid stride/,
  );
  refused(
    changed((g) => {
      g.accessors[0].count = 4;
    }),
    /runs past its buffer view/,
  );
  refused(
    changed((g) => {
      g.accessors[0].byteOffset = 4;
    }),
    /runs past its buffer view/,
  );
  refused(
    changed((g) => {
      g.accessors[0].bufferView = 9;
    }),
    /not stored in the file/,
  );
  refused(
    changed((g) => {
      g.accessors[0].count = 0;
    }),
    /count is out of range/,
  );
  refused(
    changed((g) => {
      g.accessors[0].count = 1.5;
    }),
    /whole number/,
  );
  refused(
    changed((g) => {
      g.accessors[0].type = "VEC5";
    }),
    /unknown data type/,
  );
  refused(
    changed((g) => {
      g.accessors[0].sparse = { count: 1, indices: {}, values: {} };
    }),
    /sparse/,
  );
});

test("indices that point past their part's vertices are refused", () => {
  const g = triangle();
  refused(glb(g, triangleBin([0, 1, 3])), /point past its vertices/);
  refused(glb(g, triangleBin([0, 65535, 2])), /point past its vertices/);
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].indices = 7;
    }),
    /point at nothing/,
  );
  refused(
    changed((g) => {
      g.accessors[1].componentType = 5122; // signed: not an index type
    }),
    /indices are malformed/,
  );
});

test("meshes must be triangles with 3D float positions and finite bounds", () => {
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].mode = 1;
    }),
    /triangle meshes/,
  );
  refused(
    changed((g) => {
      delete g.meshes[0].primitives[0].attributes.POSITION;
    }),
    /no positions/,
  );
  refused(
    changed((g) => {
      g.accessors[0].componentType = 5123;
      g.accessors[0].count = 1;
    }),
    /3D floats/,
  );
  const nan = triangleBin();
  new DataView(nan.buffer).setFloat32(4, Number.NaN, true);
  refused(glb(triangle(), nan), /not a number/);
  refused(
    changed((g) => {
      g.meshes = [];
    }),
    /no mesh/,
  );
  refused(
    changed((g) => {
      delete g.scenes;
    }),
    /no scene/,
  );
});

test("images must be PNG or JPEG, stored in the file, and really be what they say", () => {
  const withImage = (image: Record<string, unknown>, bytes: number[]) => {
    const bin = new Uint8Array(52);
    bin.set(triangleBin());
    bin.set(bytes, 44);
    const g = triangle() as Record<string, any>;
    g.buffers[0].byteLength = 52;
    g.bufferViews.push({ buffer: 0, byteOffset: 44, byteLength: 8 });
    g.images = [image];
    return glb(g, bin);
  };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  refused(
    withImage({ bufferView: 2, mimeType: "image/webp" }, png),
    /not PNG or JPEG/,
  );
  refused(
    withImage({ mimeType: "image/png" }, png),
    /not stored inside the file/,
  );
  refused(
    withImage({ bufferView: 2, mimeType: "image/jpeg" }, png),
    /not what it says/,
  );
  refused(
    withImage(
      { bufferView: 2, mimeType: "image/png" },
      [0x3c, 0x73, 0x76, 0x67],
    ),
    /not what it says/,
  );
  refused(
    changed((g) => {
      g.images = Array.from({ length: GLB_LIMITS.images + 1 }).fill({
        mimeType: "image/png",
      });
    }),
    /too many images/,
  );
});

test("counts over the limits are refused", () => {
  refused(new Uint8Array(GLB_LIMITS.bytes + 1), /larger than 64 MiB/);
  refused(
    changed((g) => {
      g.materials = Array.from({ length: GLB_LIMITS.materials + 1 }).fill({});
    }),
    /too many materials/,
  );
  refused(
    changed((g) => {
      g.nodes = Array.from({ length: GLB_LIMITS.nodes + 1 }).fill({});
    }),
    /too many nodes/,
  );
  refused(
    changed((g) => {
      g.meshes = Array.from({ length: GLB_LIMITS.meshes + 1 }).fill(
        g.meshes[0],
      );
    }),
    /too many meshes/,
  );
  refused(
    changed((g) => {
      const part = g.meshes[0].primitives[0];
      const perMesh = GLB_LIMITS.primitives / GLB_LIMITS.meshes + 1;
      g.meshes = Array.from({ length: GLB_LIMITS.meshes })
        .fill(0)
        .map(() => ({
          primitives: Array.from({ length: perMesh }).fill(part),
        }));
    }),
    /too many parts/,
  );
});

test("vertex and triangle counts over the limits are refused before the indices are read", () => {
  // Positions only: one more vertex than the limit, all zero.
  const vertices = GLB_LIMITS.vertices + 1;
  const bin = new Uint8Array(vertices * 12);
  const g = triangle() as Record<string, any>;
  g.meshes[0].primitives[0] = { attributes: { POSITION: 0 } };
  g.buffers[0].byteLength = bin.byteLength;
  g.bufferViews = [{ buffer: 0, byteLength: bin.byteLength }];
  g.accessors = [{ ...g.accessors[0], count: vertices }];
  refused(glb(g, bin), /too many vertices/);
  // Indices for one more triangle than the limit, all pointing at the first vertex.
  const indices = (GLB_LIMITS.triangles + 1) * 3;
  const big = new Uint8Array(36 + indices * 4);
  big.set(triangleBin().subarray(0, 36));
  const t = triangle() as Record<string, any>;
  t.buffers[0].byteLength = big.byteLength;
  t.bufferViews[1].byteLength = indices * 4;
  t.accessors[1] = {
    bufferView: 1,
    componentType: 5125,
    count: indices,
    type: "SCALAR",
  };
  refused(glb(t, big), /too many triangles/);
});

test("the extent is measured from the positions, not taken from the file's word", () => {
  const g = triangle() as Record<string, any>;
  g.accessors[0].min = [-1e30, -1e30, -1e30];
  g.accessors[0].max = [1e30, 1e30, 1e30];
  const summary = checkGlb(glb(g));
  assert.deepEqual(
    [summary.min, summary.max],
    [
      [0, 0, 0],
      [1, 2, 0],
    ],
  );
});

test("extensions are refused wherever they are declared, not only in the lists", () => {
  const cases: [string, (g: Record<string, any>) => void][] = [
    [
      "EXT_meshopt_compression",
      (g) => {
        g.bufferViews[0].extensions = { EXT_meshopt_compression: {} };
      },
    ],
    [
      "KHR_texture_basisu",
      (g) => {
        g.textures = [{ extensions: { KHR_texture_basisu: { source: 0 } } }];
      },
    ],
    [
      "EXT_mesh_gpu_instancing",
      (g) => {
        g.nodes[0].extensions = {
          EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 0 } },
        };
      },
    ],
    [
      "KHR_materials_variants",
      (g) => {
        g.materials = [{ extensions: { KHR_materials_variants: {} } }];
      },
    ],
    [
      "KHR_draco_mesh_compression",
      (g) => {
        g.meshes[0].primitives[0].extensions = {
          KHR_draco_mesh_compression: { bufferView: 0, attributes: {} },
        };
      },
    ],
    [
      "whole file",
      (g) => {
        g.extensions = { KHR_materials_unlit: {} };
      },
    ],
  ];
  for (const [name, edit] of cases) refused(changed(edit), new RegExp(name));
  // An allowed one on a material still passes.
  const ok = triangle() as Record<string, any>;
  ok.materials = [{ extensions: { KHR_materials_emissive_strength: {} } }];
  ok.meshes[0].primitives[0].material = 0;
  assert.equal(checkGlb(glb(ok)).materials, 1);
});

test("data that is not stored in the file, or overlaps, is refused", () => {
  refused(
    changed((g) => {
      delete g.accessors[0].bufferView;
    }),
    /not stored in the file/,
  );
  // A huge zero-filled normal list beside a three-vertex triangle.
  refused(
    changed((g) => {
      g.accessors.push({
        componentType: 5126,
        count: 10_000_000,
        type: "MAT4",
      });
      g.meshes[0].primitives[0].attributes.NORMAL = 2;
    }),
    /not stored in the file/,
  );
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].targets = [{ POSITION: 0 }];
    }),
    /morph targets/,
  );
  refused(
    changed((g) => {
      g.meshes[0].weights = [1];
    }),
    /morph targets/,
  );
  refused(
    changed((g) => {
      g.nodes[0].weights = [1];
    }),
    /morph targets/,
  );
  // Elements that overlap each other (a stride shorter than one position).
  refused(
    changed((g) => {
      g.bufferViews[0].byteStride = 4;
    }),
    /overlap/,
  );
  refused(
    changed((g) => {
      g.accessors[1].byteOffset = 1;
      g.bufferViews[1].byteLength = 8;
    }),
    /not aligned/,
  );
  refused(
    changed((g) => {
      g.bufferViews[1].byteStride = 4;
      g.bufferViews[1].byteLength = 8;
      g.accessors[1].count = 1;
    }),
    /indices are malformed/,
  );
});

test("a part's other data must be known, in range and match its vertex count", () => {
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].attributes.JOINTS_0 = 0;
    }),
    /JOINTS_0/,
  );
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].attributes.NORMAL = 99;
    }),
    /points at nothing/,
  );
  refused(
    changed((g) => {
      g.meshes[0].primitives[0].attributes.TEXCOORD_0 = "x";
    }),
    /points at nothing/,
  );
  // A normal list with one entry for a three-vertex part.
  refused(
    changed((g) => {
      g.accessors.push({
        bufferView: 0,
        componentType: 5126,
        count: 1,
        type: "VEC3",
      });
      g.meshes[0].primitives[0].attributes.NORMAL = 2;
    }),
    /does not match its vertices/,
  );
  // The same stored data named by every attribute slot, counted for each use, past the limit.
  const big = 2_000_000;
  const bin = new Uint8Array(big * 12);
  const shared = triangle() as Record<string, any>;
  shared.buffers[0].byteLength = bin.byteLength;
  shared.bufferViews = [{ buffer: 0, byteLength: bin.byteLength }];
  shared.accessors = [
    { bufferView: 0, componentType: 5126, count: big, type: "VEC3" },
    { bufferView: 0, componentType: 5126, count: big, type: "VEC2" },
  ];
  const slots = [0, 1, 2, 3, 4, 5, 6, 7];
  shared.meshes = [
    {
      primitives: [
        {
          attributes: {
            POSITION: 0,
            NORMAL: 0,
            ...Object.fromEntries(slots.map((i) => [`TEXCOORD_${i}`, 1])),
            ...Object.fromEntries(slots.map((i) => [`COLOR_${i}`, 0])),
          },
        },
      ],
    },
  ];
  refused(glb(shared, bin), /more data than is taken/);
});

test("references between parts must point at something", () => {
  const cases: [RegExp, (g: Record<string, any>) => void][] = [
    [/node's mesh/, (g) => (g.nodes[0].mesh = 50)],
    [/child points at nothing/, (g) => (g.nodes[0].children = [9])],
    [/more than one parent/, (g) => (g.nodes[0].children = [0])],
    [
      /more than one parent/,
      (g) => {
        g.nodes.push({}, { children: [1] });
        g.nodes[0].children = [1];
      },
    ],
    [
      /in a loop/,
      (g) => {
        g.nodes = [{ children: [1] }, { children: [0], mesh: 0 }];
        g.scenes = [{ nodes: [] }];
      },
    ],
    [
      /nested too deeply/,
      (g) => {
        const length = GLB_LIMITS.nodeDepth + 2;
        g.nodes = Array.from({ length }, (_, i) =>
          i + 1 < length ? { children: [i + 1] } : { mesh: 0 },
        );
      },
    ],
    [/not a root/, (g) => (g.scenes[0].nodes = [77])],
    [
      /not a root/,
      (g) => {
        g.nodes = [{ children: [1] }, { mesh: 0 }];
        g.scenes[0].nodes = [1];
      },
    ],
    [/default scene/, (g) => (g.scene = 4)],
    [/material/, (g) => (g.meshes[0].primitives[0].material = 33)],
    [/texture's image/, (g) => (g.textures = [{ source: 99 }])],
    [
      /material's texture/,
      (g) => {
        g.materials = [
          { pbrMetallicRoughness: { baseColorTexture: { index: 7 } } },
        ];
      },
    ],
    [
      /material's texture/,
      (g) => (g.materials = [{ normalTexture: { index: 0 } }]),
    ],
  ];
  for (const [pattern, edit] of cases) refused(changed(edit), pattern);
});

test("type names that are not glTF's are refused, even ones every object has", () => {
  for (const [componentType, type] of [
    ["constructor", "toString"],
    ["__proto__", "__proto__"],
    ["5126", "VEC3"],
    [5126, "hasOwnProperty"],
  ])
    refused(
      changed((g) => {
        g.accessors.push({
          bufferView: 0,
          componentType,
          type,
          count: 10_000_000,
          byteOffset: 999_999,
        });
      }),
      /unknown data type/,
    );
});

test("a byte-order mark, a short image and the wrong argument type are refused", () => {
  // The description starts with the UTF-8 byte-order mark; the JSON is otherwise unchanged.
  const g = triangle();
  const raw = glb(g);
  const json = new TextEncoder().encode(JSON.stringify(g));
  const jsonLength = Math.ceil((json.byteLength + 3) / 4) * 4;
  const binStart = 20 + new DataView(raw.buffer).getUint32(12, true);
  const binChunk = raw.subarray(binStart);
  const out = new Uint8Array(20 + jsonLength + binChunk.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.byteLength, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set([0xef, 0xbb, 0xbf], 20);
  out.set(json, 23);
  out.set(binChunk, 20 + jsonLength);
  refused(out, /not valid JSON/);
  // The same file without the mark passes.
  out.fill(0x20, 20, 23);
  assert.equal(checkGlb(out).triangles, 1);

  const short = triangle() as Record<string, any>;
  short.bufferViews.push({ buffer: 0, byteOffset: 40, byteLength: 2 });
  short.images = [{ bufferView: 2, mimeType: "image/png" }];
  refused(glb(short), /not what it says/);
  refused(new ArrayBuffer(64) as unknown as Uint8Array, /not a \.glb/);
});

test("a texture slot is checked wherever it appears, so a valid copy cannot hide another", () => {
  const withTexture = (material: Record<string, unknown>) => {
    const bin = new Uint8Array(48);
    bin.set(triangleBin());
    bin.set([0x89, 0x50, 0x4e, 0x47], 44);
    const g = triangle() as Record<string, any>;
    g.buffers[0].byteLength = 48;
    g.bufferViews.push({ buffer: 0, byteOffset: 44, byteLength: 4 });
    g.images = [{ bufferView: 2, mimeType: "image/png" }];
    g.textures = [{ source: 0 }];
    g.materials = [material];
    return glb(g, bin);
  };
  assert.equal(
    checkGlb(
      withTexture({ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }),
    ).images,
    1,
  );
  refused(
    withTexture({
      baseColorTexture: { index: 0 },
      pbrMetallicRoughness: { baseColorTexture: { index: 99 } },
    }),
    /material's texture/,
  );
  refused(
    withTexture({
      pbrMetallicRoughness: { metallicRoughnessTexture: { index: 0 } },
      metallicRoughnessTexture: { index: 99 },
    }),
    /material's texture/,
  );
});

test("a mesh with no parts is refused", () => {
  refused(
    changed((g) => {
      g.meshes = [{ primitives: [] }];
    }),
    /no parts/,
  );
});

test("vertex data must have the type glTF gives it", () => {
  const extra = (name: string, type: string, componentType: number) =>
    changed((g) => {
      g.accessors.push({ bufferView: 0, componentType, count: 3, type });
      g.meshes[0].primitives[0].attributes[name] = 2;
    });
  refused(extra("NORMAL", "MAT2", 5121), /NORMAL data has the wrong type/);
  refused(extra("TANGENT", "VEC3", 5126), /TANGENT data has the wrong type/);
  refused(extra("TEXCOORD_0", "VEC3", 5126), /TEXCOORD_0 data has/);
  refused(extra("COLOR_0", "VEC2", 5126), /COLOR_0 data has/);
  // The positions themselves serve as a valid normal list.
  assert.equal(
    checkGlb(
      changed((g) => {
        g.meshes[0].primitives[0].attributes.NORMAL = 0;
      }),
    ).vertices,
    3,
  );
});

test("node placement must be well formed and bounded; scene roots are listed once", () => {
  const cases: [RegExp, (g: Record<string, any>) => void][] = [
    [/matrix/, (g) => (g.nodes[0].matrix = [1, 0])],
    [/scale/, (g) => (g.nodes[0].scale = [1e308, 1, 1])],
    [/translation/, (g) => (g.nodes[0].translation = [0, 0, "x"])],
    [/rotation/, (g) => (g.nodes[0].rotation = [0, 0, 0])],
    [/same node twice/, (g) => (g.scenes[0].nodes = [0, 0])],
  ];
  for (const [pattern, edit] of cases) refused(changed(edit), pattern);
  const placed = triangle() as Record<string, any>;
  placed.nodes[0].translation = [1, 2, 3];
  placed.nodes[0].rotation = [0, 0, 0, 1];
  placed.nodes[0].scale = [2, 2, 2];
  assert.equal(checkGlb(glb(placed)).meshes, 1);
});

test("placement must be meaningful: unit rotations, one way of placing, bounded enlargement", () => {
  const cases: [RegExp, (g: Record<string, any>) => void][] = [
    [/not a unit/, (g) => (g.nodes[0].rotation = [0, 0, 0, 0])],
    [
      /both a matrix/,
      (g) => {
        g.nodes[0].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        g.nodes[0].translation = [1, 0, 0];
      },
    ],
    [
      /enlarge it out of range/,
      (g) => {
        g.nodes = Array.from({ length: 4 }, (_, i) =>
          i < 3 ? { children: [i + 1], scale: [1e4, 1, 1] } : { mesh: 0 },
        );
      },
    ],
    [
      /enlarge it out of range/,
      (g) => {
        g.nodes = [
          {
            children: [1],
            matrix: [1e8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          },
          { mesh: 0, scale: [100, 1, 1] },
        ];
      },
    ],
  ];
  for (const [pattern, edit] of cases) refused(changed(edit), pattern);
});

test("whole-number texture coordinates and colours must be marked normalized", () => {
  const extra = (name: string, type: string, normalized?: boolean) =>
    changed((g) => {
      g.accessors.push({
        bufferView: 0,
        componentType: 5121,
        count: 3,
        type,
        ...(normalized === undefined ? {} : { normalized }),
      });
      g.meshes[0].primitives[0].attributes[name] = 2;
    });
  refused(extra("COLOR_0", "VEC4"), /not normalized/);
  refused(extra("TEXCOORD_0", "VEC2", false), /not normalized/);
  assert.equal(checkGlb(extra("COLOR_0", "VEC4", true)).vertices, 3);
});
