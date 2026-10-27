# Operational contracts for the proposed Yamakan core

This is a contract appendix to [the master plan](IMPLEMENTATION_PLAN.md), not a second roadmap. Proposed on 2026-10-11, based on PR #4 head `73910ba9db870a68c9b08c7c369c4bdd1ff3f420`. No contract below is claimed implemented. [New evidence](review/final-2026-10-11/evidence.json) and Claude's unchanged evidence have separate authority.

## Workspace authority and commit

One workspace SQLite database owns immutable canonical **snapshot bytes**, heads, revision history, command receipts, assets, jobs, attempts, leases and later reservations. Store small metadata snapshots in SQLite instead of requiring a newly published external JSON file for every acknowledged edit. The canonical SHA-256 still identifies an immutable snapshot; portable JSON files are exports or rebuildable caches. Media remains external content-addressed immutable objects. A 2 MiB snapshot target and a configurable validated maximum bound write amplification; measure before replacing full snapshots with deltas.

Minimal logical tables (names may change, relationships may not):

| Table                 | Keys and invariant                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `snapshots`           | `hash` PK, canonical UTF-8 bytes, format/version, byte length; bytes immutable                                                                   |
| `projects`            | `projectId` PK, revision, snapshotHash FK; exactly one authoritative head                                                                        |
| `revisions`           | `(projectId,revision)` PK, snapshotHash FK, parentRevision, commandReceiptId; append-only until an explicit retention policy                     |
| `command_receipts`    | `(principalId,projectId,requestId)` unique, requestDigest, result bytes, committedRevision; request ID reuse with a different digest is an error |
| `asset_objects`       | digest PK, size, managed object key, `ready/gcPending/quarantined`, monotonic publication generation; no client-controlled absolute path         |
| `asset_versions`      | version ID, immutable object digest, probe and derivation refs; referenced objects cannot be GC'd                                                |
| `jobs` / `attempts`   | job ID / `(jobId,attemptNo)`; frozen revision, plan hash, resource policy, lease generation, outcome and output refs                             |
| `leases`              | supervisor owner, monotonically increasing generation, expiry; stale owners cannot publish                                                       |
| `snapshot_asset_refs` | `(snapshotHash,assetVersionId)`; complete validated reference index inserted with each snapshot; retained snapshots are GC roots                 |
| `pins` / `outbox`     | snapshot/asset/render cache retention pins; ordered committed event IDs emitted after commit                                                     |

Commit algorithm:

1. Authorize the principal and validate a bounded request/schema before expensive work. Canonicalize the complete request including operation, parameters, format version and expected revision; hash it. Retry with the same request ID means the same request, including its original expected revision.
2. Enter `BEGIN IMMEDIATE` with bounded `busy_timeout` and bounded busy retries. Check the receipt **before** the revision comparison: same digest returns the recorded result; different digest returns `IDEMPOTENCY_MISMATCH`. A retry after a lost HTTP response must not fail merely because its own prior commit advanced the head.
3. Read and compare `expectedRevision`; apply the pure reducer to the current snapshot and validate all refs and numeric bounds. Insert canonical snapshot bytes, revision and receipt and CAS the head to exactly `expectedRevision+1` in this transaction. Check affected row count. Write outbox event in the same transaction.
4. Commit with WAL and `synchronous=FULL`; only then acknowledge. On failure roll back the entire mutation. Events, autosave badges and UI revision labels advance only from committed receipts. Identical bytes may deduplicate; two different edits never share a receipt.

The command service is the sole sanctioned writer API. Every connection enables `foreign_keys=ON`, WAL, `synchronous=FULL` and a bounded busy policy; schema/constraint migrations are atomic and versioned. Several DB connections/processes may contend safely under SQLite; CLI and MCP normally call the service, rather than installing a competing daemon. A live service lock is OS-owned and released on death; acquire it before reading DB leases. A stale lock file is diagnostic metadata, never a manual-deletion prerequisite. `SQLITE_BUSY` is a retryable busy result, not corruption. An open transaction cannot contain a network request, media decode or subprocess wait.

SQLite protects the database transaction; it cannot make an external-file rename durable. The bounded spike commits snapshot/head/request together and demonstrates rollback after one forced process kill. It does **not** prove physical power-loss behavior. The supported first release uses a local NTFS volume; reject SMB, cloud-synced/live-synced workspace locations and removable filesystems pending qualification. SQLite database, WAL and SHM form one operational unit; copying only the live `.sqlite` file is not a backup.

## Assets, backup and recovery

Stream to a unique staging file on the object volume; hash while writing, enforce byte/dimension/stream/time budgets, flush and close. Under an object-publication lock, use exclusive no-overwrite publication to the digest key, then reopen and verify bytes/length. If the key already exists, verify its contents rather than replacing it. Register `ready` only after this; snapshots may reference only ready versions. Publish failures leave unregistered staged/orphan data, never phantom asset metadata. Media ingestion is independently idempotent; a successful object import followed by a revision conflict can be attached by a new explicit command without re-upload.

On restart verify DB integrity and ready-object existence before writable use. Preserve missing/corrupt objects and records, block affected operations, and show a recovery report. Do not silently rewind an acknowledged head or pretend a missing asset is usable. External object durability after power loss remains a qualification gate; claims are restricted to observed filesystem and hardware conditions. For a stronger future promise, qualify a native Windows publication/flush helper or a transactional blob store, with power-cut evidence and migration costs.

GC roots include all retained revisions through the transactional snapshot reference index, active attempts, user recovery snapshots, backup pins and exports. Under the same per-object publication/GC lock, a transaction verifies no references or pins and CASes `ready→gcPending` with a new generation. Reference creation checks ready state in its own transaction; it cannot attach gcPending data. Only that generation may move the digest file to its unique quarantine key and finalize the object state. Do not hold a DB transaction across filesystem work. A stale GC worker may delete only its own quarantine key, never the canonical digest path or a later generation's publication. Republication/reattachment must reacquire the object lock, verify bytes, return the object to ready with a higher generation and only then commit references. Recovery reconciles gcPending/quarantine records under that lock; it never treats a ready digest as an orphan by filename alone. Test attach/import against GC and crashes before/after each move/CAS. Limits apply to active work and retained bytes, never lifetime job count. Preserve all acknowledged revisions through MVP; disk pressure blocks new work rather than deleting history.

A live backup uses SQLite's online backup API with a **GC exclusion barrier**, acquired before the copy and after all in-flight GC deletion completes. Database edits and ready-object imports may continue. After the destination database snapshot is complete, derive the manifest from that destination's retained snapshots/reference index, ready assets and retained attempt/output roots, rather than the live head. Verify referenced objects exist and persist a durable backup-intent pin set in the source DB before releasing the GC barrier. A timeout aborts safely and leaves no published backup; a crashed intent retains pins until recovery verifies or explicitly abandons it. Copy immutable pinned bytes to a new backup root, verify all hashes/lengths and destination DB integrity, seal a manifest binding DB and objects, and publish the backup only after complete validation. Release pins only after publication or explicit abandonment. Concurrent import/edit/GC tests must restore the exact destination snapshot and every referenced byte; report barrier duration. A closed-DB alternative needs the same manifest/hash contract. Never copy only a running .sqlite file without WAL handling. Physical corruption puts the workspace in diagnostic mode; restore a verified backup to a new root, preserving original DB/WAL/SHM and blobs. A corrupt single job payload is quarantined and other valid jobs can continue; page-level DB corruption cannot be treated as one safely skippable row. Recovery never invents missing edits.

Legacy migration reads original Darzain roots without writes, creates a new workspace, validates snapshots and media hashes, and records a before/after original-root manifest. Unknown project versions allow bounded safe inspection only. JSON recovery exports contain no credentials or host paths. Portable media archives follow later with traversal, case-collision, expansion, symlink/reparse and duplicate protections; process isolation is not a substitute for extraction validation.

## Creative documents

Studio canvases and Cinema scenes are immutable creative documents of the one project (YU-010, activation group AG-DOCS). Canonical format v5 adds a bounded `documents` list (at most 32) of `{id, kind, schemaVersion, contentHash}`; a project without documents is still written as v4 byte for byte, so its hash, history and older readers are unchanged. Workspace schema v8 adds `creative_documents` (canonical bytes named by their SHA-256, with the asset ids they use) and `snapshot_document_refs`; as with every schema step, a workspace this build opens is then refused by earlier builds, and rollback is a verified pre-upgrade backup.

A document is validated before it is stored: raw and canonical bytes each at most 8 MiB, strict UTF-8, JSON depth at most 64 and at most 10,000 nodes (the Studio canvas text inside a document is bounded the same way), no prototype keys, and the kind's own schema (`studio` v1, `cinemaScene` v1). Every revision keeps the assets its documents use (Studio bitmaps must be image assets); a commit that would drop one is refused. Every save path through the editing shape (whole-project save, timeline batches, undo and redo) carries the head's document references forward; restore uses the restored revision's own. Committing a document (`yamakan.document.commit`) is compare-and-swap on the document's current hash and the project revision, replayable by request receipt, and may revert to a version this project already held. Migrated folder history cannot carry documents. `yamakan.document.list` and `yamakan.document.get` read the current revision. Clients write documents since AG-DOCS activation (see below); while an operator turns saving off, every write path refuses and reads continue.

Bounds are applied before a document is built: a linear pre-scan of the text refuses excess nesting and values before `JSON.parse`, then the parsed value is checked exactly. A replayed commit must name the same document, kind, version, expected hash and content as the original, whatever digest the caller supplies. A reference whose stored document is missing or mismatched is workspace damage (`RECOVERY_REQUIRED`; restore an earlier revision). Identical content may back two document ids (content addressing). `yamakan.document.get` returns the whole document, up to the 8 MiB document limit. Content larger than a command is uploaded first: `POST /api/v1/projects/{id}/documents/stage` with `Content-Type: application/json`, `Content-Length` (at most 8 MiB), `X-Request-Id`, `X-Content-SHA256` (of the body), `X-Document-Kind` and `X-Document-Schema-Version`. The route authorizes `yamakan.document.commit` and reserves before reading a byte: at most 2 active uploads and 8 MiB staged per principal, 24 MiB per workspace of which agents together hold at most 8 MiB (so the browser session and the local CLI/SDK can always stage), plus the disk reserve. The whole body must arrive within 10 s plus its length at the slowest accepted upload rate, or the connection is closed and the reservation released; a restart releases uploads that were still being received, and expired ones. The body must match its length and hash and be a valid document; the sealed canonical bytes wait in the workspace database (no host path is ever involved or returned) for 15 minutes, and the response is `{stagedUploadId, contentHash, byteLength, kind, schemaVersion, expiresAt}` (`byteLength` and `contentHash` describe the stored canonical bytes). A retry with the same request id after a lost response returns that receipt without reading the body; a different request under the id is `IDEMPOTENCY_MISMATCH`. A sealed upload is consumed by one commit, inside its transaction, and only by its uploader in its project; unknown, foreign and expired handles are `NOT_FOUND`, a consumed one `VALIDATION`. A refused or interrupted upload keeps nothing. While AG-DOCS is turned off the route and the command refuse with `CAPABILITY_UNAVAILABLE` before any work. Clients: the SDK's `stageDocument` (SHA-256 via WebCrypto, so the browser and Node share it) and `saveDocument` (stage then commit; one request id of at most 121 characters derives both replayable steps; retry within the 15-minute upload lifetime, after which a retry of a save that did commit is reported as `IDEMPOTENCY_MISMATCH` rather than replayed); the CLI's `stage-document <projectId> <kind> <schemaVersion> <file>` reads the file locally and sends only its bytes; MCP adds one tool beyond the catalog, `yamakan_document_save`, which takes the document as `content` within the 2 MiB MCP line and stages it over the authenticated route before committing. Studio bitmaps (YU-011): a layer's pixels are a PNG (at most 64 MiB, within the Studio side and megapixel limits, read from its header before the rest is stored) in the project's content-addressed object store, registered as a ready object (so garbage collection and backups treat it like media) and indexed in `studio_bitmaps` (workspace schema v10). The canvas names each bitmap by its SHA-256, which is the engine's image name; identical bytes are stored once. A persisted canvas may name only such digests: any other image name, a non-empty media URL field (`url`, `src`, `href`, `uri`) or a video reference is refused (free text that looks like a URL, such as a text layer's words, is not), and a document may reference only bitmaps its own project holds. `POST /api/v1/projects/{id}/studio/bitmaps` (`image/png`, `Content-Length`; same authorization, flag and deadline as staging) returns `{digest, byteLength, width, height}`; `GET …/studio/bitmaps/{digest}` serves one of the project's bitmaps. Session intermediates stay in browser memory and can never be saved. A new canvas starts with one empty, selected paint layer, so a first stroke is part of the document. Bounds: at most 2 bitmap uploads in progress per principal, and 2 GiB and 10,000 bitmaps per project (checked before streaming and at registration). Garbage collection frees a bitmap once it is older than the grace period and named by no document of any retained revision and no sealed upload awaiting its commit; re-uploading a bitmap restarts its grace period. Agent tokens are workspace-wide, as for every other route: a `project:write` agent may write any project's bitmaps.

