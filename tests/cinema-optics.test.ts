import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMA_LENS_PRESETS_MM,
  assertCinemaCameraOptics,
  cinemaPreviewSize,
  cinemaVerticalFovDegrees,
} from "../src/cinema/cinemaCameraOptics.ts";

const source = { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 };

test("Cinema camera lens presets are bounded and physically ordered", () => {
  assert.deepEqual(CINEMA_LENS_PRESETS_MM, [24, 35, 50, 85]);
  const fovs = CINEMA_LENS_PRESETS_MM.map((focalLengthMm) =>
    cinemaVerticalFovDegrees({ ...source, focalLengthMm }, 16 / 9),
  );
  for (let i = 1; i < fovs.length; i++) assert.ok(fovs[i - 1] > fovs[i]);
  // Worked by hand: a 36 mm sensor at 16:9 is 20.25 mm tall.
  // 50 mm: 2·atan(20.25/100) = 22.895°; 35 mm: 2·atan(20.25/70) = 32.269°.
  const at = (focalLengthMm: number) =>
    cinemaVerticalFovDegrees({ ...source, focalLengthMm }, 16 / 9);
  assert.ok(Math.abs(at(50) - 22.895) < 0.001, String(at(50)));
  assert.ok(Math.abs(at(35) - 32.269) < 0.001, String(at(35)));
});

test("Cinema camera FOV adapts to portrait aspect ratios", () => {
  assert.ok(
    cinemaVerticalFovDegrees(source, 9 / 16) >
      cinemaVerticalFovDegrees(source, 16 / 9),
  );
});

test("Cinema camera rejects malformed intrinsics rather than corrupting a render", () => {
  for (const bad of [
    null,
    [],
    {},
    { ...source, near: 1000 },
    { ...source, far: 0.01 },
    { ...source, focalLengthMm: Number.NaN },
    { ...source, sensorWidthMm: Infinity },
    { ...source, focalLengthMm: -5 },
    { ...source, near: 0 },
    { ...source, sensorWidthMm: 1001 },
    { ...source, far: 1e10 },
  ]) {
    assert.throws(() => assertCinemaCameraOptics(bad));
  }
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => cinemaVerticalFovDegrees(source, bad));
  }
  assert.deepEqual(assertCinemaCameraOptics(source), source);
});

test("the preview takes the width it has, in a 16:9 frame within 180 to 360 pixels tall", () => {
  assert.deepEqual(cinemaPreviewSize(1280), { width: 1280, height: 360 });
  assert.deepEqual(cinemaPreviewSize(640), { width: 640, height: 360 });
  assert.deepEqual(cinemaPreviewSize(480), { width: 480, height: 270 });
  // A phone: never wider than the room it has, so the page never scrolls sideways.
  assert.deepEqual(cinemaPreviewSize(342.6), { width: 342, height: 192 });
  assert.deepEqual(cinemaPreviewSize(200), { width: 200, height: 180 });
  for (const bad of [0, -5, Number.NaN, Infinity])
    assert.deepEqual(cinemaPreviewSize(bad), { width: 640, height: 360 });
});
