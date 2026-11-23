# Real checks on GitHub's own machine

The founder answered "Yes, use GitHub" to running the blocked real checks on GitHub's own machines ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-blocked-real-checks-may-run-on-githubs-own-machines)). They are `.github/workflows/real-checks.yml`.

## Result

Run 45197050458, commit `88063220f4ef0f22a03ed1324cab6c290f84a0a9`, on GitHub's `ubuntu-24.04` machine (image 20261116.376.1), with FFmpeg 6.1.1 from Ubuntu's packages, which the job installs (not the pinned Windows build). All four ended PASS. `qualify:revisable-shot` uses the real store, job table and commands in one process, with the stand-in engine and no browser. The other three use the real service and Microsoft Edge, which the machine has: 157.0.4341.60 by a step of its own, as the receipts do not name it. The receipts beside this file are as the log printed them; the workflow's log is the source.

| Check                    | Cards           | Receipt                                                                         | Steps    |
| ------------------------ | --------------- | ------------------------------------------------------------------------------- | -------- |
| `qualify:revisable-shot` | MPR-101         | `MPR-101-take-record-receipt.json`                                              | 4        |
| `qualify:create-durable` | MPR-101         | `create-durable-github-receipt.json`                                            | 9        |
| `qualify:take-review`    | SS-006, MPR-105 | `take-review-github-receipt.json` and `MPR-105-split-shot-replace-receipt.json` | 14 and 4 |
| `qualify:consent-gate`   | MPR-010         | `consent-undo-pinned-take-github-receipt.json`                                  | 4        |

Every receipt names its commit and what the machine had first; three of the five do not say whether the checkout was clean, which a fresh one is (`githubImage` is the image's short name). Two earlier runs passed too, at `140bbfb` (45192954429) and `110ca19` (45194764272); three of their receipts named no host, which the common contract asks for, so they are not the ones kept.

## What each card still waits for, as far as it is known

The cards' lists of requirements were read for this; their other open items are in their own evidence files.

- **MPR-010 is not met by this.** Its text names the Windows host, for the browser run and for a time to be measured. On GitHub's Windows machine it failed, and on the founder's computer it is BLOCKED. The pinned-take finding stays open.
- **MPR-101:** FD-2 is not answered, and its Definition of Done asks for the answer to be on record. Its Blender arm is BLOCKED, which its text allows to be recorded so.
- **MPR-105:** its text also has `qualify:director-cinema` run, to show that the Cinema placement needs no change. That needs Blender and is BLOCKED. Its Arabic string is unreviewed, and its departures from the card are listed in its evidence.

The founder answered that a card whose text names no computer may be VERIFIED on results from GitHub's machine ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-a-card-that-names-no-computer-may-be-verified-on-githubs-results)). That verifies none of them by itself.

## What it does not show

- **Nothing of the Windows sandbox or of the founder's computer.** On Linux a media worker runs with no sandbox and no job object, which `core/process/owner.ts` calls a development fallback, never qualified. On GitHub's Windows machine (run 45190159942, commit `165916e`) three tests of a sandboxed worker ended with 3221225794 (0xC0000142), 5 of the 14 sandbox and probe tests failed, and all four checks failed, with a media probe, an upload or a page timeout; the cause is likely the same and is not proven. The sandbox was not loosened.
- **No model and no Blender ran.** The video of these checks is a test pattern. `qualify:director-cinema` and the Blender take record stay BLOCKED.
- **No Arabic review and no person's acceptance.** The labels are checked to be there, not to be right.
- **Not a check of every change:** the workflow runs when one of its own files changes, or when a person starts it.
