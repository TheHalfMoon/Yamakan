# Local ComfyUI engine adapter

Builder: Claude Opus, 2026-11-05. Founder authorization: see `docs/FOUNDER_DECISION_RECORD.md`. **No AI output was generated, and no model is enabled.** `ENGINE_ENABLED` stays `false`, no recipe is pinned, cloud providers stay off.

## What exists now

`core/engines/comfyui.ts` implements the existing `EngineAdapterV2`. It speaks only to `127.0.0.1` or `[::1]` by number, follows no redirect, and runs only graphs the server owns: a request names a recipe, hash and model manifest, and fills that recipe's bindings. While off it does no IO. It is not yet wired to any command or to the browser, so **a person cannot generate anything yet.**

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

`tests/comfyui-engine.test.ts`, 18 tests against a fake server on a real port, also covers: addresses other than loopback, a redirect-free client, recipes with no qualification, a graph or URL in a request, outputs beyond a recipe's limits, stale generations, a path outside the output folder in history, temporary previews not counted, and real socket progress for only this execution.

**Found by the real run:**

- **Frame rate is not exact.** At 24000/1001, ComfyUI's `CreateVideo` wrote `2997/125`, not the rational asked for, because it takes a decimal. The frame count is right, but a generated clip's timing needs conforming on import. Not fixed here.
- **A rejected value was reported as missing weights.** Fixed: only a missing node or model file is `WEIGHTS_ABSENT`.
- `EmptyImage` caps a batch at 4,096 frames, and 13 GiB of frames exceeded this host. Real recipes must declare limits they were measured at.

## This host cannot qualify a video model

Measured 2026-11-05: Intel UHD Graphics with no discrete GPU, 15.7 GiB RAM, 18.2 GiB free on C:, and 17.4 GiB on D:. The heaviest stack surveyed, MiniMax H3, was reported by its own project at about 98 GB of models on a 16 GB NVIDIA card. **No video model has been downloaded, run or qualified here, and none is likely to run usefully on this host.** Qualifying one needs a machine with a suitable GPU, or a founder decision about which small CPU model is worth trying.

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
- Cancelling a running job uses ComfyUI's targeted interrupt. ComfyUI checks between steps, so a long step may finish first, and `localProcessExited` is always false since Yamakan does not own that process. Input files uploaded to ComfyUI are not deleted, since it offers no way to.

## Not done

A command or browser path to generate; a pinned recipe; any model; progress during a real model run; ownership of the ComfyUI process (start, stop, process-tree limits); conforming a generated clip's frame rate; publishing an output as a project asset with consent and lineage; running on a GPU.

Reviews: see the pull request.
