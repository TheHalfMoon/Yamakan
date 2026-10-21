// Adapted from OpenCut Classic (MIT) apps/web/src/retime/audio-stretch.ts
// @ cf5e79e919144200294fb9fed22a222592a0aeea. Yamakan: rational rates via
// rateAsFloat for SoundTouch preview only; export uses FFmpeg atempo.
import { PitchShifter } from "soundtouchjs";
import {
  clampRetimeRate,
  DEFAULT_RETIME_RATE,
  rateAsFloat,
  shouldMaintainPitch,
  type RetimeConfig,
} from "../../../core/donors/opencut/retime/rate.ts";
const RATE_EPSILON = 1e-6;

function sampleLinear({
  channelData,
  position,
}: {
  channelData: Float32Array;
  position: number;
}): number {
  if (position <= 0) {
    return channelData[0] ?? 0;
  }
  const lower = Math.floor(position);
  const upper = Math.min(channelData.length - 1, lower + 1);
  if (lower >= channelData.length) {
    return 0;
  }
  const fraction = position - lower;
  return channelData[lower]! * (1 - fraction) + channelData[upper]! * fraction;
}

function buildResampledBuffer({
  audioContext,
  sourceBuffer,
  trimStart,
  clipDuration,
  targetSampleRate,
  retime,
}: {
  audioContext: BaseAudioContext;
  sourceBuffer: AudioBuffer;
  trimStart: number;
  clipDuration: number;
  targetSampleRate: number;
  retime?: RetimeConfig;
}): AudioBuffer {
  const outputLength = Math.max(1, Math.ceil(clipDuration * targetSampleRate));
  const numChannels = Math.max(1, Math.min(2, sourceBuffer.numberOfChannels));
  const outputBuffer = audioContext.createBuffer(
    numChannels,
    outputLength,
    targetSampleRate,
  );

  for (let channel = 0; channel < numChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(
      Math.min(channel, sourceBuffer.numberOfChannels - 1),
    );
    const outputData = outputBuffer.getChannelData(channel);

    const rate = rateAsFloat(
      clampRetimeRate({ rate: retime?.rate ?? DEFAULT_RETIME_RATE }),
    );
    for (let i = 0; i < outputLength; i++) {
      const clipTime = i / targetSampleRate;
      const sourceTime = trimStart + clipTime * rate;
      outputData[i] = sampleLinear({
        channelData: sourceData,
        position: sourceTime * sourceBuffer.sampleRate,
      });
    }
  }

  return outputBuffer;
}

async function buildPitchPreservedBuffer({
  sourceBuffer,
  trimStart,
  clipDuration,
  rate,
  targetSampleRate,
}: {
  sourceBuffer: AudioBuffer;
  trimStart: number;
  clipDuration: number;
  rate: number;
  targetSampleRate: number;
}): Promise<AudioBuffer> {
  const nativeSampleRate = sourceBuffer.sampleRate;
  const sourceDuration = clipDuration * rate;
  const startSample = Math.max(0, Math.floor(trimStart * nativeSampleRate));
  const numSourceSamples = Math.max(
    1,
    Math.ceil(sourceDuration * nativeSampleRate),
  );
  const available = Math.max(0, sourceBuffer.length - startSample);
  const actualSamples = Math.max(1, Math.min(numSourceSamples, available));
  const numChannels = Math.max(1, Math.min(2, sourceBuffer.numberOfChannels));

  const resampledLength = Math.max(
    1,
    Math.ceil(sourceDuration * targetSampleRate),
  );
  const resampleCtx = new OfflineAudioContext(
    numChannels,
    resampledLength,
    targetSampleRate,
  );
  const nativeBuffer = resampleCtx.createBuffer(
    numChannels,
    actualSamples,
    nativeSampleRate,
  );

  for (let ch = 0; ch < numChannels; ch++) {
    const src = sourceBuffer.getChannelData(
      Math.min(ch, sourceBuffer.numberOfChannels - 1),
    );
    nativeBuffer.copyToChannel(
      src.subarray(startSample, startSample + actualSamples),
      ch,
    );
  }

  const resampleSourceNode = resampleCtx.createBufferSource();
  resampleSourceNode.buffer = nativeBuffer;
  resampleSourceNode.connect(resampleCtx.destination);
  resampleSourceNode.start(0);
  const resampledBuffer = await resampleCtx.startRendering();

  const outputSamples = Math.max(1, Math.ceil(clipDuration * targetSampleRate));
  const stretchCtx = new OfflineAudioContext(
    numChannels,
    outputSamples,
    targetSampleRate,
  );
  const shifter = new PitchShifter(stretchCtx, resampledBuffer, 4096);
  shifter.tempo = rate;
  shifter.pitch = 1;
  shifter.connect(stretchCtx.destination);
  return stretchCtx.startRendering();
}

export async function renderRetimedBuffer({
  audioContext,
  sourceBuffer,
  trimStart,
  clipDuration,
  retime,
  maintainPitch = false,
}: {
  audioContext: BaseAudioContext;
  sourceBuffer: AudioBuffer;
  trimStart: number;
  clipDuration: number;
  retime?: RetimeConfig;
  maintainPitch?: boolean;
}): Promise<AudioBuffer> {
  const targetSampleRate = audioContext.sampleRate;
  const rate = clampRetimeRate({
    rate: retime?.rate ?? DEFAULT_RETIME_RATE,
  });
  const rateFloat = rateAsFloat(rate);
  const usePitchPreservation =
    shouldMaintainPitch({ rate, maintainPitch }) &&
    Math.abs(rateFloat - 1) > RATE_EPSILON;

  if (usePitchPreservation) {
    return buildPitchPreservedBuffer({
      sourceBuffer,
      trimStart,
      clipDuration,
      rate: rateFloat,
      targetSampleRate,
    });
  }

  return buildResampledBuffer({
    audioContext,
    sourceBuffer,
    trimStart,
    clipDuration,
    targetSampleRate,
    retime,
  });
}
