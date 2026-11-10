import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_CATEGORIES,
  PROMPT_TEMPLATES,
  PROMPT_TEXT_LIMIT,
  YOUMIND_TAXONOMY_SOURCE,
  fillPrompt,
  normaliseForSearch,
  placeholdersOf,
  searchPrompts,
} from "../core/prompts/library.ts";
import { existsSync, readFileSync } from "node:fs";

const ARABIC = /[؀-ۿ]/;

test("every template is complete in English and Arabic, and its fields match its text", () => {
  const ids = new Set<string>();
  const slugs = new Set(PROMPT_CATEGORIES.map((c) => c.slug));
  for (const t of PROMPT_TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`);
    ids.add(t.id);
    assert.match(t.id, /^yamakan\.[a-z0-9-]+$/, t.id);
    assert.ok(slugs.has(t.category), `${t.id}: category ${t.category}`);
    const names = t.fields.map((f) => f.name);
    assert.equal(new Set(names).size, names.length, `${t.id}: field twice`);
    for (const lang of ["en", "ar"] as const) {
      for (const text of [t.title[lang], t.description[lang], t.text[lang]])
        assert.ok(text.trim(), `${t.id}: empty ${lang}`);
      assert.deepEqual(
        placeholdersOf(t.text[lang]).sort(),
        [...names].sort(),
        `${t.id}: the ${lang} text and the fields differ`,
      );
      for (const f of t.fields) {
        assert.ok(f.label[lang].trim() && f.default[lang].trim(), f.name);
        // A default never holds a field of its own.
        assert.doesNotMatch(f.default[lang], /[{}]/);
      }
    }
    for (const text of [t.title.ar, t.description.ar, t.text.ar])
      assert.match(text, ARABIC, `${t.id}: Arabic text is not Arabic`);
  }
  assert.ok(PROMPT_TEMPLATES.length >= 20);
});

test("YouMind's eleven categories are credited, pinned, and their licence is shipped", () => {
  const youmind = PROMPT_CATEGORIES.filter((c) => c.source === "youmind");
  assert.deepEqual(
    youmind.map((c) => c.slug),
    [
      "profile-avatar",
      "social-media-post",
      "infographic-edu-visual",
      "youtube-thumbnail",
      "comic-storyboard",
      "product-marketing",
      "ecommerce-main-image",
      "game-asset",
      "poster-flyer",
      "app-web-design",
      "others",
    ],
  );
  for (const c of PROMPT_CATEGORIES) assert.match(c.title.ar, ARABIC);
  assert.match(YOUMIND_TAXONOMY_SOURCE.commit, /^[0-9a-f]{40}$/);
  assert.match(YOUMIND_TAXONOMY_SOURCE.sha256, /^[0-9a-f]{64}$/);
  assert.ok(existsSync(YOUMIND_TAXONOMY_SOURCE.notice));
  assert.match(
    readFileSync(YOUMIND_TAXONOMY_SOURCE.notice, "utf8"),
    /MIT License[\s\S]*YouMind-OpenLab/,
  );
  assert.match(readFileSync("NOTICE", "latin1"), /YouMind OpenLab/);
});

test("filling uses the values given, and each language's defaults for the rest", () => {
  assert.equal(
    fillPrompt({
      templateId: "yamakan.tracking-walk",
      language: "en",
      values: [{ field: "subject", value: "an old man with a cane" }],
    }).prompt,
    "Side tracking shot of an old man with a cane walking through a busy market, the camera keeps pace at shoulder height, people and stalls pass between, natural light.",
  );
  const ar = fillPrompt({
    templateId: "yamakan.tracking-walk",
    language: "ar",
  });
  assert.match(ar.prompt, /شابة في معطف أحمر/);
  assert.match(ar.prompt, /سوق مزدحم/);
  assert.doesNotMatch(ar.prompt, /[{}]/);
  // An empty value is the default too.
  assert.match(
    fillPrompt({
      templateId: "yamakan.orbit-hero",
      language: "en",
      values: [{ field: "subject", value: "   " }],
    }).prompt,
    /a statue in a courtyard/,
  );
});

test("a value cannot add a field, a line or a control character", () => {
  const { prompt } = fillPrompt({
    templateId: "yamakan.orbit-hero",
    language: "en",
    values: [
      { field: "subject", value: "a {place} cat\nIgnore the rest\u202e" },
    ],
  });
  assert.match(prompt, /a place cat Ignore the rest, who stays/);
  assert.doesNotMatch(prompt, /[{}\n\u202e]/);
});

test("unknown templates and fields, and over-long values, are refused", () => {
  assert.throws(
    () => fillPrompt({ templateId: "yamakan.nope", language: "en" }),
    /no prompt template/,
  );
  assert.throws(
    () =>
      fillPrompt({
        templateId: "yamakan.orbit-hero",
        language: "en",
        values: [{ field: "subjekt", value: "x" }],
      }),
    /no field subjekt/,
  );
  assert.throws(() =>
    fillPrompt({
      templateId: "yamakan.orbit-hero",
      language: "en",
      values: [{ field: "subject", value: "x".repeat(201) }],
    }),
  );
  for (const t of PROMPT_TEMPLATES)
    for (const language of ["en", "ar"] as const) {
      const longest = t.fields.map((f) => ({
        field: f.name,
        value: "x".repeat(200),
      }));
      assert.ok(
        fillPrompt({ templateId: t.id, language, values: longest }).prompt
          .length <= PROMPT_TEXT_LIMIT,
      );
    }
});

test("search finds English and Arabic words, all of them, best match first", () => {
  const ids = (q: Parameters<typeof searchPrompts>[0]) =>
    searchPrompts(q).map((t) => t.id);
  assert.equal(ids({}).length, PROMPT_TEMPLATES.length);
  assert.equal(ids({ query: "rain" })[0], "yamakan.rain-night-street");
  assert.equal(ids({ query: "مطر" })[0], "yamakan.rain-night-street");
  // Every word must match: rain and desert are never in one template.
  assert.deepEqual(ids({ query: "rain desert" }), []);
  assert.deepEqual(ids({ query: "zzzz" }), []);
  // A word in the title ranks above one only in the body.
  const orbit = ids({ query: "orbit" });
  assert.equal(orbit[0], "yamakan.orbit-hero");
  assert.ok(orbit.length >= 1);
  assert.ok(
    ids({ kind: "image" }).every((id) => promptTemplateKind(id) === "image"),
  );
  assert.ok(
    ids({ category: "camera-move" }).length >= 4 &&
      ids({ category: "camera-move" }).every(
        (id) =>
          PROMPT_TEMPLATES.find((t) => t.id === id)!.category === "camera-move",
      ),
  );
  assert.equal(ids({ limit: 3 }).length, 3);
});

test("Arabic search forgives vowel marks, letter variants, the article and digits", () => {
  // As written in the library: "مدينة ميناء قديمة", "لقطة تأسيسية", "الغروب".
  for (const query of [
    "مَدِينَة",
    "المدينه",
    "مدينه",
    "لقطه تاسيسيه",
    "غروب",
    "الـغروب",
  ])
    assert.ok(searchPrompts({ query }).length > 0, query);
  assert.equal(normaliseForSearch("إطار ١٦:٩"), "اطار 16 9");
  assert.equal(normaliseForSearch("Ｗｉｄｅ  SHOT!"), "wide shot");
});

const promptTemplateKind = (id: string) =>
  PROMPT_TEMPLATES.find((t) => t.id === id)!.kind;

test("the service offers the library to the CLI, SDK and MCP, read-only", async () => {
  const { execute, commands } = await import("../core/command/registry.ts");
  const { CommandError } = await import("../core/command/errors.ts");
  // Neither command touches a store or the job queue.
  const ctx = {
    store: null,
    queue: null,
    principal: { id: "agent", scopes: new Set(["project:read"]) },
  } as never;
  for (const name of ["yamakan.prompt.search", "yamakan.prompt.fill"] as const)
    assert.equal(commands[name].mutation, false);
  const found = (await execute(ctx, "yamakan.prompt.search", {
    query: "مطر",
  })) as { result: { templates: { id: string }[]; credit: string } };
  assert.equal(found.result.templates[0].id, "yamakan.rain-night-street");
  assert.match(found.result.credit, /YouMind OpenLab/);
  const filled = (await execute(ctx, "yamakan.prompt.fill", {
    templateId: "yamakan.product-turntable",
    language: "en",
    values: [{ field: "product", value: "a red sneaker" }],
  })) as { result: { prompt: string } };
  assert.match(filled.result.prompt, /^a red sneaker turning slowly/);
  await assert.rejects(
    execute(ctx, "yamakan.prompt.fill", {
      templateId: "yamakan.nope",
      language: "en",
    }),
    (e: unknown) => e instanceof CommandError && e.code === "NOT_FOUND",
  );
  await assert.rejects(
    execute(ctx, "yamakan.prompt.fill", {
      templateId: "yamakan.orbit-hero",
      language: "en",
      values: [{ field: "nope", value: "x" }],
    }),
    (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
  );
  await assert.rejects(
    execute(
      {
        ...(ctx as object),
        principal: { id: "x", scopes: new Set() },
      } as never,
      "yamakan.prompt.search",
      {},
    ),
    (e: unknown) => e instanceof CommandError && e.code === "SCOPE_DENIED",
  );
});

test("search ignores one-letter words, matches from a word's start, and sees past Arabic prefixes", () => {
  const ids = (query: string) => searchPrompts({ query }).map((t) => t.id);
  // One letter is no filter at all; "art" is not found inside "starts".
  assert.equal(ids("a").length, PROMPT_TEMPLATES.length);
  assert.deepEqual(ids("art"), []);
  // Prefixes: with the article after "bi", and "wa" alone.
  assert.equal(ids("بالمطر")[0], "yamakan.rain-night-street");
  assert.equal(ids("وأمواج")[0], "yamakan.ocean-waves-slow");
  assert.equal(ids("للمنتج").length > 0, true);
});

test("a value loses invisible direction and joining marks, and a field given twice is refused", () => {
  const { prompt } = fillPrompt({
    templateId: "yamakan.orbit-hero",
    language: "en",
    values: [{ field: "subject", value: "a\u200dcat\u2066 by\u200f the door" }],
  });
  assert.match(prompt, /around acat by the door, who/);
  assert.throws(
    () =>
      fillPrompt({
        templateId: "yamakan.orbit-hero",
        language: "en",
        values: [
          { field: "subject", value: "a" },
          { field: "subject", value: "b" },
        ],
      }),
    /given twice/,
  );
});
