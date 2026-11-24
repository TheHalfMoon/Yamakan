// MPR-208: what is known of a model's licence, and whether that allows offering it. Browser-safe,
// and pure: no clock, no file, no network. A block says what a named reader read at `sourceUrl` on
// `verifiedAt`; it is not legal advice. See docs/MODEL_LICENCE_GATE.md.
import { z } from "zod";

export const LICENCE_BLOCK_FORMAT = "yamakan.model-licence/v1";

// Licenses a model may carry and be used under (commercial use included).
export const ACCEPTED_MODEL_LICENSES: readonly string[] = Object.freeze([
  "apache-2.0",
  "mit",
  "bsd-2-clause",
  "bsd-3-clause",
]);

// Package licences a bundled runtime may carry: permissive, or file-level
// copyleft (MPL-2.0, unmodified). Anything else, GPL and LGPL included,
// is refused until reviewed.
export const ACCEPTED_PACKAGE_LICENSES: readonly string[] = Object.freeze([
  "Apache-2.0",
  "MIT",
  "MIT-CMU",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "ISC",
  "Zlib",
  "BSL-1.0",
  "CC0-1.0",
  "PSF-2.0",
  "CNRI-Python",
  "MPL-2.0",
]);
// The only accepted exception, and the licence it modifies.
const ACCEPTED_EXCEPTIONS: Readonly<Record<string, string>> = Object.freeze({
  "LLVM-exception": "Apache-2.0",
});

/**
 * Whether an SPDX expression is well formed and every licence in it is
 * accepted: expression = term ((AND | OR) term)*, term = "(" expression ")"
 * or a licence with an optional "WITH" exception. Either side of an OR
 * must be accepted too (conservative: no choosing the accepted branch).
 */
export function packageLicenseAccepted(spdx: string | null) {
  if (!spdx) return false;
  const tokens = spdx.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const term = (): boolean => {
    const t = tokens[i++];
    if (t === "(") {
      if (!expression()) return false;
      return tokens[i++] === ")";
    }
    if (!t || !ACCEPTED_PACKAGE_LICENSES.includes(t)) return false;
    if (tokens[i] === "WITH") {
      const exception = tokens[i + 1];
      i += 2;
      return exception !== undefined && ACCEPTED_EXCEPTIONS[exception] === t;
    }
    return true;
  };
  const expression = (): boolean => {
    if (!term()) return false;
    while (tokens[i] === "AND" || tokens[i] === "OR") {
      i++;
      if (!term()) return false;
    }
    return true;
  };
  return expression() && i === tokens.length;
}

const words = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((t) => t === t.trim(), "No space around it.");

// A name, never an address by number: its last part begins with a letter.
export const HOST =
  "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){0,8}\\.[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?";
export const plainSegments = (p: string) =>
  !p.split("/").some((s) => s === "" || s === "." || s === "..");
// A page that was read, never fetched by code: no account, query or fragment in it.
export const SourceUrl = z
  .string()
  .max(300)
  .regex(new RegExp(`^https://${HOST}/[A-Za-z0-9._~/-]+$`))
  .refine(
    (u) => plainSegments(u.slice("https://".length)),
    "A page's plain address.",
  );

const Right = z.enum(["allowed", "notAllowed", "unknown"]);
export const LicenceTermSchema = z
  .object({
    name: words(120),
    // Null where the publisher names no licence that has one.
    spdx: words(200).nullable(),
    commercialUse: Right,
  })
  .strict();
export type LicenceTerm = z.infer<typeof LicenceTermSchema>;

const kind = <K extends string>(value: K) =>
  z.object({ kind: z.literal(value) }).strict();

