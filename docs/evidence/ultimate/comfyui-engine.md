# Local ComfyUI engine adapter

Builder: Claude Opus, 2026-11-05. Founder authorization: see `docs/FOUNDER_DECISION_RECORD.md`. **No AI output was generated, and no model is enabled.** `ENGINE_ENABLED` stays `false`, no recipe is pinned, cloud providers stay off.

## What exists now

`core/engines/comfyui.ts` implements the existing `EngineAdapterV2`. It speaks only to `127.0.0.1` or `[::1]` by number, follows no redirect, and runs only graphs the server owns: a request names a recipe, hash and model manifest, and fills that recipe's bindings. While off, no call does IO. It is not yet wired to any command or to the browser, so **a person cannot generate anything yet.**

## Real run

`npm run qualify:comfyui`, against ComfyUI v0.44.0 (`2c75dc1b379a59e0880619d029607af5169a62ef`) on CPU with Python 3.12, installed outside the repository, using core nodes and no weights. Each output is a solid colour built from `EmptyImage` or an uploaded still, so this qualifies the path, not any model.

| Step                   | Result                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Setup check            | Every core node found; a missing node and a missing model are each named, and report `WEIGHTS_ABSENT` |
| 30 fps                 | Real H.264 MP4, 64×36, 30 frames, first frame `255,1,0`                                               |
| 24000/1001             | Real H.264 MP4, 64×36, 48 frames, first frame `255,1,0`                                               |
| Upload                 | A still reached `LoadImage` through ComfyUI's upload; MP4 with 30 frames, `1,0,253`                   |
| Input failing its hash | Not submitted                                                                                         |
| Cancel                 | A running job was interrupted, ended `cancelled`, and left no output                                  |

`tests/comfyui-engine.test.ts`, 31 tests against a fake server on a real port, also covers: addresses other than loopback, a redirect not followed, recipes with no qualification, a graph or URL in a request, outputs beyond a recipe's limits, stale generations, a path outside the output folder in history, temporary previews not counted, and real socket progress for only this execution.

**Added after review:** `comfyLaunchArguments` gives ComfyUI's arguments, on loopback with `--offline` and no custom nodes; nothing calls them outside the qualifier yet. `--offline` turns partner nodes off and restricts ComfyUI's browser page. **It is not an egress block on ComfyUI's process.** A recipe using a partner node reports `cloud-node` and is not available, judged by ComfyUI's flag or by the module the node came from, since a review found a partner node, `Krea2StyleReferenceNode`, that uploads images without setting the flag. The real run shows no such node with `--offline`, and as a control, finds them without it, including that one. Measured: 690 nodes with `--offline`; 1,035 without, of which 345 are partner nodes.

A submit whose answer is lost stays followed by its id and reports `unknown`, and the same generation replays it. **A new generation can still overlap it:** if `/prompt` times out, ComfyUI can enqueue the job afterwards, the cancel finds nothing, and both run. A real timeout was not provoked; tests use an unreadable answer.

**Proposed by the builder, not decided by the founder: Yamakan does not own ComfyUI's process.** Its worker sandbox allows no network and no GPU (`core/process/owner.ts`), and ComfyUI is a server that needs a loopback socket and, for a real model, a GPU, so owning it there would widen a security boundary. **This moves the exposure rather than removing it: a copy a person starts has no Yamakan sandbox at all**, no memory limit, and no process Yamakan can stop or confirm stopped. This departs from `docs/LOCAL_INFERENCE.md`, the job contract for model operations, `docs/IMPLEMENTATION_PLAN.md`'s isolated ComfyUI, and `docs/review/CLAUDE_INDEPENDENT_REVIEW.md`, which requires a Job Object before a local inference worker is enabled. **It must be settled before this is enabled.** Nothing here is enabled or wired.

So a person starts ComfyUI, and the adapter reads the arguments it reports, at each setup check and again at each submit since it may have been restarted. A copy without `--offline` and `--disable-all-custom-nodes`, with `--whitelist-custom-nodes`, `--enable-manager`, `--enable-agent`, `--enable-cors-header` or `--front-end-version`, or listening beyond loopback, is `not-started-locally` and not used. The check allows for `--flag=value`, shortened flags and a repeated `--listen`. It reads arguments only: an environment variable, or a model folder configured by `extra_model_paths.yaml`, would not show. A spelling it does not recognise, such as `--offl` or the deprecated `--disable-api-nodes`, is refused, which fails closed. **The reported arguments are ComfyUI's own word, not proof:** another program on that port could say anything.

