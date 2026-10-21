// M14: Mediabunny wrapper. Input is a Blob only (never a URL/HLS source).
// Decoding runs in a Worker that is terminated after 2 seconds.
const WORKER_TIMEOUT_MS = 2000;

export type DemuxPeaks = {
  sampleRate: number;
  peaks: number[];
};

/**
 * Decode waveform peaks from a media Blob via Mediabunny in a Worker.
 * Returns null when the worker times out or the container is unsupported
 * (caller keeps server-derived peaks — Q5 fallback).
 */
export async function openAssetPeaks(
  blob: Blob,
  peakCount = 256,
): Promise<DemuxPeaks | null> {
  if (typeof Worker === "undefined") return null;
  if (!(blob instanceof Blob) || blob.size <= 0) return null;
  // Vite resolves and bundles mediabunny into this module worker.
  const worker = new Worker(new URL("./demux-worker.ts", import.meta.url), {
    type: "module",
  });
  return await new Promise<DemuxPeaks | null>((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve(null);
    }, WORKER_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      worker.terminate();
      const data = event.data as
        { ok: true; sampleRate: number; peaks: number[] } | { ok: false };
      if (data && data.ok === true)
        resolve({ sampleRate: data.sampleRate, peaks: data.peaks });
      else resolve(null);
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(null);
    };
    worker.postMessage({ blob, peakCount });
  });
}
