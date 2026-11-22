# Product Experience and User Journeys

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document evaluates the interface Yamakan has today and says what should change so that five
kinds of user can do real work in it. It keeps the existing design. Every recommendation extends a
workspace, panel or command that already exists and names the card that would build it.

Related documents: the thesis and the editability ladder are in
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md); the code facts used here are
in [02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md); the cards are in
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md).

## 1. Method and limits

- **Source of the baseline.** The interface was assessed by reading the browser code at the
  baseline commit and the committed qualification receipts. No session with a real user was run
  for this document, and no screen was measured for task time.
- **What that means.** Statements about what is hard, hidden or confusing are design judgements
  from code. They are hypotheses for the formative usability study in
  [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) section 7, not findings. No
  card in this plan runs that study.
- **Human review that remains open.** Native Arabic review and human usability review are the
  external item X-01 in the System Supremacy registry. Nothing here closes it.
- **No wholesale redesign.** The four-workspace shell was built under YU-030, and its remaining
  qualification is carried by SS-011. The gaps found below are mostly controls that are missing
  for commands that already work, and records that live in the wrong place. Neither needs a new
  layout.

## 2. The interface today

### 2.1 The shell

The shell is `src/workspaces/ProjectShell.tsx`. It defines four workspaces in a fixed order, opens
on Edit, remembers the last workspace per browser, keeps a workspace mounted once it has been shown
so that moving between them discards nothing, and mirrors its tabs for right-to-left text. The
earlier two-tab shell remains reachable with `?shell=classic`. The page has two languages, English
and Arabic, switched from the header (`src/i18n.ts`).

| Workspace | What it holds at the baseline | Main source |
|---|---|---|
| Create | Prompt and brief, prompt library and presets, model choice, Elements and People (reference packs and consent), the generation list with start, follow, stop, dismiss and bring-in, video import, and "place on the timeline" | `src/create/CreateWorkspace.tsx`, `src/create/GeneratePanel.tsx`, `src/create/ElementsPanel.tsx`, `src/create/PeoplePanel.tsx` |
| Story | A scene list with name, focal length, shot scale and camera movement; the Cinema previs viewport and the Blender render panel; the Director stages inside a collapsed section | `src/main.tsx`, `src/cinema/CinemaViewport.tsx`, `src/cinema/BlenderRender.tsx`, `src/director/DirectorPanel.tsx` |
| Edit | Preview, timeline and inspector; Studio opens from here as a panel | `src/main.tsx`, `src/reference.tsx`, `src/studio/StudioCanvas.tsx` |
| Finish | Output frame size and length, captions, and the agent tools and command catalog inside a collapsed section | `src/main.tsx`, `src/captions.tsx`, `src/agent-access.tsx` |

Above the workspaces sit the project list with history and recovery, a top bar with undo, redo,
save and the single Export button, and a job tray that shows the one export job from any
workspace.

### 2.2 What works and should be kept

| Property | Why it matters | Evidence |
|---|---|---|
| One project behind every workspace | A person can start in Create and finish in Edit without an import step | every panel reads and writes the same project through the command registry |
| Work is not lost on a workspace change | Drafts, an open Studio document and a running Director stage survive moving between tabs | `WorkspacePanel` keeps a shown workspace mounted |
| Undo is scoped to the writer | A person's undo never removes an agent's step, and the reverse | the top bar calls `yamakan.project.undo`, which undoes only that writer's steps |
| Honest unavailability in Create | When no model route can run, the page says so and still allows import and editing | `yamakan.engines.capabilities` and the `create.engineOff` message |
| Consent sits beside the reference | A person's image cannot be sent without a recorded consent, and the control is on the same panel | `src/create/PeoplePanel.tsx`, `yamakan.consent.grant` |
| Recovery is in the product | History, restore to a revision, backup and restore are reachable from the project list | `yamakan.project.history`, `yamakan.project.restore`, `yamakan.workspace.backup`, `yamakan.workspace.restore` |
| A generation survives a restart | A run started in Create is recorded before it is sent and is followed after the service restarts | `docs/evidence/ultimate/kaggle-restart-run-receipt.json` |

### 2.3 What exists but cannot be reached

