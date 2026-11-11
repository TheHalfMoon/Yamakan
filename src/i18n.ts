// Interface language (plan T8: localized UI; contract: "UI strings/layout
// use RTL separately from title shaping"). Yamakan's own interface strings
// in English and Arabic. Arabic switches the page to right-to-left; the
// timeline keeps left-to-right time. Title text is shaped by libass at
// render time and is unaffected by the interface language.

export type Lang = "en" | "ar";

const en = {
  "lang.label": "Language",
  "lang.switch": "العربية",
  "brand.tagline": "Creative production · Offline workspace",
  "nav.production": "Production",
  "nav.tools": "Agent tools",
  "workspace.label": "Workspaces",
  "workspace.create": "Create",
  "create.runUncertain":
    "It is not known whether this reached Kaggle. It is being checked, and will not be sent again.",
  "create.runHeld":
    "This workspace is a restored copy, and this run belongs to the original. It is not followed here.",
  "create.recordRetry": "Try saving it again",
  "create.storyFull":
    "The video is in the project, but this project's record of made videos is full, so what its receipt says was not saved.",
  "create.storyUnread":
    "What this project's videos were made from could not be read.",
  "create.kaggleSetup":
    "To run it from here, start Yamakan with YAMAKAN_KAGGLE_CLI set to your Kaggle CLI's full path and YAMAKAN_KAGGLE_USERNAME to your username.",
  "create.agree":
    "Send this prompt and seed to my private Kaggle notebook, using my free GPU quota. About {minutes} minutes. The prompt leaves this computer, and Kaggle keeps it in the notebook's history. The video comes back here; the model stays on Kaggle.",
  "create.agreePicture":
    "Send this prompt, seed and picture to my private Kaggle notebook, using my free GPU quota. About {minutes} minutes. The prompt and the picture leave this computer, and Kaggle keeps them in the notebook's history, where withdrawing consent later cannot reach them. The video comes back here; the model stays on Kaggle.",
  "create.picture": "Start from a picture",
  "create.pictureNone": "No picture: from the prompt alone",
  "create.pictureNote":
    "Only this project's PNG and JPEG stills are listed. What is sent is a copy made from the picture's pixels, fitted to the model's frame, without its camera details or other data.",
  "create.noRealPerson":
    "This picture shows no real person, or only people whose consent to send it is recorded.",
  "create.peopleTitle": "People and consent",
  "create.peopleNote":
    "A real person's likeness is used only with their consent, recorded here. Consent to make videos lets a still of them be linked to them. Consent to send also lets that still leave this computer for your private Kaggle notebook. Revoking stops any further use, for good; it cannot reach what Kaggle already keeps. A still once linked stays bound to that consent, even after undo.",
  "create.peopleName": "Their name",
  "create.peopleVersion": "What they agreed to, such as the form they signed",
  "create.peopleDays": "For",
  "create.peopleDaysOption": "{days} days",
  "create.peopleAttest":
    "The person shown, or someone entitled to act for them, consented to videos being made from their likeness.",
  "create.peopleGrant": "Record consent",
  "create.peopleEmpty": "No consent is recorded.",
  "create.peopleGenerate": "Consent to make videos: {version}, until {until}.",
  "create.peopleSend": "Consent to send to Kaggle, until {until}.",
  "create.peopleNoSend":
    "Pictures linked to this consent cannot be sent to Kaggle: no consent to send is recorded for it.",
  "create.peopleSendAttest":
    "They also agreed that pictures of them may leave this computer for my private Kaggle notebook, which keeps them in its history.",
  "create.peopleAllowSend": "Record consent to send, for {days} days",
  "create.peopleNoSendExpired":
    "This consent has expired, but stills linked to it still need their own consent to send before they can go to Kaggle.",
  "create.peopleRevalidateSend": "Confirm consent to send again",
  "create.peopleAlreadyLinked": "That still is already linked to this consent.",
  "create.peopleLinked": "Linked stills: {names}",
  "create.peopleLinkStill": "A still of them",
  "create.peopleLink": "Link to them",
  "create.peopleRevoke": "Revoke consent",
  "create.peopleRevokeSend": "Revoke consent to send",
  "create.peopleRevokeSure": "Revoke for good",
  "create.peopleRevalidate": "Confirm again",
  "create.peopleState.revoked": "Revoked.",
  "create.peopleState.expired": "Expired.",
  "create.peopleState.revalidate":
    "From before a restore: confirm it again to use it.",
  "create.peopleFailed": "That was not saved.",
  "create.peopleUnread": "Consents could not be read.",
  "create.elementsTitle": "Places and props",
  "create.elementsNote":
    "Kept with this project as a record, and pinned to a shot if you wish. They are not sent to a model and do not change what is generated. Saving one, or a pin, ends undo for what came before. Do not keep a real person's likeness here, even as a made-up character: that needs consent this does not ask for.",
  "create.elementName": "Name",
  "create.elementRole": "Kind",
  "create.elementRole.environment": "Place",
  "create.elementRole.prop": "Prop",
  "create.elementRole.wardrobe": "Wardrobe",
  "create.elementRole.style": "Style",
  "create.elementRole.fictional": "Drawn or made-up character",
  "create.elementAdd": "Choose an image",
  "create.elementAddImage": "Add another image",
  "create.elementOnShots": "On these shots",
  "create.elementOlder": "An older version",
  "create.elementImageType": "This takes a PNG or JPEG image.",
  "create.elementNotKept":
    "That image may not have come in. Check this project's assets before trying again.",
  "create.elementImageOnly":
    "The image came into the project's assets, and this could not be saved with it. The reason is at the top of the page.",
  "create.elementNotPinned":
    "That may not have been saved on the shot. Reopen the project to see.",
  "create.elementsUnread": "What this project keeps here could not be read.",
  "create.elementFull": "This holds all the images it can.",
  "create.elementGone":
    "That one is no longer in this project. Nothing was added.",
  "create.elementShotFull": "That shot holds all it can.",
  "create.needPrompt": "Describe the shot first.",
  "create.notFromHere":
    "This model has not yet been tested from this page, so it cannot be started here.",
  "create.generate": "Generate on Kaggle",
  "create.starting": "Sending it to Kaggle",
  "create.startFailed": "The run could not be started.",
  "create.runQueued": "{name} is waiting for a GPU on Kaggle.",
  "create.runRunning": "{name} is running on Kaggle.",
  "create.runDone":
    "{name} finished. Its video was checked against its receipt.",
  "create.runFailed": "No video came of this {name} run.",
  "create.runCancelled": "Kaggle shows this notebook's latest run as stopped.",
  "create.runUnknown": "Kaggle is not answering. The run may still be going.",
  "create.runStopped": "No longer following this run.",
  "create.runLost": "Yamakan has no record of this run.",
  "create.runClock": "{elapsed} so far, of about {minutes} minutes",
  "create.runStop": "Stop following",
  "create.runStopNote":
    "Yamakan cannot stop a run on Kaggle. Stop following leaves it running, up to its {minutes} minute limit, using your quota. To stop it there:",
  "create.runGoesOn":
    "It may still be running on Kaggle, up to its {minutes} minute limit, using your quota. To see or stop it:",
  "create.openNotebook": "open its notebook",
  "create.runBringIn": "Bring it into this project",
  "create.bringInFailed":
    "The video could not be brought in. The line at the top of the page says why; try again.",
  "create.runBroughtIn": "{name} made this video. It is in the list here.",
  "create.runRetry": "Try again",
  "create.runDismiss": "Done",
  "create.seedInvalid": "A seed is a whole number from 0 to 4294967295.",
  "create.modelFacts":
    "Run so far at {width}x{height}, {frames} frames at {fps} fps ({seconds} s), about {minutes} minutes in all on a free Kaggle T4, the first load included. {licence}.",
  "create.negativePrompt": "Its notebook also asks it to avoid: {words}.",
  "create.readsLittle":
    "This model reads only about the first {words} words of a prompt, and was trained on English. Words past that, including direction words added at the end, may not be read, and other languages may not be understood.",
  "create.engineChecking": "Checking what can run here.",
  "create.engineUnknown": "What can run here could not be checked.",
  "create.engineFound":
    "An engine was found on this machine, but Yamakan cannot start it from here yet.",
  "create.engineOff": "Yamakan cannot run a model on this machine yet.",
  "create.outside":
    "This model has been run in a private Kaggle notebook: {folder}. Its prompt and seed are set in that script, not from this page. Its video and receipt can then be brought in here.",
  "create.bringInNote":
    "Add its receipt to check that this is the file it describes. A match does not show that its model, seed or prompt are true: anyone can write a receipt.",
  "create.receiptNotFinished":
    "That receipt is from a run that did not finish or did not pass its own checks, so nothing was brought in.",
  "create.tooLargeToCheck":
    "This video is too large to check against a receipt here, so nothing was brought in. Remove the receipt to bring it in without one.",
  "create.checkFailed":
    "This video could not be read to check it, so nothing was brought in.",
  "create.importFailed":
    "The video could not be brought in. The status line above says why.",
  "create.busy":
    "Yamakan is busy, so nothing was brought in. Try again in a moment.",
  "create.notKept":
    "The video is in the project, but what its receipt says could not be saved with it.",
  "create.broughtIn": "Brought in {name}, with no receipt checked.",
  "create.broughtInChecked": "Brought in {name}. It matches its receipt.",
  "create.broughtInCopy":
    "Brought in {name}. The file matched its receipt, and was then converted to a constant frame rate.",
  "create.receiptMatched":
    "This project's record says this file's hash matched its receipt when it came in.",
  "create.receiptMatchedOriginal":
    "This project's record says the original file's hash matched its receipt when it came in. This is a converted copy.",
  "create.receiptSays": "The receipt says:",
  "create.prompt": "Describe the shot",
  "create.promptHint": "A paper boat floats slowly along a calm stream.",
  "create.promptCount": "{count} of {limit} characters",
  "directorCinema.title": "Render a story shot with Blender",
  "directorCinema.note":
    "The Director plans the shot as a Cinema scene from its direction and renders it on this computer. You approve the video before it becomes the shot's take and goes on the timeline.",
  "directorCinema.noShots":
    "This project has no story shots yet. Make a story on the Create page first.",
  "directorCinema.shot": "Story shot",
  "directorCinema.chooseShot": "Choose a shot",
  "directorCinema.render": "Plan and render",
  "directorCinema.sendForApproval": "Ask for approval",
  "directorCinema.approve": "Approve the video",
  "directorCinema.place": "Make it the shot's take and place it",
  "directorCinema.followed": "Followed: {list}.",
  "directorCinema.notFollowed":
    "Not followed (the render cannot make these yet): {list}.",
  "directorCinema.rendered":
    "Rendered with Blender. Watch it in the project's media, then ask for approval.",
  "directorCinema.awaiting": "Waiting for your approval.",
  "directorCinema.approved": "Approved.",
  "directorCinema.placed":
    "Rendered with Blender. The video is the shot's take and is on the timeline.",
  "directorCinema.partlyPlaced":
    "Some of this story's other shots are on the timeline, but not this one. Place the story's shots together.",
  "directorCinema.clipRemoved":
    "This shot is on the timeline without its clip. Undo the clip's removal in the editor, then place it again.",
  "directorCinema.takeChanged":
    "The story now selects another take for this shot. Select this render's take again, or start over.",
  "directorCinema.startOver": "Start over (the video stays in the project)",
  "directorCinema.storyGone": "The story or its shot is no longer there.",
  "directorCinema.takesFull":
    "This shot already has 8 takes, the most a shot keeps. Remove one first.",
  "presets.title": "Saved in this project",
  "presets.reading": "Reading the project's presets…",
  "presets.none":
    "No presets yet. Fill a template, or write a prompt, and save it here.",
  "presets.unreadable": "This project's presets could not be read.",
  "presets.name": "Preset name",
  "presets.fromBrief": "My prompt",
  "presets.save": "Save as preset",
  "presets.use": "Use",
  "presets.useNamed": "Use the preset {name}",
  "presets.remove": "Remove",
  "presets.removeNamed": "Remove the preset {name}",
  "presets.taken": "A preset already has this name.",
  "presets.full": "A project keeps at most {limit} presets.",
  "presets.notSaved":
    "The presets were not saved. The reason is on the status line.",
  "library.title": "Prompt library",
  "library.note":
    "Templates written for Yamakan, in English and Arabic. Search, fill in the parts, and put the prompt above. It works offline.",
  "library.search": "Search",
  "library.searchHint": "rain, orbit, product, مطر…",
  "library.category": "Category",
  "library.kind": "Kind",
  "library.kind.video": "Video",
  "library.kind.image": "Still image",
  "library.all": "All",
  "library.found": "Templates found: {count}",
  "library.language": "Write the prompt in",
  "library.language.en": "English (most models read it best)",
  "library.language.ar": "Arabic",
  "library.use": "Use this prompt",
  "library.replace": "Replace the prompt",
  "library.add": "Add to the prompt",
  "library.credit": "Every template is Yamakan's own.",
  "library.tooLong":
    "The prompt with this added is longer than {limit} characters. Shorten the prompt first.",
  "create.direction": "Direction",
  "create.direction.shot": "Shot",
  "create.direction.movement": "Movement",
  "create.direction.lens": "Lens",
  "create.direction.light": "Light",
  "create.direction.none": "Not set",
  "create.directionNote":
    "These only add words to the prompt. Neither model has camera settings, and it may not follow them.",
  "create.model": "Model",
  "create.seed": "Seed",
  "create.finalPrompt": "What the model would be given",
  "create.finalPromptEmpty": "Nothing yet.",
  "create.copy": "Copy the prompt",
  "create.copied": "Copied",
  "create.copyFailed": "The prompt could not be copied.",
  "create.engineTitle": "Making it",
  "create.bringInTitle": "Bring a video in",
  "create.receipt": "Receipt (optional)",
  "create.receiptClear": "Remove the receipt",
  "create.bringIn": "Choose a video",
  "create.receiptInvalid":
    "That file is not a run receipt, so nothing was brought in.",
  "create.receiptMismatch":
    "This video is not the file that receipt describes, so nothing was brought in.",
  "create.videos": "Videos in this project",
  "create.noVideos": "No videos yet.",
  "create.noReceipt": "No receipt",
  "create.place": "Add to timeline",
  "create.placeAgain": "Add again",
  "create.placed": "Added {name} to the timeline.",
  "create.openEdit": "Open in Edit",
  "workspace.story": "Story",
  "workspace.edit": "Edit",
  "workspace.finish": "Finish",
  "workspace.storyIntro":
    "Brief, scenes and shots, with Director and the Cinema previs.",
  "workspace.finishIntro":
    "Output, the export job and agent tools. Export from the toolbar; the job shows in every workspace.",
  "workspace.output": "Output {size}, {seconds} s",
  "workspace.openStudio": "Open Studio",
  "badge.local": "Local media · CPU rendering",
  "status.initial": "Create or open a project to begin.",
  "session.locked":
    "Open Yamakan with the link it printed when it started (also saved in the workspace's launch file). Opening the address alone does not sign you in.",
  "status.working": "Working…",
  "status.opened": "Opened {name}, revision {revision}.",
  "status.saved": "Saved revision {revision}.",
  "status.documentUnsaved":
    "Save your unsaved caption or canvas edits first. Undo, redo and restore of saved changes wait for them.",
  "status.conflictReloaded":
    "This project changed elsewhere and your last change no longer applies to it. The current version is shown; your change can be downloaded.",
  "status.mergedAfterConflict":
    "This project changed elsewhere; your change was applied to the current version.",
  "status.draftNeedsSave":
    "This change is kept as a draft: press Save to save the whole project.",
  "conflict.unapplied":
    "Your last change was not applied because the project changed elsewhere.",
  "conflict.download": "Download my change",
  "conflict.dismiss": "Dismiss",
  "error.operation": "Operation failed.",
  "error.edit": "Invalid edit.",
  "error.assetMissing": "Asset missing.",
  "error.track": "Choose an unlocked compatible track.",
  "projects.title": "Projects",
  "projects.name": "Project name",
  "projects.defaultName": "Untitled production",
  "projects.create": "Create project",
  "projects.revision": "Revision {revision}",
  "projects.history": "History & recovery",
  "localEngine.title": "Local generation engine",
  "localEngine.note":
    "You start the engine yourself. This only reads its status: it starts, installs and generates nothing.",
  "localEngine.check": "Check engine",
  "localEngine.unknown": "unknown",
  "localEngine.notConfigured":
    "No engine is configured. Set YAMAKAN_COMFYUI_URL to its address on this machine and restart Yamakan.",
  "localEngine.unreachable": "The configured engine did not answer.",
  "localEngine.reachable":
    "The engine answered: version {version}, on {device}.",
  "localEngine.startedSafely":
    "It reports a safe start: offline, with no custom nodes, on this machine only.",
  "localEngine.startedUnsafely": "Yamakan will not use it as started.",
  "localEngine.missing": "Start it with: {flags}.",
  "localEngine.refused": "Start it without: {flags}.",
  "localEngine.exposed": "It is also reachable from beyond this machine.",
  "localEngine.generationUnavailable":
    "Generation is not available in this build. A working connection does not change that.",
  "backups.title": "Backups",
  "backups.note":
    "A backup copies the database (with creative documents), verified media and older scene files to a folder beside this workspace while you keep working. Restoring creates a new workspace folder; this one is not changed.",
  "backups.create": "Back up now",
  "backups.show": "Show backups",
  "backups.none": "No backups yet.",
  "backups.summary": "{date} · projects: {projects} · {size} MB",
  "backups.damaged": "Damaged media not copied: {count}",
  "backups.incomplete": "{id} · incomplete, cannot be restored",
  "backups.partialScope":
    "Not proven complete: an earlier backup format, or something could not be copied.",
  "backups.restore": "Restore to a new folder",
  "backups.made": "Backup created.",
  "backups.madeDamaged":
    "Backup created, but {count} damaged media files could not be copied.",
  "backups.restored":
    "Restored into a new workspace folder: {folder}. Start Yamakan with that folder as its workspace to open it.",
  "backups.restoredQuarantined":
    "Restored into a new workspace folder: {folder}. Media files that could not be verified were quarantined: {count}. Start Yamakan with that folder as its workspace to open it.",
  "backups.restoredQuarantinedHeld":
    "Restored into a new workspace folder: {folder}. Media files that could not be verified were quarantined: {count}. Jobs copied from this workspace wait there until you retry or discard them: {held}. Start Yamakan with that folder as its workspace to open it.",
  "backups.restoredHeld":
    "Restored into a new workspace folder: {folder}. Jobs copied from this workspace wait there until you retry or discard them: {count}. Start Yamakan with that folder as its workspace to open it.",
  "assets.title": "Assets",
  "assets.import": "Import local media",
  "assets.kind.image": "image",
  "assets.kind.video": "video",
  "assets.kind.audio": "audio",
  "assets.size": "{kb} KB",
  "preview.clipStatus": "{count} clips · Canvas renderer",
  "import.failed": "Import failed.",
  "import.converting":
    "Converting {name} to a constant frame rate before editing…",
  "import.stillConverting":
    "{name} is still converting; it will appear in the asset list when it finishes.",
  "import.incomplete": "Conversion did not complete.",
  "import.converted":
    "Imported {name} at a constant frame rate. Click it to add it to the timeline.",
  "import.done": "Imported {name}. Click it to add it to the timeline.",
  "hint.media":
    "Media stays on this computer. Video clips with sound can mix their own audio when enabled below. No inference backend is enabled yet.",
  "clip.sound.heading": "Clip sound",
  "clip.sound.enable": "Use video clip sound",
  "clip.sound.gain": "Sound gain (dB)",
  "clip.sound.noAudio": "This asset has no audio stream.",
  "clip.sound.notVideo": "Select a video clip to adjust its sound.",
  "clip.animation.heading": "Clip animation",
  "clip.animation.startOpacity": "Start opacity",
  "clip.animation.endOpacity": "End opacity",
  "clip.animation.startVolume": "Start volume",
  "clip.animation.endVolume": "End volume",
  "clip.animation.apply": "Apply opacity keyframes",
  "clip.animation.applyVolume": "Apply volume keyframes",
  "clip.animation.clear": "Clear animation",
  "clip.animation.hint":
    "Two keyframes from clip start to end. Preview and export share the same sampler.",
  "clip.animation.none":
    "Select a media clip to edit opacity or volume keyframes.",
  "history.label": "Project history",
  "history.title": "Project history & recovery",
  "history.current": "Project {id} · Current revision {revision}",
  "history.unverified": "unverified",
  "history.note":
    "Restoring creates a new revision. Existing snapshots and the previous head are preserved.",
  "history.unverifiable":
    "The current project cannot be verified. Choose a verified snapshot to recover it.",
  "history.item": "Revision {revision} · {name}",
  "history.restore": "Restore revision {revision}",
  "history.saveFirst":
    "Save your edits or download an unsaved draft before restoring. Draft JSON retains edits; media stays in this workspace.",
  "history.downloadDraft": "Download unsaved draft",
  "history.close": "Close history",
  "tools.title": "Yamakan agent tools",
  "tools.intro":
    "The same validated project and render operations power the editor and local REST API.",
  "tools.catalog": "Show the versioned tool catalog",
  "agents.title": "Agent access",
  "agents.intro":
    "Make a token for an agent (the MCP server or a script) that can do only what you allow. Give the agent this token, never the workspace's own.",
  "agents.label": "Name",
  "agents.scopes": "It may",
  "agents.scope.projectRead": "read projects",
  "agents.scope.projectWrite": "change projects",
  "agents.scope.projectRecover": "restore earlier versions",
  "agents.scope.renderExecute": "render exports",
  "agents.scope.jobRead": "see jobs",
  "agents.scope.jobControl": "start and stop jobs",
  "agents.end": "It ends",
  "agents.end.choose": "Choose when it ends",
  "agents.end.7": "after 7 days",
  "agents.end.30": "after 30 days",
  "agents.end.90": "after 90 days",
  "agents.end.never": "never (until you revoke it)",
  "agents.create": "Make token",
  "agents.why.noScope": "Choose at least one thing it may do.",
  "agents.why.noEnd": "Choose when it ends.",
  "agents.why.labelTooLong": "The name is longer than 80 characters.",
  "agents.made.title": "New token:",
  "agents.made.once":
    "It is shown only now, and is lost if you leave this panel before keeping it. Keep it where only the agent can read it: anyone who has it can do what it allows.",
  "agents.made.copy": "Copy",
  "agents.made.copied": "Copied.",
  "agents.made.copyFailed": "Could not copy; select the token and copy it.",
  "agents.made.done": "I have kept it",
  "agents.loading": "Loading agent tokens…",
  "agents.none": "No agent tokens yet.",
  "agents.unnamed": "Unnamed token",
  "agents.status.active": "Active",
  "agents.status.ended": "Ended",
  "agents.status.revoked": "Revoked",
  "agents.status.unreadable": "Not usable (its record cannot be read)",
  "agents.scopesUnreadable": "What it may do cannot be read.",
  "agents.separator": ", ",
  "agents.created": "Made {date}",
  "agents.ends": "ends {date}",
  "agents.ended": "ended {date}",
  "agents.endsUnreadable": "its end cannot be read, so it has ended",
  "agents.createdUnreadable": "made at a time that cannot be read",
  "agents.endsNever": "does not end",
  "agents.revoke": "Revoke",
  "agents.revokeNow": "Revoke now",
  "agents.cancel": "Cancel",
  "studio.title": "Studio canvas",
  "studio.save": "Save Studio",
  "studio.reload": "Reload saved Studio",
  "studio.state.loading": "Opening the project's Studio canvas…",
  "studio.state.new": "New canvas: not saved yet",
  "studio.state.saved": "Saved to the project",
  "studio.state.saving": "Saving…",
  "studio.state.conflict":
    "Another window saved this canvas first. Reload the saved canvas to continue.",
  "studio.state.error": "The Studio canvas could not be saved.",
  "studio.state.unavailable":
    "Saving Studio canvases to the project is not enabled on this service.",
  "studio.state.turnedOff":
    "Saving Studio canvases is turned off on this service. This canvas is not kept; saved canvases are kept and open again when saving is turned back on.",
  "studio.noProject": "Open a project to keep its Studio canvas.",
  "studio.intro":
    "Layered image editing is imported behind a Yamakan host adapter.",
  "cinema.title": "Cinema camera",
  "cinema.intro":
    "Supported scene3d preview and persist. AI-conditioned camera stays off.",
  "cinema.lens.title": "Lens preview",
  "cinema.lens.preset": "{value} mm",
  "cinema.lens.fov": "Vertical field of view: {value}°",
  "cinema.lens.note":
    "Changes stay in this window until you choose Save scene to project. They are never used to generate AI video.",
  "cinema.units": "Measured in metres. Turns apply about X, then Y, then Z.",
  "blender.title": "Render with Blender",
  "blender.note":
    "Blender renders the saved scene on this computer, offline, as a short video. It can take a minute or more.",
  "blender.unavailable": "Blender rendering is not available here:",
  "blender.size": "Size",
  "blender.sizeValue": "{width} × {height}",
  "blender.length": "Length",
  "blender.seconds": "{n} s",
  "blender.fps": "Frames per second",
  "blender.quality": "Quality",
  "blender.quality.draft": "Draft (fastest)",
  "blender.quality.good": "Good",
  "blender.quality.best": "Best (slowest)",
  "blender.orbit": "Camera orbit",
  "blender.degrees": "{n}°",
  "blender.render": "Render",
  "blender.cancel": "Cancel render",
  "blender.place": "Place on timeline",
  "blender.saveFirst": "Save the scene to the project before rendering it.",
  "blender.rendering": "Rendering…",
  "blender.progress": "Rendered {percent}%",
  "blender.noVideo": "The render finished without a video.",
  "blender.unknown": "Blender gave no reason.",
  "blender.lost": "Lost track of the render for now; trying again:",
  "blender.cancelFailed": "The render could not be cancelled:",
  "blender.placeFailed": "The video could not be placed:",
  "blender.placeUnsaved":
    "The editor's changes could not be saved first; nothing was placed.",
  "blender.done": "Rendered with Blender. The video is in the project.",
  "blender.placed": "Rendered with Blender. The video is on the timeline.",
  "blender.cancelled": "The render was cancelled.",
  "blender.failed": "The render failed:",
  "cinema.unsupported": "Not available in Cinema:",
  "cinema.unsupported.separator": "; ",
  "cinema.unsupported.aiCamera": "an AI-guided camera",
  "cinema.unsupported.generativeVideo": "generating video from this scene",
  "cinema.unsupported.remoteMedia": "loading media from web addresses",
  "cinema.objects.title": "Objects",
  "cinema.objects.choose": "Object",
  "cinema.objects.none": "This scene has no objects. Add a box to start.",
  "cinema.objects.left": "Move left",
  "cinema.objects.right": "Move right",
  "cinema.objects.forward": "Move away",
  "cinema.objects.back": "Move closer",
  "cinema.objects.up": "Raise",
  "cinema.objects.down": "Lower",
  "cinema.objects.turnLeft": "Turn left",
  "cinema.objects.turnRight": "Turn right",
  "cinema.objects.bigger": "Larger",
  "cinema.objects.smaller": "Smaller",
  "cinema.objects.add": "Add box",
  "cinema.objects.remove": "Remove object",
  "cinema.objects.boxName": "Box {n}",
  "cinema.objects.readout":
    "Position {x}, {y}, {z} m · turned {turn}° · size {scale}×",
  "cinema.objects.full":
    "This scene holds the most objects the page edits ({max}).",
  "cinema.objects.note":
    "Placeholder boxes for blocking out a shot. They are saved with the scene when you save it, and are never used to generate AI video.",
  "cinema.project.save": "Save scene to project",
  "cinema.project.reopen": "Reopen saved scene",
  "cinema.project.none": "Open a project to keep its Cinema scene.",
  "cinema.project.loading": "Opening the project's Cinema scene…",
  "cinema.project.new": "This project has no Cinema scene yet: not saved",
  "cinema.project.saved": "Saved to the project",
  "cinema.project.changed": "Changes not saved",
  "cinema.project.saving": "Saving…",
  "cinema.project.conflict":
    "This scene was changed elsewhere since it was opened here. Reopen the saved scene to continue; changes not saved here are lost.",
  "cinema.project.error": "The Cinema scene could not be saved: {message}",
  "cinema.project.loadError":
    "The project's Cinema scene could not be opened: {message}",
  "cinema.project.unavailable":
    "Saving Cinema scenes to the project is not enabled on this service.",
  "cinema.project.turnedOff":
    "Saving Cinema scenes is turned off on this service. This scene is not kept; saved scenes open again when saving is turned back on.",
  "director.title": "Director",
  "director.unsupported": "Not available in the Director:",
  "director.unsupported.separator": "; ",
  "director.unsupported.modelStages": "stages that need an AI model",
  "director.unsupported.paidInference": "paid AI services",
  "director.unsupported.agentApproval":
    "an agent approving a stage in place of a person",
  "director.intro":
    "Manual stage workflows. Model-dependent stages stay disabled.",
  "engine.list": "Generative operations",
  "clip.dissolve.heading": "Dissolve",
  "clip.dissolve.none":
    "Select a clip on a video track that starts where another clip ends.",
  "clip.dissolve.frames": "Length (frames, an even number)",
  "clip.dissolve.length":
    "A dissolve lasts a whole, even number of frames, at least 2.",
  "clip.dissolve.apply": "Set dissolve",
  "clip.dissolve.remove": "Remove dissolve",
  "clip.transform.heading": "Transform",
  "clip.transform.none":
    "Select footage or a still on a video track to transform it.",
  "clip.transform.scale": "Scale (%)",
  "clip.transform.offsetX": "Move right (% of width)",
  "clip.transform.offsetY": "Move down (% of height)",
  "clip.transform.cropLeft": "Crop left (%)",
  "clip.transform.cropTop": "Crop top (%)",
  "clip.transform.cropRight": "Crop right (%)",
  "clip.transform.cropBottom": "Crop bottom (%)",
  "clip.transform.reset": "Reset transform",
  "clip.transform.cropHint":
    "Scale and position show while playing; a crop shows in the reference preview and the export.",
  "captions.title": "Captions",
  "captions.import": "Import SRT or WebVTT",
  "captions.none": "This project has no caption track yet.",
  "captions.track": "Caption track",
  "captions.burnIn": "Burn into the picture (export and reference preview)",
  "captions.start": "Start (s)",
  "captions.end": "End (s)",
  "captions.text": "Text",
  "captions.split": "Split at playhead",
  "captions.splitHint": "Move the playhead inside the cue to split it there.",
  "captions.save": "Save cues",
  "captions.exportSrt": "Download SRT",
  "captions.exportVtt": "Download WebVTT",
  "captions.tooLarge": "A caption file is at most 512 KiB.",
  "captions.language": "Language of the imported file",
  "captions.language.ar": "Arabic",
  "captions.language.en": "English",
  "captions.changed":
    "The caption track changed elsewhere; your unsaved edits were set aside. Make them again.",
  "captions.unsaved":
    "Unsaved cue edits: save or discard them before other caption changes.",
  "captions.discard": "Discard edits",
  "captions.startOf": "Start of cue {n}",
  "captions.endOf": "End of cue {n}",
  "captions.textOf": "Text of cue {n}",
  "take.title": "Take review",
  "take.none": "No story shot has takes to review.",
  "take.unknown": "The takes could not be read right now.",
  "take.row": "{shot} — {name} ({hash})",
  "take.current": "Shown now",
  "take.notAssembled": "Assemble the story to replace this take.",
  "take.review": "Review this take",
  "take.clip": "Clip",
  "take.timing": "Timing",
  "take.span": "Starts at {start} s, lasts {duration} s",
  "take.from": "Now shows",
  "take.to": "Would show",
  "take.media": "{name} ({hash}) from {seconds} s",
  "take.titleCard": "title card {title}",
  "take.revision": "Project revision",
  "take.hash": "Proposal hash",
  "take.apply": "Apply this take",
  "take.dismiss": "Dismiss",
  "take.unnamed": "unnamed media",
  "take.failedOutcome": "The take was not applied. Review it again.",
  "take.unknownOutcome":
    "The connection was lost, so whether the take was applied is not known. Open the project again to see.",
  "take.busyOutcome":
    "The editor is busy, so nothing was sent. Review the take again.",
  "take.saveFirst": "Save your timeline changes before applying a take.",
  "take.stale":
    "The project changed, so this review no longer applies. Review the take again.",
  "take.applied":
    "Take applied as revision {revision}. Undo returns the previous take.",
  "take.refused": "The take was not applied: {message}",
  "story.list": "Stories and reference packs",
  "story.none": "This project has no story or reference pack yet.",
  "story.refresh": "Read stories again",
  "story.summary": "{title} — shots: {shots}; title cards: {cards}",
  "story.pack":
    "{name} — references: {entries}; linked likeness consents: {likeness}",
  "story.unknown":
    "The stories and reference packs could not be read right now.",
  "engine.unknown":
    "Whether generative operations can run here is not known right now.",
  "engine.reason.ENGINE_DISABLED":
    "Generative engines are turned off in this build. Editing, rendering and export work without them.",
  "engine.reason.WEIGHTS_ABSENT":
    "The model files for this operation are not installed on this computer, or failed their check. Yamakan never downloads them.",
  "engine.reason.HARDWARE_UNQUALIFIED":
    "This computer is not qualified for this operation, or its qualification has expired.",
  "engine.reason.RIGHTS_UNQUALIFIED":
    "The model's license does not allow this use.",
  "engine.available": "Available.",
  "engine.present":
    "The model files are in place; they are checked in full when the engine starts.",
  "engine.op.textToVideo": "Text to video",
  "engine.op.imageToVideo": "Image to video",
  "engine.op.videoEdit": "Video edit",
  "engine.op.transcribe": "Transcribe",
  "engine.op.enhance": "Enhance",
  "tools.jobs":
    "Jobs expose progress, cancellation, errors and verified video artifacts. Project paths and arbitrary commands are not accepted by the API.",
  "toolbar.unsaved": "Unsaved changes",
  "action.undo": "Undo",
  "action.redo": "Redo",
  "action.save": "Save",
  "action.export": "Export video",
  "transport.play": "Play",
  "proxy.toggle": "Edit proxies",
  "proxy.summary":
    "{ready} of {total} videos use a proxy · {building} preparing · export always uses the originals",
  "proxy.off": "Preview plays the original videos",
  "transport.pause": "Pause",
  "transport.playhead": "Playhead",
  "transport.seconds": "{seconds} s",
  "scene.heading": "Scene & shot",
  "scene.add": "Add scene",
  "scene.default": "Scene {n}",
  "scene.name": "Scene name",
  "scene.focal": "Focal length (mm)",
  "scene.scale": "Shot scale",
  "scene.movement": "Movement",
  "scene.scale.wide": "wide",
  "scene.scale.medium": "medium",
  "scene.scale.close": "close",
  "scene.movement.static": "static",
  "scene.movement.dolly": "dolly",
  "scene.movement.pan": "pan",
  "scene.movement.orbit": "orbit",
  "hint.camera":
    "Camera settings record shot intent. They do not change imported footage.",
  "title.heading": "Title",
  "title.text": "Title text",
  "title.add": "Add title",
  "track.titles": "Titles",
  "track.picture": "Picture",
  "track.audio": "Audio",
  "job.QUEUED": "Export queued",
  "job.RUNNING": "Export running",
  "job.COMPLETED": "Export completed",
  "job.FAILED": "Export failed",
  "job.CANCELLED": "Export cancelled",
  "job.cancel": "Cancel export",
  "job.download": "Download MP4",
  "empty.title": "Your next production starts here.",
  "empty.body":
    "Create a local project, import media, plan a shot, edit the timeline and export a playable video.",
  "empty.persist":
    "Projects remain editable after closing and reopening Yamakan.",
  footer: "Yamakan engineering preview · Not a public release",
  "reference.region": "Reference preview",
  "reference.title": "Reference preview",
  "parity.exact": "This preview shows the timeline as the export will.",
  "parity.approximate":
    "This preview approximates {list}. The reference preview shows what the export contains.",
  "parity.titleFont": "titles (browser fonts and layout)",
  "parity.videoOnAudioTrack":
    "video on an audio track (the export plays only its sound)",
  "parity.extremeRetime": "speed below 1/4 or above 4x",
  "parity.audioFade": "audio fades (not played)",
  "parity.gainAboveUnity": "gain above 0 dB",
  "parity.animation": "clip animation (not drawn)",
  "parity.effectCrop": "a transform's crop (not drawn)",
  "parity.transition": "a dissolve (shown as a cut)",
  "parity.lut": "a LUT (not applied)",
  "reference.empty": "Add a clip or title to see the reference preview.",
  "reference.state": "Saved revision {revision}, frame {frame}",
  "reference.stale": "Stale: save to include your latest edits",
  "reference.save": "Save and refresh",
  "reference.play": "Play reference (2 s)",
  "reference.segment": "Reference segment",
  "reference.alt": "Reference frame {frame} of saved revision {revision}",
  "reference.rendering": "Rendering…",
  "reference.failed":
    "The reference preview could not be rendered for this revision.",
} as const;

