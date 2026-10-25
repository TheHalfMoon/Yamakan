// Waveform peak tiles in the browser (YU-016). Tiles are immutable for an
// asset's content, so they are cached by content hash, level and index and
// reused across every edit and revision: drawing a waveform never fetches
// the original media. The cache is bounded; a request every view has left
// is aborted (a superseded zoom or scroll).

/** Base peaks per second (core/audio/peaks.ts); level L has 100 / 2^L. */
export const PEAKS_PER_SECOND = 100;
export const PEAK_TILE = 2048;
export const MAX_PEAK_LEVEL = 12;

export type PeakSpan = {
  // Peak values 0..255, one per 1 / peaksPerSecond seconds from `from`.
  peaks: Uint8Array;
  peaksPerSecond: number;
};

type Fetcher = (url: string, signal: AbortSignal) => Promise<Response>;
type Entry = {
  promise: Promise<Uint8Array>;
  controller: AbortController;
  waiters: number;
  done: boolean;
};

/** The coarsest level that still gives at least one peak per pixel. */
export function peakLevel(seconds: number, widthPx: number) {
  const wanted = widthPx / Math.max(seconds, 1e-3);
  let level = 0;
  while (
    level < MAX_PEAK_LEVEL &&
    PEAKS_PER_SECOND / 2 ** (level + 1) >= wanted
  )
    level++;
  return level;
}

export function createPeakTiles(fetcher: Fetcher, limit = 256) {
  const cache = new Map<string, Entry>();
  const keep = (key: string, entry: Entry) => {
    cache.delete(key);
    cache.set(key, entry);
    // Least recently used first; tiles still loading are never dropped.
    for (const [k, e] of cache) {
      if (cache.size <= limit) break;
      if (e.done) cache.delete(k);
    }
  };
  const tile = (path: string, hash: string, level: number, index: number) => {
    const key = `${hash}:${level}:${index}`;
    let entry = cache.get(key);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      const made: Entry = {
        controller,
        waiters: 0,
        done: false,
        promise: fetcher(
          `${path}?level=${level}&index=${index}`,
          controller.signal,
        ).then(async (res) => {
          if (!res.ok) throw new Error(`Waveform tile failed (${res.status}).`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.length > PEAK_TILE)
            throw new Error("Waveform tile is too large.");
          made.done = true;
          return bytes;
        }),
      };
      // A failed tile is fetched again next time.
      made.promise.catch(() => {
        if (cache.get(key) === made) cache.delete(key);
      });
      entry = made;
    }
    keep(key, entry);
    return entry;
  };
  return {
    /**
     * Peaks for `from`..`to` seconds of an asset `duration` seconds long,
     * drawn `widthPx` wide. Rejects with an AbortError when `signal` aborts.
     */
    async span(input: {
      path: string;
      hash: string;
      duration: number;
      from: number;
      to: number;
      widthPx: number;
      signal: AbortSignal;
    }): Promise<PeakSpan> {
      const from = Math.max(0, input.from);
      const to = Math.min(input.duration, Math.max(from, input.to));
      const level = peakLevel(to - from, input.widthPx);
      const rate = PEAKS_PER_SECOND / 2 ** level;
      const total = Math.ceil(
        Math.ceil(input.duration * PEAKS_PER_SECOND) / 2 ** level,
      );
      const first = Math.floor(from * rate);
      const last = Math.max(first, Math.min(total, Math.ceil(to * rate)));
      const entries: Entry[] = [];
      for (let i = Math.floor(first / PEAK_TILE); i * PEAK_TILE < last; i++)
        entries.push(tile(input.path, input.hash, level, i));
      for (const e of entries) e.waiters++;
      let left = false;
      const leave = () => {
        if (left) return;
        left = true;
        for (const e of entries)
          if (--e.waiters === 0 && !e.done) e.controller.abort();
      };
      try {
        const tiles = await new Promise<Uint8Array[]>((resolve, reject) => {
          if (input.signal.aborted) {
            leave();
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          input.signal.addEventListener(
            "abort",
            () => {
              leave();
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
          Promise.all(entries.map((e) => e.promise)).then(resolve, reject);
        });
        const peaks = new Uint8Array(last - first);
        const offset = Math.floor(first / PEAK_TILE) * PEAK_TILE;
        tiles.forEach((t, n) => {
          const at = offset + n * PEAK_TILE;
          for (let j = 0; j < t.length; j++) {
            const k = at + j - first;
            if (k >= 0 && k < peaks.length) peaks[k] = t[j]!;
          }
        });
        return { peaks, peaksPerSecond: rate };
      } finally {
        if (!left) {
          left = true;
          for (const e of entries) e.waiters--;
        }
      }
    },
    /** Cached tiles (tests). */
    size: () => cache.size,
  };
}