These capabilities work as commands and have tests, but a person using the browser cannot use
them. An agent can. This is the largest gap between what Yamakan does and what a user sees.

| Capability | Where it is today | Effect on the user | Card |
|---|---|---|---|
| Ripple delete, ripple trim, insert, group move | `yamakan.timeline.rippleDelete`, `yamakan.timeline.rippleTrim`, `yamakan.timeline.insert`, `yamakan.timeline.groupMove`; helpers in `src/edit-ops.ts` are not used by the page | An editor closes every gap by hand | MPR-601 |
| Clip speed, LUT, sound unlink and relink | `yamakan.clip.setSpeed`, `yamakan.lut.import`, `yamakan.clip.unlinkSound`, `yamakan.clip.relinkSound` | No retime, no look, no split edits | MPR-602 |
| Loudness normalisation, batch export | an option of `yamakan.export.video`; `yamakan.export.batch` | One export profile and no settings | MPR-603 |
| Interchange and its loss report | `yamakan.project.exportOtio`, `yamakan.project.otioLosses` | No hand-off to a finishing tool from the page | MPR-603, MPR-702 |
| Take comparison | `yamakan.take.compare` | Takes are chosen without a side-by-side view | Not in this plan's cards; comparison in the editor stays with SS-011, and MPR-104 opens the existing take review from the shot card |
| Take review | `src/director/TakeReview.tsx`, inside the collapsed Director section | The control that replaces a shot is where a filmmaker will not look | MPR-104 |
| Scene-cut analysis | `yamakan.analysis.sceneCuts` | An imported multi-shot clip stays one object | Not in this plan; remains command-only |
| Match-move and aerial view | `yamakan.blender.track`, `yamakan.track.read`; the render accepts an aerial view | The Blender panel has no control for either | MPR-403 for the aerial view, as a field of the shot's stored camera; a match-move control is not in this plan and remains command-only |
| Progress and hand-off view for agent work | `yamakan.progress.read`, `yamakan.handoff.read` | A person cannot see what an agent did except as revisions | MPR-302 (the plan view), MPR-506 (an activity list per agent); a hand-off view is not in this plan and `yamakan.handoff.read` remains command-only |

### 2.4 What can mislead or lose work

| Observation | Why it is a problem | Card |
|---|---|---|
| The Create brief is kept in the browser's `localStorage`, not in the project | It is lost when browser data is cleared, absent from a backup, and invisible to an agent | MPR-106 |
| Each generated video becomes a new shot in a story titled "Made in Create" | A second attempt at the same shot is not a second take; it is an unrelated shot | MPR-102, MPR-104 |
| A take records its seed, steps and model as a free-text label and its prompt in the shot notes | Nothing can be revised "from this take" by changing one field | MPR-101, MPR-103 |
| A shot that has been split or trimmed into more than one clip can no longer be replaced | The first edit an editor makes removes the product's main revision path | MPR-105 |
| The tick that says the prompt may leave the PC is checked only in the browser | The page shows a gate that the service does not enforce | MPR-204 |
| The control on a Kaggle run cannot stop the remote notebook | The page already labels it "Stop following" and says the run keeps using quota (`src/i18n.ts`). What is missing is what is known about the quota, and whether a stopped or failed run may still use it | MPR-205, MPR-207 |
| The only estimate is a fixed expected duration per recipe | A person cannot see quota use or a range before starting | MPR-203 |
| Blender renders in progress are tracked in page memory | A reload loses the list; the job continues unseen | Not in this plan; MPR-507 adds a stored queue, a position and cancel, and no card makes the page's own list survive a reload |
| Blender refuses a second render instead of queueing it | The person must wait and try again by hand | MPR-507 |
| Director is a collapsed diagnostic panel of manual stages | The pipeline that plans a production reads as a debug tool | MPR-302 |
| Agent access is under a collapsed "agent tools" section in Finish | A person who wants to supervise an agent has no place that shows requests, spend or history | MPR-504, MPR-505, MPR-506 |
| No first-run path | The empty state shows a title and two sentences; there is no sample project and no statement of what can run on this PC | MPR-604 |

## 3. Experience principles