export type MessageKey = keyof typeof en;

const ar: Record<MessageKey, string> = {
  "lang.label": "اللغة",
  "lang.switch": "English",
  "brand.tagline": "إنتاج إبداعي · مساحة عمل دون اتصال",
  "nav.production": "الإنتاج",
  "nav.tools": "أدوات الوكلاء",
  "workspace.label": "مساحات العمل",
  "workspace.create": "إنشاء",
  "create.runUncertain":
    "لا يُعرف هل وصل هذا إلى Kaggle. يجري التحقق، ولن يُرسل مرة أخرى.",
  "create.runHeld":
    "مساحة العمل هذه نسخة مستعادة، وهذا التشغيل يخص الأصل. لا تتم متابعته هنا.",
  "create.recordRetry": "حاول الحفظ مرة أخرى",
  "create.storyFull":
    "الفيديو في المشروع، لكن سجل الفيديوهات المنتجة ممتلئ، فلم يُحفظ ما يذكره إيصاله.",
  "create.storyUnread": "تعذرت قراءة مصدر فيديوهات هذا المشروع.",
  "create.kaggleSetup":
    "لتشغيله من هنا، شغّل Yamakan مع ضبط YAMAKAN_KAGGLE_CLI على المسار الكامل لأداة Kaggle وYAMAKAN_KAGGLE_USERNAME على اسم المستخدم.",
  "create.agree":
    "أرسل هذا الوصف والبذرة إلى دفتر Kaggle الخاص بي باستخدام حصتي المجانية من GPU. نحو {minutes} دقيقة. يغادر الوصف هذا الحاسوب، ويحتفظ به Kaggle في سجل الدفتر. يعود الفيديو إلى هنا، ويبقى النموذج على Kaggle.",
  "create.agreePicture":
    "أرسل هذا الوصف والبذرة والصورة إلى دفتر Kaggle الخاص بي باستخدام حصتي المجانية من GPU. نحو {minutes} دقيقة. يغادر الوصف والصورة هذا الحاسوب، ويحتفظ بهما Kaggle في سجل الدفتر، ولا يصل إليهما سحب الموافقة لاحقًا. يعود الفيديو إلى هنا، ويبقى النموذج على Kaggle.",
  "create.picture": "البدء من صورة",
  "create.pictureNone": "بلا صورة: من الوصف وحده",
  "create.pictureNote":
    "لا تظهر هنا إلا الصور الثابتة بصيغتي PNG وJPEG في هذا المشروع. ما يُرسل نسخة تُصنع من بكسلات الصورة، مُلاءَمة لإطار النموذج، دون بيانات الكاميرا أو أي بيانات أخرى.",
  "create.noRealPerson":
    "لا تُظهر هذه الصورة أي شخص حقيقي، أو تُظهر فقط أشخاصًا سُجّلت موافقتهم على إرسالها.",
  "create.peopleTitle": "الأشخاص والموافقة",
  "create.peopleNote":
    "لا تُستخدم صورة شخص حقيقي إلا بموافقته المسجلة هنا. تتيح الموافقة على صنع الفيديو ربط صورة ثابتة له به. وتتيح الموافقة على الإرسال كذلك أن تغادر تلك الصورة هذا الحاسوب إلى دفتر Kaggle الخاص بك. السحب يوقف أي استخدام لاحق نهائيًا، ولا يصل إلى ما يحتفظ به Kaggle بالفعل. وتبقى الصورة الثابتة بعد ربطها مرتبطة بتلك الموافقة، حتى بعد التراجع.",
  "create.peopleName": "الاسم",
  "create.peopleVersion": "ما وافق عليه، مثل النموذج الذي وقّعه",
  "create.peopleDays": "لمدة",
  "create.peopleDaysOption": "{days} يومًا",
  "create.peopleAttest":
    "وافق الشخص الظاهر، أو من يحق له التصرف عنه، على صنع فيديوهات من صورته.",
  "create.peopleGrant": "تسجيل الموافقة",
  "create.peopleEmpty": "لا توجد موافقة مسجلة.",
  "create.peopleGenerate": "موافقة على صنع الفيديو: {version}، حتى {until}.",
  "create.peopleSend": "موافقة على الإرسال إلى Kaggle، حتى {until}.",
  "create.peopleNoSend":
    "لا يمكن إرسال الصور المرتبطة بهذه الموافقة إلى Kaggle: لا توجد موافقة على الإرسال مسجلة لها.",
  "create.peopleSendAttest":
    "وافق أيضًا على أن تغادر صوره هذا الحاسوب إلى دفتر Kaggle الخاص بي، الذي يحتفظ بها في سجله.",
  "create.peopleAllowSend": "تسجيل الموافقة على الإرسال لمدة {days} يومًا",
  "create.peopleNoSendExpired":
    "انتهت هذه الموافقة، لكن الصور الثابتة المرتبطة بها لا تزال تحتاج إلى موافقة خاصة على الإرسال قبل أن تذهب إلى Kaggle.",
  "create.peopleRevalidateSend": "تأكيد الموافقة على الإرسال مجددًا",
  "create.peopleAlreadyLinked":
    "هذه الصورة الثابتة مرتبطة بهذه الموافقة بالفعل.",
  "create.peopleLinked": "الصور الثابتة المرتبطة: {names}",
  "create.peopleLinkStill": "صورة ثابتة له",
  "create.peopleLink": "ربطها به",
  "create.peopleRevoke": "سحب الموافقة",
  "create.peopleRevokeSend": "سحب الموافقة على الإرسال",
  "create.peopleRevokeSure": "السحب نهائيًا",
  "create.peopleRevalidate": "التأكيد مجددًا",
  "create.peopleState.revoked": "مسحوبة.",
  "create.peopleState.expired": "منتهية.",
  "create.peopleState.revalidate":
    "من قبل الاستعادة: أكّدها مجددًا لاستخدامها.",
  "create.peopleFailed": "لم يُحفظ ذلك.",
  "create.peopleUnread": "تعذّرت قراءة الموافقات.",
  "create.elementsTitle": "الأماكن والأغراض",
  "create.elementsNote":
    "تُحفظ مع هذا المشروع كسجل، ويمكن تثبيتها على لقطة إن شئت. لا تُرسل إلى أي نموذج ولا تغيّر ما يُولَّد. وحفظ أي منها أو تثبيته يُنهي التراجع عمّا سبقه. لا تحفظ هنا صورة شخص حقيقي، ولو على أنها شخصية خيالية: فذلك يحتاج إلى موافقة لا يطلبها هذا القسم.",
  "create.elementName": "الاسم",
  "create.elementRole": "النوع",
  "create.elementRole.environment": "مكان",
  "create.elementRole.prop": "غرض",
  "create.elementRole.wardrobe": "أزياء",
  "create.elementRole.style": "أسلوب",
  "create.elementRole.fictional": "شخصية مرسومة أو خيالية",
  "create.elementAdd": "اختر صورة",
  "create.elementAddImage": "أضف صورة أخرى",
  "create.elementOnShots": "في هذه اللقطات",
  "create.elementOlder": "نسخة أقدم",
  "create.elementImageType": "يقبل هذا صور PNG أو JPEG.",
  "create.elementNotKept":
    "ربما لم تدخل تلك الصورة. تحقّق من ملفات هذا المشروع قبل المحاولة مجددًا.",
  "create.elementImageOnly":
    "دخلت الصورة إلى ملفات المشروع، وتعذّر حفظ هذا معها. السبب في أعلى الصفحة.",
  "create.elementNotPinned":
    "ربما لم يُحفظ ذلك على اللقطة. أعد فتح المشروع لترى.",
  "create.elementsUnread": "تعذّرت قراءة ما يحفظه هذا المشروع هنا.",
  "create.elementFull": "يضم هذا كل ما يتسع له من صور.",
  "create.elementGone": "لم يعد ذلك في هذا المشروع. لم يُضَف شيء.",
  "create.elementShotFull": "تضم تلك اللقطة كل ما تتسع له.",
  "create.needPrompt": "صف اللقطة أولًا.",
  "create.notFromHere":
    "لم يُختبر هذا النموذج من هذه الصفحة بعد، فلا يمكن تشغيله من هنا.",
  "create.generate": "إنتاج على Kaggle",
  "create.starting": "جارٍ الإرسال إلى Kaggle",
  "create.startFailed": "تعذر بدء التشغيل.",
  "create.runQueued": "ينتظر {name} وحدة GPU على Kaggle.",
  "create.runRunning": "يعمل {name} على Kaggle.",
  "create.runDone": "انتهى {name}. جرى التحقق من الفيديو مقابل إيصاله.",
  "create.runFailed": "لم ينتج فيديو عن تشغيل {name} هذا.",
  "create.runCancelled": "يُظهر Kaggle أن آخر تشغيل لهذا الدفتر قد أُوقف.",
  "create.runUnknown": "لا يجيب Kaggle. قد يكون التشغيل مستمرًا.",
  "create.runStopped": "توقفت متابعة هذا التشغيل.",
  "create.runLost": "لا يوجد لدى Yamakan سجل لهذا التشغيل.",
  "create.runClock": "{elapsed} حتى الآن، من نحو {minutes} دقيقة",
  "create.runStop": "إيقاف المتابعة",
  "create.runStopNote":
    "لا يستطيع Yamakan إيقاف تشغيل على Kaggle. إيقاف المتابعة يتركه يعمل، حتى حد {minutes} دقيقة، مستخدمًا حصتك. لإيقافه هناك:",
  "create.runGoesOn":
    "قد يكون ما زال يعمل على Kaggle، حتى حد {minutes} دقيقة، مستخدمًا حصتك. لرؤيته أو إيقافه:",
  "create.openNotebook": "افتح دفتره",
  "create.runBringIn": "إحضاره إلى هذا المشروع",
  "create.bringInFailed":
    "تعذر إحضار الفيديو. يوضح السطر أعلى الصفحة السبب؛ حاول مرة أخرى.",
  "create.runBroughtIn": "أنتج {name} هذا الفيديو. وهو في القائمة هنا.",
  "create.runRetry": "حاول مرة أخرى",
  "create.runDismiss": "تم",
  "create.seedInvalid": "البذرة عدد صحيح من 0 إلى 4294967295.",
  "create.modelFacts":
    "شُغّل حتى الآن بدقة {width}x{height}، {frames} إطارًا بمعدل {fps} إطارًا في الثانية ({seconds} ث)، نحو {minutes} دقيقة إجمالًا على T4 مجاني في Kaggle، شاملة التحميل الأول. {licence}.",
  "create.negativePrompt": "يطلب دفتره أيضًا تجنّب: {words}.",
  "create.readsLittle":
    "لا يقرأ هذا النموذج إلا نحو أول {words} كلمة من الوصف، وقد دُرّب على الإنجليزية. قد لا يُقرأ ما بعد ذلك، بما فيه كلمات الإخراج المضافة في آخره، وقد لا تُفهم اللغات الأخرى.",
  "create.engineChecking": "جارٍ التحقق مما يمكن تشغيله هنا.",
  "create.engineUnknown": "تعذر التحقق مما يمكن تشغيله هنا.",
  "create.engineFound":
    "عُثر على محرك في هذا الجهاز، لكن Yamakan لا يستطيع تشغيله من هنا بعد.",
  "create.engineOff": "لا يستطيع Yamakan تشغيل نموذج على هذا الجهاز بعد.",
  "create.outside":
    "شُغّل هذا النموذج في دفتر Kaggle خاص: {folder}. يُضبط وصفه وبذرته في ذلك الملف، لا من هذه الصفحة. يمكن بعدها إحضار الفيديو وإيصاله إلى هنا.",
  "create.bringInNote":
    "أضف الإيصال للتحقق من أن هذا هو الملف الذي يصفه. لا تثبت المطابقة صحة نموذجه أو بذرته أو وصفه: يمكن لأي شخص كتابة إيصال.",
  "create.receiptNotFinished":
    "هذا الإيصال من تشغيل لم يكتمل أو لم يجتز فحوصه، فلم يُحضر شيء.",
  "create.tooLargeToCheck":
    "هذا الفيديو أكبر من أن يُطابق مع إيصال هنا، فلم يُحضر شيء. أزل الإيصال لإحضاره دونه.",
  "create.checkFailed": "تعذرت قراءة هذا الفيديو للتحقق منه، فلم يُحضر شيء.",
  "create.importFailed": "تعذر إحضار الفيديو. يوضح سطر الحالة أعلاه السبب.",
  "create.busy": "Yamakan مشغول، فلم يُحضر شيء. حاول مرة أخرى بعد قليل.",
  "create.notKept": "الفيديو في المشروع، لكن تعذر حفظ ما يذكره إيصاله معه.",
  "create.broughtIn": "أُحضر {name} دون التحقق من إيصال.",
  "create.broughtInChecked": "أُحضر {name}. وهو يطابق إيصاله.",
  "create.broughtInCopy":
    "أُحضر {name}. طابق الملف إيصاله، ثم حُوّل إلى معدل إطارات ثابت.",
  "create.receiptMatched":
    "يذكر سجل هذا المشروع أن بصمة هذا الملف طابقت إيصاله عند إحضاره.",
  "create.receiptMatchedOriginal":
    "يذكر سجل هذا المشروع أن بصمة الملف الأصلي طابقت إيصاله عند إحضاره. هذه نسخة محوّلة.",
  "create.receiptSays": "يذكر الإيصال:",
  "create.prompt": "صف اللقطة",
  "create.promptHint": "قارب ورقي يطفو ببطء على جدول هادئ.",
  "create.promptCount": "{count} من {limit} حرفًا",
  "directorCinema.title": "تصيير لقطة من القصة باستخدام Blender",
  "directorCinema.note":
    "يخطّط المخرج اللقطة مشهدًا سينمائيًا من إرشاداتها ويصيّرها على هذا الحاسوب. توافق أنت على الفيديو قبل أن يصبح لقطة مأخوذة للمشهد ويوضع على الخط الزمني.",
  "directorCinema.noShots":
    "لا توجد لقطات قصة في هذا المشروع بعد. أنشئ قصة في صفحة الإنشاء أولًا.",
  "directorCinema.shot": "لقطة القصة",
  "directorCinema.chooseShot": "اختر لقطة",
  "directorCinema.render": "خطّط وصيِّر",
  "directorCinema.sendForApproval": "اطلب الموافقة",
  "directorCinema.approve": "وافق على الفيديو",
  "directorCinema.place": "اجعله لقطة مأخوذة للمشهد وضعه",
  "directorCinema.followed": "مُتّبع: {list}.",
  "directorCinema.notFollowed":
    "غير مُتّبع (لا يستطيع التصيير صنعه بعد): {list}.",
  "directorCinema.rendered":
    "صُيِّر باستخدام Blender. شاهده في وسائط المشروع، ثم اطلب الموافقة.",
  "directorCinema.awaiting": "بانتظار موافقتك.",
  "directorCinema.approved": "تمت الموافقة.",
  "directorCinema.placed":
    "صُيِّر باستخدام Blender. الفيديو هو اللقطة المأخوذة للمشهد وهو على الخط الزمني.",
  "directorCinema.partlyPlaced":
    "بعض لقطات هذه القصة الأخرى على الخط الزمني، لكن ليس هذه. ضع لقطات القصة معًا.",
  "directorCinema.clipRemoved":
    "هذه اللقطة على الخط الزمني دون مقطعها. تراجع عن إزالة المقطع في المحرر، ثم ضعه مجددًا.",
  "directorCinema.takeChanged":
    "تختار القصة الآن لقطة مأخوذة أخرى لهذه اللقطة. اختر لقطة هذا التصيير مجددًا، أو ابدأ من جديد.",
  "directorCinema.startOver": "ابدأ من جديد (يبقى الفيديو في المشروع)",
  "directorCinema.storyGone": "لم تعد القصة أو لقطتها موجودة.",
  "directorCinema.takesFull":
    "لهذه اللقطة 8 لقطات مأخوذة، وهو أقصى ما تحفظه اللقطة. احذف واحدة أولًا.",
  "presets.title": "محفوظة في هذا المشروع",
  "presets.reading": "جارٍ قراءة الأوصاف المحفوظة في المشروع…",
  "presets.none":
    "لا توجد أوصاف محفوظة بعد. املأ قالبًا أو اكتب وصفًا، ثم احفظه هنا.",
  "presets.unreadable": "تعذّرت قراءة الأوصاف المحفوظة في هذا المشروع.",
  "presets.name": "اسم الوصف المحفوظ",
  "presets.fromBrief": "وصفي",
  "presets.save": "احفظ الوصف",
  "presets.use": "استخدم",
  "presets.useNamed": "استخدم الوصف المحفوظ {name}",
  "presets.remove": "احذف",
  "presets.removeNamed": "احذف الوصف المحفوظ {name}",
  "presets.taken": "يوجد وصف محفوظ بهذا الاسم.",
  "presets.full": "يحفظ المشروع {limit} وصفًا على الأكثر.",
  "presets.notSaved": "لم تُحفظ الأوصاف. السبب مذكور في سطر الحالة.",
  "library.title": "مكتبة الأوصاف",
  "library.note":
    "قوالب كُتبت لـ Yamakan بالعربية والإنجليزية. ابحث، واملأ الأجزاء، وضع الوصف في الأعلى. تعمل دون اتصال.",
  "library.search": "بحث",
  "library.searchHint": "مطر، دوران، منتج، rain…",
  "library.category": "الفئة",
  "library.kind": "النوع",
  "library.kind.video": "فيديو",
  "library.kind.image": "صورة ثابتة",
  "library.all": "الكل",
  "library.found": "القوالب الموجودة: {count}",
  "library.language": "اكتب الوصف بـ",
  "library.language.en": "الإنجليزية (تفهمها معظم النماذج أفضل)",
  "library.language.ar": "العربية",
  "library.use": "استخدم هذا الوصف",
  "library.replace": "استبدل الوصف",
  "library.add": "أضف إلى الوصف",
  "library.credit": "كل القوالب من كتابة Yamakan.",
  "library.tooLong":
    "الوصف مع الإضافة يتجاوز {limit} حرفًا. اختصر الوصف أولًا.",
  "create.direction": "الإخراج",
  "create.direction.shot": "اللقطة",
  "create.direction.movement": "الحركة",
  "create.direction.lens": "العدسة",
  "create.direction.light": "الإضاءة",
  "create.direction.none": "غير محدد",
  "create.directionNote":
    "تضيف هذه الخيارات كلمات إلى الوصف فقط. لا يملك أي من النموذجين إعدادات للكاميرا، وقد لا يتبعها.",
  "create.model": "النموذج",
  "create.seed": "البذرة",
  "create.finalPrompt": "ما سيتلقاه النموذج",
  "create.finalPromptEmpty": "لا شيء بعد.",
  "create.copy": "نسخ الوصف",
  "create.copied": "نُسخ",
  "create.copyFailed": "تعذر نسخ الوصف.",
  "create.engineTitle": "الإنتاج",
  "create.bringInTitle": "إحضار فيديو",
  "create.receipt": "الإيصال (اختياري)",
  "create.receiptClear": "إزالة الإيصال",
  "create.bringIn": "اختيار فيديو",
  "create.receiptInvalid": "هذا الملف ليس إيصال تشغيل، فلم يُحضر شيء.",
  "create.receiptMismatch":
    "هذا الفيديو ليس الملف الذي يصفه الإيصال، فلم يُحضر شيء.",
  "create.videos": "الفيديوهات في هذا المشروع",
  "create.noVideos": "لا توجد فيديوهات بعد.",
  "create.noReceipt": "لا يوجد إيصال",
  "create.place": "إضافة إلى المخطط الزمني",
  "create.placeAgain": "إضافة مرة أخرى",
  "create.placed": "أُضيف {name} إلى المخطط الزمني.",
  "create.openEdit": "فتح في التحرير",
  "workspace.story": "القصة",
  "workspace.edit": "التحرير",
  "workspace.finish": "الإنهاء",
  "workspace.storyIntro":
    "الموجز والمشاهد واللقطات، مع المخرج ومعاينة السينما.",
  "workspace.finishIntro":
    "المُخرَج ومهمة التصدير وأدوات الوكلاء. صدّر من شريط الأدوات؛ تظهر المهمة في كل مساحة عمل.",
  "workspace.output": "المُخرَج {size}، {seconds} ث",
  "workspace.openStudio": "فتح الاستوديو",
  "badge.local": "وسائط محلية · تصيير بالمعالج",
  "status.initial": "أنشئ مشروعًا أو افتح مشروعًا للبدء.",
  "session.locked":
    "افتح يماكن بالرابط الذي طبعه عند تشغيله (وهو محفوظ أيضًا في ملف launch في مساحة العمل). فتح العنوان وحده لا يسجّل دخولك.",
  "status.working": "جارٍ العمل…",
  "status.opened": "فُتح {name}، المراجعة {revision}.",
  "status.saved": "حُفظت المراجعة {revision}.",
  "status.documentUnsaved":
    "احفظ أولًا تعديلات الترجمة النصية أو اللوحة غير المحفوظة. ينتظرها التراجع عن التغييرات المحفوظة وإعادتها واستعادتها.",
  "status.conflictReloaded":
    "تغيّر هذا المشروع في مكان آخر ولم يعد تعديلك الأخير ينطبق عليه. تُعرض النسخة الحالية، ويمكن تنزيل تعديلك.",
  "status.mergedAfterConflict":
    "تغيّر هذا المشروع في مكان آخر؛ طُبِّق تعديلك على النسخة الحالية.",
  "status.draftNeedsSave":
    "يُحتفظ بهذا التعديل كمسودة: اضغط حفظ لحفظ المشروع كاملًا.",
  "conflict.unapplied":
    "لم يُطبَّق تعديلك الأخير لأن المشروع تغيّر في مكان آخر.",
  "conflict.download": "تنزيل تعديلي",
  "conflict.dismiss": "إغلاق",
  "error.operation": "تعذّر إتمام العملية.",
  "error.edit": "تعديل غير صالح.",
  "error.assetMissing": "الوسيط غير موجود.",
  "error.track": "اختر مسارًا متوافقًا غير مقفل.",
  "projects.title": "المشاريع",
  "projects.name": "اسم المشروع",
  "projects.defaultName": "إنتاج بلا عنوان",
  "projects.create": "إنشاء مشروع",
  "projects.revision": "المراجعة {revision}",
  "projects.history": "السجل والاستعادة",
  "localEngine.title": "محرك التوليد المحلي",
  "localEngine.note":
    "أنت من يشغّل المحرك. هذا يقرأ حالته فقط: لا يشغّل شيئًا ولا يثبّت شيئًا ولا يولّد شيئًا.",
  "localEngine.check": "فحص المحرك",
  "localEngine.unknown": "غير معروف",
  "localEngine.notConfigured":
    "لم يُضبط أي محرك. اضبط YAMAKAN_COMFYUI_URL على عنوانه في هذا الجهاز ثم أعد تشغيل يماكن.",
  "localEngine.unreachable": "لم يستجب المحرك المضبوط.",
  "localEngine.reachable": "استجاب المحرك: الإصدار {version}، على {device}.",
  "localEngine.startedSafely":
    "يُبلغ عن تشغيل آمن: دون اتصال، وبلا عُقد مخصصة، وعلى هذا الجهاز فقط.",
  "localEngine.startedUnsafely": "لن يستخدمه يماكن كما شُغّل.",
  "localEngine.missing": "شغّله مع: {flags}.",
  "localEngine.refused": "شغّله بدون: {flags}.",
  "localEngine.exposed": "يمكن الوصول إليه أيضًا من خارج هذا الجهاز.",
  "localEngine.generationUnavailable":
    "التوليد غير متاح في هذا الإصدار. والاتصال السليم لا يغيّر ذلك.",
  "backups.title": "النسخ الاحتياطية",
  "backups.note":
    "تنسخ النسخة الاحتياطية قاعدة البيانات (ومعها المستندات الإبداعية) والوسائط المتحقَّق منها وملفات المشاهد الأقدم إلى مجلد بجوار مساحة العمل هذه وأنت تواصل العمل. تُنشئ الاستعادة مجلد مساحة عمل جديدًا ولا تغيّر هذا المجلد.",
  "backups.create": "إنشاء نسخة احتياطية الآن",
  "backups.show": "عرض النسخ الاحتياطية",
  "backups.none": "لا توجد نسخ احتياطية بعد.",
  "backups.summary": "{date} · عدد المشاريع: {projects} · {size} ميغابايت",
  "backups.damaged": "وسائط تالفة لم تُنسخ: {count}",
  "backups.incomplete": "{id} · غير مكتملة، لا يمكن استعادتها",
  "backups.partialScope":
    "لم يثبت اكتمالها: صيغة نسخ احتياطي أقدم، أو تعذّر نسخ شيء ما.",
  "backups.restore": "استعادة إلى مجلد جديد",
  "backups.made": "أُنشئت النسخة الاحتياطية.",
  "backups.madeDamaged":
    "أُنشئت النسخة الاحتياطية، لكن تعذّر نسخ ملفات وسائط تالفة عددها {count}.",
  "backups.restored":
    "استُعيدت في مجلد مساحة عمل جديد: {folder}. شغّل يماكن مع هذا المجلد مساحةً للعمل لفتحه.",
  "backups.restoredQuarantined":
    "استُعيدت في مجلد مساحة عمل جديد: {folder}. عُزلت ملفات وسائط تعذّر التحقق منها، وعددها {count}. شغّل يماكن مع هذا المجلد مساحةً للعمل لفتحه.",
  "backups.restoredQuarantinedHeld":
    "استُعيدت في مجلد مساحة عمل جديد: {folder}. عُزلت ملفات وسائط تعذّر التحقق منها، وعددها {count}. تنتظر هناك مهام منسوخة من مساحة العمل هذه حتى تعيد تشغيلها أو تتجاهلها، وعددها {held}. شغّل يماكن مع هذا المجلد مساحةً للعمل لفتحه.",
  "backups.restoredHeld":
    "استُعيدت في مجلد مساحة عمل جديد: {folder}. تنتظر هناك مهام منسوخة من مساحة العمل هذه حتى تعيد تشغيلها أو تتجاهلها، وعددها {count}. شغّل يماكن مع هذا المجلد مساحةً للعمل لفتحه.",
  "assets.title": "الوسائط",
  "assets.import": "استيراد وسائط محلية",
  "assets.kind.image": "صورة",
  "assets.kind.video": "فيديو",
  "assets.kind.audio": "صوت",
  "assets.size": "{kb} ك.ب",
  "preview.clipStatus": "{count} مقاطع · مُصيِّر اللوحة",
  "import.failed": "تعذّر الاستيراد.",
  "import.converting": "جارٍ تحويل {name} إلى معدل إطارات ثابت قبل التحرير…",
  "import.stillConverting":
    "لا يزال تحويل {name} جاريًا، وسيظهر في قائمة الوسائط عند اكتماله.",
  "import.incomplete": "لم يكتمل التحويل.",
  "import.converted":
    "استُورد {name} بمعدل إطارات ثابت. انقر عليه لإضافته إلى الخط الزمني.",
  "import.done": "استُورد {name}. انقر عليه لإضافته إلى الخط الزمني.",
  "hint.media":
    "تبقى الوسائط على هذا الحاسوب. يمكن لمقاطع الفيديو مزج صوتها عند تفعيله أدناه. لم تُفعَّل أي خدمة استدلال بعد.",
  "clip.sound.heading": "صوت المقطع",
  "clip.sound.enable": "استخدام صوت مقطع الفيديو",
  "clip.sound.gain": "كسب الصوت (dB)",
  "clip.sound.noAudio": "لا يحتوي هذا الوسيط على مسار صوت.",
  "clip.sound.notVideo": "اختر مقطع فيديو لتعديل صوته.",
  "clip.animation.heading": "تحريك المقطع",
  "clip.animation.startOpacity": "الشفافية عند البداية",
  "clip.animation.endOpacity": "الشفافية عند النهاية",
  "clip.animation.startVolume": "مستوى الصوت عند البداية",
  "clip.animation.endVolume": "مستوى الصوت عند النهاية",
  "clip.animation.apply": "تطبيق مفاتيح الشفافية",
  "clip.animation.applyVolume": "تطبيق مفاتيح مستوى الصوت",
  "clip.animation.clear": "مسح التحريك",
  "clip.animation.hint":
    "مفتاحان من بداية المقطع إلى نهايته. المعاينة والتصدير يستخدمان نفس العيّنة.",
  "clip.animation.none":
    "اختر مقطع وسائط لتعديل مفاتيح الشفافية أو مستوى الصوت.",
  "history.label": "سجل المشروع",
  "history.title": "سجل المشروع والاستعادة",
  "history.current": "المشروع {id} · المراجعة الحالية {revision}",
  "history.unverified": "غير متحقَّق منها",
  "history.note":
    "تُنشئ الاستعادة مراجعة جديدة، وتُحفظ اللقطات الحالية والمراجعة السابقة كما هي.",
  "history.unverifiable":
    "تعذّر التحقق من المشروع الحالي. اختر لقطة متحقَّقًا منها لاستعادته.",
  "history.item": "المراجعة {revision} · {name}",
  "history.restore": "استعادة المراجعة {revision}",
  "history.saveFirst":
    "احفظ تعديلاتك أو نزّل مسودة غير محفوظة قبل الاستعادة. تحتفظ مسودة JSON بالتعديلات، وتبقى الوسائط في مساحة العمل هذه.",
  "history.downloadDraft": "تنزيل المسودة غير المحفوظة",
  "history.close": "إغلاق السجل",
  "tools.title": "أدوات الوكلاء في يماكن",
  "tools.intro":
    "يعتمد المحرِّر وواجهة REST المحلية على عمليات المشروع والتصيير نفسها التي جرى التحقق منها.",
  "tools.catalog": "عرض دليل الأدوات ذي الإصدارات",
  "agents.title": "وصول الوكلاء",
  "agents.intro":
    "أنشئ رمزاً لوكيل (خادم MCP أو برنامج نصي) لا يفعل إلا ما تسمح به. أعطِ الوكيل هذا الرمز، لا رمز مساحة العمل نفسها.",
  "agents.label": "الاسم",
  "agents.scopes": "يمكنه أن",
  "agents.scope.projectRead": "يقرأ المشاريع",
  "agents.scope.projectWrite": "يغيّر المشاريع",
  "agents.scope.projectRecover": "يستعيد نسخاً سابقة",
  "agents.scope.renderExecute": "يصدّر الفيديو",
  "agents.scope.jobRead": "يرى المهام",
  "agents.scope.jobControl": "يبدأ المهام ويوقفها",
  "agents.end": "ينتهي",
  "agents.end.choose": "اختر متى ينتهي",
  "agents.end.7": "بعد ٧ أيام",
  "agents.end.30": "بعد ٣٠ يوماً",
  "agents.end.90": "بعد ٩٠ يوماً",
  "agents.end.never": "لا ينتهي (حتى تلغيه)",
  "agents.create": "إنشاء الرمز",
  "agents.why.noScope": "اختر شيئاً واحداً على الأقل يمكنه فعله.",
  "agents.why.noEnd": "اختر متى ينتهي.",
  "agents.why.labelTooLong": "الاسم أطول من ٨٠ حرفاً.",
  "agents.made.title": "رمز جديد:",
  "agents.made.once":
    "يظهر الآن فقط، ويضيع إن غادرت هذه اللوحة قبل حفظه. احفظه حيث لا يقرؤه إلا الوكيل: من يملكه يستطيع فعل ما يسمح به.",
  "agents.made.copy": "نسخ",
  "agents.made.copied": "تم النسخ.",
  "agents.made.copyFailed": "تعذّر النسخ؛ حدّد الرمز وانسخه.",
  "agents.made.done": "لقد احتفظت به",
  "agents.loading": "جارٍ تحميل رموز الوكلاء…",
  "agents.none": "لا توجد رموز وكلاء بعد.",
  "agents.unnamed": "رمز بلا اسم",
  "agents.status.active": "فعّال",
  "agents.status.ended": "منتهٍ",
  "agents.status.revoked": "ملغى",
  "agents.status.unreadable": "غير صالح للاستخدام (تعذّرت قراءة سجله)",
  "agents.scopesUnreadable": "تعذّرت قراءة ما يمكنه فعله.",
  "agents.separator": "، ",
  "agents.created": "أُنشئ {date}",
  "agents.ends": "ينتهي {date}",
  "agents.ended": "انتهى {date}",
  "agents.endsUnreadable": "تعذّرت قراءة موعد انتهائه، فهو منتهٍ",
  "agents.createdUnreadable": "أُنشئ في وقت تعذّرت قراءته",
  "agents.endsNever": "لا ينتهي",
  "agents.revoke": "إلغاء",
  "agents.revokeNow": "ألغِه الآن",
  "agents.cancel": "تراجع",
  "studio.title": "لوحة الاستوديو",
  "studio.save": "حفظ الاستوديو",
  "studio.reload": "إعادة تحميل اللوحة المحفوظة",
  "studio.state.loading": "جارٍ فتح لوحة الاستوديو الخاصة بالمشروع…",
  "studio.state.new": "لوحة جديدة: لم تُحفظ بعد",
  "studio.state.saved": "حُفظت في المشروع",
  "studio.state.saving": "جارٍ الحفظ…",
  "studio.state.conflict":
    "حفظت نافذة أخرى هذه اللوحة أولاً. أعد تحميل اللوحة المحفوظة للمتابعة.",
  "studio.state.error": "تعذّر حفظ لوحة الاستوديو.",
  "studio.state.unavailable":
    "حفظ لوحات الاستوديو في المشروع غير مفعّل في هذه الخدمة.",
  "studio.state.turnedOff":
    "حفظ لوحات الاستوديو موقوف في هذه الخدمة. لن تُحفظ هذه اللوحة؛ أما اللوحات المحفوظة فتبقى وتُفتح من جديد عند إعادة تشغيل الحفظ.",
  "studio.noProject": "افتح مشروعاً للاحتفاظ بلوحة الاستوديو الخاصة به.",
  "cinema.title": "كاميرا السينما",
  "cinema.intro":
    "معاينة المشهد المدعومة والحفظ. كاميرا الذكاء الاصطناعي تبقى متوقفة.",
  "cinema.lens.title": "معاينة العدسة",
  "cinema.lens.preset": "{value} مم",
  "cinema.lens.fov": "زاوية الرؤية العمودية: {value}°",
  "cinema.lens.note":
    "تبقى التغييرات في هذه النافذة حتى تختار حفظ المشهد في المشروع. ولا تُستخدم أبداً لتوليد فيديو بالذكاء الاصطناعي.",
  "cinema.units": "القياس بالمتر. يُطبَّق الدوران حول X ثم Y ثم Z.",
  "blender.title": "التصيير باستخدام Blender",
  "blender.note":
    "يصيّر Blender المشهد المحفوظ على هذا الحاسوب دون اتصال، في فيديو قصير. قد يستغرق ذلك دقيقة أو أكثر.",
  "blender.unavailable": "التصيير باستخدام Blender غير متاح هنا:",
  "blender.size": "الحجم",
  "blender.sizeValue": "{width} × {height} بكسل",
  "blender.length": "المدة",
  "blender.seconds": "{n} ث",
  "blender.fps": "إطارات في الثانية",
  "blender.quality": "الجودة",
  "blender.quality.draft": "مسودة (الأسرع)",
  "blender.quality.good": "جيدة",
  "blender.quality.best": "الأفضل (الأبطأ)",
  "blender.orbit": "دوران الكاميرا",
  "blender.degrees": "{n} درجة",
  "blender.render": "تصيير",
  "blender.cancel": "إلغاء التصيير",
  "blender.place": "ضعه على الخط الزمني",
  "blender.saveFirst": "احفظ المشهد في المشروع قبل تصييره.",
  "blender.rendering": "جارٍ التصيير…",
  "blender.progress": "اكتمل {percent}٪",
  "blender.noVideo": "انتهى التصيير دون فيديو.",
  "blender.unknown": "لم يذكر Blender سبباً.",
  "blender.lost": "انقطعت متابعة التصيير مؤقتاً؛ تجري المحاولة مجدداً:",
  "blender.cancelFailed": "تعذّر إلغاء التصيير:",
  "blender.placeFailed": "تعذّر وضع الفيديو:",
  "blender.placeUnsaved": "تعذّر حفظ تغييرات المحرر أولاً؛ لم يُوضع شيء.",
  "blender.done": "صُيِّر باستخدام Blender. الفيديو في المشروع.",
  "blender.placed": "صُيِّر باستخدام Blender. الفيديو على الخط الزمني.",
  "blender.cancelled": "أُلغي التصيير.",
  "blender.failed": "فشل التصيير:",
  "cinema.unsupported": "غير متاح في السينما:",
  "cinema.unsupported.separator": "؛ ",
  "cinema.unsupported.aiCamera": "كاميرا يوجّهها الذكاء الاصطناعي",
  "cinema.unsupported.generativeVideo": "توليد فيديو من هذا المشهد",
  "cinema.unsupported.remoteMedia": "تحميل الوسائط من عناوين الويب",
  "cinema.objects.title": "العناصر",
  "cinema.objects.choose": "العنصر",
  "cinema.objects.none": "لا توجد عناصر في هذا المشهد. أضف صندوقاً للبدء.",
  "cinema.objects.left": "تحريك لليسار",
  "cinema.objects.right": "تحريك لليمين",
  "cinema.objects.forward": "إبعاد",
  "cinema.objects.back": "تقريب",
  "cinema.objects.up": "رفع",
  "cinema.objects.down": "خفض",
  "cinema.objects.turnLeft": "تدوير لليسار",
  "cinema.objects.turnRight": "تدوير لليمين",
  "cinema.objects.bigger": "تكبير",
  "cinema.objects.smaller": "تصغير",
  "cinema.objects.add": "إضافة صندوق",
  "cinema.objects.remove": "إزالة العنصر",
  "cinema.objects.boxName": "صندوق {n}",
  "cinema.objects.readout":
    "الموضع {x}، {y}، {z} م · مُدار {turn}° · الحجم {scale}×",
  "cinema.objects.full":
    "يحتوي هذا المشهد على أكبر عدد من العناصر تعدّله الصفحة ({max}).",
  "cinema.objects.note":
    "صناديق مؤقتة لتخطيط اللقطة. تُحفظ مع المشهد عند حفظه، ولا تُستخدم أبداً لتوليد فيديو بالذكاء الاصطناعي.",
  "cinema.project.save": "حفظ المشهد في المشروع",
  "cinema.project.reopen": "إعادة فتح المشهد المحفوظ",
  "cinema.project.none": "افتح مشروعاً للاحتفاظ بمشهد السينما الخاص به.",
  "cinema.project.loading": "جارٍ فتح مشهد السينما في المشروع…",
  "cinema.project.new": "لا يوجد مشهد سينما في هذا المشروع بعد: غير محفوظ",
  "cinema.project.saved": "محفوظ في المشروع",
  "cinema.project.changed": "التغييرات غير محفوظة",
  "cinema.project.saving": "جارٍ الحفظ…",
  "cinema.project.conflict":
    "تغيّر هذا المشهد في مكان آخر منذ فتحه هنا. أعد فتح المشهد المحفوظ للمتابعة؛ وتضيع التغييرات غير المحفوظة هنا.",
  "cinema.project.error": "تعذّر حفظ مشهد السينما: {message}",
  "cinema.project.loadError": "تعذّر فتح مشهد السينما في المشروع: {message}",
  "cinema.project.unavailable":
    "حفظ مشاهد السينما في المشروع غير مفعّل في هذه الخدمة.",
  "cinema.project.turnedOff":
    "حفظ مشاهد السينما متوقف في هذه الخدمة. لا يُحتفظ بهذا المشهد؛ وتُفتح المشاهد المحفوظة مجدداً عند إعادة تشغيل الحفظ.",
  "director.title": "المخرج",
  "director.unsupported": "غير متاح في المخرج:",
  "director.unsupported.separator": "؛ ",
  "director.unsupported.modelStages":
    "المراحل التي تحتاج إلى نموذج ذكاء اصطناعي",
  "director.unsupported.paidInference": "خدمات الذكاء الاصطناعي المدفوعة",
  "director.unsupported.agentApproval": "موافقة وكيل على مرحلة بدلاً من شخص",
  "director.intro": "مسارات المراحل اليدوية. مراحل النماذج تبقى متوقفة.",
  "engine.list": "عمليات التوليد",
  "clip.dissolve.heading": "مزج انتقالي",
  "clip.dissolve.none": "حدد مقطعًا على مسار فيديو يبدأ حيث ينتهي مقطع آخر.",
  "clip.dissolve.frames": "الطول (بالإطارات، عدد زوجي)",
  "clip.dissolve.length":
    "يستمر المزج عددًا زوجيًا صحيحًا من الإطارات، 2 على الأقل.",
  "clip.dissolve.apply": "ضبط المزج",
  "clip.dissolve.remove": "إزالة المزج",
  "clip.transform.heading": "التحويل",
  "clip.transform.none": "اختر لقطة فيديو أو صورة على مسار فيديو لتحويلها.",
  "clip.transform.scale": "الحجم (%)",
  "clip.transform.offsetX": "إزاحة لليمين (% من العرض)",
  "clip.transform.offsetY": "إزاحة للأسفل (% من الارتفاع)",
  "clip.transform.cropLeft": "قص من اليسار (%)",
  "clip.transform.cropTop": "قص من الأعلى (%)",
  "clip.transform.cropRight": "قص من اليمين (%)",
  "clip.transform.cropBottom": "قص من الأسفل (%)",
  "clip.transform.reset": "إعادة التحويل",
  "clip.transform.cropHint":
    "يظهر الحجم والموضع أثناء التشغيل؛ ويظهر القص في المعاينة المرجعية والتصدير.",
  "captions.title": "الترجمة النصية",
  "captions.import": "استيراد SRT أو WebVTT",
  "captions.none": "لا يحتوي هذا المشروع على مسار ترجمة بعد.",
  "captions.track": "مسار الترجمة",
  "captions.burnIn": "دمجها في الصورة (التصدير والمعاينة المرجعية)",
  "captions.start": "البداية (ث)",
  "captions.end": "النهاية (ث)",
  "captions.text": "النص",
  "captions.split": "التقسيم عند المؤشر",
  "captions.splitHint": "حرّك المؤشر داخل المقطع لتقسيمه عنده.",
  "captions.save": "حفظ المقاطع",
  "captions.exportSrt": "تنزيل SRT",
  "captions.exportVtt": "تنزيل WebVTT",
  "captions.tooLarge": "حجم ملف الترجمة 512 كيلوبايت على الأكثر.",
  "captions.language": "لغة الملف المستورد",
  "captions.language.ar": "العربية",
  "captions.language.en": "الإنجليزية",
  "captions.changed":
    "تغيّر مسار الترجمة في مكان آخر؛ نُحّيت تعديلاتك غير المحفوظة. أعد إجراءها.",
  "captions.unsaved":
    "تعديلات غير محفوظة على المقاطع: احفظها أو تجاهلها قبل أي تغيير آخر في الترجمة.",
  "captions.discard": "تجاهل التعديلات",
  "captions.startOf": "بداية المقطع {n}",
  "captions.endOf": "نهاية المقطع {n}",
  "captions.textOf": "نص المقطع {n}",
  "take.title": "مراجعة اللقطة",
  "take.none": "لا توجد لقطات لمراجعتها في مشاهد القصة.",
  "take.unknown": "تعذّرت قراءة اللقطات الآن.",
  "take.row": "{shot} — الوسائط {name} ({hash})",
  "take.current": "المعروضة الآن",
  "take.notAssembled": "اجمع القصة لاستبدال هذه اللقطة.",
  "take.review": "راجع هذه اللقطة",
  "take.clip": "المقطع",
  "take.timing": "التوقيت",
  "take.span": "يبدأ عند {start} ث، ومدته {duration} ث",
  "take.from": "يعرض الآن",
  "take.to": "سيعرض",
  "take.media": "الوسائط {name} ({hash}) من {seconds} ث",
  "take.titleCard": "بطاقة عنوان {title}",
  "take.revision": "مراجعة المشروع",
  "take.hash": "بصمة المقترح",
  "take.apply": "طبّق هذه اللقطة",
  "take.dismiss": "إغلاق",
  "take.unnamed": "وسائط بلا اسم",
  "take.failedOutcome": "لم تُطبَّق اللقطة. راجعها من جديد.",
  "take.unknownOutcome":
    "انقطع الاتصال، فلا يُعرف هل طُبّقت اللقطة. افتح المشروع من جديد لتتحقق.",
  "take.busyOutcome": "المحرر مشغول، فلم يُرسل شيء. راجع اللقطة من جديد.",
  "take.saveFirst": "احفظ تغييرات المخطط الزمني قبل تطبيق اللقطة.",
  "take.stale":
    "تغيّر المشروع، فلم تعد هذه المراجعة صالحة. راجع اللقطة من جديد.",
  "take.applied":
    "طُبّقت اللقطة في المراجعة {revision}. يعيد التراجع اللقطة السابقة.",
  "take.refused": "لم تُطبَّق اللقطة: {message}",
  "story.list": "القصص وحزم المراجع",
  "story.none": "لا توجد في هذا المشروع قصة ولا حزمة مراجع بعد.",
  "story.refresh": "اقرأ القصص من جديد",
  "story.summary": "{title} — اللقطات: {shots}؛ بطاقات العناوين: {cards}",
  "story.pack":
    "{name} — المراجع: {entries}؛ موافقات الشبه المرتبطة: {likeness}",
  "story.unknown": "تعذّرت قراءة القصص وحزم المراجع الآن.",
  "engine.unknown": "لا يُعرف الآن إن كانت عمليات التوليد ممكنة هنا.",
  "engine.reason.ENGINE_DISABLED":
    "محركات التوليد متوقفة في هذا الإصدار. التحرير والتصيير والتصدير تعمل بدونها.",
  "engine.reason.WEIGHTS_ABSENT":
    "ملفات النموذج لهذه العملية غير مثبتة على هذا الحاسوب، أو لم تجتز فحصها. لا ينزّلها يماكن أبدًا.",
  "engine.reason.HARDWARE_UNQUALIFIED":
    "هذا الحاسوب غير مؤهَّل لهذه العملية، أو انتهت صلاحية تأهيله.",
  "engine.reason.RIGHTS_UNQUALIFIED": "ترخيص النموذج لا يسمح بهذا الاستخدام.",
  "engine.available": "متاحة.",
  "engine.present": "ملفات النموذج في مكانها، وتُفحص كاملةً عند تشغيل المحرك.",
  "engine.op.textToVideo": "نص إلى فيديو",
  "engine.op.imageToVideo": "صورة إلى فيديو",
  "engine.op.videoEdit": "تحرير فيديو",
  "engine.op.transcribe": "تفريغ نصي",
  "engine.op.enhance": "تحسين",
  "studio.intro":
    "تحرير الصور الطبقي مستورد خلف محوِّل يماكن. يبقى معطّلاً حتى تتحقق أهداف تأهيل الاستوديو.",
  "tools.jobs":
    "تعرض المهام التقدم والإلغاء والأخطاء وملفات الفيديو المتحقَّق منها. لا تقبل الواجهة مسارات المشاريع ولا الأوامر العشوائية.",
  "toolbar.unsaved": "تغييرات غير محفوظة",
  "action.undo": "تراجع",
  "action.redo": "إعادة",
  "action.save": "حفظ",
  "action.export": "تصدير الفيديو",
  "transport.play": "تشغيل",
  "proxy.toggle": "نسخ التحرير الخفيفة",
  "proxy.summary":
    "{ready} من {total} مقاطع فيديو تستخدم نسخة خفيفة · {building} قيد التحضير · التصدير يستخدم الأصول دائمًا",
  "proxy.off": "المعاينة تعرض مقاطع الفيديو الأصلية",
  "transport.pause": "إيقاف مؤقت",
  "transport.playhead": "موضع التشغيل",
  "transport.seconds": "{seconds} ث",
  "scene.heading": "المشهد واللقطة",
  "scene.add": "إضافة مشهد",
  "scene.default": "المشهد {n}",
  "scene.name": "اسم المشهد",
  "scene.focal": "البعد البؤري (مم)",
  "scene.scale": "حجم اللقطة",
  "scene.movement": "الحركة",
  "scene.scale.wide": "واسعة",
  "scene.scale.medium": "متوسطة",
  "scene.scale.close": "قريبة",
  "scene.movement.static": "ثابتة",
  "scene.movement.dolly": "دولي",
  "scene.movement.pan": "استدارة أفقية",
  "scene.movement.orbit": "دوران حول الموضوع",
  "hint.camera":
    "تسجّل إعدادات الكاميرا نية اللقطة فقط، ولا تغيّر اللقطات المستوردة.",
  "title.heading": "العنوان",
  "title.text": "نص العنوان",
  "title.add": "إضافة عنوان",
  "track.titles": "العناوين",
  "track.picture": "الصورة",
  "track.audio": "الصوت",
  "job.QUEUED": "التصدير في الانتظار",
  "job.RUNNING": "التصدير جارٍ",
  "job.COMPLETED": "اكتمل التصدير",
  "job.FAILED": "فشل التصدير",
  "job.CANCELLED": "أُلغي التصدير",
  "job.cancel": "إلغاء التصدير",
  "job.download": "تنزيل MP4",
  "empty.title": "إنتاجك القادم يبدأ من هنا.",
  "empty.body":
    "أنشئ مشروعًا محليًا، واستورد الوسائط، وخطّط للقطة، وحرّر الخط الزمني، وصدّر فيديو قابلًا للتشغيل.",
  "empty.persist": "تبقى المشاريع قابلة للتحرير بعد إغلاق يماكن وإعادة فتحه.",
  footer: "معاينة هندسية من يماكن · ليست إصدارًا عامًا",
  "reference.region": "المعاينة المرجعية",
  "reference.title": "المعاينة المرجعية",
  "parity.exact": "تعرض هذه المعاينة الخط الزمني كما سيظهر في التصدير.",
  "parity.approximate":
    "هذه المعاينة تقريبية في {list}. المعاينة المرجعية تعرض ما يحتويه التصدير.",
  "parity.titleFont": "العناوين (خطوط المتصفح وتخطيطه)",
  "parity.videoOnAudioTrack": "فيديو على مسار صوتي (التصدير يشغّل صوته فقط)",
  "parity.extremeRetime": "سرعة أقل من الربع أو أكثر من أربعة أضعاف",
  "parity.audioFade": "تلاشي الصوت (لا يُشغَّل)",
  "parity.gainAboveUnity": "رفع الصوت فوق 0 ديسيبل",
  "parity.animation": "تحريك المقاطع (لا يُرسم)",
  "parity.effectCrop": "قص التحويل (لا يُرسم)",
  "parity.transition": "الانتقال التدريجي (يُعرض كقطع)",
  "parity.lut": "جدول الألوان LUT (لا يُطبَّق)",
  "reference.empty": "أضف مقطعًا أو عنوانًا لرؤية المعاينة المرجعية.",
  "reference.state": "المراجعة المحفوظة {revision}، الإطار {frame}",
  "reference.stale": "غير محدّثة: احفظ لتضمين أحدث تعديلاتك",
  "reference.save": "حفظ وتحديث",
  "reference.play": "تشغيل المرجع (ثانيتان)",
  "reference.segment": "مقطع مرجعي",
  "reference.alt": "الإطار المرجعي {frame} من المراجعة المحفوظة {revision}",
  "reference.rendering": "جارٍ التصيير…",
  "reference.failed": "تعذّر تصيير المعاينة المرجعية لهذه المراجعة.",
};

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ar };

