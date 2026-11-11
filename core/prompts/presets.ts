// A project's prompt presets (YouMind integration, Phase B): prompts the person keeps with the
// project, each made from a library template or written freely. One `promptPresets` document
// per project holds them all, since a project holds at most 32 documents. Pure: the browser
// bundle reads it too.

import { z } from "zod";
import { CommandError } from "../command/errors.ts";
import { Id } from "../project.ts";
import {
  PROMPT_TEXT_LIMIT,
  PROMPT_VALUE_LIMIT,
  promptTemplate,
} from "./library.ts";

export const PROMPT_PRESET_LIMITS = Object.freeze({
  presets: 50,
  nameChars: 80,
  // 50 presets at their longest (a 2,000-character prompt and 16 values of 200 characters,
  // all in Arabic, two bytes each in UTF-8) stay under this.
  documentBytes: 1024 * 1024,
});

const Field = z
  .object({
    field: z.string().min(1).max(40),
    value: z.string().max(PROMPT_VALUE_LIMIT),
  })
  .strict();

export const PromptPresetSchema = z
  .object({
    id: Id,
    name: z.string().trim().min(1).max(PROMPT_PRESET_LIMITS.nameChars),
    // The library template it was filled from, or null for a prompt written freely.
    templateId: z.string().min(1).max(120).nullable(),
    language: z.enum(["en", "ar"]),
    values: z.array(Field).max(16),
    // The prompt as kept: what Use puts into the brief.
    prompt: z.string().trim().min(1).max(PROMPT_TEXT_LIMIT),
  })
  .strict();
export type PromptPreset = z.infer<typeof PromptPresetSchema>;

export const PromptPresetsDocumentSchema = z
  .object({
    format: z.literal("yamakan.prompt-presets"),
    formatVersion: z.literal(1),
    presets: z.array(PromptPresetSchema).max(PROMPT_PRESET_LIMITS.presets),
  })
  .strict();
export type PromptPresetsDocument = z.infer<typeof PromptPresetsDocumentSchema>;

/**
 * A preset whose template the library no longer has stays as the prompt it made, with no
 * template: what the page saves, so the project's presets can always be saved again even if a
 * template were withdrawn (template ids and field names are kept; see core/prompts/library.ts).
 */
export const withoutMissingTemplates = (
  presets: readonly PromptPreset[],
): PromptPreset[] =>
  presets.map((p) =>
    p.templateId === null || promptTemplate(p.templateId)
      ? p
      : { ...p, templateId: null, values: [] },
  );

export const emptyPromptPresets = (): PromptPresetsDocument => ({
  format: "yamakan.prompt-presets",
  formatVersion: 1,
  presets: [],
});

const fail = (message: string): never => {
  throw new CommandError("VALIDATION", message);
};

/**
 * Validation of a parsed `promptPresets` document (core/documents.ts): the schema, then what it
 * cannot say. Ids and names are each used once; a preset's template, if named, is in the library
 * and its fields are that template's, each given once.
 */
export function validatePromptPresets(value: unknown) {
  const parsed = PromptPresetsDocumentSchema.safeParse(value);
  if (!parsed.success)
    fail(parsed.error.issues[0]?.message ?? "Invalid prompt presets.");
  const doc = parsed.data!;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const preset of doc.presets) {
    if (ids.has(preset.id)) fail(`The preset id ${preset.id} is used twice.`);
    ids.add(preset.id);
    // Without regard to case, the same in every locale.
    const name = preset.name.toLowerCase();
    if (names.has(name)) fail(`Two presets are named ${preset.name}.`);
    names.add(name);
    const fields = preset.values.map((v) => v.field);
    if (new Set(fields).size !== fields.length)
      fail(`The preset ${preset.name} gives a field twice.`);
    if (preset.templateId === null) {
      if (fields.length)
        fail(`The preset ${preset.name} has no template for its fields.`);
      continue;
    }
    const template = promptTemplate(preset.templateId);
    if (!template) fail(`The preset ${preset.name} names no library template.`);
    const known = new Set(template!.fields.map((f) => f.name));
    for (const f of fields)
      if (!known.has(f))
        fail(
          `The preset ${preset.name} has a field ${f} its template does not.`,
        );
  }
  return {
    content: doc,
    assetIds: [] as string[],
    objectDigests: [] as string[],
  };
}