export const LicenceBlockSchema = z
  .object({
    // The pipeline library the weights are run with.
    code: LicenceTermSchema,
    weights: LicenceTermSchema,
    baseModel: z.union([LicenceTermSchema, kind("none")]),
    // What else the run loads, each once. Reviewed, so an empty list says that there is nothing.
    bundled: z
      .array(
        z
          .object({ name: words(80), role: words(80), term: LicenceTermSchema })
          .strict(),
      )
      .max(16)
      .refine(
        (all) => new Set(all.map((b) => b.name)).size === all.length,
        "Each once.",
      ),
    bundledReviewed: z.literal(true),
    revenueCap: z.union([
      kind("none"),
      z
        .object({
          kind: z.literal("cap"),
          amount: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
          currency: z.string().regex(/^[A-Z]{3}$/),
        })
        .strict(),
      kind("unknown"),
    ]),
    territorialExclusions: z.union([
      kind("none"),
      z
        .object({
          kind: z.literal("excluded"),
          regions: z.array(words(80)).min(1).max(64),
        })
        .strict(),
      kind("unknown"),
    ]),
    hostedServiceRight: Right,
    outputUse: z.union([
      kind("unrestricted"),
      z.object({ kind: z.literal("restricted"), note: words(500) }).strict(),
      kind("unknown"),
    ]),
    watermark: z.union([
      kind("none"),
      z
        .object({ kind: z.enum(["visible", "invisible"]), note: words(500) })
        .strict(),
      kind("unknown"),
    ]),
    gated: z.enum(["no", "yes", "unknown"]),
    attribution: z.union([
      kind("none"),
      z.object({ kind: z.literal("required"), text: words(500) }).strict(),
      kind("unknown"),
    ]),
    sourceUrl: SourceUrl,
    verifiedAt: z.iso.date(),
    // DOC: the licence's own text was read at `sourceUrl`.
    evidence: z.enum(["DOC", "CLAIM", "IND", "ASSUMED", "UNKNOWN"]),
  })
  .strict();
export type LicenceBlock = z.infer<typeof LicenceBlockSchema>;

// Where the model runs: "hosted" is a service under the person's own account (Kaggle).
export type LicenceUse = { run: "local" | "hosted" };
export type LicenceRefusal =
  | "BLOCK_MISSING"
  | "BLOCK_INVALID"
  | "FIELD_UNKNOWN"
  | "NOT_READ_AT_SOURCE"
  | "LICENCE_UNACCEPTED"
  | "NON_COMMERCIAL"
  | "REVENUE_CAP"
  | "TERRITORY_EXCLUDED"
  | "HOSTED_RUN_NOT_ALLOWED"
  | "OUTPUT_USE_RESTRICTED"
  | "GATED";
export type LicenceGate =
  { offered: true } | { offered: false; reasons: LicenceRefusal[] };

const isNone = (
  value: LicenceBlock["baseModel"],
): value is Extract<LicenceBlock["baseModel"], { kind: "none" }> =>
  "kind" in value;

export const LICENCE_FIELDS = Object.freeze([
  "code",
  "weights",
  "baseModel",
  "bundled",
  "revenueCap",
  "territorialExclusions",
  "hostedServiceRight",
  "outputUse",
  "watermark",
  "gated",
  "attribution",
  "evidence",
] as const);
export type LicenceField = (typeof LICENCE_FIELDS)[number];
// `part` is the bundled component, by its name.
export type OpenLicenceField = { field: LicenceField; part: string | null };

/** What a block says is not known, or was not read at its source, for a use. */
export function openLicenceFields(
  block: LicenceBlock,
  use: LicenceUse,
): OpenLicenceField[] {
  const open: OpenLicenceField[] = [];
  const say = (field: LicenceField, part: string | null = null) =>
    open.push({ field, part });
  for (const field of ["code", "weights"] as const)
    if (block[field].commercialUse === "unknown") say(field);
  if (!isNone(block.baseModel) && block.baseModel.commercialUse === "unknown")
    say("baseModel");
  for (const { name, term } of block.bundled)
    if (term.commercialUse === "unknown") say("bundled", name);
  for (const field of ["revenueCap", "territorialExclusions"] as const)
    if (block[field].kind === "unknown") say(field);
  if (use.run === "hosted" && block.hostedServiceRight === "unknown")
    say("hostedServiceRight");
  for (const field of ["outputUse", "watermark"] as const)
    if (block[field].kind === "unknown") say(field);
  if (block.gated === "unknown") say("gated");
  if (block.attribution.kind === "unknown") say("attribution");
  if (block.evidence !== "DOC") say("evidence");
  return open;
}

