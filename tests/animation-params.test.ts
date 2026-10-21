import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  coerceParamValue,
  getParamDefaultInterpolation,
  getParamNumericRange,
  getParamValueKind,
} from "../core/timeline/properties.ts";

describe("animated params", () => {
  test("snaps and clamps number params", () => {
    assert.equal(
      coerceParamValue({
        param: {
          key: "intensity",
          label: "Intensity",
          type: "number",
          default: 0,
          min: 0,
          max: 1,
          step: 0.25,
        },
        value: 0.62,
      }),
      0.5,
    );

    assert.equal(
      coerceParamValue({
        param: {
          key: "intensity",
          label: "Intensity",
          type: "number",
          default: 0,
          min: 0,
          max: 1,
          step: 0.25,
        },
        value: 1.2,
      }),
      1,
    );
  });

  test("rejects NaN and non-number values for number params", () => {
    const param = {
      key: "intensity",
      label: "Intensity",
      type: "number" as const,
      default: 0,
      min: 0,
      max: 1,
      step: 0.25,
    };
    assert.equal(coerceParamValue({ param, value: Number.NaN }), null);
    assert.equal(coerceParamValue({ param, value: "0.5" }), null);
    assert.equal(coerceParamValue({ param, value: true }), null);
  });

  test("passthrough with step <= 0 guard", () => {
    assert.equal(
      coerceParamValue({
        param: {
          key: "x",
          label: "X",
          type: "number",
          default: 0,
          min: 0,
          step: 0,
        },
        value: 0.123,
      }),
      0.123,
    );
  });

  test("accepts valid select values", () => {
    const param = {
      key: "blend",
      label: "Blend",
      type: "select" as const,
      default: "normal",
      options: [
        { value: "normal", label: "Normal" },
        { value: "multiply", label: "Multiply" },
      ],
    };
    assert.equal(coerceParamValue({ param, value: "normal" }), "normal");
    assert.equal(coerceParamValue({ param, value: "multiply" }), "multiply");
  });

  test("rejects select values outside the allowed options", () => {
    assert.equal(
      coerceParamValue({
        param: {
          key: "blend",
          label: "Blend",
          type: "select",
          default: "normal",
          options: [
            { value: "normal", label: "Normal" },
            { value: "multiply", label: "Multiply" },
          ],
        },
        value: "screen",
      }),
      null,
    );
  });

  test("rejects non-string select values", () => {
    const param = {
      key: "blend",
      label: "Blend",
      type: "select" as const,
      default: "normal",
      options: [{ value: "normal", label: "Normal" }],
    };
    assert.equal(coerceParamValue({ param, value: 42 }), null);
    assert.equal(coerceParamValue({ param, value: null }), null);
    assert.equal(coerceParamValue({ param, value: undefined }), null);
  });

  test("boolean params accept booleans and reject other types", () => {
    const param = {
      key: "visible",
      label: "Visible",
      type: "boolean" as const,
      default: true,
    };
    assert.equal(coerceParamValue({ param, value: true }), true);
    assert.equal(coerceParamValue({ param, value: false }), false);
    assert.equal(coerceParamValue({ param, value: 1 }), null);
    assert.equal(coerceParamValue({ param, value: "true" }), null);
  });

  test("color params accept strings and reject other types", () => {
    const param = {
      key: "fill",
      label: "Fill",
      type: "color" as const,
      default: "#ffffff",
    };
    assert.equal(coerceParamValue({ param, value: "#ff0000" }), "#ff0000");
    assert.equal(coerceParamValue({ param, value: 0xff0000 }), null);
    assert.equal(coerceParamValue({ param, value: null }), null);
  });

  test("getAnimationParamValueKind maps param type to binding kind", () => {
    assert.equal(
      getParamValueKind({
        param: {
          key: "n",
          label: "N",
          type: "number",
          default: 0,
          min: 0,
          step: 1,
        },
      }),
      "number",
    );
    assert.equal(
      getParamValueKind({
        param: { key: "c", label: "C", type: "color", default: "#fff" },
      }),
      "color",
    );
    assert.equal(
      getParamValueKind({
        param: { key: "b", label: "B", type: "boolean", default: false },
      }),
      "discrete",
    );
    assert.equal(
      getParamValueKind({
        param: {
          key: "s",
          label: "S",
          type: "select",
          default: "a",
          options: [{ value: "a", label: "A" }],
        },
      }),
      "discrete",
    );
  });

  test("getAnimationParamDefaultInterpolation is linear for continuous, hold for discrete", () => {
    assert.equal(
      getParamDefaultInterpolation({
        param: {
          key: "n",
          label: "N",
          type: "number",
          default: 0,
          min: 0,
          step: 1,
        },
      }),
      "linear",
    );
    assert.equal(
      getParamDefaultInterpolation({
        param: { key: "c", label: "C", type: "color", default: "#fff" },
      }),
      "linear",
    );
    assert.equal(
      getParamDefaultInterpolation({
        param: { key: "b", label: "B", type: "boolean", default: false },
      }),
      "hold",
    );
    assert.equal(
      getParamDefaultInterpolation({
        param: {
          key: "s",
          label: "S",
          type: "select",
          default: "a",
          options: [{ value: "a", label: "A" }],
        },
      }),
      "hold",
    );
  });

  test("getAnimationParamNumericRange returns spec for number params, undefined otherwise", () => {
    assert.deepEqual(
      getParamNumericRange({
        param: {
          key: "intensity",
          label: "Intensity",
          type: "number",
          default: 0.5,
          min: 0,
          max: 1,
          step: 0.1,
        },
      }),
      { min: 0, max: 1, step: 0.1 },
    );
    assert.equal(
      getParamNumericRange({
        param: { key: "c", label: "C", type: "color", default: "#fff" },
      }),
      undefined,
    );
    assert.equal(
      getParamNumericRange({
        param: { key: "b", label: "B", type: "boolean", default: false },
      }),
      undefined,
    );
  });
});
