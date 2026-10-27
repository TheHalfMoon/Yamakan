// Cinematic intent → engine conditioning (YU-050). A shot's intent (camera,
// lens, light, motion, and guided inputs: an end frame, a depth map or a
// pose) is lowered against one recipe's declared capability, by a fixed
// table, to the engine contract's named, bounded controls and input roles
// (core/engines/contract-v2.ts). The compiler's output has no prompt and no
// free text, and no control is assumed:
// - applied: the recipe declares the control (or input role), and the
//   intent's value is lowered to it exactly (v1 has no approximate
//   lowering; the status is reserved);
// - metadata: the recipe does not declare a style control; the intent is
//   returned as previs metadata only, and nothing claims it was applied;
// - unsupported: a guided input the recipe does not take, or one the
//   contract has no role for (depth and pose today). Compiling is refused
//   unless the caller accepts that the guide is dropped (recorded).
// The report names the intent, and what reaches the engine under which
// compiler and recipe, by hash.
import { z } from "zod";
import { CommandError } from "../command/errors.ts";
import { Id } from "../project.ts";
import { canonicalJson, sha256Hex } from "../hash/canonical.ts";
import { ControlsSchema, type AssetRef } from "../engines/contract-v2.ts";

export const CONTROLS_COMPILER = "yamakan.controls-compiler/v1";

