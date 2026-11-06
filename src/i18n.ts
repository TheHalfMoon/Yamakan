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
  "create.elementsTitle": "Places and props",
  "create.elementsNote":
    "Kept with this project as a record, and pinned to a shot if you wish. They are not sent to a model and do not change what is generated. Saving one, or a pin, ends undo for what came before, as saving any document does. Do not keep a person's likeness here: that needs consent this does not ask for.",
  "create.elementName": "Name",
  "create.elementRole": "Kind",
  "create.elementRole.environment": "Place",
  "create.elementRole.prop": "Prop",
  "create.elementRole.wardrobe": "Wardrobe",
  "create.elementRole.style": "Style",
  "create.elementAdd": "Choose an image",
  "create.elementAddImage": "Add another image",
  "create.elementOnShots": "On these shots",
  "create.elementOlder": "An older version",
  "create.elementImageType": "This takes a PNG or JPEG image.",
  "create.elementNotKept": "That image could not come in. Nothing changed.",
  "create.elementImageOnly":
    "The image came into the project's assets, and this could not be saved with it.",
  "create.elementNotPinned":
    "That could not be saved on the shot. Nothing changed.",
  "create.elementsUnread": "What this project keeps here could not be read.",
  "create.elementFull": "This holds all the images it can.",
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
  "director.title": "Director",
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
  "create.elementsTitle": "الأماكن والأغراض",
  "create.elementsNote":
    "تُحفظ مع هذا المشروع كسجل، ويمكن تثبيتها على لقطة إن شئت. لا تُرسل إلى أي نموذج ولا تغيّر ما يُولَّد. وحفظ أي منها أو تثبيته يُنهي التراجع عمّا سبقه، كما يفعل حفظ أي مستند. لا تحفظ هنا صورة شخص: فذلك يحتاج إلى موافقة لا يطلبها هذا القسم.",
  "create.elementName": "الاسم",
  "create.elementRole": "النوع",
  "create.elementRole.environment": "مكان",
  "create.elementRole.prop": "غرض",
  "create.elementRole.wardrobe": "أزياء",
  "create.elementRole.style": "أسلوب",
  "create.elementAdd": "اختر صورة",
  "create.elementAddImage": "أضف صورة أخرى",
  "create.elementOnShots": "في هذه اللقطات",
  "create.elementOlder": "نسخة أقدم",
  "create.elementImageType": "يقبل هذا صور PNG أو JPEG.",
  "create.elementNotKept": "تعذّر إدخال تلك الصورة. لم يتغيّر شيء.",
  "create.elementImageOnly":
    "دخلت الصورة إلى ملفات المشروع، وتعذّر حفظ هذا معها.",
  "create.elementNotPinned": "تعذّر حفظ ذلك على اللقطة. لم يتغيّر شيء.",
  "create.elementsUnread": "تعذّرت قراءة ما يحفظه هذا المشروع هنا.",
  "create.elementFull": "يضم هذا كل ما يتسع له من صور.",
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
  "director.title": "المخرج",
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
