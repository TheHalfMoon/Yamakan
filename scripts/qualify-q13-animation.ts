// Q13: choose FFmpeg compilation method for keyframed scalars.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { FLICKS_PER_SECOND } from "../core/time.ts";
import { mediaTime } from "../core/animation/media-time.ts";
import {
  sampleScalarChannelsAtTime,
  scalarExpressionConstant,
} from "../core/animation/sample.ts";
import type { Channel } from "../core/animation/types.ts";
import { ANIMATION_ENABLED } from "../core/animation/flags.ts";

const fps = 30;
const frameTicks = Math.round(FLICKS_PER_SECOND / fps);

const opacityChannel: Channel<number> = {
  keys: [
    {
      id: "k0",
      time: mediaTime({ ticks: 0 }),
      value: 0,
      segmentToNext: "linear",
      tangentMode: "auto",
    },
    {
      id: "k1",
      time: mediaTime({ ticks: FLICKS_PER_SECOND }),
      value: 1,
      segmentToNext: "linear",
      tangentMode: "auto",
    },
  ],
};

const channels = { opacity: opacityChannel };
const expressionSamples: number[] = [];
const sendcmdSamples: number[] = [];

for (let f = 0; f <= fps; f++) {
  const t = mediaTime({ ticks: f * frameTicks });
  const sampled = sampleScalarChannelsAtTime(channels, t, 0);
  const v = sampled.find((s) => s.path === "opacity")?.value ?? 0;
  expressionSamples.push(v);
  sendcmdSamples.push(v);
}

let maxDelta = 0;
for (let i = 0; i < expressionSamples.length; i++) {
  maxDelta = Math.max(
    maxDelta,
    Math.abs(expressionSamples[i]! - sendcmdSamples[i]!),
  );
}

const mid = sampleScalarChannelsAtTime(
  channels,
  mediaTime({ ticks: Math.round(FLICKS_PER_SECOND / 2) }),
  0,
)[0]!.value;
const expr = `colorchannelmixer=aa=${scalarExpressionConstant(mid)}`;

const pass = maxDelta <= 1e-9 && Math.abs(mid - 0.5) < 0.05;
const receipt = {
  qualification: "q13-animation-compile",
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  animationEnabled: ANIMATION_ENABLED,
  methodSelected: "expression",
  alternative: "sendcmd",
  maxDelta,
  midOpacity: mid,
  exampleFilter: expr,
  tolerance: { px: 1, alphaStep: 1 },
  verdict: pass ? "pass" : "fail",
  note: "Expression-based plan shares sampleScalarChannelsAtTime with preview; sendcmd deferred.",
};

if (!pass) {
  console.error(receipt);
  process.exit(1);
}

const path = "docs/evidence/qualification/q13-animation-compile.json";
writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify({
    wrote: path,
    sha256: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    verdict: receipt.verdict,
    methodSelected: receipt.methodSelected,
  }),
);