/** Whether a model under this block may be offered for a use, with every reason it may not. */
export function licenceGate(block: unknown, use: LicenceUse): LicenceGate {
  if (block === undefined || block === null)
    return { offered: false, reasons: ["BLOCK_MISSING"] };
  const parsed = LicenceBlockSchema.safeParse(block);
  if (!parsed.success) return { offered: false, reasons: ["BLOCK_INVALID"] };
  const b = parsed.data;
  const models = [b.weights, ...(isNone(b.baseModel) ? [] : [b.baseModel])];
  const packages = [b.code, ...b.bundled.map((x) => x.term)];
  const reasons = new Set<LicenceRefusal>();
  if (openLicenceFields(b, use).some((o) => o.field !== "evidence"))
    reasons.add("FIELD_UNKNOWN");
  if (b.evidence !== "DOC") reasons.add("NOT_READ_AT_SOURCE");
  if (
    models.some(
      (t) =>
        t.spdx === null ||
        !ACCEPTED_MODEL_LICENSES.includes(t.spdx.toLowerCase()),
    ) ||
    packages.some((t) => !packageLicenseAccepted(t.spdx))
  )
    reasons.add("LICENCE_UNACCEPTED");
  if ([...models, ...packages].some((t) => t.commercialUse === "notAllowed"))
    reasons.add("NON_COMMERCIAL");
  if (b.revenueCap.kind === "cap") reasons.add("REVENUE_CAP");
  if (b.territorialExclusions.kind === "excluded")
    reasons.add("TERRITORY_EXCLUDED");
  if (use.run === "hosted" && b.hostedServiceRight !== "allowed")
    reasons.add("HOSTED_RUN_NOT_ALLOWED");
  if (b.outputUse.kind === "restricted") reasons.add("OUTPUT_USE_RESTRICTED");
  if (b.gated === "yes") reasons.add("GATED");
  return reasons.size === 0
    ? { offered: true }
    : { offered: false, reasons: [...reasons] };
}

// The recipes that were offered before this gate (2026-11-24), by the founder's direction. Closed:
// a test refuses a new one. Each stays offered with what is not known of its licence shown, until
// the founder decides; it is not a clearance, and what is known and against it is not excused.
export const PRE_GATE_EXCEPTIONS = Object.freeze({
  at: "2026-11-24",
  recipeIds: Object.freeze([
    "kaggle-wan22-ti2v-5b",
    "kaggle-wan22-ti2v-5b-first-frame",
    "kaggle-cogvideox-2b",
  ] as readonly string[]),
});
// What a component whose licence is not known gives, and no more.
const OPEN: readonly LicenceRefusal[] = [
  "FIELD_UNKNOWN",
  "NOT_READ_AT_SOURCE",
  "LICENCE_UNACCEPTED",
];

/** Whether a recipe may be offered: by the gate, or as one of the recipes before it. */
export function recipeLicence(
  recipeId: string | null,
  block: unknown,
  use: LicenceUse,
): { offered: boolean; reasons: LicenceRefusal[]; open: OpenLicenceField[] } {
  const gate = licenceGate(block, use);
  if (gate.offered) return { offered: true, reasons: [], open: [] };
  const parsed = LicenceBlockSchema.safeParse(block);
  return {
    offered:
      parsed.success &&
      recipeId !== null &&
      PRE_GATE_EXCEPTIONS.recipeIds.includes(recipeId) &&
      gate.reasons.every((r) => OPEN.includes(r)) &&
      // A licence that is named and not accepted is not one that is not known.
      !namedAndUnaccepted(parsed.data),
    reasons: gate.reasons,
    open: parsed.success ? openLicenceFields(parsed.data, use) : [],
  };
}

const namedAndUnaccepted = (b: LicenceBlock) =>
  [b.weights, ...(isNone(b.baseModel) ? [] : [b.baseModel])].some(
    (t) =>
      t.commercialUse !== "unknown" &&
      !ACCEPTED_MODEL_LICENSES.includes((t.spdx ?? "").toLowerCase()),
  ) ||
  [b.code, ...b.bundled.map((x) => x.term)].some(
    (t) => t.commercialUse !== "unknown" && !packageLicenseAccepted(t.spdx),
  );