These rules decide between alternatives in the cards. They are stated so that a reviewer can refuse
a change that breaks one.

1. **One project, many views.** A workspace is a view. It never owns data that another workspace
   cannot see, and it never stores work outside the project.
2. **The shot is the unit of revision.** Every control that makes or changes generated media says
   which shot it acts on. A generation started with no shot named keeps today's behaviour and
   makes a new shot of its own (MPR-102); an explicit "loose clip" is not in this plan.
3. **Deterministic fix first.** When the change a person wants can be made exactly (timing, order,
   trim, title, caption, colour, loudness, reframing), the interface offers that. Regeneration is
   offered for what is inside the pixels, and says that the result will be a new sample. No card
   lists such fixes on the revise control; their controls exist today or come from MPR-601 and
   MPR-602.
4. **Name the editability level.** Each clip shows whether it is flattened, regenerable, a
   deterministic layer or a structured scene, in plain words, before a person presses Revise.
   MPR-104 shows the level as a word on an opened take in Story, taken from the origin in the
   take's record. A label on a clip in Edit is not in this plan.
5. **Price before run.** Any action that uses a model route, quota, money or a long render shows a
   figure and what leaves the PC before it starts, and the service enforces the same check. The
   cards deliver this for a generation (MPR-203, MPR-204); a figure before a Blender render or an
   export is not in this plan.
6. **Say what cannot be done.** A control that cannot do what its label implies (stop a remote
   run, keep a face identical) says so beside the control, not in a document.
7. **Agent work is visible and reversible.** What an agent proposed, what it changed, what it
   spent and what it is waiting for are shown to the person in one place, and each change is an
   undo step of that agent.
8. **Nothing is converted between simple and advanced.** There is no mode flag in the project and
   no export or import between views.
9. **Both languages are first-class.** New text is added in English and Arabic together, with
   right-to-left layout checked, or the control is not merged.

## 4. Simple and advanced are views of one project

The brief asks that the same project move between simple and advanced work without losing
editability. At the baseline this already holds structurally, because Create and Edit write the
same project. What is missing is that the simple path does not leave behind the objects the
advanced path needs. The table states what each view shows of each object once the Stage 1 cards
are done.

| Object in the project | Simple view (Create) | Advanced view (Story, Edit) | Agent view (CLI, SDK, MCP) |
|---|---|---|---|
| Brief and shot intent (MPR-106) | The prompt box; each made shot's prompt is saved as that shot's intent | In Story: a brief, a script per scene and intent fields per shot | Fields of the story document |
| Shot | Its made video, with "Revise" (MPR-104) | A shot card with its take stack in Story (MPR-104), plus its clip or clips on the timeline | A shot id that a generation or a proposal targets |
| Take and generation record (MPR-101) | A note that the new take was added to its shot (MPR-104) | The take stack with each take's record facts and what changed, and the existing take review; side-by-side comparison in the editor stays with SS-011 | The record and the shot history as read commands (MPR-107); the history has no page view in this plan |
| Timeline clip | Placed automatically in story order | Trim, ripple, speed, colour, sound, keyframes | Typed timeline commands |
| References and people | Elements and People | Entities scheduled per shot (MPR-401, MPR-402) | Pack and entity commands; consent stays human-only |
| Cost and egress (MPR-203, MPR-204) | Before Start: a time range with its basis, what is known about quota, and what is sent and where | What the run took, in the take record (MPR-101); the estimate shown before Start is not stored | The same preflight command; a budget that refuses (MPR-505) |
| Export | One button | Export section in Finish with loudness, a batch of up to four sizes and interchange (MPR-603); no choice of codec or container | Export commands, and the manifest as a read command (MPR-701) |

Rules for the cards:

- The preference for a workspace stays in the browser, as it is now. It is never written to the
  project.
- A project made entirely in Create opens in Edit with every clip trimmable and every shot
  replaceable, and a project edited heavily in Edit still shows its shots in Story and its made
  videos in Create.
- MPR-605 is the test of this: one scripted journey that crosses Create, Story, Edit and Finish
  and back, and fails if any step needs a conversion, loses a take, or leaves a shot that cannot be
  revised.

