import React, { useEffect, useState } from "react";
import { mediaUrl } from "../../session.ts";
import { createPeakTiles } from "../../media/peak-tiles.ts";
import type { PeakSpan } from "../../media/peak-tiles.ts";

// Server peak tiles (YU-016), shared by every clip and kept across edits:
// a waveform never fetches the original media.
const tiles = createPeakTiles((url, signal) =>
  fetch(mediaUrl(url), { signal }),
);

interface WaveformProps {
  // The asset's peak tile route and content hash.
  path: string;
  hash: string;
  // Asset duration, and the source seconds the clip shows.
  duration: number;
  from: number;
  to: number;
  width: number;
  height: number;
}

const Waveform: React.FC<WaveformProps> = ({
  path,
  hash,
  duration,
  from,
  to,
  width,
  height,
}) => {
  const [span, setSpan] = useState<PeakSpan | null>(null);
  // Peaks at most one per pixel; a new zoom or trim aborts the old request.
  const px = Math.max(1, Math.round(width));
  useEffect(() => {
    if (!(duration > 0) || !(to > from)) {
      setSpan(null);
      return;
    }
    const controller = new AbortController();
    tiles
      .span({
        path,
        hash,
        duration,
        from,
        to,
        widthPx: px,
        signal: controller.signal,
      })
      .then(setSpan, () => {
        // Aborted or unavailable: keep the empty clip.
      });
    return () => controller.abort();
  }, [path, hash, duration, from, to, px]);
  if (!span || span.peaks.length === 0) return null;
  const n = span.peaks.length;
  const d = Array.from(span.peaks, (value, index) => {
    const x = n === 1 ? 0 : (index / (n - 1)) * width;
    const y = (1 - value / 255) * (height / 2);
    return `M${x.toFixed(2)},${y.toFixed(2)} L${x.toFixed(2)},${(height - y).toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="absolute inset-0">
      <path d={d} stroke="rgba(167, 139, 250, 0.6)" strokeWidth="1" />
    </svg>
  );
};

export default Waveform;
