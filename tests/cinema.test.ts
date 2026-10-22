// W14 / M8–M10: camera math, scene3d schema, adapted CameraController.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as THREE from "three";
import { MathUtils, PerspectiveCamera, Scene, Vector3 } from "three";
import { ProjectStore } from "../core/store.ts";
import {
  createFreeCamControlState,
  emptyMoveKeys,
  freeCamFrameTick,
  lerpVelocity,
  lookAtFromCamera,
  moveVectorFromKeys,
  panFromDrag,
  zoomFromWheel,
} from "../src/cinema/camera/cameraMath.ts";
import {
  CameraController,
  createOrbitControlsFallback,
} from "../src/cinema/camera/CameraController.ts";
import {
  CINEMA_ENABLED,
  SCENE3D_FORMAT,
  SCENE3D_FORMAT_VERSION,
  SCENE3D_LIMITS,
  artCraftItemsFromScene3D,
  parseScene3D,
  saveScene3D,
  scene3dContentHash,
  scene3dFromArtCraft,
} from "../core/scene3d.ts";
import { execute, type CommandContext } from "../core/command/registry.ts";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

function sampleScene() {
  return {
    format: SCENE3D_FORMAT,
    formatVersion: SCENE3D_FORMAT_VERSION,
    id: SCENE_ID,
    units: "metres" as const,
    eulerOrder: "XYZ" as const,
    camera: {
      focalLengthMm: 35,
      sensorWidthMm: 36,
      near: 0.1,
      far: 1000,
    },
    items: [
      {
        id: ITEM_ID,
        name: "cube",
        position: { x: 0, y: 1, z: -2 },
        rotation: { x: 0, y: 0.5, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        assetId: ASSET_ID,
      },
    ],
  };
}

test("CINEMA_ENABLED is true after supported Cinema activation", () => {
  assert.equal(CINEMA_ENABLED, true);
});

test("lerpVelocity endpoints are exact", () => {
  const v = new Vector3(0, 0, 0);
  lerpVelocity(v, new Vector3(10, 20, 30), 0);
  assert.deepEqual(v.toArray(), [0, 0, 0]);
  lerpVelocity(v, new Vector3(10, 20, 30), 1);
  assert.deepEqual(v.toArray(), [10, 20, 30]);
  lerpVelocity(v, new Vector3(0, 0, 0), 0.5);
  assert.equal(v.x, MathUtils.lerp(10, 0, 0.5));
});

test("pan and zoom invariants", () => {
  const pan = panFromDrag(100, -50, 2);
  assert.equal(pan.x, -100 * (2 * 0.01));
  assert.equal(pan.y, -50 * (2 * 0.01));
  assert.equal(zoomFromWheel(240), 2);
  assert.equal(zoomFromWheel(-120), -1);
});

test("free-cam math stays finite at the poles", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.rotation.set(Math.PI / 2, 0, 0);
  const state = createFreeCamControlState();
  state.enabled = true;
  state.moveKeys = { ...emptyMoveKeys(), forward: 1, up: 1 };
  state.rotateKeys = {
    pitchUp: 1,
    pitchDown: 0,
    yawLeft: 1,
    yawRight: 0,
    rollLeft: 1,
    rollRight: 0,
  };
  for (let i = 0; i < 120; i++) {
    freeCamFrameTick(camera, state, 1 / 60);
  }
  assert.ok(Number.isFinite(camera.position.x));
  assert.ok(Number.isFinite(camera.position.y));
  assert.ok(Number.isFinite(camera.position.z));
  const look = lookAtFromCamera(camera);
  assert.ok(
    Number.isFinite(look.x) &&
      Number.isFinite(look.y) &&
      Number.isFinite(look.z),
  );
  const move = moveVectorFromKeys(state.moveKeys);
  assert.ok(Number.isFinite(move.length()));
});

test("scene3d round-trips ArtCraft Object3DJSON without media_file_token", () => {
  const art = {
    version: 1,
    sceneItems: [
      {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        object_name: "prop",
        object_uuid: ITEM_ID,
        object_user_data_name: "prop",
        media_file_token: "hosted-token-must-drop",
        color: "#ff00ff",
        metalness: 0.2,
        shininess: 40,
        specular: 0.1,
        locked: false,
        visible: true,
      },
    ],
  };
  const scene = scene3dFromArtCraft(art, {
    id: SCENE_ID,
    assetIdsByObjectUuid: new Map([[ITEM_ID, ASSET_ID]]),
  });
  assert.equal(scene.items[0]!.assetId, ASSET_ID);
  const back = artCraftItemsFromScene3D(scene);
  assert.equal(back[0]!.object_uuid, ITEM_ID);
  assert.equal("media_file_token" in back[0]!, false);
  const again = parseScene3D(scene);
  assert.equal(scene3dContentHash(again), scene3dContentHash(scene));
});