## 5. Journeys

Each journey gives the person and goal, what happens at the baseline, what happens once the named
cards are done, the limits that will remain, and an acceptance that can be observed. "After"
describes the plan, not the product.

### Journey 1 — A beginner makes a first clip

**Person and goal.** Someone who has never edited video. They want one short clip from a sentence,
to know what it will cost and what leaves their PC, and not to lose it.

**At the baseline.**

1. The page opens on the project list and an empty state. After a project is made, the shell opens
   on Edit, not Create.
2. In Create the page checks what can run. On a PC where the person has not installed and signed
   in to the Kaggle command-line tool and set two environment variables before starting the
   service, nothing can generate. The page says so. Import and editing still work.
3. Where the route is configured, the person writes a prompt, ticks that the prompt may leave the
   PC, and starts. The measured time for one clip on the free route was between 1,091.7 and
   1,213.3 seconds. The page shows an expected duration, not a range and not quota use.
4. The clip is brought in, placed, and exported with the one Export button.
5. Work is safe: the project autosaves, and history and backup are in the project list. The brief
   text is the exception (section 2.4).

**After the plan.**

- First run offers a sample project that needs no model, and a plain statement of what this PC can
  and cannot run and why (MPR-604). Which workspace a new project opens on does not change in this
  plan (section 9, question 1).
- Before Start, the page gives a time range and its basis, what is known about quota (which may be
  "unknown", with the reason), what is sent, and where it goes. The service refuses a start whose
  request differs from the one shown, or that has no recorded approval for that route, host and
  account (MPR-203, MPR-204).
- The clip arrives as take 1 of a shot. "Revise" on that video makes take 2 of the same shot
  (MPR-101, MPR-102, MPR-104). A plain new generation still makes a new shot.
- A failed run says which kind of failure it was and whether quota may still have been used
  (MPR-207).
- Each made shot's prompt, and a brief written in Story, are part of the project and of every
  backup. Create's unsent draft stays in the browser until the person keeps it (MPR-106).

**Limits that remain.** A beginner still cannot generate anything on a PC with no configured
route, and Yamakan will not download a model or open an account for them. One clip on the free
route takes about twenty minutes and cannot be stopped remotely. Setting up the route is a
technical task today; MPR-205 documents and contains it but does not make it one click. On such a
PC the Stage 1 controls add no setup guidance beyond today's message in Create: a shot card
offers "Revise this shot" only when a model is offered (MPR-104). A generated clip is about 3.4
or 6.1 seconds long, by recipe, and has no sound of its own. No card produces lip sync or
generated sound; a voice arrives only with MPR-221, which waits on FD-4, and a shot's dialogue is
a stored note until then.

**Acceptance.** On a clean profile, a first-time participant reaches an exported video from the
sample project without help. With a route configured, what the run took, as reported, is in the
take record (MPR-101); storing the estimate shown before Start is not in this plan. The story text
survives a backup and restore.

### Journey 2 — An editor revises one shot

**Person and goal.** A working editor with a cut of twelve shots. A client asks for one change to
shot seven. Nothing else may move.

**At the baseline.**

1. The cut is trustworthy as an edit: typed operations, undo, revision history and a qualified
   720p preview.
2. If the change is a trim, a title, a caption or a transition, the editor makes it in Edit. Ripple
   edits and speed changes exist only as commands (section 2.3).
3. If the change is inside the picture, the editor goes to Create and writes a new prompt. The
   result is a new unrelated shot. They place it by hand and delete the old clip.
4. Replacing a take as one undo step exists and is qualified (SS-006), but the control is inside
   the collapsed Director section, works only when the story has takes for that shot, and refuses a
   shot that has been split or trimmed into more than one clip.

**After the plan.**

- In Story, each shot has a card with its takes and one control, "Revise this shot"; each made
  video in Create has "Revise" (MPR-104). Nothing is added on a selected clip in Edit: that entry
  stays with SS-011. An opened take shows its editability level as a word (MPR-104); a label on a
  clip in Edit is not in this plan.
- A list of deterministic fixes on the control is not in this plan. Regeneration starts from the
  chosen take with every field of its record filled in; the editor changes one field and sees
  which fields differ (MPR-103).
