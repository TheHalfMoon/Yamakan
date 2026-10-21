// M14: Mediabunny peaks worker. Loaded only as a module Worker (Vite bundles
// the mediabunny import). Input is a Blob; never a URL/HLS source.
import { Input, ALL_FORMATS, BlobSource, AudioSampleSink } from "mediabunny";

self.onmessage = async (event: MessageEvent) => {
  const { blob, peakCount } = event.data as { blob: Blob; peakCount: number };
  try {
    const input = new Input({
      source: new BlobSource(blob),
      formats: ALL_FORMATS,
    });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      self.postMessage({ ok: false, error: "no-audio" });
      return;
    }
    const metaSec = await audioTrack.getDurationFromMetadata();
    const durationSec =
      metaSec && metaSec > 0
        ? Math.min(metaSec, 60)
        : await audioTrack.computeDuration().then((d) => Math.min(d || 60, 60));
    const sink = new AudioSampleSink(audioTrack);
    const peaks = new Array(peakCount).fill(0);
    let sampleRate = 48000;
    let wrote = 0;
    const totalSamples = Math.max(1, Math.ceil(durationSec * sampleRate));
    for await (const sample of sink.samples()) {
      sampleRate = sample.sampleRate || sampleRate;
      const channels = sample.numberOfChannels;
      const frames = sample.numberOfFrames;
      const denom = Math.max(1, Math.ceil(durationSec * sampleRate));
      for (let c = 0; c < channels; c++) {
        const data = new Float32Array(frames);
        sample.copyTo(data, { planeIndex: c, format: "f32-planar" });
        for (let i = 0; i < data.length; i++) {
          const idx = Math.min(
            peakCount - 1,
            Math.floor(((wrote + i) / denom) * peakCount),
          );
          peaks[idx] = Math.max(peaks[idx], Math.abs(data[i]!));
        }
      }
      wrote += frames;
      sample.close();
      if (wrote > totalSamples) break;
    }
    self.postMessage({ ok: true, sampleRate, peaks });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "demux-failed",
    });
  }
};