test("hostile scene is refused (NaN, huge counts, unknown asset, depth, bytes)", () => {
  assert.throws(
    () =>
      parseScene3D({
        ...sampleScene(),
        items: [
          {
            ...sampleScene().items[0],
            position: { x: NaN, y: 0, z: 0 },
          },
        ],
      }),
    /Invalid scene3d|finite/i,
  );

  assert.throws(
    () =>
      scene3dFromArtCraft(
        {
          version: 1,
          sceneItems: Array.from(
            { length: SCENE3D_LIMITS.maxItems + 1 },
            (_, i) => ({
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              object_name: `o${i}`,
              object_uuid: ITEM_ID,
              object_user_data_name: `o${i}`,
              color: "#fff",
              metalness: 0,
              shininess: 0,
              specular: 0,
              locked: false,
            }),
          ),
        },
        { id: SCENE_ID },
      ),
    /more than|exceeds/,
  );

  assert.throws(
    () =>
      scene3dFromArtCraft(
        {
          version: 1,
          sceneItems: [
            {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              object_name: "ghost",
              object_uuid: ITEM_ID,
              object_user_data_name: "ghost",
              color: "#fff",
              metalness: 0,
              shininess: 0,
              specular: 0,
              locked: false,
            },
          ],
        },
        {
          id: SCENE_ID,
          assetIdsByObjectUuid: new Map([
            ["44444444-4444-4444-8444-444444444444", ASSET_ID],
          ]),
        },
      ),
    /Unknown asset/,
  );

  let deep: unknown = { leaf: true };
  for (let i = 0; i < SCENE3D_LIMITS.maxDepth + 2; i++) deep = { nested: deep };
  assert.throws(() => parseScene3D(deep), /nesting depth/);

  const oversized = {
    ...sampleScene(),
    items: Array.from({ length: 5_000 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${i.toString(16).padStart(12, "0")}`,
      name: "n".repeat(SCENE3D_LIMITS.maxString),
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      assetId: null,
    })),
  };
  assert.throws(
    () => parseScene3D(oversized),
    /exceeds .* bytes|Invalid scene3d/,
  );

  assert.throws(
    () =>
      saveScene3D({
        ...sampleScene(),
        items: [
          {
            ...sampleScene().items[0],
            media_file_token: "nope",
          } as ReturnType<typeof sampleScene>["items"][number] & {
            media_file_token: string;
          },
        ],
      }),
    /Invalid scene3d|unrecognized|strict/i,
  );
});

test("scripted free-cam sequence updates camera pose via CameraController", () => {
  const updates: Array<{ id: string; z: number }> = [];
  const scene = new Scene();
  const camObj = new THREE.Object3D();
  camObj.name = "::CAM::";
  scene.add(camObj);

  const controller = new CameraController({
    getThreeScene: () => scene,
    getHotItems: () => null,
    removeTransformControls: () => {},
    setSelected: () => {},
    setEditorState: () => {},
    hideObjectPanel: () => {},
    getCameras: () => [{ id: "cam-a", focalLength: 35 }],
    getSelectedCameraId: () => "cam-a",
    onCameraUpdated: (id, pose) => {
      updates.push({ id, z: pose.position.z });
    },
  });
  controller.refreshCamObj(scene);
  controller.camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  controller.camera.position.set(0, 0, 5);
  const free = createFreeCamControlState();
  free.enabled = true;
  free.moveKeys = { ...emptyMoveKeys(), forward: 1 };
  free.smoothing = 1;
  controller.setFreeCamState(free);

  const z0 = controller.camera.position.z;
  for (let i = 0; i < 10; i++) controller.tickPerFrame(1 / 60);
  assert.ok(controller.camera.position.z !== z0);
  assert.ok(updates.length > 0);
  assert.equal(updates[0]!.id, "cam-a");
  assert.equal(typeof createOrbitControlsFallback, "function");
});

test("yamakan.scene.save validates, hashes, and persists when Cinema is on", async () => {
  const saved = saveScene3D(sampleScene());
  assert.equal(saved.cinemaEnabled, true);
  assert.match(saved.contentHash, /^[a-f0-9]{64}$/);

  const root = await mkdtemp(join(tmpdir(), "yamakan-cinema-"));
  const store = new ProjectStore(root);
  await store.initialize();
  try {
    const ctx = {
      store,
      queue: {} as CommandContext["queue"],
      principal: {
        id: "local-client",
        scopes: new Set(["project:write", "project:read"]),
      },
    } satisfies CommandContext;

    const out = await execute(ctx, "yamakan.scene.save", {
      scene: sampleScene(),
    });
    assert.equal(out.operation, "yamakan.scene.save");
    assert.equal(
      (out.result as { contentHash: string }).contentHash,
      saved.contentHash,
    );

    const opened = await execute(ctx, "yamakan.scene.open", {
      sceneId: SCENE_ID,
    });
    assert.equal(
      (opened.result as { contentHash: string }).contentHash,
      saved.contentHash,
    );

    const listed = await execute(ctx, "yamakan.scene.list", {});
    assert.ok(
      (listed.result as { scenes: { id: string }[] }).scenes.some(
        (s) => s.id === SCENE_ID,
      ),
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