- The new take is generated into the same shot (MPR-102), reviewed in the existing take review,
  and applied as one undo step that keeps the clip's position, length, effects and sound (SS-006,
  MPR-105). A side-by-side comparison in the editor stays with SS-011.
- Ripple, insert and group move are on the timeline (MPR-601); speed, colour and sound controls
  are in the inspector (MPR-602).
- The shot's history lists every attempt, including failed ones, its route, and who applied each
  replacement. It is a read command (MPR-107); a page view of it is not in this plan.

**Limits that remain.** A regenerated take is a new sample. Yamakan cannot change one object
inside generated pixels and hold the rest still unless a route offers that as an operation, and
none of today's routes does. The same seed on a different route need not give the same frames.
Slip, slide and roll trims are not in this plan; MPR-601 offers normal and ripple trim only.

**Acceptance.** The collateral change rate for the task is zero: after the revision, every clip
other than shot seven has the same asset hash, position and effects as before, checked from the
project and not by eye. The revision is one undo step. This is hypothesis H-A, measured by
MPR-802.

### Journey 3 — An editor hands the cut to a finishing tool

**Person and goal.** The same editor finishes picture in another application. They need the cut,
the media, and an exact statement of what did not travel.

**At the baseline.**

1. Export gives one H.264 file with one profile. Loudness normalisation and batch export exist as
   commands only.
2. An OpenTimelineIO export and a list of what it loses exist as commands, and a dedicated CI job
   checks the export. Neither is on the page.
3. There is no manifest: nothing written beside the export says which revision, which media
   hashes, which model and licence produced each generated clip, or which consents apply.

**After the plan.**

- Finish gains an export section: loudness for a single export, a batch of up to four output
  sizes, interchange, and the loss report shown before the interchange file can be downloaded
  (MPR-603). A choice of codec, bitrate or container is not in this plan, and the top-bar Export
  button stays.
- A manifest is stored beside every finished video export, and a readable provenance report is
  produced from it. Both are read commands (MPR-701); a page view of them is not in this plan.
- The interchange file carries each clip's lineage (origin, hashes, take identity) as metadata so
  that a round trip can be matched back to the project, and an imported timeline becomes a
  proposal that is reviewed and applied through MPR-303 (MPR-702).

**Limits that remain.** Interchange carries cuts, timing and media references. Effects, titles,
colour and keyframes are listed as losses, not translated. Which finishing tools read the file
correctly is [UNKNOWN]. MPR-702 checks the file with the OpenTimelineIO library only; opening it
in a finishing tool is not part of any card, and no tool is named as supported.

Media is not in the interchange file, and the panel says so beside the download (MPR-603). No
card collects a project's media into a folder: imported clips are files the editor already
holds, and how generated or rendered clips leave the project's store for another tool is not
planned. Import adds tracks and clips only and never updates an existing cut: a revised edit
comes back as a proposal of new tracks and clips (MPR-702), so it is cleanest in an empty
project.

Done elsewhere, by design: colour grading beyond a LUT, a full sound mix, multicam, masters and
stems, and anything over ten minutes or 200 clips. The export is a review file (SDR 8-bit H.264
at up to 1080p), not a master.

**Acceptance.** The loss report lists every item of the project that is absent from the
interchange file, and a reviewer can rebuild the report from the two files. The manifest's hashes
match the exported media. Opening the file in a named finishing tool is recorded as evidence with
the tool's version if the founder runs it by hand; otherwise it reads NOT TESTED.

### Journey 4 — A filmmaker plans and holds a shot exactly

**Person and goal.** A director planning a short scene: five shots, one location, a camera move
that must be the same on every attempt.

**At the baseline.**

1. Story holds a scene list with lens and movement fields, and the Cinema previs viewport. There
   is no brief, no script and no shot-card editor in Story.
2. The Blender panel renders a shot on the CPU from a stored scene, within fixed limits
   (1280×720, 120 frames, 32 samples, one render at a time). Camera, light and objects are
   numbers, so a re-render with one value changed is exact.
3. The render choices are made per render and are not stored on the shot. The Director's
   `cinema-blender` pipeline plans from a fixed set of boxes, not from the project's own scene.