**Legacy Cinema scenes** (YU-012). Before documents existed, `yamakan.scene.save` wrote each scene as a workspace file, `cinema/<sceneId>.json`, with no project and no compare-and-swap.

- **Sidecar writes.** The file is now written whole and then renamed into place, so a crash or two concurrent saves can never leave a torn scene.
- **Inventory.** `yamakan.scene.inventory` examines up to 10,000 such files, reading and validating at most 256 MiB per call. Files past that budget are listed as `unexamined`, and the result is marked `truncated`. It reads only, and never assigns anything to a project. For each file it reports:
  - the name and the SHA-256 of its bytes;
  - whether it is a valid scene, and the canonical document hash it would have;
  - every migration recorded for it.

  A file is reported invalid, with its reason, when:
  - its name is not a UUID file name (older saves kept the id's case, so an upper-case name can be the original);
  - several names differ only in case (possible off Windows); none of them is read;
  - it is a link, a hard link (more than one link), or not a plain file, or it was swapped after it was looked at;
  - it is empty, larger than 8 MiB, or truncated;
  - it is not a valid scene;
  - the scene inside names a different id than its file.

  A folder that is itself a link is refused.

- **Migration.** `yamakan.scene.migrate {projectId, expectedRevision, sceneId, sourceSha256}` commits one file into the named project as its `cinemaScene` document of that id. It is compare-and-swap on the project revision. The caller names the SHA-256 it inventoried, so a file changed since then is a `REVISION_CONFLICT`. In the same transaction it writes a receipt row in `legacy_migrations` (workspace schema v11) recording the source (its scene id, in any case), the source SHA-256 and size, the project, document, content hash and revision. Ownership is never inferred:
  - a scene file is migrated once, into one project, and is refused for any other, even after the file changes;
  - a project document of that id that did not come from this file is never overwritten;
  - a retry, including after a restart, returns the recorded migration without a new revision, whatever has happened to the file or the project's scene since. Later changes belong to the project's document.

  The original file is never written, renamed or deleted. Two concurrent first migrations of different scenes against the same revision: one commits and the other gets `REVISION_CONFLICT`. Calling again then returns a fresh result.

  Undo: like any document commit, a migration ends the project's per-writer editing undo history, so it is not undone by `yamakan.project.undo`. A scene is restored to an earlier version by committing that version again (a revert, `source: {contentHash}`).

  Filesystem errors are reported without host paths. While AG-DOCS is turned off, migration refuses with `CAPABILITY_UNAVAILABLE`; the inventory stays available.

Workspace budgets (AG-DOCS activation): Studio bitmaps at most 8 GiB and distinct stored document bytes at most 4 GiB across all projects; agents write only while the workspace (and, for bitmaps, the project) uses less than half of each (the person can always use the rest); stored document versions are kept by project history and not yet pruned. Agents cannot migrate legacy scenes (`SCOPE_DENIED`). Garbage collection runs at start and hourly. These agent limits apply to agent tokens (`agent:*`); an MCP server started without `YAMAKAN_AGENT_TOKEN` or `YAMAKAN_AGENT_TOKEN_FILE` uses the workspace token and acts as the local client.

Activation: AG-DOCS is on since the group receipt (`docs/evidence/ultimate/receipts/AG-DOCS.json`). Rollback switch: `YAMAKAN_AG_DOCS_OFF=1` in the service's own environment turns document writes (commits, staging, migrations, bitmap uploads) off again without a rebuild; stored documents stay readable and keep their references, the service announces it at startup, `yamakan.document.capability` reports `turnedOff`, and no request can change it.

## Director runs and likeness consent

YU-013 moved this state from mutable JSON files into the workspace database (schema v12). Each change below is one transaction.

- **Runs.** A run belongs to an existing project. It advances by compare-and-swap on its `version`:
  - `yamakan.director.advance` accepts `expectedVersion`;
  - `yamakan.director.approve` requires it, so a human approves the version they reviewed and never a run that moved since;
  - a stale version is a `REVISION_CONFLICT`.

  Every advance and approval appends to the run's attempt log, which is never rewritten. A stage's receipt is its latest attempt.

- **Outputs.** A stage output must be a stored, ready object of the run's project. This is checked when the output is written, and again every time the run is read. An output that has since been lost or quarantined (for example by a restore that could not verify it) leaves its stage `failed`, so the stage must be produced again.
- **Approvals.** An approval binds that output with an expiry and is human-only (agents are refused).
- **Consents.** A likeness consent is immutable. It is revoked once, by an append-only row. An identity encoding's validity is derived from its consent and never stored as a flag: a revoked or expired consent, or one awaiting revalidation, invalidates it. So revoking invalidates the consent's encodings in the same commit. An encoding is recorded only inside the same transaction that confirms a live, current consent, so a concurrent revocation cannot be raced.
- **Replay.** Mutations sent with a request id replay their original result. The same id with a different request is `IDEMPOTENCY_MISMATCH`. A stored result from before a restore is never replayed (`REVISION_CONFLICT`): it described approvals that no longer count.
- **Execution epoch.** The workspace has an execution epoch. Restoring a backup mints a fresh epoch in the restored copy, in the same transaction that quarantines unverified objects. In the copy:
  - approvals given before the restore no longer count, and their stages await a new approval;
  - consents granted before it must be revalidated (`yamakan.consent.revalidate`, human-only) before any new encoding.

  The original workspace is unaffected. Restoring a project revision never touches consent or revocations, which are workspace state.

- **Legacy import.** `yamakan.director.importLegacy` (human-only) imports the pre-database `director/*.json` files once and idempotently. Limits: plain, single-link files of at most 1 MiB each, 64 MiB in total and at most 10,000 files. Originals are kept.
  - Runs are imported only for projects of this workspace; others are reported.
  - Revoked consents arrive revoked.
  - An encoding must match its consent's character.
  - Imported state belongs to no live epoch: its approvals must be given again, and its consents revalidated. Live state is untouched.
- **Not yet covered (YU-013b).** The Director has no workers, provider calls, publications or billing reservations today, so nothing can resume or act on its own after a restore. The job side of restore fencing is follow-up work, together with YU-014, before any such effect is added:
  - a durable `restoreHold` before the job supervisor starts;
  - fencing of copied queued, running or cancel-pending jobs and leases;
  - JobSupervisor references from runs;
  - reconciliation data for external requests.

## Durable jobs and owned processes

One SQLite state machine, shared by export, proxy/transcode and later workflow/model operations:

`queued → preparing → running → validating → succeeded`

`queued → cancelled`; `preparing/running/validating → cancelRequested → cancelled`; any nonterminal attempt may become `failed` or `reconciliationRequired` when its true external/process outcome is unknown. A retry creates a new attempt; it never erases the old outcome. Jobs contain intent; attempts contain execution identity and effects. Terminal states are immutable except append-only diagnostic annotations.

| Transition     | Required atomic predicate and effect                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| claim          | queued, resources available, current supervisor generation; allocate attempt and isolated staging directory                          |
| start          | prepared inputs/argv/environment hashes persisted; retain exact PID + creation time and native job-handle ownership                  |
| validate       | worker exited zero; staging artifact bounded, probed and hashed; no project mutation from worker output                              |
| succeed        | lease generation still current, state is validating, cancel not requested; register artifact and terminal receipt in one transaction |
| request cancel | CAS nonterminal state, persist request; native supervisor terminates tree; terminal cancelled only after process exit confirmed      |
| restart        | new owner fences old owner; reconcile actual process and staging artifact, preserving uncertainty; no automatic paid resubmit        |

Cancellation races with completion are decided by the DB predicate. A cancellation that wins prevents success publication; a completed job returns `ALREADY_TERMINAL`. Do not promise deletion of a valid artifact after success or let a late worker overwrite cancellation. Restart may validate a sealed completed artifact only if provenance and input hashes match the attempt; otherwise quarantine it and fail/reconcile. Cleanup is asynchronous, bounded, retries sharing violations and reports failures; it never follows worker-supplied paths. A cleanup failure is not permission to mark an alive process cancelled.

MVP direct FFmpeg/ffprobe requires a small qualified **native service binding**, independently of any desktop shell. Create a no-breakaway Job Object with KILL_ON_JOB_CLOSE; the service holds its only lifetime handle, and workers cannot inherit/duplicate it. Assign the job **atomically at process creation** using STARTUPINFOEX/PROC_THREAD_ATTRIBUTE_JOB_LIST on the supported Windows build; CREATE_SUSPENDED then AssignProcessToJobObject alone leaves a launcher-death seam before assignment. Resume only after ownership, bounded argv/environment and attempt identity are established. Fail closed if atomic assignment is unavailable. Use absolute pinned executable paths, argv arrays, no shell and an inherited-handle allowlist. An equivalent out-of-process launcher is admissible only after proving service-death, launcher-death and pre-assignment cleanup at every seam; a surviving desktop handle is insufficient. Inject kills before creation, after creation/before resume, during identity persistence and while running; no orphan, including suspended workers, may remain. PID/start-time records aid reconciliation but never replace ownership. Python/model descendants remain disabled until their separate Python→FFmpeg tree, no-breakaway, cancellation, service/host death and reboot gates pass. Job Objects enforce lifetime/resources, not filesystem/network access.

## Canonical render plan

`yamakan.render-plan/v1` is immutable and has `projectId`, revision, snapshotHash, planHash, compilerVersion, asset/probe hashes, output profile, positive rational fps, duration in flicks, ordered layers, source PTS mappings, audio mix instructions, title ASS bytes/hash, font hashes and effect registry versions. No free-form filters, JS, JSX, paths, URLs or shell text. Profile specifies dimensions, sample rate, fit/crop, premultiplied-alpha convention, SDR color conversion, pixel aspect, rotation normalization and encoder/timebase policy. Unsupported HDR/variable speed/effects fail preflight. MVP is SDR 8-bit, square pixels, fixed rational fps, cuts, fit/position/opacity, titles and audio gain/linear fades; crossfades and advanced effects follow only after parity qualification.

Time remains 705,600,000 flicks/s with reduced rational fps and source stream time bases. Use BigInt/rational intermediates with explicit signed rounding; validate safe integers on serialized results. Safe stored ticks do not imply safe `ticks*fpsNumerator` intermediates (already unsafe around 213 seconds at 60000/1001). No floating accumulation. VFR editing uses a provenance-bound CFR derivative; conversion is a durable job, original retained. Source PTS discontinuities, rotation and audio priming need fixture tests, not a blind `-r` assumption.

Both export and **reference preview** call the same plan compiler and FFmpeg filter/ASS path. A bounded frame/short-segment preview cache is keyed by snapshot/plan/assets/fonts/profile/engine hashes, invalidated on revision changes and pinned during playback. Reference preview makes effect/timing/color validation possible without writing a second semantic renderer. Fast interactive Canvas/proxy overlays may provide drag feedback and immediate playback, but only a parity-qualified subset earns a match claim; visibly indicate a stale reference preview and give direct access to the current one. Playback must be useful, and reference-render latency is a blocking spike with an explicit fallback to shorter segments/lower proxy resolution. Browser decode, lossy encoding and scaling still require comparison tests.

**Waveform peak tiles** (YU-016). The timeline draws audio from server peaks and never fetches the original to do it.

- **Decode.** An owned FFmpeg worker reads only the asset's file. It decodes the first audio stream at 48 kHz in the source's own channels. Channels are never mixed, because mixing lowers peaks; more than 8 channels are mixed down to 8. The decode is bounded by the 10-minute asset limit, a 120 s wall time, worker memory and stdout length. Its output is base peaks: the loudest absolute sample on any channel in each 10 ms, quantized up to 0..255.
- **Cache.** Base peaks are cached per project under `cache/peaks`. Entries are keyed by the asset's content hash, the peak format version and the FFmpeg build, and are checked with a SHA-256 checksum. A damaged entry is a miss and is rebuilt. If an entry cannot be written (a full disk, or the disk reserve), the tile is still served but not kept. The cache is bounded at 32 MiB per project and evicts least recently used first. It holds only rebuildable data, so eviction never touches an asset.
- **Memory.** The 16 most recently used base peaks stay in memory, about 60 KB each. A full disk therefore never means a re-decode for every tile.
- **Failures.** An asset whose audio fails to decode is refused for a minute instead of decoding again on every request.
- **Concurrency.** One decode runs at a time. At most 8 requests wait; beyond that a request gets `BUSY`. Concurrent requests for the same asset share one decode, and a decode is stopped once every requester has left.
- **Route.** `GET /api/v1/projects/{id}/assets/{assetId}/peaks?level=L&index=I` authorizes `yamakan.project.open`, like the asset's bytes. The media key also opens it. It returns at most 2048 bytes, one peak per byte. At level L (0..12) each peak covers 2^L base peaks, which is 100/2^L peaks per second. The response carries `X-Peaks-Per-Second`, `X-Peaks-Total` and `X-Peaks-Tile`, and is immutable.
- **Browser.** It caches up to 256 tiles by content hash, level and index, so edits and revisions reuse them. Each tile URL carries the hash. It picks the coarsest level that still gives one peak per pixel, and aborts a superseded zoom or trim. A tile gets 150 s to arrive. A tile past the audio the service decoded draws as silence. If a waveform cannot be loaded, the clip shows a flat dashed placeholder.

Titles use one ASS compiler and libass with automatic base direction (`Encoding:-1` on the qualified build), pinned Arabic/Latin fonts and escaped plain text. Escape ASS override blocks, line separators and filter path quoting; project text never becomes a filtergraph. Preview/export use identical font bytes and font selection. JASSUB is an optional fast text backend after proving compatible libass/HarfBuzz/FriBidi versions, shaping and fallback; sharing the libass name alone is insufficient. Arabic reviewer fixtures cover punctuation, bidi isolates, diacritics, Arabic-Indic digits, lam-alef, mixed lines, line wraps and clipping. UI strings/layout use RTL separately from title shaping.

## Command and agent contract

Envelope: `apiVersion, workspaceGrantRef, principalId (derived from authentication), projectId, operation, requestId, expectedRevision, parameters`. Clients cannot select a more privileged principal. Result: `requestId, revision, snapshotHash, result, eventCursor`; asynchronous result also has `jobId, frozenRevision, planHash`. Errors are structured (`REVISION_CONFLICT`, `IDEMPOTENCY_MISMATCH`, `BUSY`, `VALIDATION`, `SCOPE_DENIED`, `MEDIA_INVALID`, `RECOVERY_REQUIRED`, `CAPABILITY_UNAVAILABLE`) with safe retry policy.

UI, REST, CLI, MCP stdio and a thin TypeScript SDK use the same schema/reducer/authorization function. Read operations do not need expectedRevision; destructive/recovery and paid operations require a grant that names the action. An atomic bounded `project.applyBatch` validates/reduces every operation before one transaction commits; donor `BatchCommand` is not that transaction. Undo is a new revision-bound mutation; it cannot rewind another writer's acknowledged work. Import IDs or deterministic replay mappings let UI/tool E2E compare canonical bytes without deleting substantive fields to manufacture parity.

**The browser editor's changes** (YU-015) go through those same operations.

- **Gestures.** A gesture edits the local 30 fps view, so feedback is immediate and a drag preview never leaves the page. Once the pointer is released and the editor has been still for 400 ms (or Save is pressed), the difference from the service's head is expressed as one `yamakan.project.applyBatch` of typed operations covering tracks, clips, titles, sound, speed, animation, scenes and shots. It is compare-and-swap on that head's revision, so a drag or a slider becomes one revision.
- **Verification.** The batch is verified before it is sent: applied to the head locally, it must reproduce the view exactly.
- **Drafts.** A change the operations cannot express that way (renaming the project, output settings, more than 64 operations) is never committed lossily. It stays a visible unsaved draft, which Save commits as a whole-project save.
- **Undo and Redo.** These take back a change that has not been committed yet locally. Otherwise they use the service's revision-bound history, which undoes only the browser's own steps and never another writer's.
- **Stored bytes.** A plain move or trim is sent as `clip.move` or `clip.trim` with setters, so the stored bytes equal those of the same edit made through the CLI or MCP. Only clips that would overlap on the way (trading places) are taken out and put back whole.
- **Commits.** Commits run one at a time. Editing goes on during a commit: what was edited meanwhile is kept on top of the committed head and committed next. A lost response is asked again under the same request id, and the service answers it with the original result. A change undone by the next one leaves nothing pending.
- **Conflicts.** If another writer moved the project first, the editor fetches the current version. When the change's operations still apply there, they are committed onto it and the user is told. When they don't, the current version is shown and the change is offered for download. The editor never overwrites.
- **Undo scope.** Writer-scoped undo is per principal: every browser tab acts as the browser session, so one tab can undo another's step once its head is current. It never undoes an agent's or the CLI's work.

MCP transport (`mcp/framing.ts`): one JSON-RPC message per line, at most the 2 MiB request cap in UTF-8 bytes; a longer line, complete or not, is never parsed or retained and gets one `-32700` "Message exceeds the request size limit." with id null, and its remainder up to the newline is discarded. At most 16 requests run at once and about 1 MiB of responses wait for the client; beyond either the server stops reading stdin until it catches up, so a flood waits in the client's pipe, requests stay in order and none is refused for being busy. Invalid JSON is `-32700`, a non-request or an id that is not a string, number or null `-32600` (such an id is never echoed), an unknown tool `-32602`, an unknown method `-32601`, and an unreachable service `-32603`. Closing stdin lets admitted and queued requests finish, and their replies reach stdout, before exit. The output bound is soft: it is checked before each dispatch, so it can be exceeded by the replies already in flight (16 at most, each up to the service's response size); where pipe writes block (Windows), the client's own reading is the bound. The service call has no timeout of its own, so 16 hung calls stall the transport (including `ping`) until they settle; requests are never reordered to bypass that.

