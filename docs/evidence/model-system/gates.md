# MPR-204: the gates

Nothing is sent to Kaggle, and none of its allowance is used, unless a person has approved exactly that. Part a recorded the approvals; part b is where they are asked for. `docs/SECURITY.md` says what they cover and what they do not.

## What was found (step 0)

At `245b079`, by reading: no `gate_approvals` table, no `core/gates.ts` and no `yamakan.gates.*` command; `kaggleCli` and `start` had no permission check, and `WORKSPACE_SCHEMA_VERSION` was 18. A service with a Kaggle CLI and no approval would start a run: with either choke point taken out, the test 'no approval, no process' or the ones after it fail.

## How it was read where the card leaves room

- **`permit` is given the run and its recipe.** The card's `worstCaseSeconds` and `bytesUpperBound` are the permit's own to know: it is made where the recipe's time limit is.
- **`consumeGates`** counts both gates of a run in one transaction, where the card had one call for each.
- **A refusal while a run is being sent** is told apart from an answer of the CLI by the error itself, so that it is never taken for a run that may have left, nor an ended run for a failed one.
- **The page starts the run even with no approval,** and shows the service's refusal: the service decides, not the page.
- **One press records both approvals.** They are two commands: if the second fails, the first stands, is listed and can be taken back. To follow a run only contacting is asked for, with no bytes to send, so no run can be sent under it, whatever is left of the allowance.
- **The page lists the newest approval of each kind,** also when its runs are used up, since it still lets a run be followed until it ends; no new run or contact is allowed by an older one. What the person was shown of the network settings is sent with the approval, and other ones are refused.
- **The page proposes one run and one hour.** A run may take an hour and wait in a queue before it; when the hour ends it goes on at Kaggle and is followed no more until a person approves again, which the page says before the press.
- **OA-20** closes an approval for every contact under other network settings, and putting them back opens it again.

## What to know

- A person who already uses the Kaggle route is asked once, and again after each end, limit, restore or change of those settings.
- A use is counted before the send and is never given back, also when the engine or Kaggle refuses the run. Both approvals it was counted on are asked about again just before the push.
- A CLI that is already running when an approval closes is not stopped.
- A run started before this has no use row. It is followed while contacting is approved and counts against no limit.
- The Arabic words are unreviewed.
- The list of files with outbound call sites, and their number in each, is a search of the text of `core`, `server`, `cli` and `mcp`.
- **Tests made with the computer's temporary folder could remove a person's old run folders:** an engine tidies folders of runs older than a day that its own workspace does not know, and several tests gave it the real folder (some since 2026-11-06, on main). The test files that did have a folder of their own now (`tests/fixtures/own-temp.ts`), one that MPR-103 brought to main on 2026-11-24 included (`tests/take-revision.test.ts`, found by the review of the merge). Whether one was removed on the founder host cannot be told; none was there when this was found, nor on 2026-11-24.

## Not covered

- Real Kaggle: the optional real run of `qualify-kaggle-generation.mjs` needs FD-3 and quota, so it is BLOCKED. Its scripts ask for the approvals now; they were not run.
- `qualify:kaggle-screens` was changed to approve through the page first. On the founder host its first eleven steps pass, the approvals among them, and it then stops where a video is brought in: the media worker does not start in that host's sandbox (ledger 12). It is not a PASS.
- Two processes racing for one approval: one connection holding the database is tested, and two starts at once in one service.

## The check

`npm run qualify:gates`: **PASS** at `dc46bc436f11dd8be01ae3576d8a494b09fbaf50`, with a clean checkout. Host: `{"platform":"win32","githubImage":null,"freeDiskBytes":9380724736,"freeMemoryBytes":3904860160,"onAcPower":true,"load":null,"need":"unmeasured"}`.

- with no approval the page says what would be allowed, one run and one hour.
- with no approval the start is refused on the page, and the stand-in was not started.
- an agent's token is refused the approval and the list.
- one press approves both, the start is sent once, and one run is counted.
- taken back, two intervals pass with no start of the stand-in, and the page says why.
- a new approval resumes following the same run, with no second push.
- under a proxy that came since, nothing is contacted and the page asks again.
- the page turns right to left in Arabic, whose words are unreviewed.
- no external requests and no page errors.