4. Takes exist per shot, up to eight, but their review is in the collapsed Director section.

**After the plan.**

- The brief, each scene's script and each shot's intent are fields of the story document, edited
  in Story. Create writes each made shot's prompt as that shot's intent and shows it (MPR-106).
- Each shot has one stored setup (scene, camera, render settings), read by every render that
  becomes a take. The Cinema page can save its settings to a shot; a render from unsaved settings
  stays a labelled preview. The second Cinema persistence path becomes read-only behind a
  migration (MPR-403).
- Characters, products and places are entities scheduled per shot, so the references a shot will
  use are known before it is generated or rendered (MPR-401, MPR-402).
- The production plan view shows the nine stages, what each needs and produces, and where a
  person must approve. No stage starts a generation, an export or a download by itself (MPR-301,
  MPR-302). Renders queue instead of being refused (MPR-507).
- Four of the nine stages ask for approval: script, storyboard, shot list and sound. An approval
  moves the plan forward. It does not block a generation or an export that a person starts
  outside the plan (MPR-301).

**Limits that remain.** Exactness holds for shots rendered by Blender. A generated shot does not
follow the Blender camera: conditioning a model on a camera path or depth needs a route that
accepts control inputs, and none is authorised (MPR-404, deferred). On the founder's PC a Blender
render is CPU-only and small; the peak memory of the Blender worker next to the service has not
been measured (MPR-507). Photoreal output from Blender at these limits is not claimed. Yamakan
ships no language model, so the person types every planning stage; MPR-604 says the same of the
sample project.

**Acceptance.** A shot rendered twice from the same stored setup submits the same Blender scene
and settings (MPR-403). The same card renders that setup twice on the founder host and requires
equal frame hashes, or records the difference and its cause. Changing the focal length changes
that one shot and no other. The plan view shows the nine
stages of the production run, no stage starts a generation, an export or a download by itself, and
anything that spends or sends still needs the recorded approval of MPR-204.

### Journey 5 — A marketing producer makes variants of one product film

**Person and goal.** One producer in a marketing team, making a product advert in several lengths
and formats, with the same product and look in each, inside a known budget. Colleagues see the
work by backup and restore: the product has one human principal and no second approver.

**At the baseline.**

1. Elements and People hold reference packs with roles and pins. The panel itself states that no
   model receives them. Only a first-frame image reaches the one route that accepts an image.
2. `yamakan.continuity.check` reports that consistency is unmeasured. Nothing in the product
   states that a product or face stayed the same between shots.
3. Prompt presets exist. Batch export exists as a command. There is no budget and no figure before
   a batch.
4. Yamakan is a single-account local application. A team shares a project by backup and restore.

**After the plan.**

- The product, its colours and each person are entities with their references and consent, reused
  across shots by schedule and not by re-attaching files (MPR-401, MPR-402).
- For each shot, a reference delivery report says before the run which references the chosen
  route will receive and which it will not, with a reason, so "we attached it" is not mistaken for
  "the model used it" (MPR-402, MPR-202).
- Each generation shows its own preflight before it starts (MPR-203); a total for a batch of
  generations is not in this plan. Up to four output sizes are exported in one batch with one
  manifest each (MPR-603, MPR-701); a batch of different lengths is not in this plan.
- Consistency is measured per route by a declared method on a fixed task set of fictional
  entities and shown with its number, never as a promise. The card builds the method, measures no
  route by itself and does not measure the team's own product (MPR-405).

**Limits that remain.** Reference management is not demonstrated consistency. Whether a route
keeps a product identical across shots depends on the model; Yamakan will report the measurement
and will not claim identity. There is no live multi-user editing and none is planned; two people
do not work in the same project at the same moment. On the free route, the "budget" is quota
hours, not money, and a batch of ten clips is several hours. This plan never measures consistency
for a real person: the task set of MPR-405 holds fictional entities only.

**Acceptance.** Every variant's manifest lists the same media hashes and consent ids; entity ids
are not in the manifest. The reference delivery report is part of every preflight, and the
references that were sent are recorded on the take. What each run took, as reported, is kept in
its take record; a stored figure from before the run is not in this plan. No consistency statement
appears in the interface without a measurement behind it.

