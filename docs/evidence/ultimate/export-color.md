# Why exports came out darker

Measured 2026-11-06 on real AI video and test patterns, with Yamakan's vendored FFmpeg 7.1.1, except the first three rows below, which used a system FFmpeg 8.1.1 and differ by at most 0.03 on the vendored one. All figures are mean differences from the source, out of 255, per red, green and blue.

## The cause

**FFmpeg's scaler, at its default flags, when converting from one colour matrix or range to another.** It is not the encoder, the tags, the range, or the upscale.

Each step alone, on a real Wan frame read back with the proper matrix:

| Step                                                               | Difference              |
| ------------------------------------------------------------------ | ----------------------- |
| Encoding only, x264 veryfast CRF 20                                | 0.04, -0.03, 0.01       |
| BT.601 to BT.709, default flags, 4:2:0, lossless                   | **-2.58, -1.66, -2.30** |
| The same with `accurate_rnd` and `full_chroma_int`                 | -0.02, 0.01, -0.21      |
| BT.601 to BT.709, up to 1056x720, default flags                    | **-1.13, -1.51, -0.97** |
| The same with both flags                                           | -0.01, 0.03, -0.25      |
| The same with `accurate_rnd` alone                                 | 0.17, -1.49, -0.03      |
| The same with `full_chroma_int` alone                              | -1.13, -1.51, -0.97     |
| Source already BT.709 limited range, up to 1056x720, default flags | -0.02, 0.00, -0.08      |
| RGB still to BT.709, default flags                                 | -0.12, -0.02, -0.22     |

Stored luma actually rose, by about 3, as a correct conversion to BT.709 should. The picture read darker only once read with each file's proper matrix. The earlier "darker by about 2" was right, and its cause was not looked at then.

It showed on every kind of picture tried, from real video and gradients to flat colours and test bars, at about 1 to 3. Why the colour chart test never caught it: its tolerance is 5.

## The fix

`core/render.ts` uses both flags **only where a matrix or range conversion happens**, including a LUT's reading. BT.709 limited-range sources and RGB stills showed no such shift, so they keep their speed. The renderer's version rises, so a cached preview of a converted source is drawn again rather than staying darker than its export; that makes each preview draw once more.

The same real 81-frame Wan video through the real pipeline, with and without the fix, measured the way `qualify:ai-video` does:

|               | Before              | After               |
| ------------- | ------------------- | ------------------- |
| Steady offset | -1.46, -2.17, -1.41 | -0.27, -0.60, -0.76 |
| Worst frame   | 1.89                | 0.96                |

**The cost** on 20 seconds of 704x480 up to 1056x720, encoding included, median of three on AC power: 3.34 s to 5.18 s. Only sources that convert pay this. That is about 4 times faster than real time here, not a measure of the frozen render limits, which were not changed.

**What it does not do:** the offset is smaller, not zero. Chroma subsampling and 8-bit rounding remain. Exports of converted sources have different bytes from before.

## The test

`tests/color-pipeline.test.ts`, "a detailed untagged picture keeps its average colour through export", fails without the fix: it fell short by about 1 on a channel. Its first version, on a test pattern, passed without the fix and so proved nothing, which is why it uses a gradient.
