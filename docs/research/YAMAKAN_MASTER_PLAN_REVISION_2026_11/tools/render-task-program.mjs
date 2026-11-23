// Renders 09_TASK_PROGRAM.md from TASK_REGISTRY_ADDENDUM.json.
//
//   node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/render-task-program.mjs
//   node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/render-task-program.mjs --check
//
// The registry is the source; the markdown is a rendering of it. --check
// writes nothing and fails when the file on disk differs from the rendering.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REGISTRY = "TASK_REGISTRY_ADDENDUM.json";
const OUTPUT = "09_TASK_PROGRAM.md";

const list = (items, empty = "None.") =>
  items && items.length
    ? items.map((item) => `- ${item}`).join("\n")
    : `- ${empty}`;
const numbered = (items) =>
  items && items.length
    ? items.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "1. None.";
// Implementation steps count from 0, because the cards refer to "step 0".
const steps = (items) =>
  items && items.length
    ? items.map((item, index) => `${index}. ${item}`).join("\n")
    : "0. None.";
const nested = (items) =>
  items && items.length
    ? items.map((item) => `  - ${item}`).join("\n")
    : "  - None.";
const WAITS_OUTSIDE = ["EXTERNAL_BLOCKED", "DEFERRED"];
const code = (items, empty = "None.") =>
  items && items.length ? items.map((item) => `\`${item}\``).join(", ") : empty;

function card(task) {
  return [
    `### ${task.id} — ${task.title}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| State | ${task.state} |`,
    `| Stage | ${task.stage} |`,
    `| Track | ${task.track} |`,
    `| Pillars | ${task.pillars.length ? task.pillars.join(", ") : "cross-cutting"} |`,
    `| Dependencies | ${task.dependsOn.length ? task.dependsOn.join(", ") : "none"} |`,
    `| Founder decisions | ${task.founderDecisions.length ? task.founderDecisions.join(", ") : "none"} |`,
    `| Earlier plan items | ${task.legacy.length ? task.legacy.join(", ") : "none"} |`,
    "",
    `**Goal.** ${task.objective}`,
    "",
    "**Current baseline**",
    "",
    list(task.currentBaseline),
    "",
    "**Exact code areas affected**",
    "",
    `- Existing: ${code(task.targets)}`,
    `- New files: ${code(task.newFiles)}`,
    "- Interfaces:",
    nested(task.interfaces),
    "",
    "**Source reuse opportunities**",
    "",
    `- Decision: ${task.sourceDecision}`,
    list(task.sourceReuse, "No further reuse identified."),
    "",
    "**Implementation instructions**",
    "",
    steps(task.implementationSequence),
    "",
    "**Expected behaviour**",
    "",
    list(task.acceptance),
    "",
    "**Test plan**",
    "",
    list(task.testPlan),
    "",
    "**Negative tests**",
    "",
    list(task.negativeTests),
    "",
    "**Real end-to-end qualification**",
    "",
    list(task.e2eQualification),
    "",
    "**Performance limits**",
    "",
    list(task.performanceCriteria),
    "",
    "**Compatibility**",
    "",
    list(task.compatibilityRequirements),
    "",
    "**Definition of Done**",
    "",
    list(task.definitionOfDone),
    "",
    "**Risks and blockers**",
    "",
    list(task.risks),
    ...(task.blockingExternalRequirements.length
      ? [
          "",
          WAITS_OUTSIDE.includes(task.state)
            ? "Blocked outside engineering by:"
            : "Parts that wait on something outside engineering:",
          "",
          list(task.blockingExternalRequirements),
        ]
      : []),
    "",
    `**Rollback.** ${task.rollback}`,
    "",
  ].join("\n");
}

export function render(registry) {
  const lines = [
    "# Task program",
    "",
    "> Status: PROPOSED — planning only. Not authority until founder review.",
    `> Baseline: \`main\` at \`${registry.baselineMain}\`, verified ${registry.planningDate}.`,
    "",
    `This file is rendered from \`${REGISTRY}\` by \`tools/render-task-program.mjs\`.`,
    "Do not edit it by hand: change the registry and render again.",
    "",
    "Every card carries the twelve fields the founder asked for: goal, current",
    "baseline, exact code areas affected, dependencies, source reuse, implementation",
    "instructions, expected behaviour, test plan, real end-to-end qualification,",
    "performance limits, Definition of Done, and risks and blockers. Negative tests,",
    "compatibility and rollback are added because the repository's own card format",
    "has them. Implementation steps are numbered from 0; step 0 is always the",
    "check of live `main`.",
    "",
    "## Common contract",
    "",
    "These rules apply to every card and are not repeated inside the cards.",
    "",
    numbered(registry.commonContract),
    "",
    "## Stages",
    "",
    "| Stage | Name | Purpose | Exit |",
    "| --- | --- | --- | --- |",
    ...registry.stages.map(
      (stage) =>
        `| ${stage.id} | ${stage.name} | ${stage.purpose} | ${stage.exit} |`,
    ),
    "",
    "## States",
    "",
    "| State | Meaning |",
    "| --- | --- |",
    ...registry.states.map((state) => `| ${state.id} | ${state.meaning} |`),
    "",
    "## Index",
    "",
    "| Card | Stage | State | Depends on | Title |",
    "| --- | --- | --- | --- | --- |",
    ...registry.tasks.map(
      (task) =>
        `| ${task.id} | ${task.stage} | ${task.state} | ${task.dependsOn.join(", ") || "—"} | ${task.title} |`,
    ),
    "",
  ];
  for (const track of registry.tracks) {
    const tasks = registry.tasks.filter((task) => task.track === track.id);
    if (!tasks.length) continue;
    lines.push(`## Track ${track.id} — ${track.name}`, "", track.purpose, "");
    for (const task of tasks) lines.push(card(task));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const registry = JSON.parse(
    fs.readFileSync(path.join(directory, REGISTRY), "utf8"),
  );
  const rendered = render(registry);
  const target = path.join(directory, OUTPUT);
  if (process.argv.includes("--check")) {
    const onDisk = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (onDisk.replace(/\r\n/g, "\n") !== rendered) {
      console.error(`${OUTPUT} is not the rendering of ${REGISTRY}.`);
      process.exit(1);
    }
    console.log(`${OUTPUT} matches ${REGISTRY}.`);
  } else {
    fs.writeFileSync(target, rendered);
    console.log(`Wrote ${OUTPUT}: ${registry.tasks.length} cards.`);
  }
}