### Journey 6 — An operator hands a task to an agent

**Person and goal.** A technical user who wants an agent to assemble a rough cut from a brief and
existing media overnight, within limits, and to see afterwards exactly what it did.

**At the baseline.**

1. The operator creates a scoped agent token in Finish, under the collapsed agent tools.
2. The agent reaches 117 tools over MCP, or the same commands through the CLI and SDK. The tool
   list is not filtered by the token's scopes, does not mark human-only tools, and marks two
   mutating tools as read-only.
3. There is no way to wait for a job or read events, so the agent polls. A cancel notice from the
   MCP client is ignored. The CLI always acts as the local client, not as the agent.
4. When the agent reaches a human-only operation it receives a scope refusal. It has no way to
   ask, and the operator has no place to see that it is waiting.
5. There is no budget. Timeline edits by the agent are typed and undoable as that agent's steps,
   and jobs survive a restart.

**After the plan.**

- The tool list tells the truth about scopes, human-only operations and mutations (MPR-501).
- The agent waits on jobs and reads an event cursor instead of polling (MPR-502), and the CLI and
  SDK act under the agent's own token (MPR-503).
- Starting a generation, and the agent's own import, cancel and dismiss, become approval requests
  that the operator sees in an inbox beside agent access, bound to the exact request, and that
  survive a restart. Consent, tokens and Director approvals can never be requested (MPR-504).
- The token carries a budget enforced in the service: generations, provider quota seconds,
  currency, bytes sent and, optionally, local job seconds. Everything that spends or leaves the PC
  defaults to zero (MPR-505).
- The agent can work in a propose-only mode, where its edits are a batch the operator reviews and
  applies as one step (MPR-303).
- An activity list per agent shows each changing call and its outcome; reads are not recorded.
  Waiting requests are in the inbox (MPR-504) and spend is in the budget view (MPR-505). Any
  output can be traced back to its inputs by a read command (MPR-506).

**Limits that remain.** Yamakan ships no language model and no agent. The operator brings their
own, and what that agent sends to its own provider is outside Yamakan's control; the interface
should say so where the token is created, but no card adds that statement, so it is not in this
plan. The human-only rule is enforced by the service, not by the operating system, until FD-9 is
decided (MPR-508). An agent cannot grant consent, approve spend or raise its own budget, by
design.

**Acceptance.** Measure M14, defined in MPR-801 and run by MPR-805 with a fixed scripted agent
over twenty runs and a forced service restart in the middle: no acknowledged work is lost or
repeated, the budget is never exceeded, and no human-only operation happens without an approved
request. Approvals are checked against the audit feed and acknowledged revisions against the
project history. The approver in that run is a scripted browser session labelled a stand-in, not
a person, and the generation is a stand-in.

## 6. Recommendations by surface

| Surface | Keep | Change | Cards |
|---|---|---|---|
| Shell | Four workspaces, their order, the mounted-once behaviour, the classic fallback | Opening a new project on Create and a project that has clips on Edit is not in this plan (section 9, question 1). Approval requests appear in an inbox beside agent access, with a pending count, not in a tray beside the job tray | MPR-504 |
| Create | Prompt, library, presets, Elements, People, the generation list | "Revise" generates into the same shot, with a note that the take was added; preflight facts before Start; enforced egress approval; each shot's prompt saved in the project; quota facts beside the existing Stop note; the failure class | MPR-101, MPR-102, MPR-104, MPR-106, MPR-203, MPR-204, MPR-205, MPR-207 |
| Story | Scene list, Cinema previs, Blender panel | Brief, scripts and shot intent; shot cards with their take stacks; one stored setup per shot; entity schedule; the production plan view shown without a disclosure, with the Director disclosure kept for its other panels | MPR-104, MPR-106, MPR-302, MPR-401, MPR-402, MPR-403 |
| Edit | Preview, timeline, inspector, Studio as a panel | Ripple, insert and group move; inspector controls for speed, colour and sound; replace after split. A shot card and "Revise this shot" on a selected clip are not in this plan; that entry stays with SS-011 | MPR-105, MPR-601, MPR-602 |
| Finish | Output settings, captions | Export section with loudness, batch, interchange and loss report; the manifest and provenance report as read commands, with no page view; licence terms in Create and notices in an About panel opened from the page footer | MPR-603, MPR-701, MPR-702, MPR-209 |
| Agent access | Scoped tokens created only by a person | A visible place for requests, budgets and the activity list. Token creation says that the agent cannot ask for generations until a limit is set (MPR-505); a fuller statement of what an agent can and cannot do is not in a card | MPR-504, MPR-505, MPR-506 |
| First run and empty states | The local badge and the language switch | Sample project, capability statement for this PC, and a banner that says models are off unless a route is configured | MPR-604 |
| Text and layout | Two languages, right-to-left mirroring | String freeze before review, and a packet a native reviewer can work through | MPR-606 |

