// The local prompt library (YouMind integration, Phase B): prompt templates with named fields,
// in English and Arabic, searchable offline. Every template here is written for Yamakan and is
// GPL-3.0-or-later with the rest of Yamakan. No community prompt text is included: YouMind's
// community prompts are collected from X posts, and their redistribution rights are not
// established (founder decision, 2026-11-11). From YouMind only the category list is taken,
// with credit (YOUMIND_TAXONOMY_SOURCE); the Arabic category titles are Yamakan's translations.

import { z } from "zod";

export type PromptLanguage = "en" | "ar";
export type Bilingual = { en: string; ar: string };

export const PROMPT_TEXT_LIMIT = 2000;
export const PROMPT_VALUE_LIMIT = 200;
export const PROMPT_QUERY_LIMIT = 200;

/** Where YouMind's category list comes from: pinned, with its licence. */
export const YOUMIND_TAXONOMY_SOURCE = Object.freeze({
  name: "YouMind OpenLab ai-image-prompts-skill",
  url: "https://github.com/YouMind-OpenLab/ai-image-prompts-skill",
  commit: "7a1233b5a012aea57cd906ba4616fc2eb1f2bb6c",
  file: "references/manifest.json",
  sha256: "51c82f84d19d3c912d9cd51355269fe161abb0178e12620e683e25f7b532e665",
  licence: "MIT",
  notice: "notices/YouMind-ai-image-prompts-skill-LICENSE",
  credit:
    "Category list derived from YouMind OpenLab ai-image-prompts-skill @7a1233b5, MIT.",
});

export type PromptCategory = {
  slug: string;
  title: Bilingual;
  source: "youmind" | "yamakan";
};

// YouMind's eleven categories (slug and English title as published), then Yamakan's own for
// moving pictures, which YouMind's list does not cover.
export const PROMPT_CATEGORIES: readonly PromptCategory[] = Object.freeze([
  {
    slug: "profile-avatar",
    title: { en: "Profile / Avatar", ar: "صورة الملف الشخصي / الأفاتار" },
    source: "youmind",
  },
  {
    slug: "social-media-post",
    title: { en: "Social Media Post", ar: "منشور لوسائل التواصل" },
    source: "youmind",
  },
  {
    slug: "infographic-edu-visual",
    title: {
      en: "Infographic / Edu Visual",
      ar: "إنفوغرافيك / مادة تعليمية مرئية",
    },
    source: "youmind",
  },
  {
    slug: "youtube-thumbnail",
    title: { en: "YouTube Thumbnail", ar: "صورة مصغّرة ليوتيوب" },
    source: "youmind",
  },
  {
    slug: "comic-storyboard",
    title: { en: "Comic / Storyboard", ar: "قصة مصوّرة / لوحة قصة" },
    source: "youmind",
  },
  {
    slug: "product-marketing",
    title: { en: "Product Marketing", ar: "تسويق المنتجات" },
    source: "youmind",
  },
  {
    slug: "ecommerce-main-image",
    title: {
      en: "E-commerce Main Image",
      ar: "الصورة الرئيسية لمتجر إلكتروني",
    },
    source: "youmind",
  },
  {
    slug: "game-asset",
    title: { en: "Game Asset", ar: "عنصر للألعاب" },
    source: "youmind",
  },
  {
    slug: "poster-flyer",
    title: { en: "Poster / Flyer", ar: "ملصق / منشور ورقي" },
    source: "youmind",
  },
  {
    slug: "app-web-design",
    title: { en: "App / Web Design", ar: "تصميم تطبيق / موقع" },
    source: "youmind",
  },
  {
    slug: "others",
    title: { en: "Uncategorized", ar: "غير مصنّف" },
    source: "youmind",
  },
  {
    slug: "establishing-shot",
    title: { en: "Establishing shot", ar: "لقطة تأسيسية" },
    source: "yamakan",
  },
  {
    slug: "camera-move",
    title: { en: "Camera move", ar: "حركة الكاميرا" },
    source: "yamakan",
  },
  {
    slug: "character-moment",
    title: { en: "Character moment", ar: "لحظة الشخصية" },
    source: "yamakan",
  },
  {
    slug: "nature-and-time",
    title: { en: "Nature and time", ar: "الطبيعة والزمن" },
    source: "yamakan",
  },
  {
    slug: "title-and-text",
    title: { en: "Titles and text", ar: "العناوين والنصوص" },
    source: "yamakan",
  },
] satisfies PromptCategory[]);