// The placeholders a message uses, e.g. ["name", "revision"].
export const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Numbers in the interface language's digits (Arabic-Indic for Arabic).
export function formatNumber(lang: Lang, value: number) {
  // Arabic-Indic digits are requested explicitly: the CLDR default for
  // "ar" varies by data version and region.
  return new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-arab" : "en").format(
    value,
  );
}

// First-strong isolate / pop directional isolate: an inserted name keeps
// its own direction and cannot reorder the sentence around it (a Latin
// "Film (v2)!" in Arabic, or a name carrying bidi controls).
const FSI = "\u2068";
const PDI = "\u2069";

// A message with its placeholders filled. Numbers are written in the
// language's digits; text values are isolated. An unknown key (a value the
// service added later) falls back to English, then to the key itself.
export function translate(
  lang: Lang,
  key: MessageKey,
  vars: Record<string, string | number> = {},
) {
  const message: string = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    return typeof value === "number"
      ? formatNumber(lang, value)
      : `${FSI}${value.replace(BIDI_CONTROLS, "")}${PDI}`;
  });
}

// Embeddings, overrides and isolates inside a value are removed, so a
// name cannot close its own isolate early (display only; stored names are
// unchanged).
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/g;

// A duration in seconds with two decimals, in the language's digits
// (fixed width, so a running readout does not jitter).
export function formatSeconds(lang: Lang, value: number) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-arab" : "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

// A moment as a date and time in the language's calendar digits.
export function formatDate(lang: Lang, iso: string) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-arab" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// A fraction (0–1) as a percentage in the language's digits and sign.
export function formatPercent(lang: Lang, fraction: number) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-arab" : "en", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}

export const direction = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

// The saved choice, else the browser's preference. Storage can be absent or
// blocked; the interface then follows the browser.
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("yamakan.lang");
    if (saved === "en" || saved === "ar") return saved;
  } catch {}
  return typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem("yamakan.lang", lang);
  } catch {}
}
