// Writes the Q12 OTIO fixture used by scripts/otio-oracle.py / CI otio-oracle.
import { writeFileSync } from "node:fs";
import { otioJson } from "../core/interchange/otio.ts";
import { rational } from "../core/time.ts";

const F = 23_520_000;
const video = "11111111-1111-4111-8111-111111111111";
const audio = "22222222-2222-4222-8222-222222222222";
const assetV = "33333333-3333-4333-8333-333333333333";
const assetA = "44444444-4444-4444-8444-444444444444";
const project = {
  format: "yamakan.project",
  formatVersion: 3,
  id: "55555555-5555-4555-8555-555555555555",
  name: "otio-oracle-fixture",
  revision: 1,
  language: "en",
  output: {
    width: 640,
    height: 360,
    fps: rational(30, 1),
  },
  assets: [
    {
      id: assetV,
      name: "pic.mp4",
      kind: "video",
      hash: "c".repeat(64),
      extension: "mp4",
      bytes: 1000,
      durationTicks: 300 * F,
      width: 640,
      height: 360,
      hasAudio: true,
      timebase: null,
    },
    {
      id: assetA,
      name: "tone.wav",
      kind: "audio",
      hash: "d".repeat(64),
      extension: "wav",
      bytes: 500,
      durationTicks: 300 * F,
      width: 0,
      height: 0,
      hasAudio: true,
      timebase: null,
    },
  ],
  scenes: [],
  tracks: [
    {
      id: video,
      name: "Picture",
      kind: "video",
      muted: false,
      locked: false,
      solo: false,
      targeted: false,
    },
    {
      id: audio,
      name: "Sound",
      kind: "audio",
      muted: false,
      locked: false,
      solo: false,
      targeted: false,
    },
  ],
  clips: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      trackId: video,
      assetId: assetV,
      startTicks: 10 * F,
      durationTicks: 60 * F,
      sourceStartTicks: 5 * F,
      title: null,
      gainDb: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      sound: {
        enabled: false,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
      },
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      trackId: audio,
      assetId: assetA,
      startTicks: 0,
      durationTicks: 90 * F,
      sourceStartTicks: 0,
      title: null,
      gainDb: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      sound: null,
    },
  ],
};

const out = "docs/evidence/qualification/otio-fixture.otio";
const json = otioJson(project);
writeFileSync(out, json);
console.log(JSON.stringify({ wrote: out, bytes: Buffer.byteLength(json) }));