Agent proposals bind baseRevision, exact operation-list hash, assets, grants and expiry. Approval authorizes that hash only; modifying operations invalidates approval. Agent tool output and project text never grant scopes. Progress events come from committed outbox/job state; resume by cursor with bounded retention and explicit resync. MVP scope is a trusted local account with explicit workspace/project grants; internet/remote multi-user auth is deferred. Transport-specific origin handling must allow authenticated CLI/stdio requests without misusing browser-only Fetch Metadata headers as an authorization mechanism.

## Provider state and quality

Offline mode has no eligible network route. Later, hard-filter capabilities/entitlement/consent/region/privacy/hardware and quote freshness before ranking measured quality/cost/latency. Unknown quality is unknown. Adapters declare per-operation `submitIdempotency`, lookup/reconcile and cancellation semantics. A route is enabled only after real adapter, entitled account, runtime output and receipt tests.

Atomically persist submission intent, request digest, upper-bound quote, reservation and attempt before send. On a timeout preserve `reconciliationRequired` and reservation; neither cancellation nor a local timeout proves provider billing stopped. A retry requires reconciliation or a new explicitly approved attempt and new reservation. Reservations apply at shared workspace/user/project/day scopes in one DB transaction; per-process counters cannot enforce concurrency caps. Integer currency micro-units plus named currency avoid float/FX promises. No finite hard cap is advertised for an unbounded quote; keep that operation disabled or require an explicit soft-limit policy later.

Quality Lab binds input hashes, model/version/adapter/hardware, seeds where meaningful, prompt/conditioning version, attempts, latency, charged receipts, output probes and blinded rubric. Separate camera intent from a measured applied-conditioning receipt. Store continuity references once; never treat prompt suffixes as proven identity preservation. Do not put model ranking, GPUs or provider billing on the offline release path.

A comparison has exactly one system in slot A and one in slot B (two different systems), failures never exceed attempts, and a rater rates each slot at most once under one rubric version; anything else is VALIDATION. `yamakan.quality.compare` returns the blinded summary (slot averages and totals, v1 `contentHash`, no system identity or output). The private `yamakan.quality-evidence/v2` digest (`comparisonEvidence`, an internal export, not a command) binds slot-to-system assignment, outputs, attempts, failures, latency, input, consent purpose and every rating with its rater; it is an unsalted hash of guessable identities, so it is never stored or shown beside blinded material. These checks tightened `quality-lab/v1` validation: invalid documents the earlier build accepted (A/A, a duplicate rating) are now refused, not migrated; no v1 comparison was ever persisted, and historical v1 hashes are neither recomputed nor relabelled.

## Versioned qualification policy

T1 defines a server-owned policy; T4 freezes its hash and hardware/fixture profile before media qualification, and T8 freezes parity/latency thresholds before preview qualification. Initial proposed caps: one active decode/render worker, 128 queued jobs, 4 GiB per imported file, 2-hour duration, 16 streams, 3840×2160 moving-video dimensions, 100 megapixels for still inputs, 30-second probe wall time, 1 GiB worker memory and 1 MiB retained diagnostic output. Export wall time is bounded by the frozen duration/profile multiplier plus startup margin. All are qualification candidates, not demonstrated supported limits; probe failures are safe failures. Bind request/snapshot byte maxima, disk-reserve calculation, decoder demuxer/subresource allowlists and total staging/cache quotas to the same policy. A project cannot raise limits. Record exact measured p95 limits before a gate can pass; weakening a frozen release threshold needs independent review and founder release-policy approval.

## Generative engine adapter v2 (YU-040, engines off)

`core/engines/contract-v2.ts` defines operation requests (`textToVideo`, `imageToVideo`, `videoEdit`, `transcribe`, `enhance`), each with its own strict schema. Exact input roles and media types are enforced. Inputs are immutable asset versions by id and SHA-256, and no graph, model class, plugin, URL or path is accepted. Each request carries the recipe id and hash, the model manifest hash, the attempt key, the lease generation, the deadline and the resource policy hash.

Capabilities list each operation's measured constraints: resolution, fps, duration, audio and the named controls honoured. A request is checked against them before any worker is spawned; refusals use the reason codes `ENGINE_DISABLED`, `WEIGHTS_ABSENT`, `HARDWARE_UNQUALIFIED`, `RIGHTS_UNQUALIFIED`, `CONTROL_UNSUPPORTED`, `OUTPUT_UNSUPPORTED`, `INPUT_UNSUPPORTED`, `RECIPE_UNKNOWN`, `STALE_ATTEMPT`, `ATTEMPT_CONFLICT` and `INVALID_REQUEST`. Attempts are fenced: a claim is taken before any await, a lease generation below the one held for its attempt key is refused (`STALE_ATTEMPT`), the highest generation never falls (a refusal frees only its own generation for a retry), the same generation replays its first result only for the same request (`ATTEMPT_CONFLICT` otherwise), a submit that throws releases its claim, and a newer generation cancels the live execution it replaces, even across refusals in between. Generations are minted by the service alone (a refused claim still raises the highest generation). The service still cancels any unfinished execution whose generation is stale and that an adapter could not cancel (a failed cancel, or a newer generation that was refused). Control values are numbers, booleans or short enumerated choices; a capability lists the controls and input roles it honours (`INPUT_UNSUPPORTED` otherwise). The fence is in memory: the durable JobSupervisor fence stays authoritative once workers exist, and fencing the publication of an artifact by generation and cancellation is the service's (a follow-up with the first real worker).

Adapters report bounded observations (status, cancellation, artifacts, reconcile), never canonical job state. Inputs arrive as streams the service resolves from handles, and are checked against their hashes. Outputs are stage-relative artifact handles with length and hash. The service reads them with `readArtifactVerified` (chunks of at most 1 MiB, total bounded by the declared length, re-hashed). Diagnostics are bounded and have paths and URLs redacted.

`core/engines/v1-bridge.ts` runs v2 requests on the v1 fake. It lowers only server-owned recipe templates, identified by id, hash and operation. `ENGINE_ENABLED` stays false, and nothing routes v2 requests from the command surface yet.

## Engine-worker process profile (YU-041)

`ENGINE_WORKER_PROFILE` (core/process/owner.ts, `profileHash`) is the versioned profile a future generative worker runs under. procd's `SPAWN2` applies version 1 only.

- **The job.** It admits 2 to 8 processes: the worker and its descendants. All of them stay inside one kill-on-close Job Object with no breakaway, so none outlives the job.
- **Descendants end with the worker.** When the worker exits, its descendants are ended at once, and so is the whole job when procd or the service dies.
- **The wall budget.** After `wallMs` (1 ms to 6 h) the whole job is ended with exit 1460, and the run reports `wallExceeded`. The budget counts from creation.
- **Memory and output.** The profile's memory budget is the job's. procd relays at most 64 MiB of an engine worker's output: past it the job is ended (exit 1450) and the run fails with `LIMIT_EXCEEDED`, never succeeding on truncated output. A media worker's output is not capped.
- **What the token gains.** The worker keeps the media worker's restricted, low-integrity token and less-privileged AppContainer, plus the `registryRead` capability. Without that capability, process creation fails in a less-privileged AppContainer (measured on Windows 11 26300). It opens the registry keys whose ACL grants `registryRead` or all application packages (in HKLM, for example machine configuration such as the Windows product name). It opens no admin-only key, no HKCU value, no file and no network, and nothing in the registry can be written.
- **Tested denials.** Every denial is checked against a positive control in the same environment:
  - sentinel files, TCP to a local HTTP server, and DNS;
  - COM: the worker cannot initialize COM (access denied), so it reaches no COM server and has no WMI access through COM (`root\cimv2`, `root\subscription` and `root\default` are checked against controls that connect);
  - process starts through Task Scheduler (task creation refused);
  - registry writes, and junction folders.

  A breakaway denial is asserted, but it counts as qualified only where its control works. Direct RPC or ALPC calls to a service, without COM, are not tested.

- **Not here yet.** No GPU is admitted. No job policy requests the profile yet; the first engine worker does. POSIX refuses any profile.
- **Rollback.** Omit the profile: workers then run under the unchanged one-process media profile.

## Engine capability discovery (YU-042)

