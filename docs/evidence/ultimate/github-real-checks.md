# Real checks on GitHub's own machine

The founder answered "Yes, use GitHub" to running the blocked real checks on GitHub's own machines ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-blocked-real-checks-may-run-on-githubs-own-machines)). They are `.github/workflows/real-checks.yml`.

## Result

Run 45192954429, commit `140bbfb295343158a66b45ee55091bbe2c9d1898`, on GitHub's `ubuntu-24.04` machine: the real service, FFmpeg from the machine's packages, and Microsoft Edge 157.0.4341.60, which the machine has. All four ended PASS. The receipts beside this file are as the log printed them; the workflow's log is the source.

| Check                    | Cards           | Receipt                                                                         | Steps    |
| ------------------------ | --------------- | ------------------------------------------------------------------------------- | -------- |
| `qualify:revisable-shot` | MPR-101         | `MPR-101-take-record-receipt.json`                                              | 4        |
| `qualify:create-durable` | MPR-101         | `create-durable-github-receipt.json`                                            | 9        |
| `qualify:take-review`    | SS-006, MPR-105 | `take-review-github-receipt.json` and `MPR-105-split-shot-replace-receipt.json` | 14 and 4 |
| `qualify:consent-gate`   | MPR-010         | `consent-undo-pinned-take-github-receipt.json`                                  | 4        |

The first four-step receipt and MPR-105's name their host (`linux`). The other three receipts name the commit and not the host; this file does.

## What it does not show

- **Nothing of the Windows sandbox or of the founder's computer.** On Linux a media worker runs without the native helpers (`posix-unqualified` in `core/process/owner.ts`). On GitHub's Windows machine every sandboxed worker ended as it started, with Windows status 0xC0000142, and the four checks and the sandbox's own tests failed there (run 45190159942, commit `165916e`). Why is not proven; the sandbox was not loosened.
- **No model and no Blender ran.** The generated video of these checks is a test pattern. `qualify:director-cinema` and the Blender take record stay BLOCKED.
- **No Arabic review and no person's acceptance.** The labels are checked to be there, not to be right.
- **Whether a card may be VERIFIED on this host** where its text names none was not put to the founder.