Two recommendations are about wording, and cost nothing to state now:

- **Call things by what they are.** "Version" for a take in the simple view; "Revise" for
  regeneration; "Replace" for applying a take; "Stop following" where a remote run cannot be
  stopped. "Stop following" is already the label on main (`src/i18n.ts`), and "Revise" is the word
  MPR-104 uses. The others are proposals for the string freeze in MPR-606, in both languages.
- **Never show a tick the service does not check.** Where the page asks a person to confirm
  something, the service verifies that confirmation for that request (MPR-204), or the control is
  removed.

## 7. What the interface should not gain

The reasons are in [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md). In short:

- **A node canvas as a second way to build a project.** It would be a second project structure
  beside the timeline and the story.
- **A chat box that edits the project with a bundled model.** Yamakan ships no language model; an
  agent connects through the surfaces in journey 6 and is supervised there.
- **A "simple mode" and an "expert mode" stored in the project.** Section 4 replaces both with
  views.
- **A credit balance or a wallet.** Yamakan sells no inference. It shows the provider's cost or
  quota and the customer's own budget.
- **Controls that imply edits inside generated pixels** (relight, move the camera, change one
  object) on clips that are flattened. They appear only where a route returns that operation.
- **A consistency badge without a number.** Section 5, journey 5.

## 8. How the experience is measured

| Question | Method | Where | Status |
|---|---|---|---|
| Can each kind of person finish their journey? | Formative task-based study, five beginners and five professional editors, Yamakan only | [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) section 7 | Not run; no card in this plan runs it (X-01) |
| Does a project survive moving between simple and advanced views? | Scripted journey in its own qualification script, not in the browser suite | MPR-605 | Not built |
| Is a one-shot revision local? | Collateral change rate from project records | MPR-802 | Not run |
| Is the Arabic interface correct and natural? | Native review of the frozen strings on the candidate build | MPR-606, then X-01 | Externally blocked |
| Does a supervised agent complete and resume? | Fixed scripted agent, twenty runs, with a forced restart (measure M14) | MPR-801 (definition), MPR-805 (run) | Not run |
| Is Yamakan easier than a competitor? | Within-subject comparison with counterbalanced order | [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) section 7, as a method only; MPR-803 rates outputs blind and does not measure ease of use | No card in this plan; needs FD-6 |

Findings from the formative study are qualitative. They are reported as problems with severity and
are never reported as a win over another product.

## 9. Open questions

1. **Where a new project opens.** Opening on Create for an empty project and Edit otherwise is a
   judgement from reading the code. The formative study should test it before the default changes.
2. **How much of the generation record a beginner sees.** The shot card in Story shows a take's
   model, seed, size and what changed (MPR-104); whether Create should show them at all is a study
   question.
3. **Whether the production plan view belongs in Story or as a fifth workspace.** This plan keeps
   four workspaces and puts it in Story (MPR-302). A fifth tab is refused unless the study shows
   people cannot find it.
4. **The words for takes and revision in Arabic.** The English proposals in section 6 have no
   reviewed Arabic equivalents; MPR-606 exports the strings in the catalogue at the freeze for
   review, and X-01 decides.
5. **Team use.** Journey 5 assumes hand-off by backup and restore. Whether that is acceptable to a
   small team is unknown and is not answered by this plan.
