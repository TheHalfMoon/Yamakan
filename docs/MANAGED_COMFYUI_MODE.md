# Managed ComfyUI Mode: design

**Status: proposed, not built or approved.** Requested by the founder on 2026-11-05 as the long-term aim, so that a person need not manage ComfyUI by hand. Building or enabling it needs its own security qualification and founder approval. Today a person starts ComfyUI, which the founder approved as a temporary integration. See `docs/evidence/ultimate/comfyui-engine.md`.

## What it would do

Yamakan installs, starts, monitors and stops one qualified local ComfyUI, with the person's explicit consent at each step that downloads or runs something new. Offline editing never depends on it: if it fails, the editor still works.

## The hard problem

Yamakan's worker sandbox allows no network and no GPU (`core/process/owner.ts`). ComfyUI is a server, so it needs a socket, and a real model needs a GPU. A plain AppContainer with `network: none` cannot host it. Each option below widens something, and none has been tried.

| Option                                                             | Gains                                                                       | Costs                                                                                      | Unknown                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| A: new worker profile, Job Object plus loopback capability and GPU | Process tree, memory and stop are owned; closest to today's model           | Widens the sandbox; an AppContainer loopback exemption can also reach other local services | Whether CUDA and DirectML work inside it at all |
| B: Job Object only, no AppContainer                                | Stop, memory limit and tree ownership, and probably simplest to get working | Files and network as the user, so a malicious node or model has the user's reach           | How much a firewall rule can narrow the network |
| C: a local virtual machine or container with GPU passthrough       | Strongest isolation                                                         | Heavy, Windows GPU passthrough limits, and setup friction that defeats the aim             | Whether ordinary hardware qualifies             |

**Proposal to test first: option A,** falling back to B only with a per-install firewall rule and the founder's approval. C stays out unless both fail qualification.

## Requirements any option must meet

- **Install:** exact pinned ComfyUI revision and hash-locked Python packages, into a Yamakan-owned folder, verified before every start. No package is installed at run time. ComfyUI's manager and custom nodes stay off.
- **Models:** each named with exact file, source, size, hash and licence, downloaded only after the person agrees to that file, and refused if the hash differs. No scanning of other folders. Pickle checkpoints are refused.
- **Start:** `comfyLaunchArguments`, on a random loopback port, with an owned secret if ComfyUI can check one. It must be proven that no other local program can drive it.
- **Network:** blocked by the operating system, not only by `--offline`, which is not an egress block. Tested by attempting a connection from inside.
- **Limits:** memory, processes, disk and wall time enforced by the Job Object. These are new limits for a new worker, and need the founder's decision while limits stay frozen.
- **Stop:** a cancel confirmed by process exit, so the job contract's cancelled-only-after-exit holds again. A hang is killed, and the whole tree dies with Yamakan.
- **Privacy and consent:** media reaches it only through the engine contract, by hash, after a consent check. Nothing leaves the machine. Its input and output folders are cleared after each job.
- **Failure:** a crash reports plainly, offers a restart, and never affects the project.

## Qualification before any approval

1. Whether a GPU can be used at all inside option A, on real hardware.
2. A connection attempt from inside to the internet and to another local service, both refused.
3. A hostile node, in a test build only, cannot read outside its folders or outlive a stop.
4. Kill tests: Yamakan, the owner and ComfyUI each killed mid-render, leaving no process and no partial asset.
5. A real render at measured peak memory and time, on a named machine.

## Licensing, for a lawyer before any release

ComfyUI is GPL-3.0 in the copy inspected, and depending on how it is packaged, distributing it with Yamakan may bring obligations for Yamakan itself. The founder states they have full legal permission to copy and rename it, on terms not shared with the builder. A managed install downloads a separate copy and need not rename or bundle anything, which keeps that question smaller. Any copy keeps its visible notices. Each model has its own licence.

## Not decided here

Which option is approved, new resource limits, which models, whether a bundled copy is wanted over a managed download, and the release decision, which stays NO-GO.
