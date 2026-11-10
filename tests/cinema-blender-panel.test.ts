import test from "node:test";
import assert from "node:assert/strict";
import {
  BLENDER_FPS,
  BLENDER_ORBITS,
  BLENDER_QUALITY,
  BLENDER_SECONDS,
  BLENDER_SIZES,
  DEFAULT_BLENDER_CHOICES,
  blenderSettings,
  blenderView,
  type BlenderChoices,
} from "../src/cinema/blenderRender.ts";
import { BlenderRenderSettingsSchema } from "../core/blender/scene.ts";
import { MESSAGES } from "../src/i18n.ts";

test("every choice the Cinema page offers is settings the service accepts", () => {
  for (const size of Object.keys(BLENDER_SIZES) as BlenderChoices["size"][])
    for (const seconds of BLENDER_SECONDS)
      for (const fps of BLENDER_FPS)
        for (const quality of Object.keys(
          BLENDER_QUALITY,
        ) as BlenderChoices["quality"][])
          for (const orbitDegrees of BLENDER_ORBITS) {
            const settings = blenderSettings({
              size,
              seconds,
              fps,
              quality,
              orbitDegrees,
            });
            assert.ok(settings.frames <= 120);
            BlenderRenderSettingsSchema.parse(settings);
          }
});

test("the default render is the small, quick one", () => {
  assert.deepEqual(blenderSettings(DEFAULT_BLENDER_CHOICES), {
    width: 320,
    height: 180,
    fps: 30,
    frames: 30,
    samples: 8,
    orbitDegrees: 90,
  });
});

test("a finished render names the asset it made; anything else is not a video", () => {
  const id = "0b7a1c64-4a39-4e5e-9a3f-2f1f0f7d6c11";
  assert.deepEqual(
    blenderView({ id: "j", state: "COMPLETED", artifact: `asset:${id}` }),
    { kind: "done", assetId: id },
  );
  for (const artifact of [null, "", "asset:../x", `file:${id}`, `asset:${id}x`])
    assert.equal(
      blenderView({ id: "j", state: "COMPLETED", artifact }).kind,
      "failed",
    );
});

test("a running render shows its progress, never 100% before it is done", () => {
  assert.deepEqual(blenderView({ id: "j", state: "QUEUED" }), {
    kind: "working",
    percent: 0,
  });
  assert.deepEqual(blenderView({ id: "j", state: "RUNNING", progress: 0.42 }), {
    kind: "working",
    percent: 42,
  });
  assert.equal(
    (blenderView({ id: "j", state: "RUNNING", progress: 1 }) as any).percent,
    99,
  );
});

test("a failed or cancelled render says so", () => {
  assert.deepEqual(
    blenderView({ id: "j", state: "FAILED", error: "Blender stopped." }),
    { kind: "failed", message: "Blender stopped." },
  );
  assert.equal(blenderView({ id: "j", state: "FAILED" }).kind, "failed");
  assert.deepEqual(blenderView({ id: "j", state: "CANCELLED" }), {
    kind: "cancelled",
  });
});

test("the panel's words are in English and Arabic", () => {
  const { en, ar } = MESSAGES;
  const keys = Object.keys(en).filter((k) => k.startsWith("blender."));
  assert.ok(keys.length >= 20);
  for (const k of keys) assert.ok(ar[k as keyof typeof ar], k);
  assert.match(en["blender.done"], /Rendered with Blender/);
});