Cancelling on a copy the person also uses is limited: ComfyUI checks and then interrupts, so an interrupt could land on the person's next job.

**Found by the real run:**

- **Frame rate is not exact.** At 24000/1001, ComfyUI's `CreateVideo` wrote `2997/125`, not the rational asked for, because it takes a decimal. The frame count is right, but a generated clip's timing needs conforming on import. Not fixed here.
- **A rejected value was reported as missing weights.** Fixed: a value ComfyUI rejects is `INVALID_REQUEST` unless it is a missing node or a model file a recipe names. A copy started the wrong way is `ENGINE_DISABLED`. An unreachable ComfyUI, or a recipe not checked yet, also reports `WEIGHTS_ABSENT`, which is coarse.
- `EmptyImage` caps a batch at 4,096 frames, and 13 GiB of frames exceeded this host. Real recipes must declare limits they were measured at.

## This host cannot qualify a video model

Measured 2026-11-05: Intel UHD Graphics with no discrete GPU, 15.7 GiB RAM, 18.2 GiB free on C:, and 17.4 GiB on D:. `backlot` reports about 98 GB of required models and a 16 GB NVIDIA card for MiniMax H3, the heaviest stack surveyed; this was not measured here. **No video model has been downloaded, run or qualified here, and none is likely to run usefully on this host.** Qualifying one needs a machine with a suitable GPU, or a founder decision about which small CPU model is worth trying.

## Sources checked

Read only, nothing from them was executed. Revisions are the commits inspected.

| Repository                       | Revision                                   | Licence at root | Decision                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D3voz/openjutsu`                | `7fe118bb5a61fcfac0148e1bfea3dd29884dbf26` | MIT             | The setup check's approach is followed and rewritten, with its notice. Its client is not taken: it has no socket or direct cancel, and has a cloud fallback. Its `face` workflow needs non-commercial and AGPL weights |
| `codyclack/opensfield`           | `a9c762d9d0ef3e3b6e01099b7e247370d49fcf2c` | MIT             | Nothing yet. Camera and lighting vocabulary is a candidate; its graphs derive from another project whose licence is unrecorded. Its catalogue follows another product's list and is not taken                          |
| `Arfolomew/backlot`              | `c28a493417aa884da1e1380fbae53883be041b6c` | MIT             | Nothing yet. `cinema.json` and `moves.json` are candidates, tuned to one model. A graph needing a GPL-3.0 node pack is not taken                                                                                       |
| `Anil-matcha/Open-Generative-AI` | `4998b37bb59da69a6bcc832ca6b42a275e852224` | MIT             | Nothing yet. Most of it is a front end to a paid cloud API, which is not taken                                                                                                                                         |
| `wide-trace/open-higgsfield`     | `b16a0efe4d7e2707b56f8ccb02387fd2a9d2eddf` | **None found**  | **Not copied, and no code was fetched:** without a licence there is no right to copy it                                                                                                                                |

Licences at root were read through GitHub's API and do not settle what a file's own origin, a model or a node pack allows. This is not legal advice.

ComfyUI is GPL-3.0. Yamakan talks to a separately installed copy over HTTP and bundles none of it. Whether that is enough for any distribution of Yamakan is a question for a lawyer, recorded here for the release decision.

## Decisions to overrule

- The brand rule bans the name ComfyUI as a donor product. Three files are excepted by exact path, since this adapter must name what it talks to; a user-visible use elsewhere still fails.
- Cancelling a running job uses ComfyUI's targeted interrupt. ComfyUI checks between steps, so a long step may finish first, and `localProcessExited` is always false since Yamakan does not own that process. Input files uploaded to ComfyUI are not deleted: its assets API can delete when enabled, which was not tried. An interrupt can arrive after ComfyUI's last check, so a cancelled job can still succeed; `remoteOutcome` stays `unknown` for this reason, and the service must fence publication.

## Not done

**Required before this is wired to anything:** the founder settling process ownership, above; bounding how long a job may stay `unknown`, and closing the late-enqueue overlap above; and a decision on an allowlist of node classes. Pinned recipes may make that allowlist unnecessary, but a pinned recipe can only be trusted if each of its nodes was read, and whether other unflagged nodes reach the network by another route was not fully checked. A command or browser path to generate; a pinned recipe; any model; progress during a real model run; conforming a generated clip's frame rate; publishing an output as a project asset with consent and lineage; running on a GPU.
