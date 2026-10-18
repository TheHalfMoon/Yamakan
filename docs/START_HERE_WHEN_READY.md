# Start here when development is authorized

This is the single starting point for implementing the frozen Yamakan plan. **Do not start until the founder has authorized development in writing.** Merging the planning PR is not, by itself, that authorization. Until then, the plan stays frozen and nothing below runs.

## 1. Confirm authorization and scope

- **Record the authorization.** Add the founder's start instruction (date, title or words, scope) to [FOUNDER_DECISION_RECORD.md](FOUNDER_DECISION_RECORD.md) before the first implementation commit.
- **Default scope** if the founder names none: Track 1 (W1–W7), stopping when the M-gate is declared. Track 2 (W8–W18) needs the founder to say so, or a scope that includes it.
- **Never in scope without a separate explicit authorization:**
  - purchases, paid services or inference;
  - cloud spend or a public release;
  - code signing certificates;
  - model or weight downloads;
  - any real generative engine (gate E-SEC plus founder decisions F and G).

## 2. Verify the live repository against the freeze

1. `git fetch origin`, then record `origin/main`'s SHA and the open PRs (`gh pr list -R TheHalfMoon/Yamakan --state open`).
2. Compare them with the [freeze manifest](PLAN_FREEZE_MANIFEST.md):
   - main at the freeze (`6e471088…`);
   - PRs #29, #24 and #19 open at the freeze.
3. Check that the frozen planning documents are unchanged. Run the `sha256sum -c` block in the manifest from the repository root. A mismatch means the plan changed after the freeze: read the change and its decision record before continuing.
4. **Reconcile:**
   - For each task W1–W18, check whether main already contains it (search the merged PRs and `specs/CURRENT.md`). Mark done tasks done; never redo them.
   - If a starting file listed for a task has changed, re-read it, and adjust the task's instructions in its PR description.
   - If an external dependency changed (#29, #24 or #19 merged or closed), update the eligibility list.

## 3. Pick the first eligible task

Use the [dependency graph and tie-break](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#dependency-graph). At the freeze:

1. **W1** (a video clip's own sound) is first.
2. Then **W6**.
3. Then **W2** once PR #24 has merged.

The [first wave](research/rea-source-reuse/13_FIRST_IMPLEMENTATION_WAVE.md) lists the first ten PRs.

## 4. Execute each task

- **Follow its card** in [08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md): purpose, starting files, donor sources, instructions (running its Q test first), acceptance tests, checks, definition of done, rollback and next task.
- **For donor imports,** follow [04](research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) exactly:
  - import byte-identical at the pin first;
  - adapt in separate commits;
  - record every file in the provenance ledger.
- **Merge discipline:**
  - fresh independent combined and security reviewers;
  - CI success at the exact head;
  - `gh pr merge N --merge --match-head-commit <sha>`;
  - a tree-equality check after merging;
  - normal merges only, never force-push, credentials per command.

## 5. Gates that stay open until they genuinely run

These are execution-time requirements. They do not block starting.

| Gate                                                                                                 | Owner                                   | Blocks                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| H1 native Arabic review of title goldens and UI strings                                              | Founder or a reviewer the founder names | Release; W12              |
| H2 clean Windows Profile A run with the network disabled and a packet capture                        | Administrator                           | Release                   |
| H3 a real second Windows account denied, and a restore on a second clean profile                     | Administrator                           | Release                   |
| H4 real constrained-volume disk-full runs                                                            | Administrator                           | Release                   |
| H5 artifact-bound ship decision after an independent release review                                  | Founder                                 | Release                   |
| E-SEC engine security gate ([04](research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) M13) | Engine builder and security reviewer    | Any real engine run       |
| F local AI hardware and weights; G paid providers                                                    | Founder                                 | Real engines; paid routes |

## 6. The prompt

[FUTURE_CLAUDE_EXECUTION_PROMPT.md](FUTURE_CLAUDE_EXECUTION_PROMPT.md) is the complete prompt the founder pastes to begin.