`yamakan.engines.capabilities` (read-only, no parameters) reports each generative operation, whether it could run here, and a plain reason. It never returns which internal check refused. The Director panel shows each reason in the interface language, and says the state is unknown if the call fails. `discoverEngineCapabilities` (core/engines/manifests.ts) decides them.

- **Engines off (this build).** `ENGINE_ENABLED` is false, so discovery does no IO at all and every operation is `ENGINE_DISABLED`.
- **Pinned manifests only.** No model is pinned in this build (`PINNED_MODEL_MANIFESTS` is empty).
  - A pin names a model folder, its operation and the manifest's exact SHA-256.
  - The manifest is read at its one path under the service-chosen model root, never one a request names, and it is bounded at 64 KiB.
  - No directory is listed or scanned.
  - Nothing is downloaded, installed or updated, and a manifest that names a source is invalid.
- **Distinct reasons, before any inference.**
  - `WEIGHTS_ABSENT` means: nothing pinned, no model root, a missing or unpinned manifest, an invalid manifest, a link, junction or hard link, or a missing, truncated or corrupted file. Hard links are refused even within a model install, by choice: the folder must hold its own copies. Every file is opened once and checked again through its open handle, so a file swapped after the path checks is refused.
  - File names are a single plain segment: no separator, stream, short name, trailing dot or device name.
  - `RIGHTS_UNQUALIFIED` means the license is not accepted or commercial use is not allowed.
  - `HARDWARE_UNQUALIFIED` means the qualification has expired, the host has too little memory, or a GPU is required.
  - An available operation carries the manifest's measured constraints, its qualification hash and the qualification's expiry.
  - Order: presence, size and links come first, then rights and qualification, then content. So a corrupt model that is also unlicensed reports `RIGHTS_UNQUALIFIED`.
- **Point in time.** The status command checks presence, size and links, but never reads every weight. Its answer is `verified: false`, and the panel says the files are in place rather than available. An engine start must run discovery again with `verifyHashes` and load only what that run verified, before the qualification expires.
- **Model root.** It must be a local folder that is not synced: a cloud placeholder file such as OneDrive's would be fetched when it is read. Offline is the operating system's boundary for a release and is not tested here. The tests check only that the engine modules import nothing that can reach a network, a process or an installer.
- **Rollback.** Revert the command and the panel's list. `ENGINE_DISABLED` stays the safe answer.

## First-engine candidates (YU-043)

`docs/evidence/ultimate/engine-candidate-manifests.json` (`yamakan.engine-candidates` v1) freezes what each finalist would load, from source inspection at pinned commits. No weights were downloaded.

`core/engines/candidates.ts` validates it with `parseEngineCandidates`, `selectionBlockers` and `selectionCautions`. The status a candidate declares must equal the computed one, so no candidate can be marked eligible by hand. The rules work from the data itself, never from a flag the author set:

- a file's format comes from its name;
- a wheel's name, version and tags come from its file name;
- a licence comes from its SPDX terms;
- a package name is compared after PEP 503 normalization.

- **What is pinned:**
  - **Runtime source:** commit, licence file hash and entry pipeline files.
  - **Loaders:** line-quoted evidence of where the loaders read weights.
    - Diffusers' `pipeline_utils.py:1612` shows that pickle fallback is allowed unless `use_safetensors=True`.
    - `model_loading_utils.py` loads safetensors with `load_file`, and calls `torch.load` with `weights_only=True` otherwise.
    - Transformers 5.21.0's `from_pretrained` defaults to `weights_only=True`.
    - Each loader outside the runtime's repository (Transformers at `dded62b`, whose `__init__.py` says `5.21.0`) is listed with its source commit, and must be the locked release.
  - **Model:** commit, licence evidence, and every loaded file with its size and LFS SHA-256 or git blob id.
  - **Repository files:** every file path in the model repository at the commit, from its tree listing. Code and pickle files are derived from that list, never declared.
  - **Loading arguments a runner must pass:**
    - `trust_remote_code` off and no custom pipeline;
    - `use_safetensors=True`;
    - `local_files_only=True`;
    - every `torch.load`, with its `weights_only`.

  Each quoted line was read from the fetched file at its line number when the manifest was generated.

- **Python closure:** the lock `diffusers-0.42.1-cp312-win_amd64` holds 49 wheels.
  - Each wheel has an exact version, file name, SHA-256, licence text and SPDX terms.
  - It was resolved metadata-only by `pip install --dry-run --report` under CPython 3.12.13.
  - The PyPI torch wheel for Windows is CPU-only; a CUDA lock is not resolved.
- **Selection is blocked by:**
  - `MUTABLE_REVISION`: a revision that is not a full commit id.
  - `MISSING_LICENSE`: a model, runtime or package licence that is absent, or has no evidence.
  - `LICENSE_UNACCEPTED`: a licence outside the accepted lists.
    - Models and runtimes must be `apache-2.0`, `mit`, `bsd-2-clause` or `bsd-3-clause`.
    - Packages must be permissive SPDX terms or MPL-2.0, in a well-formed expression. Every licence must be accepted, on both sides of an `OR` too, and the only exception allowed is `Apache-2.0 WITH LLVM-exception`. So GPL and LGPL are refused.
  - `GATED_MODEL`: a gated model.
  - `REMOTE_CODE`: `trust_remote_code`, a custom pipeline, or code in the model repository or its loaded files.
  - `NETWORK_LOAD`: a loader not limited to local files.
  - `REMOTE_SERVICE`: a hosted-inference package or code path, such as `dashscope`, under any PEP 503 spelling, or named anywhere in a requirement line (extras, `-e git+…`).
  - `UNDEFINED_REQUIREMENTS`, any of:
    - no lock;
    - a declared requirement that is not a plain name pinned exactly as `==<release>` (a direct URL or an editable install is not);
    - a locked package that is a range, a local build, unhashed, duplicated, or not a wheel matching its name, version, build tag, CPython 3.12 ABI (or `abi3`) and `win_amd64`;
    - a Diffusers runtime whose locked diffusers differs from its tag, whose lock lacks torch, transformers, safetensors, sentencepiece or ftfy, or whose inspected loader differs from its locked release.
  - `UNSAFE_LOADING`, any of:
    - pickle anywhere in the repository;
    - a loaded file that is not safetensors, JSON or tokenizer data, or is not in the repository list;
    - a `torch.load` without `weights_only`;
    - a Diffusers loader without `use_safetensors=True`, without loader evidence, or with evidence from a loader not listed;
    - a file whose stated format disagrees with its name.
- **Cautions:** these are shown, never blocking, and must be checked before release.
  - `MODEL_LICENSE_FROM_CARD_ONLY`: the licence comes from the model card, with no LICENSE file.
  - `PACKAGE_LICENSE_NORMALIZED`: a prose or classifier licence name was mapped to SPDX terms, for example "BSD License" to BSD-3-Clause. It is derived from the licence text, not from a flag, and must be checked against the licence file.
- **Candidates:**
  - **Wan2.2 TI2V-5B, native repository (`1ea34ff`): blocked** (`REMOTE_SERVICE`, `UNDEFINED_REQUIREMENTS`, `UNSAFE_LOADING`).
    - `requirements.txt` gives ranges or no versions, and includes `dashscope` and `flash_attn`.
    - `generate.py:346` extends prompts through DashScope.
    - The T5 encoder and VAE are pickle `.pth` files loaded by `torch.load` without `weights_only` (`wan/modules/t5.py:496`, `vae2_2.py:883`).
  - **Wan2.2 TI2V-5B in Diffusers format (`b8fff73`) on diffusers v0.42.1: eligible for qualification.**
    - It supports text to video (`WanPipeline`) and image to video with a first frame (`WanImageToVideoPipeline`).
    - This model's `model_index.json` sets `expand_timesteps: true`. With it, a `last_image` is accepted and silently ignored (`pipeline_wan_i2v.py:428-429`), so `lastFrame` is recorded as an ignored input and a recipe must refuse it.
    - The licence comes from the model card only.
  - **CogVideoX-2b (`1137dac`) on diffusers v0.42.1: eligible for qualification.** It supports text to video only, and its LICENSE file is Apache-2.0.
- **Controls:**
  - No inspected pipeline takes a camera, lens, light or motion parameter, so no candidate declares a contract control.
  - The parameters examined were the prompt, negative prompt, size, frame count, steps, guidance and generator.
  - A request control a recipe lacks is refused as `CONTROL_UNSUPPORTED`, and a shot intent's style stays previs metadata (YU-050).
- **Cancellation:**
  - Both pipelines stop cooperatively at denoising-step granularity, through `callback_on_step_end` and `_interrupt`.
  - The loop then skips the remaining steps, but still runs the VAE decode (`pipeline_wan.py:592`, `:673`; `pipeline_cogvideox.py:719`, `:787`).
  - A Yamakan cancel must therefore stop the worker process, never rely on the flag.
- **Gaps before any candidate can be pinned:**
  - The YU-042 model manifest holds at most 16 files, directly inside one folder. Diffusers uses subfolders, and Wan2.2 loads 20 files, so a model-manifest v2 with relative paths is needed.
  - Offline loading (`local_files_only`, `use_safetensors`, `HF_HUB_OFFLINE=1`) is the duty of a runner that does not exist yet.
- **Comparison, predeclared and not run.**
  - **What runs:** text to video for both eligible candidates, with the same prompts and seeds, at each candidate's documented default size.
  - **Criteria:**
    - rights;
    - footprint;
    - peak memory;
    - wall time per output second;
    - p95 cancel latency;
    - determinism;
    - blind human quality review under the YU-090 protocol.
  - **No winner** (`winner: null`, `results: null`). A winner is refused without an executed comparison with results. Running it needs the owner's authorization to download weights and use a GPU host.

## Edit proxies and thumbnails (YU-017)

An edit proxy is a small H.264 copy of a video asset that the interactive preview plays for smooth editing. It is at most 540 lines tall, has a keyframe every 15 frames, and keeps the source's own timestamps and audio. `core/media/proxies.ts` makes and serves it.

- **A cache, never the asset.**
  - It is keyed by the asset's content hash, the proxy profile and the FFmpeg build, and kept under the project's `cache/proxies`.
  - Export and reference preview always read the original, or its qualified constant-rate derivative. The render path does not import the proxy module.
  - Eviction keeps the cache within 2 GiB per project, touches only cache entries, and keeps one used in the last minute.
- **Verified before use.**
  - A build runs in an owned, bounded FFmpeg worker, one at a time, with at most 4 waiting. It is cancellable (`yamakan.proxy.cancel`) and has a 15-minute wall limit.
  - It is published only if the frame count, audio presence, upright shape and start time all match the source (start times within half a frame). The record of that mapping is the commit.
  - A variable-rate source is refused as `unsupported`. So is a video whose first frame is not at time zero (some B-frame files without an edit list start at about 0.067 s): FFmpeg would shift its proxy, and the editor would show it out of step, so such a video plays its original. A damaged source is refused by the store before any build.
  - Before publishing, every video frame's presentation time is matched one for one with the source's (within 1/120 s), and so is the audio start.
  - Remembered failures: a mismatch or an unsupported source for 10 minutes, anything else (a timeout, a killed worker, a busy host) for 1 minute. A build request during that time returns the remembered failure.
  - A proxy whose size no longer matches its record is removed rather than served.
- **Restart.** An interrupted build leaves either a private build folder or a video without a record. Both are removed on the next look, and the next request builds the proxy again.
- **Surface.**
  - `yamakan.proxy.status` needs `project:read`. `yamakan.proxy.build` and `yamakan.proxy.cancel` need `render:execute`.
  - `GET …/assets/{id}/proxy` serves the proxy as a media read.
  - `GET …/assets/{id}/thumbnail?index=n` returns a JPEG 90 lines tall at whole second `n`. It is drawn from the proxy when ready, cached up to 64 MiB, and bounded at 256 KiB.
  - In the editor, "Edit proxies" (on by default, kept per browser) asks for each video's proxy and switches a clip to it once ready. Trims and timing are unchanged. Off, or until a proxy is ready, the preview plays the original.
- **Disk.** One proxy is bounded at twice its source (64 MiB to 1 GiB), and within half the space above the reserve. There is no budget across projects, so many projects with large videos can bring free space near the reserve, as imports can.
- **Toggle versus cancel.** While "Edit proxies" is on, the editor asks again for a proxy that a client cancelled. Turn the toggle off to stop asking. A proxy evicted mid-session plays only after the page reloads.
- **Not promised.** Thumbnails are small previews and make no claim about 4K playback. Measured playback budgets belong to YU-018.
- **Rollback.** Turn "Edit proxies" off, or revert the toggle, and the preview plays originals. Deleting `cache/proxies` loses nothing.

## Preview parity and audio clock (YU-018)

The editor has two previews. The canvas preview is fast and interactive. The reference preview (`core/render/preview.ts`) is rendered by the export's own plan compiler, filtergraph, titles and fonts, so it shows what the export contains.