export type PromptField = {
  name: string;
  label: Bilingual;
  default: Bilingual;
};

export type PromptTemplate = {
  id: string;
  kind: "video" | "image";
  category: string;
  title: Bilingual;
  description: Bilingual;
  // The prompt, with {field} where a field's value goes.
  text: Bilingual;
  fields: readonly PromptField[];
  tags: readonly string[];
};

const field = (
  name: string,
  label: Bilingual,
  def: Bilingual,
): PromptField => ({ name, label, default: def });

const SUBJECT = (en: string, ar: string) =>
  field("subject", { en: "Subject", ar: "الموضوع" }, { en, ar });
const PLACE = (en: string, ar: string) =>
  field("place", { en: "Place", ar: "المكان" }, { en, ar });
const PRODUCT = (en: string, ar: string) =>
  field("product", { en: "Product", ar: "المنتج" }, { en, ar });

export const PROMPT_TEMPLATES: readonly PromptTemplate[] = Object.freeze([
  {
    id: "yamakan.city-dawn-establishing",
    kind: "video",
    category: "establishing-shot",
    title: { en: "City at dawn", ar: "مدينة عند الفجر" },
    description: {
      en: "A slow, wide opening shot that sets the place and the hour.",
      ar: "لقطة افتتاحية واسعة وبطيئة تعرّف بالمكان والوقت.",
    },
    text: {
      en: "Wide establishing shot of {place} at dawn, first light on the rooftops, thin mist in the streets, calm and still, slow push in.",
      ar: "لقطة تأسيسية واسعة تُظهر {place} عند الفجر، أول الضوء على الأسطح، ضباب خفيف في الشوارع، هدوء وسكون، اقتراب بطيء.",
    },
    fields: [PLACE("an old harbour city", "مدينة ميناء قديمة")],
    tags: ["city", "dawn", "wide", "opening", "مدينة", "فجر"],
  },
  {
    id: "yamakan.desert-road-aerial",
    kind: "video",
    category: "establishing-shot",
    title: { en: "Desert road from above", ar: "طريق صحراوي من الأعلى" },
    description: {
      en: "An aerial view following a lone vehicle through open land.",
      ar: "منظر جوي يتبع مركبة وحيدة عبر أرض مفتوحة.",
    },
    text: {
      en: "Aerial view of {subject} driving along a straight desert road, long shadows at golden hour, dunes on both sides, the camera follows from high above.",
      ar: "منظر جوي يتبع {subject} على طريق صحراوي مستقيم، ظلال طويلة في الساعة الذهبية، كثبان على الجانبين، والكاميرا تتابع من علو.",
    },
    fields: [SUBJECT("a white jeep", "سيارة جيب بيضاء")],
    tags: ["desert", "aerial", "drone", "road", "صحراء", "جوي"],
  },
  {
    id: "yamakan.interior-room-reveal",
    kind: "video",
    category: "establishing-shot",
    title: { en: "Room reveal", ar: "كشف الغرفة" },
    description: {
      en: "A slow pan that shows a room and what it says about its owner.",
      ar: "تحريك بطيء يكشف غرفة وما تقوله عن صاحبها.",
    },
    text: {
      en: "Interior of {place}, slow pan from the window to the desk, dust in the sunbeams, quiet, lived-in details, soft natural light.",
      ar: "داخل {place}، تحريك بطيء من النافذة إلى المكتب، غبار في أشعة الشمس، تفاصيل هادئة مأهولة، ضوء طبيعي ناعم.",
    },
    fields: [PLACE("a writer's study", "مكتب كاتب")],
    tags: ["interior", "room", "pan", "داخلي", "غرفة"],
  },
  {
    id: "yamakan.orbit-hero",
    kind: "video",
    category: "camera-move",
    title: { en: "Orbit around the subject", ar: "دوران حول الموضوع" },
    description: {
      en: "The camera circles the subject, which stays in the centre.",
      ar: "تدور الكاميرا حول الموضوع الذي يبقى في المنتصف.",
    },
    text: {
      en: "The camera orbits slowly around {subject}, who stays centred and still, background turning behind, cinematic lighting, shallow depth of field.",
      ar: "تدور الكاميرا ببطء حول {subject} الذي يبقى في المنتصف ثابتاً، والخلفية تدور وراءه، إضاءة سينمائية، عمق مجال ضحل.",
    },
    fields: [SUBJECT("a statue in a courtyard", "تمثال في فناء")],
    tags: ["orbit", "circle", "hero", "دوران"],
  },
  {
    id: "yamakan.push-in-detail",
    kind: "video",
    category: "camera-move",
    title: { en: "Push in to a detail", ar: "اقتراب نحو تفصيل" },
    description: {
      en: "A slow push in that ends on one small, telling detail.",
      ar: "اقتراب بطيء ينتهي عند تفصيل صغير معبّر.",
    },
    text: {
      en: "Slow push in from a medium shot to an extreme close-up of {subject}, the background falls out of focus, still and quiet.",
      ar: "اقتراب بطيء من لقطة متوسطة إلى لقطة قريبة جداً تُظهر {subject}، وتغيب الخلفية عن التركيز، في سكون وهدوء.",
    },
    fields: [
      SUBJECT("an old pocket watch on a table", "ساعة جيب قديمة على طاولة"),
    ],
    tags: ["push", "dolly", "close-up", "detail", "اقتراب", "تفصيل"],
  },
  {
    id: "yamakan.tracking-walk",
    kind: "video",
    category: "camera-move",
    title: { en: "Tracking a walk", ar: "تتبّع المشي" },
    description: {
      en: "The camera moves alongside someone walking through a place.",
      ar: "تتحرك الكاميرا بجانب شخص يمشي عبر مكان.",
    },
    text: {
      en: "Side tracking shot of {subject} walking through {place}, the camera keeps pace at shoulder height, people and stalls pass between, natural light.",
      ar: "لقطة تتبّع جانبية لمشي {subject} عبر {place}، والكاميرا تواكب المشي على مستوى الكتف، والناس والأكشاك يمرّون بينهما، ضوء طبيعي.",
    },
    fields: [
      SUBJECT("a young woman in a red coat", "شابة في معطف أحمر"),
      PLACE("a busy market", "سوق مزدحم"),
    ],
    tags: ["tracking", "walk", "follow", "تتبع", "مشي"],
  },
  {
    id: "yamakan.pull-back-reveal",
    kind: "video",
    category: "camera-move",
    title: { en: "Pull back to reveal", ar: "ابتعاد للكشف" },
    description: {
      en: "Start close and pull back to show where the subject really is.",
      ar: "ابدأ قريباً ثم ابتعد لتكشف أين يوجد الموضوع حقاً.",
    },
    text: {
      en: "Starts on a close-up of {subject}, then the camera pulls back and rises to reveal {place} around it, slow and steady.",
      ar: "تبدأ بلقطة قريبة تُظهر {subject}، ثم تبتعد الكاميرا وترتفع لتكشف {place} من حول الموضوع، ببطء وثبات.",
    },
    fields: [
      SUBJECT("a single lit window", "نافذة واحدة مضاءة"),
      PLACE("a snowy mountain village at night", "قرية جبلية مثلجة ليلاً"),
    ],
    tags: ["pull back", "reveal", "crane", "ابتعاد", "كشف"],
  },
  {
    id: "yamakan.handheld-chase",
    kind: "video",
    category: "camera-move",
    title: { en: "Handheld urgency", ar: "كاميرا محمولة متوترة" },
    description: {
      en: "A shaky, close camera for tension and speed.",
      ar: "كاميرا قريبة مهتزة للتوتر والسرعة.",
    },
    text: {
      en: "Handheld camera running behind {subject} through {place}, quick and unsteady, motion blur, breath and footsteps, night lights flashing past.",
      ar: "كاميرا محمولة تجري خلف {subject} عبر {place}، سريعة وغير ثابتة، ضبابية الحركة، أنفاس وخطوات، وأضواء الليل تمرّ سريعاً.",
    },
    fields: [SUBJECT("a boy", "صبي"), PLACE("narrow alleys", "أزقة ضيقة")],
    tags: ["handheld", "chase", "running", "محمولة", "مطاردة"],
  },
  {
    id: "yamakan.close-up-emotion",
    kind: "video",
    category: "character-moment",
    title: { en: "Close-up of a feeling", ar: "لقطة قريبة لشعور" },
    description: {
      en: "A face holding one feeling, lit softly from the side.",
      ar: "وجه يحمل شعوراً واحداً، بإضاءة جانبية ناعمة.",
    },
    text: {
      en: "Close-up of {subject}, {feeling}, eyes looking just past the camera, soft side light, shallow depth of field, almost still.",
      ar: "لقطة قريبة تُظهر {subject}، {feeling}، والعينان تنظران بجانب الكاميرا، إضاءة جانبية ناعمة، عمق مجال ضحل، شبه ساكنة.",
    },
    fields: [
      SUBJECT("an old fisherman", "صياد عجوز"),
      field(
        "feeling",
        { en: "Feeling", ar: "الشعور" },
        { en: "quietly proud", ar: "فخور في صمت" },
      ),
    ],
    tags: ["close-up", "face", "emotion", "portrait", "وجه", "مشاعر"],
  },
  {
    id: "yamakan.over-shoulder-dialogue",
    kind: "video",
    category: "character-moment",
    title: { en: "Over-the-shoulder conversation", ar: "حوار من فوق الكتف" },
    description: {
      en: "Two people talking, seen past one's shoulder.",
      ar: "شخصان يتحدثان، يُريان من فوق كتف أحدهما.",
    },
    text: {
      en: "Over-the-shoulder shot of two people talking at {place}, focus on the one facing the camera, warm practical light, gentle handheld.",
      ar: "لقطة من فوق الكتف لشخصين يتحدثان في {place}، والتركيز على من يواجه الكاميرا، ضوء دافئ من مصابيح المكان، كاميرا محمولة لطيفة.",
    },
    fields: [PLACE("a small café table", "طاولة مقهى صغيرة")],
    tags: ["dialogue", "conversation", "two shot", "حوار"],
  },
  {
    id: "yamakan.silhouette-sunset",
    kind: "video",
    category: "character-moment",
    title: { en: "Silhouette at sunset", ar: "صورة ظلية عند الغروب" },
    description: {
      en: "A figure as a dark shape against a bright sky.",
      ar: "شخص يظهر كهيئة داكنة أمام سماء ساطعة.",
    },
    text: {
      en: "Silhouette of {subject} against a sunset sky over {place}, the sun low behind, warm orange and purple, slow and calm.",
      ar: "صورة ظلية تُظهر {subject} أمام سماء الغروب فوق {place}، والشمس منخفضة في الخلف، برتقالي وبنفسجي دافئان، ببطء وهدوء.",
    },
    fields: [
      SUBJECT("a rider on a horse", "فارس على حصان"),
      PLACE("the dunes", "الكثبان"),
    ],
    tags: ["silhouette", "sunset", "backlight", "غروب", "صورة ظلية"],
  },
  {
    id: "yamakan.rain-night-street",
    kind: "video",
    category: "nature-and-time",
    title: { en: "Rain on a night street", ar: "مطر في شارع ليلاً" },
    description: {
      en: "Wet streets, reflections and a slow, moody camera.",
      ar: "شوارع مبللة وانعكاسات وكاميرا بطيئة ذات مزاج.",
    },
    text: {
      en: "Rain falling on {place} at night, neon and street lamps reflected in puddles, people with umbrellas, slow dolly forward, moody and quiet.",
      ar: "مطر يهطل على {place} ليلاً، أضواء النيون ومصابيح الشارع تنعكس في البرك، أناس بمظلات، تقدّم بطيء للكاميرا، جوّ هادئ ومتأمل.",
    },
    fields: [PLACE("a narrow city street", "شارع ضيق في المدينة")],
    tags: ["rain", "night", "neon", "reflections", "مطر", "ليل"],
  },
  {
    id: "yamakan.time-lapse-sky",
    kind: "video",
    category: "nature-and-time",
    title: { en: "Time-lapse of the sky", ar: "تسريع زمني للسماء" },
    description: {
      en: "Clouds racing, light changing, the ground still.",
      ar: "سحب تتسابق وضوء يتغيّر والأرض ساكنة.",
    },
    text: {
      en: "Time-lapse of clouds racing over {place}, light changing from day to dusk, shadows sweeping the ground, locked-off camera.",
      ar: "تسريع زمني لسحب تتسابق فوق {place}، والضوء يتغير من النهار إلى الغسق، والظلال تجتاح الأرض، كاميرا ثابتة.",
    },
    fields: [PLACE("a mountain valley", "وادٍ جبلي")],
    tags: ["time-lapse", "clouds", "sky", "تسريع", "سحب"],
  },
  {
    id: "yamakan.ocean-waves-slow",
    kind: "video",
    category: "nature-and-time",
    title: { en: "Waves in slow motion", ar: "أمواج بالحركة البطيئة" },
    description: {
      en: "Water at its most beautiful, slowed right down.",
      ar: "الماء في أجمل حالاته، مبطّأً جداً.",
    },
    text: {
      en: "Slow motion of waves breaking on {place}, spray catching the light, foam spreading over the sand, low camera near the water.",
      ar: "حركة بطيئة لأمواج تتكسر على {place}، والرذاذ يلتقط الضوء، والزبد ينتشر على الرمل، الكاميرا منخفضة قرب الماء.",
    },
    fields: [PLACE("black volcanic rocks", "صخور بركانية سوداء")],
    tags: ["ocean", "waves", "slow motion", "بحر", "أمواج"],
  },
  {
    id: "yamakan.forest-light",
    kind: "video",
    category: "nature-and-time",
    title: { en: "Light through the forest", ar: "ضوء عبر الغابة" },
    description: {
      en: "Shafts of light through trees, a gentle drift.",
      ar: "حزم ضوء بين الأشجار وانجراف لطيف للكاميرا.",
    },
    text: {
      en: "Morning light streaming through {place}, visible beams in the mist, leaves moving slightly, slow drift forward, peaceful.",
      ar: "ضوء الصباح يتدفق عبر {place}، حزم مرئية في الضباب، أوراق تتحرك قليلاً، انجراف بطيء إلى الأمام، في سكينة.",
    },
    fields: [PLACE("a pine forest", "غابة صنوبر")],
    tags: ["forest", "light", "mist", "morning", "غابة", "صباح"],
  },
  {
    id: "yamakan.product-turntable",
    kind: "video",
    category: "product-marketing",
    title: { en: "Product turntable", ar: "منتج على قاعدة دوّارة" },
    description: {
      en: "The product turns slowly on a clean background.",
      ar: "المنتج يدور ببطء على خلفية نظيفة.",
    },
    text: {
      en: "{product} turning slowly on a turntable, clean {colour} background, soft studio lighting, crisp reflections, centred.",
      ar: "{product} يدور ببطء على قاعدة دوّارة، خلفية {colour} نظيفة، إضاءة استوديو ناعمة، انعكاسات واضحة، في المنتصف.",
    },
    fields: [
      PRODUCT("a glass perfume bottle", "قارورة عطر زجاجية"),
      field(
        "colour",
        { en: "Background colour", ar: "لون الخلفية" },
        { en: "light grey", ar: "رمادية فاتحة" },
      ),
    ],
    tags: ["product", "turntable", "studio", "منتج", "استوديو"],
  },
  {
    id: "yamakan.product-in-use",
    kind: "video",
    category: "product-marketing",
    title: { en: "Product in use", ar: "المنتج أثناء الاستخدام" },
    description: {
      en: "Hands using the product in a real setting.",
      ar: "أيدٍ تستخدم المنتج في مكان حقيقي.",
    },
    text: {
      en: "Close shot of hands using {product} at {place}, natural light, small real movements, the product in sharp focus.",
      ar: "لقطة قريبة لأيدٍ تستخدم {product} في {place}، ضوء طبيعي، حركات صغيرة حقيقية، والمنتج في تركيز حاد.",
    },
    fields: [
      PRODUCT("a ceramic coffee cup", "فنجان قهوة من الخزف"),
      PLACE("a kitchen counter in the morning", "طاولة مطبخ في الصباح"),
    ],
    tags: ["product", "hands", "lifestyle", "منتج", "أيدي"],
  },
  {
    id: "yamakan.title-card",
    kind: "video",
    category: "title-and-text",
    title: { en: "Title card background", ar: "خلفية بطاقة العنوان" },
    description: {
      en: "A calm moving background to put a title over. Add the words in Yamakan, not in the prompt.",
      ar: "خلفية متحركة هادئة لوضع عنوان فوقها. أضف الكلمات في Yamakan، لا في الوصف.",
    },
    text: {
      en: "Abstract slow-moving {texture}, dark and calm, lots of empty space in the centre, subtle light, no text.",
      ar: "{texture} مجرّد يتحرك ببطء، داكن وهادئ، مساحة فارغة كثيرة في المنتصف، ضوء خفيف، بلا نص.",
    },
    fields: [
      field(
        "texture",
        { en: "Texture", ar: "الملمس" },
        { en: "ink spreading in water", ar: "حبر ينتشر في الماء" },
      ),
    ],
    tags: ["title", "background", "abstract", "عنوان", "خلفية"],
  },
  {
    id: "yamakan.storyboard-frame",
    kind: "image",
    category: "comic-storyboard",
    title: { en: "Storyboard frame", ar: "إطار لوحة قصة" },
    description: {
      en: "A rough storyboard drawing of one shot, to plan before filming.",
      ar: "رسم تقريبي للوحة قصة للقطة واحدة، للتخطيط قبل التصوير.",
    },
    text: {
      en: "Storyboard frame, pencil sketch, {shot} of {subject} in {place}, simple shading, arrows showing camera movement, 16:9 frame.",
      ar: "إطار لوحة قصة، رسم بالقلم الرصاص، {shot} تُظهر {subject} في {place}، تظليل بسيط، أسهم تبيّن حركة الكاميرا، إطار ١٦:٩.",
    },
    fields: [
      field(
        "shot",
        { en: "Shot size", ar: "حجم اللقطة" },
        { en: "medium shot", ar: "لقطة متوسطة" },
      ),
      SUBJECT("a detective", "محقّق"),
      PLACE("a rainy doorway", "مدخل ممطر"),
    ],
    tags: ["storyboard", "sketch", "planning", "لوحة قصة", "رسم"],
  },
  {
    id: "yamakan.thumbnail-portrait",
    kind: "image",
    category: "youtube-thumbnail",
    title: { en: "Bold thumbnail portrait", ar: "صورة مصغّرة جريئة" },
    description: {
      en: "A bright, high-contrast portrait with room for a headline.",
      ar: "صورة شخصية ساطعة عالية التباين مع مساحة لعنوان.",
    },
    text: {
      en: "Portrait of {subject} with an expressive face on the right third, bright saturated {colour} background, strong rim light, empty space on the left, no text.",
      ar: "صورة شخصية تُظهر {subject} بوجه معبّر في الثلث الأيمن، خلفية {colour} ساطعة مشبعة، إضاءة حافّة قوية، مساحة فارغة في اليسار، بلا نص.",
    },
    fields: [
      SUBJECT("a chef", "طاهٍ"),
      field(
        "colour",
        { en: "Background colour", ar: "لون الخلفية" },
        { en: "yellow", ar: "صفراء" },
      ),
    ],
    tags: ["thumbnail", "portrait", "youtube", "مصغرة"],
  },
  {
    id: "yamakan.game-prop",
    kind: "image",
    category: "game-asset",
    title: { en: "Game prop on plain ground", ar: "عنصر لعبة على أرضية بسيطة" },
    description: {
      en: "One object, clearly lit, easy to cut out.",
      ar: "عنصر واحد بإضاءة واضحة، سهل القص.",
    },
    text: {
      en: "{subject}, game asset, three-quarter view, stylised, clean plain background, even lighting, single object, no shadow on the ground.",
      ar: "{subject}، عنصر للعبة، منظر ثلاثة أرباع، بأسلوب فني، خلفية بسيطة نظيفة، إضاءة متساوية، عنصر واحد، بلا ظل على الأرض.",
    },
    fields: [SUBJECT("a wooden treasure chest", "صندوق كنز خشبي")],
    tags: ["game", "asset", "prop", "لعبة", "عنصر"],
  },
] satisfies PromptTemplate[]);

