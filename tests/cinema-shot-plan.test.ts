// The Director's Cinema planner: a shot's direction becomes a Cinema scene and Blender settings,
// the same every time, saying what it cannot follow.
import test from "node:test";
import assert from "node:assert/strict";
import { planCinemaShot } from "../core/director/cinema-shot.ts";
import {
  BlenderRenderSettingsSchema,
  blenderSceneFromCinema,
} from "../core/blender/scene.ts";
import { parseScene3D } from "../core/scene3d.ts";
import { DIRECTIONS } from "../core/prompts/directions.ts";

const SHOT = "5f0d3c2a-8b1e-4c7d-9a6f-1e2d3c4b5a60";
const plan = (direction = {}, seconds = 1) =>
  planCinemaShot({ shotId: SHOT, direction, seconds, fps: 30 });
// How far back the render's camera stands: the planner's way of making shot size.
const distance = (p: ReturnType<typeof plan>) => {
  const b = blenderSceneFromCinema(p.scene, p.settings).camera;
  return Math.hypot(
    b.position.x - b.target.x,
    b.position.y - b.target.y,
    b.position.z - b.target.z,
  );
};

test("a planned shot is a valid Cinema scene and valid render settings, the same every time", () => {
  for (const shot of Object.keys(DIRECTIONS.shot))
    for (const lens of Object.keys(DIRECTIONS.lens))
      for (const movement of Object.keys(DIRECTIONS.movement)) {
        const p = plan({ shot, lens, movement });
        parseScene3D(p.scene);
        BlenderRenderSettingsSchema.parse(p.settings);
        assert.deepEqual(plan({ shot, lens, movement }), p);
      }
  const p = plan();
  assert.equal(p.scene.id, "5f0d3c2a-8b1e-4c7d-9a6f-000000000000");
  assert.ok(
    p.scene.items.every((i, n) =>
      i.id.endsWith(String(n + 1).padStart(12, "0")),
    ),
  );
  // Another shot, other ids.
  assert.notEqual(
    planCinemaShot({
      shotId: "11111111-2222-4333-8444-555555555555",
      direction: {},
      seconds: 1,
      fps: 30,
    }).scene.id,
    p.scene.id,
  );
});

test("shot size is made by how much of the set is shown, the lens by the focal length", () => {
  const close = plan({ shot: "close" });
  const medium = plan({ shot: "medium" });
  const wide = plan({ shot: "wide" });
  assert.deepEqual(
    [close, medium, wide].map((p) => p.scene.items.length),
    [1, 2, 5],
  );
  // The render stands further back the wider the shot, so the subject is smaller in it.
  assert.ok(distance(close) < distance(medium));
  assert.ok(distance(medium) < distance(wide));
  assert.deepEqual(
    Object.keys(DIRECTIONS.lens).map(
      (lens) => plan({ lens }).scene.camera.focalLengthMm,
    ),
    [24, 50, 85, 100],
  );
  assert.equal(plan().scene.camera.focalLengthMm, 35);
});

test("movement: still and orbit are followed; what the render cannot make is said, not faked", () => {
  assert.equal(plan({ movement: "still" }).settings.orbitDegrees, 0);
  const orbit = plan({ movement: "orbit", shot: "wide", lens: "tele" });
  assert.equal(orbit.settings.orbitDegrees, 90);
  assert.deepEqual(orbit.followed, [
    "shot:wide",
    "lens:tele",
    "movement:orbit",
  ]);
  assert.deepEqual(orbit.notFollowed, []);
  const rest = plan({ movement: "push", shot: "aerial", light: "golden" });
  assert.equal(rest.settings.orbitDegrees, 0);
  assert.deepEqual(rest.followed, []);
  assert.deepEqual(rest.notFollowed, [
    "shot:aerial",
    "movement:push",
    "light:golden",
  ]);
});

test("length and size are kept within what a render may ask for; bad input is refused", () => {
  assert.equal(plan({}, 1).settings.frames, 30);
  assert.equal(plan({}, 10).settings.frames, 120);
  assert.equal(plan({}, 0.001).settings.frames, 1);
  // Never shorter than the shot: 100 frames at 23.976 fps last 4.1708 s, rendered as 101 at 24.
  const ntsc = planCinemaShot({
    shotId: SHOT,
    direction: {},
    seconds: (100 * 1001) / 24000,
    fps: 24,
  });
  assert.equal(ntsc.settings.frames, 101);
  assert.ok(ntsc.settings.frames / 24 >= (100 * 1001) / 24000);
  assert.throws(() => plan({}, 0), /positive/);
  assert.throws(() => plan({}, Number.NaN), /positive/);
  assert.throws(() => plan({ shot: "extreme" }), /no shot choice extreme/);
  // Only the Create page's own kinds and choices; nothing inherited from Object.
  assert.throws(() => plan({ foo: "x" }), /no foo choice x/);
  assert.throws(() => plan({ shot: "toString" }), /no shot choice toString/);
  assert.throws(() => plan({ toString: "name" }), /no toString choice name/);
  // An id in capitals is the same shot.
  assert.deepEqual(
    planCinemaShot({
      shotId: SHOT.toUpperCase(),
      direction: {},
      seconds: 1,
      fps: 30,
    }),
    plan(),
  );
  assert.throws(
    () =>
      planCinemaShot({
        shotId: "not-a-uuid",
        direction: {},
        seconds: 1,
        fps: 30,
      }),
    /UUID/,
  );
});

// The real render of a planned shot is in tests/blender-render.test.ts, beside the other real
// renders: tests in one file run one after another, and those check that no Blender is left.
