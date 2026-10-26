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
  "badge.local": "Local media · CPU rendering",
  "status.initial": "Create or open a project to begin.",
  "session.locked":
    "Open Yamakan with the link it printed when it started (also saved in the workspace's launch file). Opening the address alone does not sign you in.",
  "status.working": "Working…",
  "status.opened": "Opened {name}, revision {revision}.",
  "status.saved": "Saved revision {revision}.",
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
    "Saving Studio canvases to the project is not enabled in this build.",
  "studio.noProject": "Open a project to keep its Studio canvas.",
  "studio.intro":
    "Layered image editing is imported behind a Yamakan host adapter.",
  "cinema.title": "Cinema camera",
  "cinema.intro":
    "Supported scene3d preview and persist. AI-conditioned camera stays off.",
  "director.title": "Director",
  "director.intro":
    "Manual stage workflows. Model-dependent stages stay disabled.",
  "tools.jobs":
    "Jobs expose progress, cancellation, errors and verified video artifacts. Project paths and arbitrary commands are not accepted by the API.",
  "toolbar.unsaved": "Unsaved changes",
  "action.undo": "Undo",
  "action.redo": "Redo",
  "action.save": "Save",
  "action.export": "Export video",
  "transport.play": "Play",
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
  "badge.local": "وسائط محلية · تصيير بالمعالج",
  "status.initial": "أنشئ مشروعًا أو افتح مشروعًا للبدء.",
  "session.locked":
    "افتح يماكن بالرابط الذي طبعه عند تشغيله (وهو محفوظ أيضًا في ملف launch في مساحة العمل). فتح العنوان وحده لا يسجّل دخولك.",
  "status.working": "جارٍ العمل…",
  "status.opened": "فُتح {name}، المراجعة {revision}.",
  "status.saved": "حُفظت المراجعة {revision}.",
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
    "حفظ لوحات الاستوديو في المشروع غير مفعّل في هذا الإصدار.",
  "studio.noProject": "افتح مشروعاً للاحتفاظ بلوحة الاستوديو الخاصة به.",
  "cinema.title": "كاميرا السينما",
  "cinema.intro":
    "معاينة المشهد المدعومة والحفظ. كاميرا الذكاء الاصطناعي تبقى متوقفة.",
  "director.title": "المخرج",
  "director.intro": "مسارات المراحل اليدوية. مراحل النماذج تبقى متوقفة.",
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
