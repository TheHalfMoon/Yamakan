# MPR-204: the gates

Nothing is sent to Kaggle, and none of its allowance is used, unless a person has approved exactly that. Part a recorded the approvals; part b is where they are asked for. `docs/SECURITY.md` says what they cover and what they do not.

## What was found (step 0)

At `245b079`, by reading: no `gate_approvals` table, no `core/gates.ts` and no `yamakan.gates.*` command; `kaggleCli` and `start` had no permission check, and `WORKSPACE_SCHEMA_VERSION` was 18. A service with a Kaggle CLI and no approval would start a run: with either choke point taken out, the test 'no approval, no process' or the ones after it fail.

## How it was read where the card leaves room

- **`permit` is given the run and its recipe.** The card's `worstCaseSeconds` and `bytesUpperBound` are the permit's own to know: it is made where the recipe's time limit is.
- **`consumeGates`** counts both gates of a run in one transaction, where the card had one call for each.
- **A refusal while a run is being sent** is told apart from an answer of the CLI by the error itself, so that it is never taken for a run that may have left, nor an ended run for a failed one.
- **The page starts the run even with no approval,** and shows the service's refusal: the service decides, not the page.
- **One press records both approvals.** They are two commands: if the second fails, the first stands, is listed and can be taken back.
- **The page proposes one run and one hour.** A run takes about twenty minutes and may take longer; when the hour ends it is followed no more until a person approves again.
- **OA-20** closes an approval for every contact under other network settings, and putting them back opens it again.

## What to know

- A person who already uses the Kaggle route is asked once, and again after each end, limit, restore or change of those settings.
- A use is counted before the send and is never given back, also when Kaggle refuses the run.
- A run started before this has no use row. It is followed while contacting is approved and counts against no limit.
- The Arabic words are unreviewed.
- The list of outbound call sites is a search of the text of `core`, `server`, `cli` and `mcp`.

## Not covered

- Real Kaggle: the optional real run of `qualify-kaggle-generation.mjs` needs FD-3 and quota, so it is BLOCKED. Its scripts ask for the approvals now; they were not run.
- `qualify:kaggle-screens` was changed to approve through the page first. On the founder host its first eleven steps pass, the approvals among them, and it then stops where a video is brought in: the media worker does not start in that host's sandbox (ledger 12). It is not a PASS.
- Two processes racing for one approval: one connection holding the database is tested, and two starts at once in one service.

## The check

`npm run qualify:gates`: **PASS** at `7d01c7a584d0e85fe5893a84c9ac56fc017292f5`, with a clean checkout. Host: `{"platform":"win32","githubImage":null,"freeDiskBytes":13776101376,"freeMemoryBytes":4493176832,"onAcPower":true,"load":null,"need":"unmeasured"}`.

- with no approval the page says what would be allowed, one run and one hour.
- with no approval the start is refused on the page, and the stand-in was not started.
- an agent's token is refused the approval and the list.
- one press approves both, the start is sent once, and one run is counted.
- taken back, two intervals pass with no start of the stand-in, and the page says why.
- a new approval resumes following the same run, with no second push.
- under a proxy that came since, nothing is contacted and the page asks again.
- the page turns right to left in Arabic, whose words are unreviewed.
- no external requests and no page errors.