// Enumerated values are written as the contract's control values are:
// lowercase, digits, "_" and "-" only.
export const ShotIntentSchema = z
  .object({
    format: z.literal("yamakan.shot-intent"),
    formatVersion: z.literal(1),
    camera: z
      .object({
        shotScale: z
          .enum(["extreme_wide", "wide", "medium", "close", "extreme_close"])
          .optional(),
        movement: z
          .enum([
            "static",
            "pan",
            "tilt",
            "dolly",
            "truck",
            "crane",
            "orbit",
            "handheld",
          ])
          .optional(),
      })
      .strict()
      .default({}),
    lens: z
      .object({
        focalLengthMm: z.number().int().min(8).max(300).optional(),
        depthOfField: z.enum(["shallow", "medium", "deep"]).optional(),
      })
      .strict()
      .default({}),
    light: z
      .object({
        key: z.enum(["soft", "hard"]).optional(),
        timeOfDay: z
          .enum(["dawn", "day", "golden", "dusk", "night"])
          .optional(),
      })
      .strict()
      .default({}),
    motion: z
      .object({
        subject: z.enum(["still", "slow", "moderate", "fast"]).optional(),
      })
      .strict()
      .default({}),
    // Guided inputs: project media by id (never a path).
    guides: z
      .object({
        endFrame: Id.optional(),
        depth: Id.optional(),
        pose: Id.optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type ShotIntent = z.infer<typeof ShotIntentSchema>;

// The fixed lowering table: intent path → the contract's control name.
const STYLE: readonly {
  path: string;
  control: string;
  read: (i: ShotIntent) => string | number | undefined;
}[] = Object.freeze([
  {
    path: "camera.shotScale",
    control: "shotScale",
    read: (i) => i.camera.shotScale,
  },
  {
    path: "camera.movement",
    control: "cameraMovement",
    read: (i) => i.camera.movement,
  },
  {
    path: "lens.focalLengthMm",
    control: "focalLengthMm",
    read: (i) => i.lens.focalLengthMm,
  },
  {
    path: "lens.depthOfField",
    control: "depthOfField",
    read: (i) => i.lens.depthOfField,
  },
  { path: "light.key", control: "lightKey", read: (i) => i.light.key },
  {
    path: "light.timeOfDay",
    control: "timeOfDay",
    read: (i) => i.light.timeOfDay,
  },
  {
    path: "motion.subject",
    control: "subjectMotion",
    read: (i) => i.motion.subject,
  },
]);
// Guides → the contract's input roles. Depth and pose have none, so no
// recipe can take them yet: they are always unsupported.
const GUIDES: readonly {
  path: string;
  role: "lastFrame" | null;
  read: (i: ShotIntent) => string | undefined;
}[] = Object.freeze([
  {
    path: "guides.endFrame",
    role: "lastFrame",
    read: (i) => i.guides.endFrame,
  },
  { path: "guides.depth", role: null, read: (i) => i.guides.depth },
  { path: "guides.pose", role: null, read: (i) => i.guides.pose },
]);
export const GUIDE_PATHS = GUIDES.map((g) => g.path);
// The media types each role takes (as the contract's request schemas).
const ROLE_MEDIA: Readonly<Record<string, readonly string[]>> = Object.freeze({
  lastFrame: ["image/png", "image/jpeg"],
});

export type ControlReport = {
  path: string;
  status: "applied" | "metadata" | "unsupported" | "dropped";
  // The contract control or input role it was lowered to, when applied.
  to: string | null;
};

/** One recipe's declared capability: its controls and input roles. */
export type RecipeCapability = {
  recipeId: string;
  recipeHash: string;
  controls: readonly string[];
  roles: readonly string[];
};

/**
 * Lowers a shot's intent against a recipe's capability. `resolve` gives a
 * guide's project media as the contract's AssetRef (null when it is not
 * this project's). Refuses when a guide the recipe does not take is set and
 * not accepted as dropped; style controls it does not take stay metadata.
 */
export function compileControls(
  intentInput: unknown,
  recipe: RecipeCapability,
  resolve: (assetId: string) => AssetRef | null,
  acceptDropped: readonly string[] = [],
) {
  const parsed = ShotIntentSchema.safeParse(intentInput);
  if (!parsed.success)
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid shot intent.",
    );
  const intent = parsed.data;
  const controlSet = new Set(recipe.controls);
  const roleSet = new Set(recipe.roles);
  const controls: Record<string, string | number> = {};
  const inputs: { role: string; asset: AssetRef }[] = [];
  const report: ControlReport[] = [];
  for (const s of STYLE) {
    const value = s.read(intent);
    if (value === undefined) continue;
    if (controlSet.has(s.control)) {
      controls[s.control] = value;
      report.push({ path: s.path, status: "applied", to: s.control });
    } else report.push({ path: s.path, status: "metadata", to: null });
  }
  const unaccepted: string[] = [];
  for (const g of GUIDES) {
    const assetId = g.read(intent);
    if (assetId === undefined) continue;
    if (g.role && roleSet.has(g.role)) {
      const asset = resolve(assetId);
      if (!asset || !ROLE_MEDIA[g.role]!.includes(asset.mediaType))
        throw new CommandError(
          "VALIDATION",
          `The ${g.path} guide must be a still of this project.`,
        );
      inputs.push({ role: g.role, asset });
      report.push({ path: g.path, status: "applied", to: g.role });
    } else if (acceptDropped.includes(g.path))
      report.push({ path: g.path, status: "dropped", to: null });
    else {
      report.push({ path: g.path, status: "unsupported", to: null });
      unaccepted.push(g.path);
    }
  }
  if (unaccepted.length)
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      `Recipe ${recipe.recipeId} does not take ${unaccepted.join(", ")}; accept dropping it, or pick a recipe that does.`,
    );
  // What reaches the engine is always a valid contract control set.
  if (!ControlsSchema.safeParse(controls).success)
    throw new CommandError(
      "INTERNAL",
      "The controls compiler lowered an invalid control.",
    );
  return {
    compiler: CONTROLS_COMPILER,
    recipeId: recipe.recipeId,
    recipeHash: recipe.recipeHash,
    intentHash: sha256Hex(canonicalJson(intent)),
    // Bound to the compiler and recipe, so equal controls under another
    // recipe or table are another hash.
    loweredControlsHash: sha256Hex(
      canonicalJson({
        compiler: CONTROLS_COMPILER,
        recipeHash: recipe.recipeHash,
        controls,
        inputs,
      }),
    ),
    controls,
    inputs,
    report,
    // What only the previs carries (never claimed applied).
    metadataOnly: report
      .filter((r) => r.status === "metadata")
      .map((r) => r.path),
    dropped: report.filter((r) => r.status === "dropped").map((r) => r.path),
  };
}

/** The capability of one of this build's server-owned recipes. */
export function serverRecipeCapability<
  R extends {
    id: string;
    constraints: { controls: readonly string[]; roles: readonly string[] };
  },
>(recipes: readonly R[], hash: (recipe: R) => string, recipeId: string) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe)
    throw new CommandError("NOT_FOUND", "This build has no such recipe.");
  return {
    recipeId: recipe.id,
    recipeHash: hash(recipe),
    controls: recipe.constraints.controls,
    roles: recipe.constraints.roles,
  } satisfies RecipeCapability;
}