const PLACEHOLDER = /\{([a-z][a-zA-Z]*)\}/g;

/** The field names a text uses, in order of first use. */
export function placeholdersOf(text: string) {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

export const PromptFillSchema = z
  .object({
    templateId: z.string().min(1).max(120),
    language: z.enum(["en", "ar"]),
    // A field's value, by the field's name; a field left out takes its default.
    values: z
      .array(
        z
          .object({
            field: z.string().min(1).max(40),
            value: z.string().max(PROMPT_VALUE_LIMIT),
          })
          .strict(),
      )
      .max(16)
      .default([]),
  })
  .strict();

const templateById = new Map(PROMPT_TEMPLATES.map((t) => [t.id, t]));
export const promptTemplate = (id: string) => templateById.get(id) ?? null;

// A value is words only: no braces (no field inside a field), no line breaks, no control
// characters, spaces collapsed.
const cleanValue = (value: string) =>
  value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "")
    .replace(/[{}\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A template's prompt in one language with its fields filled: a value given, or the field's
 * default for that language when the value is empty. Unknown fields are refused, so a typo is
 * not silently dropped.
 */
export function fillPrompt(input: z.input<typeof PromptFillSchema>) {
  const { templateId, language, values } = PromptFillSchema.parse(input);
  const template = promptTemplate(templateId);
  if (!template) throw new Error(`There is no prompt template ${templateId}.`);
  const known = new Set(template.fields.map((f) => f.name));
  const unknown = values.map((v) => v.field).filter((k) => !known.has(k));
  const twice = values
    .map((v) => v.field)
    .filter((k, i, all) => all.indexOf(k) !== i);
  if (twice.length) throw new Error(`The field ${twice[0]} is given twice.`);
  const given = new Map(values.map((v) => [v.field, v.value]));
  if (unknown.length)
    throw new Error(
      `The template ${templateId} has no field ${unknown.join(", ")}.`,
    );
  const filled = new Map(
    template.fields.map((f) => [
      f.name,
      cleanValue(given.get(f.name) ?? "") || f.default[language],
    ]),
  );
  const prompt = template.text[language].replace(
    PLACEHOLDER,
    (_, name: string) => filled.get(name) ?? "",
  );
  if (prompt.length > PROMPT_TEXT_LIMIT)
    throw new Error(
      `The filled prompt is longer than ${PROMPT_TEXT_LIMIT} characters.`,
    );
  return { templateId, language, prompt };
}

const ARABIC_DIGITS = /[٠-٩]/g;

/**
 * Text as it is compared in a search: Unicode-normalised, lower case, Arabic without its
 * vowel marks or tatweel, with the common letter variants made one (alef forms, alef maqsura
 * and ya, ta marbuta and ha, hamza on waw and ya), Arabic-Indic digits as 0-9, and punctuation
 * as spaces.
 */
export function normaliseForSearch(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// A word, and the word without an Arabic prefix: the article (ال, لل), alone or after و ف ب ك,
// or one of و ف ب ك ل alone, when three letters or more are left. So "بالمطر" finds "مطر".
const forms = (word: string, query = true) => {
  const article = (
    query ? /^(?:[وفبك]?ال|لل)(.{3,})$/ : /^[وفبك]?ال(.{3,})$/
  ).exec(word);
  if (article) return [word, article[1]];
  if (!query) return [word];
  const letter = /^[وفبكل](.{3,})$/.exec(word);
  return letter ? [word, letter[1]] : [word];
};
// The library's own words lose only the article (ال, after و ف ب ك or alone): a single letter
// there, or the ل of لل, may be part of the word (لقطة, للقطة), so stripping it would make "قطة"
// find every shot.
const wordsOf = (text: string) =>
  new Set(
    normaliseForSearch(text)
      .split(" ")
      .filter(Boolean)
      .flatMap((w) => forms(w, false)),
  );

// The query's distinct words of two letters or more, each with its forms.
const queryTerms = (query: string) =>
  [
    ...new Set(
      normaliseForSearch(query)
        .split(" ")
        .filter((w) => w.length > 1),
    ),
  ].map((w) => forms(w));

// A word of the text starts with one of the term's forms.
const has = (words: Set<string>, term: string[]) => {
  for (const w of words) if (term.some((t) => w.startsWith(t))) return true;
  return false;
};

export const PromptSearchSchema = z
  .object({
    query: z.string().max(PROMPT_QUERY_LIMIT).default(""),
    category: z.string().max(60).optional(),
    kind: z.enum(["video", "image"]).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

const indexed = PROMPT_TEMPLATES.map((t) => {
  const category = PROMPT_CATEGORIES.find((c) => c.slug === t.category);
  return {
    template: t,
    title: wordsOf(`${t.title.en} ${t.title.ar}`),
    tags: wordsOf(
      [
        ...t.tags,
        category?.title.en ?? "",
        category?.title.ar ?? "",
        t.category,
      ].join(" "),
    ),
    body: wordsOf(
      [
        t.description.en,
        t.description.ar,
        t.text.en,
        t.text.ar,
        ...t.fields.flatMap((f) => [
          f.label.en,
          f.label.ar,
          f.default.en,
          f.default.ar,
        ]),
      ].join(" "),
    ),
  };
});

/**
 * Templates matching every word of the query (two letters or more), in English or Arabic, best
 * first: a query word matches a word that starts with it. A match in the title counts most, then
 * in the tags or category, then in the description, prompt or fields. An empty query lists them
 * all, in library order.
 */
export function searchPrompts(input: z.input<typeof PromptSearchSchema>) {
  const { query, category, kind, limit } = PromptSearchSchema.parse(input);
  const terms = queryTerms(query);
  const results: { template: PromptTemplate; score: number; order: number }[] =
    [];
  indexed.forEach((row, order) => {
    if (category && row.template.category !== category) return;
    if (kind && row.template.kind !== kind) return;
    let score = 0;
    for (const term of terms) {
      const s =
        (has(row.title, term) ? 3 : 0) +
        (has(row.tags, term) ? 2 : 0) +
        (has(row.body, term) ? 1 : 0);
      if (s === 0) return;
      score += s;
    }
    results.push({ template: row.template, score, order });
  });
  results.sort((a, b) => b.score - a.score || a.order - b.order);
  return results.slice(0, limit).map((r) => r.template);
}
