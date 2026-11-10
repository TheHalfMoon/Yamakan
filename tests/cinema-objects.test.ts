import test from "node:test";
import assert from "node:assert/strict";
import { validateDocument } from "../core/documents.ts";
import {
  CINEMA_PAGE_MAX_ITEMS,
  addCinemaBox,
  cinemaItemReadout,
  moveCinemaItem,
  nextCinemaBoxNumber,
  removeCinemaItem,
  scaleCinemaItem,
  turnCinemaItem,
} from "../src/cinema/cinemaObjects.ts";
import { freshCinemaScene } from "../src/cinema/cinemaProject.ts";

const accepted = (scene: unknown) =>
  validateDocument(
    "cinemaScene",
    1,
    new TextEncoder().encode(JSON.stringify(scene)),
  );

test("every edit makes a new scene a project accepts", () => {
  const start = freshCinemaScene();
  const id = start.items[0].id;
  let scene = addCinemaBox(start, (n) => `Box ${n}`);
  assert.notEqual(scene, start);
  assert.equal(start.items.length, 1, "the scene edited is left as it was");
  const added = scene.items[1];
  assert.equal(added.assetId, null);
  assert.equal(added.name, "Box 2");
  scene = moveCinemaItem(scene, id, "x", 0.25);
  scene = turnCinemaItem(scene, id, 15);
  scene = scaleCinemaItem(scene, id, 1.25);
  scene = removeCinemaItem(scene, added.id);
  assert.deepEqual(accepted(scene).assetIds, []);
  assert.deepEqual(cinemaItemReadout(scene.items[0]), {
    x: 0.25,
    y: 0.5,
    z: -2,
    turn: 38, // the sample starts turned 0.4 rad (22.9°), plus 15°
    scale: 1.25,
  });
});

test("moves add up exactly and stay within a kilometre", () => {
  const scene = freshCinemaScene();
  const id = scene.items[0].id;
  let s = scene;
  for (let i = 0; i < 3; i++) s = moveCinemaItem(s, id, "z", -0.1);
  assert.equal(s.items[0].position.z, -2.3);
  s = moveCinemaItem(s, id, "y", 1e9);
  assert.equal(s.items[0].position.y, 1000);
  s = moveCinemaItem(s, id, "x", -1e9);
  assert.equal(s.items[0].position.x, -1000);
  accepted(s);
});

test("a turn stays between -180° and 180°", () => {
  const scene = freshCinemaScene();
  const id = scene.items[0].id;
  let s = scene;
  for (let i = 0; i < 30; i++) s = turnCinemaItem(s, id, 15);
  const y = s.items[0].rotation.y;
  assert.ok(y > -Math.PI && y <= Math.PI, String(y));
  // 0.4 rad + 450° is 0.4 rad + 90°.
  // Each turn is rounded to 6 places, so 30 turns may drift by up to 1.5e-5.
  assert.ok(Math.abs(y - (0.4 + Math.PI / 2)) < 1e-4, String(y));
});

test("a size stays between 0.05 and 100 times, and bad factors are refused", () => {
  const scene = freshCinemaScene();
  const id = scene.items[0].id;
  let s = scene;
  for (let i = 0; i < 40; i++) s = scaleCinemaItem(s, id, 1.25);
  assert.deepEqual(s.items[0].scale, { x: 100, y: 100, z: 100 });
  for (let i = 0; i < 80; i++) s = scaleCinemaItem(s, id, 0.8);
  assert.deepEqual(s.items[0].scale, { x: 0.05, y: 0.05, z: 0.05 });
  for (const bad of [0, -1, Number.NaN, Infinity])
    assert.throws(() => scaleCinemaItem(scene, id, bad));
});

test("the page stops adding boxes at its limit", () => {
  let s = freshCinemaScene();
  while (s.items.length < CINEMA_PAGE_MAX_ITEMS)
    s = addCinemaBox(s, (n) => `Box ${n}`);
  assert.throws(() => addCinemaBox(s, () => "one more"), /most objects/);
  assert.equal(new Set(s.items.map((i) => i.id)).size, s.items.length);
  accepted(s);
});

test("an object not in the scene is refused, not invented", () => {
  const scene = freshCinemaScene();
  assert.throws(() => removeCinemaItem(scene, "missing"), /not in this scene/);
  assert.throws(
    () => moveCinemaItem(scene, "missing", "x", 1),
    /not in this scene/,
  );
});

test("box names don't repeat after a removal", () => {
  let s = addCinemaBox(freshCinemaScene(), (n) => `Box ${n}`); // cube, Box 2
  s = addCinemaBox(s, (n) => `Box ${n}`); // Box 3
  s = removeCinemaItem(s, s.items[1].id); // cube, Box 3
  assert.equal(nextCinemaBoxNumber(s), 4);
  s = addCinemaBox(s, (n) => `صندوق ${n}`);
  assert.deepEqual(
    s.items.map((i) => i.name),
    ["cube", "Box 3", "صندوق 4"],
  );
  const xs = s.items.slice(1).map((i) => i.position.x);
  assert.equal(new Set(xs).size, xs.length, "boxes added in turn don't stack");
});

test("agent-made values are shown as they are and edited within bounds", () => {
  const base = freshCinemaScene();
  const odd = {
    ...base,
    items: [
      {
        ...base.items[0],
        position: { x: 5000, y: 0, z: 0 },
        rotation: { x: 0, y: 10, z: 0 },
        scale: { x: 2, y: 1, z: -3 },
      },
    ],
  };
  const id = odd.items[0].id;
  assert.equal(cinemaItemReadout(odd.items[0]).scale, "2 × 1 × -3");
  const moved = moveCinemaItem(odd, id, "x", 0.25);
  assert.equal(moved.items[0].position.x, 1000);
  const turned = turnCinemaItem(odd, id, 15).items[0].rotation.y;
  assert.ok(turned > -Math.PI && turned <= Math.PI);
  assert.deepEqual(scaleCinemaItem(odd, id, 1.25).items[0].scale, {
    x: 2.5,
    y: 1.25,
    z: 0.05,
  });
  accepted(scaleCinemaItem(moved, id, 1.25));
});