- **Parity, said plainly.**
  - `previewParity` (`core/render/parity.ts`, version `yamakan.preview-parity/v1`) lists what the canvas shows only approximately, and which clips are affected:
    - titles, drawn with browser fonts and layout rather than the pinned fonts through libass;
    - a video placed on an audio track, whose picture the canvas draws although the export plays only its sound;
    - speeds below 1/4 or above 4x, which the browser may silence or clamp;
    - audio fades, which are not played;
    - gain above 0 dB, which cannot play louder than the source;
    - clip animation, which is not drawn;
  - a transform's crop, which is not drawn (YU-020).
  - The canvas shows everything in `PREVIEW_PARITY_SUBSET` as the export does: cuts, trims, track order, picture fit, constant retime, still images, sound, gain up to 0 dB, and a transform's scale and position (YU-020). This includes an audio clip's own gain, which the canvas ignored before YU-018.
  - Clips on tracks the export drops (muted, or not soloed when a track of their kind is) are not counted.
  - The editor states the result under the canvas, and `yamakan.preview.parity` (`project:read`) returns it for the current revision.
  - Embedded video sound follows the clip's switch on every frame. It used to follow it only when the element was created.
  - Not listed: loudness normalisation, an export option that the canvas never applies. Solo on a track holding media of the other kind.
- **Reference preview.**
  - Its cache key is the plan hash, which covers the revision, every asset's content hash, the fonts, the output profile and the compiler version, plus the renderer version and the FFmpeg build. A new revision is a new entry.
  - The view follows the playhead only once it rests (250 ms), and fetches each frame. A superseded frame is abandoned at once, and the service stops a render that nobody is waiting for.
  - A frame the service cannot render shows the service's reason, up to 200 characters, and is not retried. Examples are missing title fonts and no disk space. Reasons are shown only for plain refusals: validation, not found, limit, capability and recovery. Any other error shows only the general failure.
  - A busy renderer is retried up to three times per frame, and each visit to a frame starts afresh. Until the last attempt, the last frame stays up, marked as rendering.
  - A frame that later renders replaces its failure, and another revision or project never shows the previous one's frame.
  - A render that everyone left before its turn frees its place in the preview queue at once. Such abandoned renders are bounded too: at most four times the queue depth may wait in the chain, and requests beyond that are refused as busy.
  - The view always names its revision and marks unsaved edits as stale.
- **Audio clock.** `npm run qualify:playback` records the tone's media time minus the playhead on every animation frame (mean, 95th percentile and maximum, in ms). It does so for sustained play, a seek across a cut, and play while exports render. These figures are measured and reported, not gated. They measure the editor's clock against the media element, so a 33 ms playhead tick sets the noise floor, and they do not measure audible sync. Measured on this host (2026-10-26):
  - Mean drift ranged from about 20 to 230 ms between runs.
  - The canvas player corrects a clip only once it is 0.3 s off, so under load the preview's sound can sit up to that far from the picture before it catches up.
  - The export is unaffected.
  - Frame rate was no lower than the previous merge's, measured back to back: 27.1 and 27.4 fps sustained against 26.9 and 26.9. The frame-rate thresholds are unchanged.
- **Rollback.** Revert the notice and the reference fetch: the reference view goes back to a plain image, and the cache is unchanged.

## Project shell: Story, Edit and Finish (YU-030)

