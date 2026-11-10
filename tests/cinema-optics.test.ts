import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMA_LENS_PRESETS_MM,
  assertCinemaCameraOptics,
  cinemaVerticalFovDegrees,
} from "../src/cinema/cinemaCameraOptics.ts";

const source = { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 };

test("Cinema camera lens presets are bounded and physically ordered", () => {
  assert.deepEqual(CINEMA_LENS_PRESETS_MM, [24, 35, 50, 85]);
  const fovs = CINEMA_LENS_PRESETS_MM.map((focalLengthMm) =>
    cinemaVerticalFovDegrees({ ...source, focalLengthMm }, 16 / 9),
  );
  for (let i = 1; i < fovs.length; i++) assert.ok(fovs[i - 1] > fovs[i]);
  const expected = (2 * Math.atan(36 / (16 / 9) / (2 * 35)) * 180) / Math.PI;
  assert.ok(
    Math.abs(cinemaVerticalFovDegrees(source, 16 / 9) - expected) < 1e-12,
  );
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
