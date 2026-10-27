// Pure constants: imported by browser code (core/project.ts), so no Node APIs.
const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

// Server-owned resource policy (operational contracts, "Versioned qualification
// policy"). `enforced` values are what this build applies today; `candidate`
// values are proposed targets not yet advertised. `qualification` is frozen:
// an agent decision of 2026-10-13 under the founder's continuation directive
// (docs/AGENT_DECISION_RECORD.md), not a founder approval; it is measured by
// scripts/qualify-resources.ts and scripts/qualify-large-import.mjs, and a
// breach fails qualification. A change needs a new policy version. A project
// or client can never raise a limit.
export const RESOURCE_POLICY = Object.freeze({
  policy: "yamakan.resource-policy/v3",
  enforced: Object.freeze({
    requestBytes: 2 * MiB,
    snapshotBytes: 2 * MiB,
    // Streamed: memory use does not grow with this limit.
    assetImportBytes: 4 * GiB,
    // Free space kept after staging plus publication of an import.
    diskReserveBytes: 256 * MiB,
    // Uploads in flight at once, and the slowest sustained upload accepted.
    concurrentImports: 2,
    minUploadBytesPerSecond: 1 * MiB,
    assetsPerProject: 200,
    timelineFrames: 18000,
    // The render queue is a single serial tail; this documents, not configures, it.
    activeRenderWorkers: 1,
    // Active (non-terminal) jobs admitted at once; history never counts.
    activeJobs: 128,
    // Active constant-rate conversions per project, so exports are not starved.
    activeConversionsPerProject: 4,
    renderWallSeconds: 180,
    // v3 (YU-026c): an export's wall-clock limit grows with its length,
    // renderWallSeconds plus this per started output minute, to at most
    // exportWallMaxSeconds (the conversion limit), so one export never
    // holds the single render slot longer.
    exportWallPerMinuteSeconds: 30,
    exportWallMaxSeconds: 900,
    // v3: an export is rendered in time segments when a single pass would
    // composite more than this many clip chains (each holds decoded frames
    // for the whole pass); each segment renders only the clips it shows.
    exportSegmentChains: 32,
    // Reference preview (T8): cached frames and segments per project, and
    // the longest segment one request may render (5 s at 30 fps, about
    // 6.3 s at 24000/1001; still bounded by the wall-clock limit).
    previewCacheBytes: 256 * MiB,
    previewSegmentFrames: 150,
    // Preview requests waiting for the one preview renderer, and each
    // preview render's wall-clock limit.
    previewQueueDepth: 6,
    previewWallSeconds: 30,
    // A constant-rate conversion of a source up to ten minutes long.
    conversionWallSeconds: 900,
    renderMemoryBytes: 2 * GiB,
    renderThreads: 2,
    mediaDimension: 4096,
    probeStreams: 10,
    probeWallSeconds: 10,
    // Job Object memory ceiling for each media worker.
    workerMemoryBytes: 1 * GiB,
  }),
  qualification: Object.freeze({
    // Peak working set of the service process alone (workers are separate
    // processes) during a streamed HTTP import of at least 2 GiB: the larger
    // of 200 ms samples and Windows' PeakWorkingSet64 at the end. Not
    // enforced at run time; a breach fails qualify-large-import.
    importServicePeakMiB: 300,
    // Peak committed memory of each worker's Job Object, as procd reads it
    // when the worker exits (JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    // PeakJobMemoryUsed). Every worker the qualify-resources corpus starts
    // must report a measured peak of at most this share of the Job Object
    // limit it ran under, and that limit must be workerMemoryBytes (probes,
    // capability checks) or renderMemoryBytes (renders, conversions,
    // previews); an unmeasured peak or a run without a limit fails. The
    // corpus: every accepted container; 4096x4096 stills and video; 4K
    // H.264; 4K and 4096x2160 10-bit HEVC; AV1; VP9; ProRes; ten-minute WAV,
    // MP3 and Ogg; a 60 s 1080p VFR conversion; a 720p reference export with
    // an Arabic/Latin title; a 1080p export cutting between six heavy
    // sources (three runs); reference frames and a segment. Every decoder
    // and encoder runs with renderThreads threads, so memory does not grow
    // with the host's cores. At the limit a worker's allocations fail and it
    // exits non-zero (a probe then reports MEDIA_INVALID; a job FAILED); its
    // commit may overshoot by a few MiB (tests/resource-policy.test.ts).
    workerPeakShareOfLimit: 0.875,
    // Worst case at once: the service, one job worker (render or conversion,
    // serial), one preview renderer, `concurrentImports` probes and one
    // engine check, each at its Job Object limit; it must fit in half of the
    // machine's RAM.
    budget: Object.freeze({ serviceMiB: 300, maxShareOfRam: 0.5 }),
  }),
  candidate: Object.freeze({
    queuedJobs: 128,
    assetImportBytes: 4 * GiB,
    durationSeconds: 7200,
    streams: 16,
    videoWidth: 3840,
    videoHeight: 2160,
    stillMegapixels: 100,
    probeWallSeconds: 30,
    workerMemoryBytes: 1 * GiB,
    diagnosticOutputBytes: 1 * MiB,
  }),
});

// YU-026: the named editor scale profiles. S is a typical project and M the
// enforced maximum (200 clips, 16 tracks, ten minutes at 30 fps, 1080p
// output); each is measured by scripts/qualify-editor-scale.mjs, whose
// results are kept in docs/evidence/ultimate/editor-scale.json. L, H, A
// and K are one past a limit each and must be refused, never clamped. A
// limit is raised only by a new, reviewed policy version after measuring.
export const SCALE_PROFILES = Object.freeze({
  version: "yamakan.scale-profiles/v1",
  supported: Object.freeze({
    S: Object.freeze({
      clips: 24,
      tracks: 4,
      timelineFrames: 3600,
      width: 1280,
      height: 720,
    }),
    M: Object.freeze({
      clips: 200,
      tracks: 16,
      timelineFrames: 18000,
      width: 1920,
      height: 1080,
    }),
    // A full-length single-track timeline: measures export time against
    // the render wall-clock limit (half M's clips, one video track).
    T: Object.freeze({
      clips: 100,
      tracks: 2,
      timelineFrames: 18000,
      width: 1920,
      height: 1080,
    }),
  }),
  refused: Object.freeze({
    L: Object.freeze({ clips: 201 }),
    H: Object.freeze({ tracks: 17 }),
    A: Object.freeze({ timelineFrames: 18001 }),
    K: Object.freeze({ width: 3840, height: 2160 }),
  }),
});

/** The wall-clock limit of an export of this many ticks (policy v3). */
export function exportWallSeconds(durationTicks: number) {
  const p = RESOURCE_POLICY.enforced;
  // 705,600,000 ticks a second (core/time.ts; this file imports nothing).
  const minutes = Math.ceil(durationTicks / (705_600_000 * 60));
  return Math.min(
    p.exportWallMaxSeconds,
    p.renderWallSeconds + p.exportWallPerMinuteSeconds * minutes,
  );
}