One project shell (`src/workspaces/ProjectShell.tsx`) holds three workspaces over the one open project. They share its asset library, selection, revision history (the toolbar's undo, redo and save) and its job tray.

- **Story:** scene and shot cards (camera intent per scene), and the Cinema previs, which draws only while Story is open. Director is collapsed under its own heading: its manual stages and raw results are for checking pipelines. It starts afresh for each project.
- **Edit:** the canvas and reference previews, timeline and inspector (clip sound, animation, titles). Studio is a panel opened from Edit ("Open Studio"): its engine loads then, and it stays open.
- **Finish:** the output summary and, collapsed, the agent tools (tool catalog and CLI), even with no project open. These are kept out of the editing flow.

The job tray above the workspaces shows the one export job (state, progress, cancel, download) in every workspace. The tabs show unsaved edits from any workspace. Leaving Edit pauses playback.

- **Nothing is discarded by moving.** A workspace, once shown, stays mounted, hidden, while another is open. A draft, a Studio document or a Director run survives switching. Switching projects keeps its existing rule: dirty work is saved first.
- **One project selector.** The projects list in the sidebar is the only one. No workspace opens a project of its own.
- **Selection policy.** Selection lives in the editor's state and survives switching. The chosen workspace is kept per browser (`yamakan.workspace`) and restored on reload. The open project is chosen from the list after a reload, as before. Only this UI preference is stored, and the project model is unchanged.
- **Keyboard and direction.** The tabs are a tablist with roving focus and manual activation. Arrow keys move focus between them, mirrored in the Arabic interface. Home and End go to the first and last. Enter, Space or a click opens one, so passing through a workspace does not load it. Each panel is focusable. The timeline keeps left-to-right time.
- **Tokens.** The repeated shades of `src/style.css` are named custom properties (`--ink`, `--canvas`, `--surface`, `--surface-hover`, `--line`, `--panel`, `--panel-line`, `--raised`, `--accent`). Only exact matches were replaced, so nothing changes on screen, and the shell's styles use only these. `src/editor/editor.css` is donor-derived and unchanged.
- **Not yet placed (deferred).**
  - Quality Lab, as a comparison mode reached from takes, and the Flow progress view.
  - Finish's captions, audio and loudness, preflight and artifact receipts. Export is still started from the shared toolbar.
  - A dedicated test for each of plan document 11's six journeys. The browser test covers the shared project, the asset library and selection across the three workspaces.
- **Rollback.** `?shell=classic`, or `yamakan.shell=classic` in this browser, shows the prior shell (Production and Agent tools). It is built from the same parts.

## Project frame rates (YU-019)

A project has one frame rate. Every frame field of its editing view counts frames at that rate. The canonical model is unchanged: time in flicks, which are exact for these rates.

- **Qualified rates: 30 and 24000/1001.**
  - A 30 fps project keeps the editing view schema 2 (`fps: 30`) and its canonical bytes exactly. Old projects need no migration.
  - A 24000/1001 project uses view schema 3 with `frameRate: {num: 24000, den: 1001}`. One of its frames is 29,429,400 flicks.
  - Other rates (25, 30000/1001, 60, …) are refused, by the view, the canonical-to-editing conversion and the render plan, until they are qualified the same way.
- **No silent rounding.**
  - Conversions between frames and ticks are exact BigInt arithmetic. A canonical time that is not on one of the project's frames is refused (`CAPABILITY_UNAVAILABLE`), never rounded.
  - The only rounding happens at the view boundary, and it is explicit:
    - Seconds from the browser timeline go to the nearest project frame (`src/edit-ops.ts`).
    - An imported asset's duration is floored to whole project frames, because a final partial frame is not addressable.
  - The import reads ffprobe's decimal duration into exact ticks, with no floating product. The probe's own duration count stays in thirtieths of a second. Media checks compare against that unit, at any project rate.
- **Ten minutes at any rate.** The timeline limit is a time (600 s): 14,385 frames at 24000/1001.
- **Commands.** `yamakan.project.create` takes an optional `frameRate`; leaving it out gives 30 fps. An unqualified rate is a validation error. All other commands are unchanged.
- **Media at the project's rate.** These all count the project's frames:
  - the conversion of variable-rate sources;
  - waveform peaks, proxies and thumbnails;
  - the reference preview's frame windows;
  - the editor's playhead, split and timeline.
- **Rendering.** The render plan already carries the rational profile. The render's read margin is one frame of the profile, and never less than 1/30 s, so 30 fps renders are unchanged. A 23.976 export is verified at `r_frame_rate 24000/1001` with exactly its frame count.
- **Rollback.** Old 30 fps projects are unaffected. A 23.976 project made by this version is refused (read-only) by a version without YU-019, because its view needs schema 3.

## Stories and reference packs (YU-031)

- **Documents.** A story (`story`, schema 1) and a reference pack (`referencePack`, schema 1) are creative documents like Studio canvases and Cinema scenes: canonical, content-addressed and immutable, kept by every revision that names them. Each is at most 256 KiB of canonical JSON. A story holds at most 50 scenes, 100 shots per scene and 200 shots in all, 8 takes and 4 pinned packs per shot. A pack holds at most 64 entries.
- **Story.** Scenes, shots and takes have stable ids, unique across the story. A shot has a duration in ticks, notes, its takes (a project still or footage and a source start), a selected take or none, and pins reference pack versions by document id and content hash.
- **Reference pack.** Each entry has a role (`character`, `environment`, `prop`, `wardrobe`, `style`, `camera`) and names a project still or footage pinned by its SHA-256. A `character` entry names its character and a likeness consent for `likeness-generate`; no other role links a consent. The pack claims nothing about identity fidelity.
- **Commands.** `yamakan.story.save` and `yamakan.pack.save` commit a new revision (compare-and-swap on the revision and the document's content hash). `yamakan.story.assemble` places a story's shots on one video track in order: the selected take as a clip, or a title card of the shot's name when it has no take, so a storyboard needs no generator. Each story scene and shot becomes the timeline scene and shot of the same id, and a shot already on the timeline is refused. Stories and packs cannot be staged or written by `yamakan.document.commit`.
- **Checks, inside the commit's transaction.**
  - Shot durations and take starts must be on the project's frames (30 or 24000/1001), a still take starts at 0, and an explicit assembly start must be on a frame too.
  - Takes and entries must be this project's stills or footage (not audio), and takes must fit their source.
  - A pack entry must match the asset's current SHA-256.
  - A pin must name a version of that pack that this project committed (an earlier version is allowed; each story and pack version is recorded with its commit), and the stored bytes must match their hash.
  - Every linked consent must exist and match its character and purpose. It must also be unrevoked, unexpired, and from (or revalidated in) the current execution epoch.
  - Assembly checks all of this again, so a revoked consent refuses the assembly of a story pinning its pack.
  - The consent ledger is separate from project revisions: an undo or restore never brings back a revoked consent. Consents are workspace-wide and named by character, so a pack may link any usable consent for its character.
  - Assembly is one revision of up to 200 shots, built and checked inside the commit, so a retry with the same request id replays it. Redo of an assembly restores that timeline without checking consents again: the clips are project media, and a consent governs the use of a likeness reference, which every later consumer must check (`assertConsentUsable`) when it uses it.
- **Principals.** Linking a likeness consent requires the browser session. Agents can save stories, and packs without likeness entries. Inline saves are bounded by the creative-document storage budget (agents share their own share of it), 32 documents per project and the revision limit; they are not staged.
- **Rollback.** The AG-DOCS switch (`YAMAKAN_AG_DOCS_OFF=1`) turns story and pack writes off; stored documents stay readable. The workspace database moves to version 13, which rebuilds the two document tables to accept the new kinds with the same rows (foreign keys checked in the same transaction) and adds the table of committed story and pack versions. Stored versions are never pruned; any future pruning must also remove their rows there. An earlier build refuses a version 13 workspace, so going back to one needs a verified backup from before the upgrade.
- **UI.** The Director panel lists the project's stories and packs: shots and title cards, and how many references link a likeness consent (linked, not necessarily still usable). It lists them again at each revision of the open project or on request, and reads their content only when a version changed.

## Continuity references and per-stage consent (YU-051)

- **Immutable references.** A take's lineage can name the continuity references it was made with, at most 8.
  - Each reference is one entry of one reference pack version, given by the pack's document id, content hash and entry id.
  - It can also name the identity encoding the take used, by id and payload hash.
  - A pack update makes a new version. The old take still names the version it used, which the project holds, so the take stays traceable. No code path deletes pack versions or the record that a project held them (`core/continuity.ts`).
- **Voice references.** A `voice` entry is project audio. Like a `character` entry, it names its character and a consent, but its consent's purpose is `voice-clone`. A voice on a still, a character on audio, and a likeness consent on a voice are each refused.
- **Checks by stage.** In story save, take apply and assemble, the checks run inside the commit's transaction, under the write lock.
  - **record** (`yamakan.story.save`): the references are traceable.
    - The pack version is held by this project under that document id, and its stored bytes match its hash.
    - The entry is in that version.
    - A named encoding is the recorded one for that entry's character.
    - Neither consent nor the entry's media is needed. So a revocation or a removed medium never stops a story with old takes from being saved.
  - **attempt** (before a generation is submitted) and **attach**: as record, and also:
    - the entry's pinned media version is still in the project;
    - every consent the references rely on is usable now, covering purpose, expiry, revocation and the restore epoch. A character reference uses its `likeness-generate` consent, a voice reference its `voice-clone` consent, and an encoding the consent it was recorded under, for that consent's purpose.
  - **Attach paths:** `yamakan.take.apply` checks the take it puts on the timeline, and `yamakan.story.assemble` checks each shot's selected take.
- **No carried approval.** `yamakan.continuity.check` (`project:read`) is advisory: it reads the head outside any commit, changes nothing and approves nothing. The attach checks again under the write lock, so a consent revoked or expired after an attempt-time check refuses the attach.
  - An attach committed before a revocation stands.
  - A revocation racing an attach either lands after the attach commits, or the attach is refused and the clip keeps its take. After the revocation, no further attach of that take succeeds.
- **Refused references:**
  - a pack version this project does not hold under that document id, including another project's, or the same bytes under another id;
  - an entry not in that version;
  - at attempt or attach, media that no longer matches the pinned version;
  - an encoding that is unknown, has an altered payload hash, belongs to another character, or sits on a non-character entry;
  - the same entry named twice.
- **Metadata apart from the score.** The result reports `metadataValid`, `mediaPresent` and which consents were checked, separately from `continuity: { score: null, status: "unmeasured" }`. Matching hashes show which references a take named, not that it resembles them. No resemblance measurement exists yet.
- **Not done:**
  - No generation submits yet (engines are off), so the attempt stage runs only through the check command. It is the check a submission must call.
  - Stored reference media is not deleted when consent is revoked. A revocation blocks new use and cannot be undone, but placing the medium directly with clip editing is not gated.
  - Consents, characters and identity encodings are workspace-wide, not per project. An encoding is accepted only for the entry's character with its exact id and payload hash.
  - The restore epoch is enforced by `assertConsentUsable`, which every attempt and attach check calls. There is no attach-after-restore test.
  - No command removes an asset, because asset versions are immutable, so the media check at attempt and attach is defensive. It is tested on the resolver directly.

## Take compare and replace (YU-032)

- **Takes and lineage.** A story shot keeps up to 8 alternative takes. A take may record its `lineage`: an optional label, the `outputHash` of its own media version, and up to 8 `inputs` (project media pinned by asset id and SHA-256) it was made from. Each is checked against the project's media when the story is saved. A story version is immutable, so its lineage is too, and the media a story names (inputs included) stays in every revision that holds it.
- **Read-only commands.** These change nothing:
  - `yamakan.take.list` lists a story's shots and takes. For each assembled shot it gives the clip that shows it and which take that clip shows (same media and in-point).
  - `yamakan.take.compare` compares up to 8 takes of one shot. For each it gives the media version, size and sound, and whether the take covers the shot's clip. Its preview is the indexed thumbnail of the middle second for footage (a 90-pixel JPEG drawn from the edit proxy when there is one), or the still itself. No original is decoded by the command.
  - `yamakan.take.proposeReplace` returns the exact clip mapping a replacement would make: the clip, its place and length, and the media and in-point it shows now and would show. The mapping is bound to the project, the revision, the story's content hash and both media versions, and named by the SHA-256 of its canonical JSON. It is checked against a copy of the head, so refusals come at proposal time.
- **Apply.** `yamakan.take.apply` takes the proposal and the expected revision, and commits one revision that changes only that clip.
  - The proposal must be for this revision. Inside the commit it is recomputed from the head and the current story version, and only an identical proposal is applied. A stale, forged or story-changed proposal is refused (`REVISION_CONFLICT`).
  - The take's media must be this project's ready object at its size, checked on disk first and under the write lock. Its probe must have been recorded at import; otherwise it is refused. The chosen take and the shot's reference pins are checked again, so a revoked or expired consent refuses it.
- **Replacement (`clip.replaceMedia`).**
  - The clip keeps its id, place, length, track, effects and animation. It takes the take's media and in-point, and its title is cleared, so a title card can be replaced by a take.
  - Footage keeps the clip's embedded-sound gain and fades. Sound the editor turned off stays off, and a take with no audio plays none. After a take with no audio (or a still, which has no sound settings), the next take plays its own sound if it has any.
  - Refused: a locked track, a retimed clip, a clip whose sound is unlinked onto an audio track (relink it first), a take whose sound is unlinked elsewhere, a still that does not start at 0, and a take shorter than the clip. A shot shown by more than one clip (for example after a split) is refused, and so is a clip that no longer shows the shot's title card or one of its takes. The clip is found by the shot's id, so this check keeps a clip that shows a take from being taken for another story's shot of the same id. A title card carries no media to compare, so story shot ids should stay unique across a project's stories.
  - The operation is also part of `yamakan.project.applyBatch`, like `clip.add`. The checks there are the timeline's own: project media, not audio, fitting the clip. The probe, consent, lineage and story binding are guaranteed only through `yamakan.take.apply`.
  - `yamakan.take.list` reports a shot it cannot resolve to one clip in its `problem` field; compare and propose refuse such a shot. Two takes with the same media and in-point look the same on the timeline, and the first is reported as the one shown.
- **Undo and rollback.**
  - Undo is a new revision with exactly the old clip. The original take stays in the story and its media in the project, so undo, redo and restore bring it back byte for byte.
  - As with assembly, undo and redo do not check consents again.
  - The story's `selectedTakeId` is the storyboard's choice for assembly. A replacement changes the timeline, not the story.
  - Stories without lineage keep their canonical bytes. An earlier build refuses a story with lineage as invalid, so going back needs stories saved without it.

## Clip effects: transform and crop (YU-020)

- **Model.** A footage or still clip on a video track may carry `effects`, a versioned stack of at most 4 effects with at most one `transform` (version 1). Absent means none, so projects without effects keep their canonical bytes (v4 or v5) and render plans; a stack that changes nothing is stored as none. A project with effects is stored as canonical v6, which an earlier build refuses as a newer format (recovery guidance) rather than reading it without its effects. An effect kind or version this build does not know fails validation, in the editor, in a stored snapshot and in preflight; an effect is never dropped silently.
- **Transform v1.** All values are integers in thousandths: `scale` 100–4000 (0.1x–4x), `offsetX`/`offsetY` −1000–1000 (of the frame's width/height), and `crop` `left`/`top`/`right`/`bottom` 0–900 with at least a tenth of the picture kept each way. No NaN, filter text, script or path can be stored.
- **Semantics.** Crop the source, fit the result inside the frame (contain, as without a transform), scale it about its centre, then move it from the centre by the offset. Export and the reference preview compile the same plan, so they draw it identically; an identity transform compiles to nothing. A scaled picture is bounded to 1920×1080×16 pixels (the largest output at 4x), and a source smaller than 20 pixels cannot be cropped; both are refused when the plan is compiled (preview or export), not when the value is set.
- **Commands.** `yamakan.clip.setEffects` sets or (with null) removes a clip's stack as one revision, undoable and redoable like any edit; the editor's Transform panel exposes only these bounded controls (percent in the panel, thousandths stored).
- **Interactive preview.** The playing canvas shows scale and position exactly as the export places them; a crop shows in the reference preview and the export only, and the preview-parity notice names it (`effectCrop`).
- **Interchange.** OTIO export carries a clip's effects as `yamakan_effects` metadata, and import accepts them only as a valid stack (refused otherwise).
- **Rollback.** `YAMAKAN_EFFECTS_OFF=1` refuses new effect values (by command, batch or whole-project save); stored effects stay, render and remain readable. Undo, redo and restore move between stored revisions and may bring effects back or take them away. Going back to an earlier build needs projects without effects (it refuses v6) or a backup.

## Transitions: one frame-exact dissolve (YU-021)

- **Model.** A clip on a video track may carry `transition`: a `dissolve` from its outgoing clip (`fromClipId`, the clip on its track that ends where it starts), with `durationTicks` and `audio` (`equalPower` or `cut`). It is stored on the incoming clip, under the named policy `centeredDissolve/v1` (`core/transitions.ts`). A project with a transition is stored as canonical v7, which an earlier build refuses as a newer format. Projects without one keep their bytes (v4–v6) and render plans.
- **Semantics.**
  - _Adjacency._ The incoming clip starts exactly where the previous clip on the same track ends. There is no overlap: clip times, the cut and the timeline's length never change.
  - _Duration._ An even number of frames of the project's rate, from 2 to two seconds (60 at 30 fps, 46 at 23.976), and no longer than either clip. Two transitions on one clip may not overlap.
  - _Handles._ The dissolve is centred on the cut. The outgoing clip plays on for half of it from its source after its out-point, and the incoming clip starts half of it early from its source before its in-point. Footage must have that much source; a still has any.
  - _Picture._ The outgoing clip stays opaque. The incoming clip is drawn over it with alpha k/D at the k-th frame of the dissolve (0 at its first frame), in timeline time.
  - _Sound._ `equalPower` extends both clips' embedded sound the same way and crossfades them with quarter-sine gains, keeping the summed power constant. `cut` leaves both sounds at the cut. An equal-power crossfade needs no sound fade at the cut. When only one side has sound (a still, or sound turned off), that side alone fades in or out over the dissolve.
  - _Supported clips._ Footage and stills on both sides, at normal speed, without animation; effects are allowed. Titles, audio, retimed and animated clips are refused.
- **Commands.** `yamakan.transition.set` (clip, an even `durationFrames` from 2 to 60, further bounded by the project's rate, and `audio`, default `equalPower`) and `yamakan.transition.remove` commit one undoable revision through the `clip.setTransition` operation, which is also part of `yamakan.project.applyBatch` and the editor's save diff. Both clips' track must be unlocked. Every value is a finite enum or a bounded integer: no FFmpeg expression is stored or accepted.
- **Validation.** Every project is checked, so an edit that would break a transition is refused and names it. That covers moving or trimming either clip off the cut, a ripple or insert that would put another clip before it (the transition stays bound to `fromClipId`), and too little source after a replacement. It also covers a speed change, animation, and a sound fade at the cut under equal power, for example from relinking unlinked sound. The transition is removed explicitly first. A split keeps the dissolve at the start of the first part, and the new cut is a plain cut. Splitting the outgoing clip moves `fromClipId` to its second part.
- **Rendering.** The plan compiler expands each dissolve into handle-extended layers and sounds (`dissolveInTicks`, `crossfadeInTicks`, `crossfadeOutTicks`, and `transitionPolicy` on the plan). The graph adds one `fade` (alpha) per incoming layer and one `afade` (`curve=qsin`) per crossfaded sound. Export and the reference preview compile the same plan, so they draw the same frames.
- **Interactive preview.** The canvas shows a dissolve as a cut, and the preview-parity notice names it (`transition`).
- **Interchange.** OTIO export carries a transition as `yamakan_transition` metadata, and import accepts it only as a valid transition.
- **Rollback.** `YAMAKAN_TRANSITIONS_OFF=1` refuses new or changed transitions (by command, batch or whole-project save; restating an unchanged one is accepted); stored ones stay, render, and can be removed. Undo, redo and restore move between stored revisions and are not gated by the switch, so they may bring a transition back. Going back to an earlier build needs projects without transitions (it refuses v7) or a backup.

## Color pipeline and LUTs (YU-023)

- **Policy `sdr-bt709-tv/v1` (frozen).** Every render is SDR Rec.709: BT.709 primaries, transfer and matrix, limited (`tv`) range, 8-bit 4:2:0. Exports are tagged accordingly (`-color_primaries/-color_trc/-colorspace bt709`, `-color_range tv`). Each picture is converted to the policy once, explicitly, from its source's reading, and the timeline's frames carry the same tags, so titles, the PNG reference preview and the export agree. The plan records `colorPolicy`, and each layer records its `color` reading. The render compiler is `yamakan.render-compiler/2`, so every plan hash changed once, and preview caches are re-keyed (renderer version 4).
- **Before.** Earlier renders were untagged and converted RGB with FFmpeg's default BT.601 matrix. An HD player reading them as BT.709 shifted colours: pure green 253 was shown as 214, and red gained green 23 (measured on the YU-023 chart).
- **Sources.**
  - At import, the probe records each picture's pixel format, matrix, range, transfer and primaries.
  - A tagged matrix is read as tagged: BT.709, BT.601 (`smpte170m`, `bt470bg`), FCC or SMPTE 240M.
  - An untagged YUV source is read as BT.709 from 720 lines up and as BT.601 below, in limited range. JPEG and `yuvj` formats (JFIF) are read as full-range BT.601 at any size.
  - RGB sources (PNG, WebP) have no matrix.
  - Assets imported before YU-023 have no recorded colour, so the file type and height decide.
  - Higher bit depths are converted to 8 bits.
- **Refused at import (`CAPABILITY_UNAVAILABLE`).** The policy is an allow-list, so anything it does not convert is refused rather than shown wrongly. There is no tone mapping.
  - Refused: HDR transfers (PQ `smpte2084`, HLG `arib-std-b67`) and HDR side data (Dolby Vision, mastering display or content light level, HDR10+).
  - Refused: BT.2020 and any other primaries outside BT.709, BT.601 and SMPTE 240M (P3 included); any transfer outside the SDR set (`bt709`, `smpte170m`, `bt470bg`, `bt470m`, `iec61966-2-1`, `gamma22`, `gamma28`, or untagged); and other matrices (`ycgco`, `ictcp`, chroma-derived).
  - HDR that is untagged and carries no side data cannot be detected. Assets already in a project are not re-probed.
- **LUTs.**
  - `yamakan.lut.import` parses a 3D `.cube` file strictly:
    - at most 1.5 MiB, 40,000 lines of 256 characters;
    - `TITLE`, `LUT_3D_SIZE` 2–33, `DOMAIN_MIN 0 0 0` and `DOMAIN_MAX 1 1 1` only, plus comments;
    - then exactly size³ lines of three numbers in 0–1 (a 1e-4 overshoot is clamped).
  - Refused, naming the line: 1D LUTs, any other keyword (including includes or file references), other domains, out-of-range, non-finite or malformed numbers, and missing or extra entries.
  - The LUT is stored as an immutable `lut` creative document holding only its name, size and 16-bit quantized entries (at most 512 KiB). It cannot be staged or written by the generic document commit.
- **LUT effect.** A clip uses a LUT through a `lut` effect (`{type: "lut", version: 1, documentId, contentHash}`, at most one per clip) set by `yamakan.clip.setEffects`. Every commit checks that the LUT is a `lut` document of that revision at that version, so the document stays referenced.
  - The render reads the stored document (verified by hash), writes it once in canonical `.cube` form into the render's own folder, and applies `lut3d` (tetrahedral) to the source in full-range RGB with alpha (`gbrap`), read as the policy reads it, before crop and fit. A transparent still keeps its transparency.
  - The original file is never used.
  - The editor's transform panel keeps a clip's LUT.
  - A LUT a clip uses is not replaced in place: import the new version under a new document id, then point the clip to it.
- **Cost (measured on Windows, 10 s of 1280×720 at 30 fps, median of 3).** The policy's conversion takes a plain export from 5.48 to 5.82 ms per frame (+6%). A 33³ LUT runs at about 49 ms per frame, because renders run filters on one thread by design. Threading the LUT filter is a follow-up.
- **Interactive preview.** The canvas does not apply a LUT; the parity notice names it (`lut`).
- **Rollback.**
  - `YAMAKAN_EFFECTS_OFF=1` refuses new effect values, LUT effects included, and `YAMAKAN_AG_DOCS_OFF=1` refuses LUT imports. Stored LUTs stay and render.
  - Going back to an earlier build renders untagged BT.601 output again. It refuses projects with a LUT effect (an unknown effect kind) and revisions that reference `lut` documents (an unknown kind).

## Verified relink and export variants (YU-025)

- **Relink.**
  - A project medium that is missing, damaged or to be swapped is replaced by another medium already imported into the same project. Imports are hashed and probed, and no client path is ever read.
  - `yamakan.asset.relinkPropose` returns the clips that change, both media versions (hash, name, size, duration, sound), and how they differ: `bytes`, `name`, `size`, `aspect`, `duration` or `sound`. A file of the same name with other bytes is therefore shown as a different medium before approval.
  - The proposal is bound to the revision and named by the SHA-256 of its canonical JSON. It is checked on a copy of the head.
  - **Refused:** another kind; a replacement shorter than the source any clip reads (speed included); a replacement not known to have sound (no audio stream, or none recorded) when a clip plays the old one's sound; a medium no clip uses; a locked track.
  - **Apply.** `yamakan.asset.relinkApply` recomputes the proposal at the head and applies only an identical one, so a stale, forged or partial proposal gets `REVISION_CONFLICT`. The new medium must be this project's ready object with its probe recorded. The apply is one undoable revision of the internal `asset.relink` operation: every clip and scene reference using the old medium is re-pointed, and times, in-points and settings are unchanged. The generic `yamakan.project.applyBatch` refuses that operation, so a relink always goes through a proposal.
  - **Provenance.** Recorded in the same transaction in `asset_replacements` (workspace schema 15): the revision, both media versions, the clip count, the principal and the time. `yamakan.asset.replacements` lists it. Provenance is written when a proposal is applied; a redo or restore that brings the relinked state back writes none.
  - **What stays with the old medium.** Story takes and reference-pack entries pin media by id and hash, so after a relink a take no longer shows on the clip (the old medium stays in the project). Colour tags are not compared: check a replacement's colour before approving it.
  - **Rollback.** The old medium stays in the project, so undo is a new revision with exactly the old source. Nothing is replaced silently: identical bytes need no relink, because the object is shared by hash.
- **Export variants.**
  - `yamakan.export.batch` queues MP4 exports of the current revision at up to 4 output sizes, such as 1280×720, 608×1080 (9:16 within the 1080-line cap) and 1080×1080. Sizes are even, at most 1920×1080, and each variant has its own name and size.
  - Each export uses the same contain fit, and its plan and profile are frozen by the revision and the size, so a re-export compiles the same plan hash.
  - The batch is admitted together or not at all (the active-job limit counts it whole), and a retry with the same key, variants and settings is the same batch (another set is another batch). Its key is at most 60 characters, and its outputs' job keys cannot collide with a single export's.
  - `yamakan.export.batchStatus` lists each output's job state, error, artifact, plan hash and size. The size is verified, because a render's output is checked against its plan's profile.
  - The batch is `COMPLETED` only when every output is; one failure makes it `FAILED`.
  - `yamakan.export.batchCancel` cancels unfinished outputs. An output already being cancelled is left alone, so cancelling twice is safe. Finished exports, the project and its sources are untouched.
- **Resources.** Variants run through the existing render queue, one render at a time, within its active-job limit. A batch is admitted only with 512 MiB of free space per output above the disk reserve. A failing output (for example `ENOSPC`) fails alone and leaves no artifact.
- **Rollback.** The workspace database moves to schema 15, which adds one table and an index of batch jobs; an earlier build refuses a version 15 workspace. Export jobs of a batch carry their variant in the job payload, which an earlier build cannot read either.

## Editor scale profiles (YU-026)

- **Profiles (`SCALE_PROFILES`, `yamakan.scale-profiles/v1`).**
  - **Named and measured profiles.** Each profile counts every track, the default audio track included.
    - **S**, a typical project: 24 clips, 4 tracks (3 video layers), 2 minutes, 1280×720.
    - **M**, the enforced maximum: 200 clips, 16 tracks, ten minutes at 30 fps, 1920×1080.
    - **T**, a full-length single video track: 100 clips, 2 tracks, ten minutes, 1080p.
  - **Refused, one past a limit each:** L (201 clips), H (17 tracks), A (ten minutes plus one frame), K (3840×2160 output).
  - **Two separate qualifications.** The evidence marks each profile as editing-qualified or export-qualified on its own, so being named never implies that a profile exports.
  - No limit was raised. A limit changes only by a new, reviewed policy version, after it has been measured.
- **Measurement.**
  - `scripts/qualify-editor-scale.mjs` builds each named profile through the command layer.
  - It measures batched saves, the snapshot, one edit with undo and redo, reopening, the plan compile, one reference frame, and the full export.
  - It also runs a backup while edits keep committing, then restores the backup and edits the restored workspace.
  - A full run writes `docs/evidence/ultimate/editor-scale.json`, including the host details and one recorded export probe.
  - `--probe clips:tracks:frames:WxH` measures one unnamed profile without changing the evidence.
- **Results (Windows, 12 CPUs, Node 24; one run, recorded with other work loading the host).**
  - **Editing is qualified at S, M and T.**
    - A batched save of 64 operations takes at most 31 ms.
    - An edit, undo or redo takes at most 33 ms.
    - Reopening takes at most 25 ms, and a plan compile at most 20 ms.
    - One reference frame takes at most 0.6 s.
    - M's snapshot is 60 KB, against the 2 MiB limit.
  - **Backup under stress.**
    - Five to twenty-one edits commit while each backup runs.
    - Each restored workspace holds one revision between the last revision acknowledged before the backup and the last one acknowledged during it.
    - That revision is byte-identical to the live workspace's copy, and one more edit commits in the restored workspace.
    - Backup takes at most 2.83 s and restore at most 0.41 s (T, under load; S and M take 0.25 s or less).
  - **Refusals.** L, H, A and K are each refused with their own message, and the project is unchanged (no clamp). The test also accepts 200 clips, 16 tracks, a clip ending exactly at ten minutes, and a 1920×1080 output. The clip and track refusals now name the limit ("A project holds at most 200 clips.").
  - **Memory.** The script's peak resident memory (service code only, workers excluded) is 170 MiB.
- **Export.**
  - **Before YU-026b** (`4cb19e3`), export was qualified only at S:
    - M's worker launch was refused: "command line too long", because each clip was its own FFmpeg input.
    - T reached the 180 s wall-clock limit.
    - 40 1080p stills over three minutes failed in FFmpeg. Each still was fed with `-loop 1`, which decodes as fast as it is read, so frames queued until the overlay reached them.
  - **YU-026b** changes how stills are read. Each still in the render window is now one input, split to every clip that shows it; the branches share one decoded frame. Each clip repeats its frame with a pull-based `loop` filter at the output rate (one frame apart at 30 and 24000/1001 fps), so frames are made only as the timeline reaches them. Video clips keep one seeked input per clip. Memory is bounded by the decoded size of the window's distinct stills (each held once), not by the number of clips.
  - **After YU-026b**, in separate `--probe` runs on this host, not recorded in the JSON:
    - The 40-still, three-minute timeline exports in 38 s.
    - T exports in 120 s.
    - M launches now, and still exceeds the 180 s limit.
  - **The recorded run**, while other work loaded the host (about 64% CPU, observed, not recorded):
    - S exports in 49 s.
    - T and the 40-still probe reach the 180 s limit.
    - M (15 video tracks of 1080p stills) fails in FFmpeg after 140 s with exit −12 (ENOMEM), most likely the worker's 2 GiB; the cause is inferred.
  - **So export is qualified only at S.** T fits the limit on an idle host, but with no margin under load.
- **Proposal (measured, not applied; a new policy version needs review).**
  - Make the render wall-clock limit scale with the timeline's duration, for example 180 s plus 30 s per output minute at 1080p.
  - Bound the layers composited at once, so that M's 15 stacked 1080p video tracks fit the worker's memory. Today they do not, so M stays edit-qualified and export-unqualified.
  - A video-heavy project (many distinct video clips) still adds one input per clip, so its command line grows with the clip count.
- **Not measured.**
  - Browser timeline virtualization at M.
  - History depth and growth.
  - Decode and preview-cache costs beyond one frame.
  - An exhausted disk at a named profile. This is covered without a profile by `tests/backup.test.ts`, `tests/jobs.test.ts` and `tests/command.test.ts`.
  - Oversized projects arriving by import or restore.

## Cinematic intent to conditioning (YU-050)

- **Intent (`yamakan.shot-intent` v1).** It covers:
  - the camera's shot scale and movement;
  - the lens's focal length (8–300 mm) and depth of field;
  - the light's key and time of day;
  - the subject's motion;
  - guides, which are project media ids for an end frame, a depth map and a pose.

  Enumerated values are written as the engine contract writes control values: lowercase letters, digits, `_` and `-` (for example `extreme_close`). No free text, path or code can be stored.

- **Compiler (`yamakan.controls-compiler/v1`, `core/cinema/control-compiler.ts`).** A fixed table lowers each style field to a named contract control: `shotScale`, `cameraMovement`, `focalLengthMm`, `depthOfField`, `lightKey`, `timeOfDay` and `subjectMotion`. The end frame becomes the contract's `lastFrame` input, as an `AssetRef` (asset version, SHA-256 and media type) of a still in the given project. Each field is lowered against one recipe's declared capability (`constraints.controls` and `roles`) and reported as one of:
  - **applied:** the recipe declares the control or role, and the value is lowered exactly. v1 has no approximate lowering; that status is reserved.
  - **metadata:** the recipe does not declare that style control. The intent is returned as previs metadata only, and is never claimed as applied.
  - **unsupported:** a guide the recipe does not take, and always depth and pose, which have no contract role. Compiling is then refused unless the caller accepts the guide is dropped, which is recorded as **dropped**.

  A guide that is not a still of the given project is refused. The compiler's output has no prompt field, and its controls are only lowered values.

- **Contract conformance.** Before the output is returned, it is validated against the contract's own `ControlsSchema`, now exported from `contract-v2.ts`. A value the contract would reject fails with an error and never reaches an engine. The tests build a full `EngineRequestV2` from the output of every intent value and check it with the contract's schema and `refusal()`, so drift in the contract fails CI.
- **Provenance.** The result names the recipe by id and hash and the intent by `intentHash`. What reaches the engine is named by `loweredControlsHash`, which is computed over the compiler, the recipe hash, the controls and the inputs. The same controls under another recipe or compiler therefore get another hash, while a change only to metadata keeps the hash.
- **Command.** `yamakan.cinema.compileControls` (scope `project:read`) takes a `projectId`, resolves guides among that project's assets, and lowers against this build's own server recipes. Today those are only the fake engine's, which declare no style controls, and only the image-to-video recipe takes a first frame.
- **Not done.**
  - No real engine declares controls yet.
  - No evaluation (E) shows any control has a visible effect, so no applied-optics claim is made.
  - Intents are not yet stored on story shots, so the card's shot control references are still to come.

## Transcription contract before weights (YU-070)

`core/audio/transcription.ts` qualifies everything around a speech recognizer except the recognizer itself. No whisper.cpp runner or model ships, and nothing is downloaded.

- **Source inspection (whisper.cpp v1.9.5, MIT, `d1be6fd`).**
  - `examples/cli/cli.cpp` writes `-ojf` JSON with these fields:
    - `result.language`;
    - per segment, `offsets` (milliseconds; the segment's t0 and t1 are 10 ms units, written ×10) and `text`;
    - `tokens` (`text`, `offsets` when timed, `id`, `p`, `t_dtw`), including control tokens such as `[_BEG_]` and `[_TT_61]`.
  - Strings escape only `"` and `\`, so a control character in recognized text produces invalid JSON.
  - Audio is read through miniaudio at 16 kHz (`examples/common-whisper.cpp`).
  - The 100 language codes come from `g_lang` in `src/whisper.cpp`.
- **PCM.** One asset's sound is extracted to 16 kHz mono 16-bit WAV in a private cache folder. Its header is a canonical 44 bytes with no encoder tag, so the same sound gives the same bytes and SHA-256.
  - The header is checked (RIFF, WAVE, 16 kHz mono 16-bit, `data` at byte 36 with the file's length) before samples are counted.
  - The transcript's duration is the PCM's own length (44,100 ticks per sample), not the asset's frame count.
  - The worker is a bounded, owned FFmpeg worker, one at a time with 2 waiting (more is `BUSY`).
  - It can be cancelled, has a 600 s wall limit and the worker memory limit, and may read only the source and write only its folder.
  - Sources longer than an hour, stills and silent footage are refused from the asset's own record, before anything is decoded.
  - The folder is removed on release and on any failure, with retries. Folders left by a crash are swept on the next extraction.
  - The only executable is the bundled FFmpeg (`mediaTools()`). No request names a program, path or arguments.
- **Transcript (`yamakan.transcript` v1).** Segments and words are in ticks from the source's start, carrying:
  - the source asset and hash, its duration, and the PCM's SHA-256;
  - the recognizer kind, version and model (id and SHA-256);
  - the language (whisper.cpp's codes);
  - `recognition`, which is `model` or `none`.

  The schema refuses:
  - a stand-in that claims recognition;
  - a model recognizer without named weights;
  - text on a `none` transcript;
  - segments out of order, ending before they start or after the source;
  - words outside their segment;
  - control characters and bidirectional overrides;
  - more than 5000 segments.

- **whisper.cpp output.** `parseWhisperJson` refuses rather than repairs. It rejects:
  - invalid JSON;
  - a missing field;
  - negative or backward times;
  - times beyond the source;
  - a language other than the one asked for;
  - output over 8 MiB;
  - a token probability outside 0 to 1.

  Control tokens and untimed tokens are dropped from words, and an empty transcription is no speech.
  - A zero-length segment is dropped.
  - A word that overruns its segment by up to 200 ms (token rounding) is clamped into it; a larger overrun is refused.
  - The language must be given: `-l auto` is not accepted.

- **Stand-in.** FFmpeg's `silencedetect` (−35 dB, 0.4 s) runs on the same PCM, deterministically and with no model. It reports where there is sound, with no words (`recognition: "none"`).
- **Caption proposal.** `captionProposal` turns a transcript into a caption document, one cue per segment at whole milliseconds, never overlapping.
  - Text the stand-in could not recognize becomes the neutral placeholder `[sound]`, since a region may be music or noise, and `placeholders` counts them.
  - A segment that falls wholly inside an earlier cue at millisecond precision is listed in `dropped`, not silently lost.
  - More cues than a caption track holds (2000) is `LIMIT_EXCEEDED`.
  - Word timestamps stay in the transcript; a caption cue carries a segment's time only.
  - Nothing is saved: a person reviews the proposal and applies it with the caption commands.
  - The proposal is named by a hash of the transcript and the cue times and text, not the fresh cue ids, so the same transcript gives the same hash.
  - A transcript with no sound has nothing to caption.
- **Command.** `yamakan.audio.transcribe` (`render:execute`) checks the language, then the source, then refuses with the engine discovery's plain reason. That reason is `ENGINE_DISABLED` while engines are off, and `WEIGHTS_ABSENT` with no pinned model. Even a pinned model would not run, because the recognizer worker is not implemented.
- **Not done:**
  - No whisper.cpp binary or model is pinned or bundled, and no real recognition is claimed or measured.
  - Consent and retention are not enforced here. The transcribe command takes no consent, because nothing runs. A recognizer that runs must apply YU-051's per-stage consent (`voice-clone` for a speaker's voice) before submission.
  - Stand-in segments are sound regions, not utterances.

## Deterministic media analysis: scene cuts (YU-071)

- **Source inspection.** On 2026-10-27, `ffmpeg -filters` on the bundled FFmpeg 7.1.1 (`vendor/ffmpeg-win64-r8`) listed these analysis and repair filters:
  - `scdet` (scene change)
  - `blackdetect` and `freezedetect`
  - `deshake`
  - the denoisers `hqdn3d`, `nlmeans` and `atadenoise`

  vid.stab is not in the build, so there is no two-pass stabilization. Only `scdet` is relied on and tested.

- **The first qualified operation: scene cuts.**
  - **Command.** `yamakan.analysis.sceneCuts` (scope `render:execute`) takes a project video asset and a threshold: a whole number from 1 to 100, default 10.
  - **Method.** It runs `scdet`, which measures the mean absolute luma difference between frames. There is no model and no randomness. It runs on the stored original, in an owned worker that may read only that file.
  - **Result.** It returns `yamakan.scene-cuts/v1:scdet`, the asset's hash, the threshold, and each cut, which has:
    - the frame a new scene starts on, counted at the project's rate, as the editor counts the asset's frames;
    - its time in ticks from the source's first frame;
    - scdet's score.
  - **Timing.** The graph converts timestamps to ticks (`settb`) and then counts them from the first frame (`PTS-STARTPTS`). A cut's time is therefore its frame's own timestamp, to the nearest tick, whatever the source's frame rate or start offset.
  - **No changes.** It writes no media and changes nothing, so the source, its timing and its sound are untouched by construction. There is no derivative to verify, and no restoration claim.
- **Bounds and refusals.**
  - **Concurrency.** One analysis runs at a time, and at most 2 wait; beyond that the request is refused as `BUSY`.
  - **Limits.** Each analysis is bounded:
    - at most 300 s;
    - the media worker's memory, reported as `LIMIT_EXCEEDED` when a worker is stopped at that limit;
    - at most 1,000 cuts and 1 MiB of analysis output, otherwise it asks for a higher threshold.
  - **Refused inputs.**
    - Stills and audio are refused.
    - A damaged stream fails as `MEDIA_INVALID`. A stream whose stored object does not match its size fails as `RECOVERY_REQUIRED`. Neither message contains a host path.
    - A frame time the parser cannot use refuses the whole analysis rather than dropping a cut.
  - **Cancellation.** A cancel that arrives before the analysis begins starts no worker, and one during it stops the worker (tested against the full scan's time). A cancelled request still holds its place in the queue until its turn. Running out of memory is recognised from the worker's peak use (95% of its limit or more). The command itself has no cancel signal yet: a client that disconnects leaves the analysis running to its bound.
- **Not covered.**
  - Denoise, deshake, black detection and freeze detection each need their own qualification.
  - No test removes `scdet` or simulates running out of memory.
  - A partial-output quarantine does not apply, because no output is written.
  - The editor does not show scene cuts yet.

## Bounded animation compilation (YU-022)

- **Compiler.** Opacity and volume animation compile with `yamakan.animation-compiler/2`, named in the render plan only when a clip is animated (other plans and their hashes are unchanged). Each output frame is sampled at its middle by the shared sampler, as before (from the two keys around it, which gives the same value as the whole channel); consecutive frames whose values agree within an explicit tolerance become one segment. Opacity's tolerance is one 8-bit alpha level (1/255), volume's 1/200 of unity gain (about 0.04 dB); every frame's value is within half a tolerance of the per-frame compiler (version 1). The tolerances belong to the version: changing them needs a new one.
- **Bounds.** A graph's size follows the curve's travel, not the clip's length: holds and steps are one segment per key, a full 0..1 opacity ramp is at most 256 segments however long (a ten-minute ramp was 18,000 per-frame filters), and a +6 dB volume ramp at most 400. Caps: 1024 segments per channel, 4096 per plan, and 600,000 sampled frames per plan (`LIMIT_EXCEEDED`). The filter graph is passed to FFmpeg as a file the worker may read, never on the command line.
- **Values.** Opacity keys are 0–1 and volume keys 0–16; a key outside is refused, and a curve's overshoot between keys is clamped to the range. A value that cannot be computed is refused, never replaced by a default.
- **Refused before rendering** (when the plan is compiled, so preview and export alike), naming the clip: animation of a channel the renderer does not draw (transform paths; `CAPABILITY_UNAVAILABLE`, so a project that stored such keys must remove them to preview or export), two keys of a channel at one time, keys out of range (`VALIDATION`), and a curve or plan past its cap. Each clip is checked for the channels it draws (opacity on a picture, volume on a sound), and a channel's check is remembered, so repeated previews do not repeat it. Preview windows are taken on the clip's own frame grid, so a window shows the frames the export shows.
- **Rollback.** `YAMAKAN_ANIMATION_COMPILER=1` makes new plans use the per-frame compiler (version 1) again, under the same range, clamp and frame-grid rules (it is per-frame sampling without merging; volume keys outside 0–16 and opacity keys outside 0–1, which rendered before YU-022, are refused under either version). The plan names the compiler it was rendered with, and an animated plan that names none is rendered with version 1. A first compile of a very large animated timeline samples up to 600,000 frames once; repeated previews reuse the result. Transform animation is a separate, later task.

## Caption tracks (YU-024)

- **Document.** A caption track is a creative document of its project (`captions`, schema 1). It holds:
  - a name, a language tag and a burn-in setting;
  - the imported file's text as received, decoded as UTF-8, with its SHA-256, which is checked;
  - timed cues: id, start and end in whole milliseconds, plain text, and the original index and timestamps.

  Cues are in time order and never overlap. A cue's text has no empty lines and no outer spaces.

- **Limits.**
  - At most 2,000 cues, each up to 500 characters and 4 lines.
  - An imported file of at most 512 KiB, with no cue reaching past ten hours.
  - The canonical document is at most 2 MiB and 20,000 JSON nodes.
- **Import.**
  - SRT (`hh:mm:ss,mmm`) and WebVTT (`[hh:]mm:ss.mmm`, header, NOTE blocks) parse to exact millisecond times.
  - These are refused, naming the line they are on:
    - a malformed timestamp or cue number, or a timing line over 256 characters;
    - a cue that ends before it starts, or cues that overlap;
    - SRT cue settings;
    - a cue with no blank line after the WebVTT header;
    - WebVTT STYLE and REGION blocks, which can load other files;
    - ASS override markup (`{\…}`), also when a tag hides it;
    - unknown tags;
    - empty or oversized cues;
    - a file without cues.
  - Simple formatting tags are removed and their text kept: `<b>`, `<i>`, `<u>`, `<s>`, `<c.x>`, `<v Name>`, `<lang x>`, `<ruby>`, `<rt>`, `<font …>` and inline timestamps. `<br>` becomes a line break.
  - Entities are decoded after tags are checked, so an escaped tag stays text. Lines left empty are dropped.
  - Cue ids are derived from the file, so a retried import replays instead of creating a second track.
- **Commands.**
  - `yamakan.captions.import`.
  - `yamakan.captions.save` changes cues, name, language or burn-in, and keeps the imported file.
  - `yamakan.captions.split` splits a cue at a whole-millisecond instant inside it. Each part can get its own text, and both keep the original cue's source.
  - `yamakan.captions.export` returns SRT or WebVTT text with times to the millisecond. Markup in cue text is written as entities in both formats, and a word joiner breaks `{\`. An export therefore reads back as the same text, never as a tag, a timing line or ASS markup.
  - Each write is a new revision, with compare-and-swap on the revision and on the track's content hash. The editor's draft follows it.
- **Captions panel** (Finish workspace).
  - It imports a file in a chosen language, edits cue times and text, splits a cue at the playhead, turns burn-in on, and downloads the track.
  - While cue edits are unsaved, other caption changes wait. Edits made from an older version of the track are set aside.
- **Burn-in.**
  - A track with burn-in on is drawn above every track through the title compiler (escaped plain text, pinned fonts), the same way in the reference preview and the export. Its cues are part of the render plan and its hash.
  - Saving a burned-in track with a character the pinned font cannot draw is refused, naming the cue.
  - Each burned-in track is its own layer, in the titles' style and place, so a caption and a title clip shown at the same time overlap.
  - Cues after the timeline's end are not shown.
- **Arabic quality.** Automated tests cover timing, escaping, mixed-script round trips and preview/export agreement. Reading quality needs a native reviewer, using the unsigned H1 packet in `docs/evidence/h1-arabic-review-packet/captions/`.
- **Rollback.**
  - The AG-DOCS switch turns caption writes off. Stored tracks, with their original files, stay readable and keep rendering.
  - The workspace database moves to version 14. Its document tables accept any kind the application validates, so new kinds need no further rebuild.
  - An earlier build refuses a version 14 workspace, so going back needs a backup from before the upgrade.
