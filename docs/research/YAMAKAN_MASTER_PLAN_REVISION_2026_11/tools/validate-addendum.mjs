// Validates the master plan revision package. Read-only: it writes nothing.
//
//   node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/validate-addendum.mjs
//   node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/validate-addendum.mjs --self-test
//
// --self-test runs in-memory controls of the state and header rules; it reads no file.
// It checks structure and cross-references, and that what the documents name
// in the repository exists at the checked-out head. It does not judge whether
// the plan is good, and a PASS here is not a review. A check that cannot run
// is an error, never a pass.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, statusLine } from "./render-task-program.mjs";

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const root = path.resolve(directory, "../../..");
const SS_DIRECTORY = "docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA";
const COMMAND_REGISTRY = "core/command/registry.ts";

const errors = [];
const passed = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
  return Boolean(condition);
};
const section = (name, before) => {
  if (errors.length === before) passed.push(name);
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const exists = (relative) => fs.existsSync(path.join(root, relative));
const isSha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const strings = (value) =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim().length > 0);

// ---------------------------------------------------------------- rules
// The four planning states keep the rule that none of a card's newFiles exists. REVIEW_PENDING
// puts no condition on newFiles. VERIFIED needs them all and names its commit in `evidence`.
const PLANNING_STATES = [
  "QUALIFICATION_READY",
  "WAITING_DEPENDENCIES",
  "EXTERNAL_BLOCKED",
  "DEFERRED",
];
const STATES = [...PLANNING_STATES, "REVIEW_PENDING", "VERIFIED"];
const namesCommit = (text) =>
  typeof text === "string" &&
  /\b(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/.test(text);

// Returns messages; an empty list is a pass. `exists` is given so the self-test can stub it.
export function lifecycleIssues(tasks, ssState, exists) {
  const issues = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    const at = "card " + task.id + ": ";
    const files = task.newFiles ?? [];
    if (!STATES.includes(task.state)) {
      issues.push(at + "state not allowed: " + task.state);
      continue;
    }
    if (PLANNING_STATES.includes(task.state))
      for (const file of files)
        if (exists(file))
          issues.push(at + "newFiles entry already exists: " + file);
    let waiting = false;
    for (const dependency of task.dependsOn ?? []) {
      if (dependency === task.id) issues.push(at + "depends on itself");
      if (byId.has(dependency))
        waiting ||= byId.get(dependency).state !== "VERIFIED";
      else if (ssState.has(dependency))
        waiting ||= ssState.get(dependency) !== "VERIFIED";
      else issues.push(at + "unknown dependency " + dependency);
    }
    if (waiting && ["QUALIFICATION_READY", "REVIEW_PENDING", "VERIFIED"].includes(task.state))
      issues.push(at + task.state + " with an unfinished dependency");
    if (!waiting && task.state === "WAITING_DEPENDENCIES")
      issues.push(at + "WAITING_DEPENDENCIES with no unfinished dependency");
    if (
      task.state === "EXTERNAL_BLOCKED" &&
      (task.blockingExternalRequirements ?? []).length === 0
    )
      issues.push(at + "EXTERNAL_BLOCKED needs blockingExternalRequirements");
    if (task.state === "VERIFIED") {
      if (!namesCommit(task.evidence))
        issues.push(at + "VERIFIED needs evidence that names a commit");
      for (const file of files)
        if (!exists(file))
          issues.push(at + "VERIFIED but a new file is missing: " + file);
    }
  }
  return issues;
}

// The registry header and the documents' status lines are in exactly one form: proposed or
// adopted. The heading is one that exists in the founder record. A pass is not an authority.
export function headerIssues(registry, documentHeads, recordText) {
  const issues = [];
  const adopted = registry.status === "ADOPTED";
  if (!adopted && registry.status !== "PROPOSED_NOT_AUTHORIZED")
    issues.push("registry: status must be PROPOSED_NOT_AUTHORIZED or ADOPTED");
  if (!adopted) {
    if (registry.implementationAuthorized !== false)
      issues.push("registry: implementationAuthorized must be false while proposed");
    if (registry.adoption !== undefined)
      issues.push("registry: a proposed package has no adoption block");
  } else {
    if (registry.implementationAuthorized !== true)
      issues.push("registry: ADOPTED needs implementationAuthorized true");
    const adoption = registry.adoption;
    if (!adoption) issues.push("registry: ADOPTED needs an adoption block");
    else {
      if (adoption.record !== "docs/FOUNDER_DECISION_RECORD.md")
        issues.push("registry: adoption.record must be the founder record");
      if (!isSha(adoption.mergeCommit))
        issues.push("registry: adoption.mergeCommit is not a commit id");
      const headings = new Set(
        [...recordText.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim()),
      );
      if (!headings.has(adoption.heading))
        issues.push("registry: adoption.heading is not a heading of the founder record");
    }
  }
  const own = statusLine(registry);
  const other = statusLine({ status: adopted ? "PROPOSED_NOT_AUTHORIZED" : "ADOPTED" });
  for (const { name, head } of documentHeads) {
    if (!head.includes(own)) issues.push(name + ": status line missing");
    if (head.includes(other))
      issues.push(name + ": carries the status line of the other form");
  }
  return issues;
}

if (process.argv.includes("--self-test")) {
  let count = 0;
  const has = (list, word) => {
    assert(
      list.some((message) => message.includes(word)),
      "expected '" + word + "' in " + JSON.stringify(list),
    );
    count++;
  };
  const none = (list) => {
    assert.deepEqual(list, []);
    count++;
  };
  const card = (id, state, more = {}) => ({
    id,
    state,
    dependsOn: [],
    newFiles: [],
    blockingExternalRequirements: [],
    ...more,
  });
  const ss = new Map([
    ["SS-001", "VERIFIED"],
    ["SS-002", "IN_PROGRESS"],
  ]);
  const here = (file) => file === "there";
  const commit = "merged as " + "a".repeat(40);
  const rule = (...tasks) => lifecycleIssues(tasks, ss, here);
  const ok = [
    card("A", "VERIFIED", { evidence: commit, newFiles: ["there"] }),
    card("B", "REVIEW_PENDING", { dependsOn: ["A"], newFiles: ["there"] }),
    card("C", "QUALIFICATION_READY", { dependsOn: ["A", "SS-001"], newFiles: ["nowhere"] }),
    card("D", "WAITING_DEPENDENCIES", { dependsOn: ["B"] }),
    card("E", "EXTERNAL_BLOCKED", { blockingExternalRequirements: ["a decision"] }),
    card("F", "DEFERRED"),
  ];
  none(lifecycleIssues(ok, ss, here));
  has(rule(card("A", "VERIFIED", { newFiles: [] })), "names a commit");
  has(rule(card("A", "VERIFIED", { evidence: "done 20261123, run 45136406982" })), "names a commit");
  has(rule(card("A", "VERIFIED", { evidence: commit, newFiles: ["nowhere"] })), "new file is missing");
  has(
    rule(card("A", "REVIEW_PENDING"), card("B", "QUALIFICATION_READY", { dependsOn: ["A"] })),
    "QUALIFICATION_READY with an unfinished dependency",
  );
  has(rule(card("A", "QUALIFICATION_READY", { dependsOn: ["SS-002"] })), "unfinished dependency");
  has(
    rule(card("A", "VERIFIED", { evidence: commit }), card("B", "WAITING_DEPENDENCIES", { dependsOn: ["A"] })),
    "no unfinished dependency",
  );
  has(rule(card("A", "QUALIFICATION_READY", { newFiles: ["there"] })), "already exists");
  has(rule(card("A", "DONE")), "state not allowed");
  has(rule(card("A", "REVIEW_PENDING", { dependsOn: ["SS-002"] })), "REVIEW_PENDING with an unfinished");
  has(rule(card("A", "VERIFIED", { evidence: commit, dependsOn: ["SS-002"] })), "VERIFIED with an unfinished");
  has(rule(card("A", "QUALIFICATION_READY", { dependsOn: ["SS-999"] })), "unknown dependency");
  has(rule(card("A", "EXTERNAL_BLOCKED")), "needs blockingExternalRequirements");

  const record = "# Record\n\n## 2026-01-01: Adopted\n\ntext\n\n### deeper\n";
  const line = (status) => statusLine({ status });
  const heads = (status) => [{ name: "README.md", head: "# T\n\n" + line(status) }];
  const adoption = {
    record: "docs/FOUNDER_DECISION_RECORD.md",
    heading: "2026-01-01: Adopted",
    mergeCommit: "b".repeat(40),
  };
  const adopted = { status: "ADOPTED", implementationAuthorized: true, adoption };
  const proposed = { status: "PROPOSED_NOT_AUTHORIZED", implementationAuthorized: false };
  none(headerIssues(proposed, heads("PROPOSED_NOT_AUTHORIZED"), record));
  none(headerIssues(adopted, heads("ADOPTED"), record));
  has(headerIssues({ ...adopted, implementationAuthorized: false }, heads("ADOPTED"), record), "implementationAuthorized true");
  has(headerIssues({ ...adopted, adoption: undefined }, heads("ADOPTED"), record), "adoption block");
  has(headerIssues({ ...proposed, adoption }, heads("PROPOSED_NOT_AUTHORIZED"), record), "no adoption block");
  has(headerIssues({ ...proposed, implementationAuthorized: true }, heads("PROPOSED_NOT_AUTHORIZED"), record), "false while proposed");
  has(headerIssues({ ...adopted, adoption: { ...adoption, heading: "deeper" } }, heads("ADOPTED"), record), "not a heading");
  has(headerIssues({ ...adopted, adoption: { ...adoption, mergeCommit: "b" } }, heads("ADOPTED"), record), "not a commit id");
  has(headerIssues(adopted, heads("PROPOSED_NOT_AUTHORIZED"), record), "other form");
  has(headerIssues({ status: "MAYBE", implementationAuthorized: false }, heads("PROPOSED_NOT_AUTHORIZED"), record), "status must be");
  console.log("PASS: lifecycle and header controls (" + count + " assertions).");
  process.exit(0);
}

// ---------------------------------------------------------------- inputs
let registry, reconciliation, ssRegistry, ssReconciliation, commandSource, recordText;
try {
  registry = readJson(path.join(directory, "TASK_REGISTRY_ADDENDUM.json"));
  reconciliation = readJson(
    path.join(directory, "LEGACY_RECONCILIATION_ADDENDUM.json"),
  );
  ssRegistry = readJson(path.join(root, SS_DIRECTORY, "TASK_REGISTRY.json"));
  ssReconciliation = readJson(
    path.join(root, SS_DIRECTORY, "LEGACY_RECONCILIATION.json"),
  );
  commandSource = fs.readFileSync(path.join(root, COMMAND_REGISTRY), "utf8");
  recordText = fs
    .readFileSync(path.join(root, "docs/FOUNDER_DECISION_RECORD.md"), "utf8")
    .replace(/\r\n/g, "\n");
} catch (error) {
  console.error("BLOCKED: a required input could not be read: " + error.message);
  process.exit(1);
}
const ssState = new Map(ssRegistry.tasks.map((task) => [task.id, task.state]));
const legacyIds = ssReconciliation.tasks.map((task) => task.id);

// ---------------------------------------------------------------- registry
let mark = errors.length;
const DECISIONS = ["COPY", "ADAPT", "WRAP", "COMBINE", "BUILD", "DEFER", "REJECT"];
const PILLARS = ["A", "B", "C", "D", "E"];
check(
  registry.schema === "yamakan.system-improvement-plan-addendum/v1",
  "registry: unexpected schema",
);
check(isSha(registry.baselineMain), "registry: baselineMain is not a commit id");
check(
  /^\d{4}-\d{2}-\d{2}$/.test(registry.planningDate ?? ""),
  "registry: planningDate missing",
);
check(
  registry.extends?.registry === SS_DIRECTORY + "/TASK_REGISTRY.json" &&
    registry.extends?.schema === ssRegistry.schema,
  "registry: extends must name the System Supremacy registry and its schema",
);
check(
  strings(registry.commonContract) && registry.commonContract.length >= 6,
  "registry: commonContract missing",
);
check(
  typeof registry.thesis === "string" && registry.thesis.length > 40,
  "registry: thesis missing",
);
const stageIds = new Set((registry.stages ?? []).map((stage) => stage.id));
const trackIds = new Set((registry.tracks ?? []).map((track) => track.id));
const decisionIds = new Set(
  (registry.founderDecisions ?? []).map((decision) => decision.id),
);
check(stageIds.size >= 6, "registry: stages missing");
check(trackIds.size >= 8, "registry: tracks missing");
check(decisionIds.size >= 1, "registry: founderDecisions missing");
check(
  JSON.stringify((registry.states ?? []).map((state) => state.id)) ===
    JSON.stringify(STATES),
  "registry: states must list the six allowed card states in order",
);
for (const entry of registry.pathsNotOnMain ?? [])
  check(
    typeof entry.path === "string" &&
      typeof entry.reason === "string" &&
      !exists(entry.path),
    "registry: pathsNotOnMain entry exists on main or lacks a reason: " +
      entry.path,
  );
section("registry header", mark);

// ---------------------------------------------------------------- cards
mark = errors.length;
const tasks = Array.isArray(registry.tasks) ? registry.tasks : [];
const taskIds = tasks.map((task) => task.id);
const byId = new Map(tasks.map((task) => [task.id, task]));
check(tasks.length > 0, "registry: no tasks");
check(byId.size === tasks.length, "registry: duplicate card id");
check(
  JSON.stringify(taskIds) === JSON.stringify(registry.expectedTaskIds),
  "registry: tasks differ from expectedTaskIds (order included)",
);
const ARRAY_FIELDS = {
  pillars: 0,
  dependsOn: 0,
  legacy: 0,
  founderDecisions: 0,
  currentBaseline: 2,
  targets: 0,
  newFiles: 0,
  interfaces: 0,
  sourceReuse: 0,
  implementationSequence: 4,
  acceptance: 3,
  testPlan: 1,
  negativeTests: 1,
  e2eQualification: 1,
  performanceCriteria: 1,
  compatibilityRequirements: 1,
  definitionOfDone: 2,
  risks: 2,
  blockingExternalRequirements: 0,
};
const STRING_FIELDS = [
  "id",
  "title",
  "track",
  "state",
  "objective",
  "sourceDecision",
  "rollback",
];
const LEGACY_PATTERNS = [
  /^YU-\d{3}$/,
  /^stream:[a-z0-9-]+$/,
  /^P10-\d{2}$/,
  /^[QWMT]\d{1,2}$/,
  /^H[1-5]$/,
  /^issue #\d+$/,
  /^ledger-12$/,
];
const streamIds = new Set((reconciliation.streams ?? []).map((s) => s.id));
const proposedPaths = new Set(
  (registry.pathsNotOnMain ?? []).map((entry) => entry.path),
);
for (const task of tasks) {
  const at = "card " + task.id + ": ";
  for (const field of STRING_FIELDS)
    check(
      typeof task[field] === "string" && task[field].trim().length > 0,
      at + "missing " + field,
    );
  for (const [field, minimum] of Object.entries(ARRAY_FIELDS))
    check(
      strings(task[field]) && task[field].length >= minimum,
      at + field + " must be a list of at least " + minimum + " text items",
    );
  const known = new Set([
    ...STRING_FIELDS,
    ...Object.keys(ARRAY_FIELDS),
    "stage",
    "evidence",
  ]);
  for (const key of Object.keys(task))
    check(known.has(key), at + "unknown field " + key);
  check(/^MPR-\d{3}$/.test(task.id ?? ""), at + "id must look like MPR-000");
  check((task.title ?? "").length <= 90, at + "title is longer than 90 characters");
  check(
    task.evidence === undefined ||
      (typeof task.evidence === "string" && task.evidence.trim().length > 0),
    at + "evidence must be text",
  );
  check(stageIds.has(task.stage), at + "unknown stage " + task.stage);
  check(trackIds.has(task.track), at + "unknown track " + task.track);
  for (const pillar of task.pillars ?? [])
    check(PILLARS.includes(pillar), at + "unknown pillar " + pillar);
  check(
    DECISIONS.some((word) => (task.sourceDecision ?? "").startsWith(word)),
    at + "sourceDecision must start with one of " + DECISIONS.join(", "),
  );
  check(
    /verify|reproduce|ALREADY_SATISFIED/i.test(
      (task.implementationSequence ?? [])[0] ?? "",
    ),
    at + "first implementation step must verify live main",
  );
  for (const decision of task.founderDecisions ?? [])
    check(decisionIds.has(decision), at + "unknown founder decision " + decision);
  for (const item of task.legacy ?? [])
    check(
      ssState.has(item) ||
        (LEGACY_PATTERNS.some((pattern) => pattern.test(item)) &&
          (!item.startsWith("YU-") || legacyIds.includes(item)) &&
          (!item.startsWith("stream:") || streamIds.has(item))),
      at + "unknown earlier plan item " + item,
    );
  for (const target of task.targets ?? [])
    check(exists(target), at + "target does not exist: " + target);
  for (const file of task.newFiles ?? []) proposedPaths.add(file);
  check(
    new Set(task.dependsOn).size === (task.dependsOn ?? []).length,
    at + "duplicate dependency",
  );
}
for (const message of lifecycleIssues(tasks, ssState, exists))
  check(false, message);
// No cycle among the cards (dependencies on System Supremacy cards are leaves).
{
  const active = new Set();
  const done = new Set();
  const visit = (id) => {
    if (done.has(id) || !byId.has(id)) return;
    if (active.has(id)) {
      check(false, "dependency cycle at " + id);
      return;
    }
    active.add(id);
    for (const dependency of byId.get(id).dependsOn ?? []) visit(dependency);
    active.delete(id);
    done.add(id);
  };
  for (const id of taskIds) visit(id);
}
// A card never sits in an earlier stage than a card it depends on, unless it
// is parked (blocked or deferred) and so not part of the stage's exit.
for (const task of tasks)
  for (const dependency of task.dependsOn ?? []) {
    const other = byId.get(dependency);
    if (other && ["QUALIFICATION_READY", "WAITING_DEPENDENCIES"].includes(task.state))
      check(
        other.stage <= task.stage,
        "card " + task.id + " (stage " + task.stage + ") depends on " +
          other.id + " in later stage " + other.stage,
      );
  }
for (const decision of registry.founderDecisions ?? [])
  for (const id of decision.cards ?? [])
    check(byId.has(id), "founder decision " + decision.id + " names unknown card " + id);
section("cards (" + tasks.length + ")", mark);

// ---------------------------------------------------------------- reconciliation
mark = errors.length;
check(
  reconciliation.schema === "yamakan.legacy-reconciliation-addendum/v1",
  "reconciliation: unexpected schema",
);
check(
  reconciliation.baselineMain === registry.baselineMain,
  "reconciliation: baselineMain differs from the registry",
);
const exactlyOnce = (rows, expected, name) => {
  const ids = (rows ?? []).map((row) => row.id);
  check(new Set(ids).size === ids.length, "reconciliation: duplicate id in " + name);
  for (const id of expected)
    check(ids.includes(id), "reconciliation: " + name + " lacks " + id);
  for (const id of ids)
    check(expected.includes(id), "reconciliation: " + name + " has unknown " + id);
};
exactlyOnce(reconciliation.ultimatePlan, legacyIds, "ultimatePlan");
exactlyOnce(reconciliation.systemSupremacy, [...ssState.keys()], "systemSupremacy");
const knownCard = (id) => byId.has(id) || ssState.has(id);
for (const row of reconciliation.ultimatePlan ?? []) {
  const earlier = ssReconciliation.tasks.find((task) => task.id === row.id);
  check(
    earlier && row.priorDisposition === earlier.disposition,
    "reconciliation: " + row.id + " priorDisposition differs from the System Supremacy record",
  );
  check(typeof row.disposition === "string", "reconciliation: " + row.id + " lacks a disposition");
  for (const id of row.successors ?? [])
    check(knownCard(id), "reconciliation: " + row.id + " names unknown successor " + id);
}
for (const row of reconciliation.systemSupremacy ?? []) {
  check(
    row.state === ssState.get(row.id),
    "reconciliation: " + row.id + " state differs from the System Supremacy registry",
  );
  check(typeof row.disposition === "string", "reconciliation: " + row.id + " lacks a disposition");
  for (const id of row.relatedCards ?? [])
    check(byId.has(id), "reconciliation: " + row.id + " names unknown card " + id);
}
check((reconciliation.streams ?? []).length > 0, "reconciliation: streams missing");
check(
  streamIds.size === (reconciliation.streams ?? []).length,
  "reconciliation: duplicate stream id",
);
for (const row of reconciliation.streams ?? []) {
  check(/^stream:[a-z0-9-]+$/.test(row.id), "reconciliation: bad stream id " + row.id);
  check(
    typeof row.pullRequests === "string" && typeof row.disposition === "string",
    "reconciliation: stream " + row.id + " lacks pullRequests or disposition",
  );
  for (const id of row.cards ?? [])
    check(byId.has(id), "reconciliation: stream " + row.id + " names unknown card " + id);
}
check(
  (reconciliation.pullRequests ?? []).some((row) => row.number === 85) &&
    (reconciliation.pullRequests ?? []).some((row) => row.number === 86),
  "reconciliation: draft pull requests 85 and 86 need a proposed disposition",
);
section("reconciliation", mark);

// ---------------------------------------------------------------- rendering
mark = errors.length;
{
  const target = path.join(directory, "09_TASK_PROGRAM.md");
  const onDisk = fs.existsSync(target)
    ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n")
    : "";
  check(
    onDisk === render(registry),
    "09_TASK_PROGRAM.md is not the rendering of the registry",
  );
}
section("task program rendering", mark);

// ---------------------------------------------------------------- documents
mark = errors.length;
const REQUIRED_DOCUMENTS = [
  "README.md",
  "00_VISION_AND_DIFFERENTIATION.md",
  "01_COMPETITIVE_CAPABILITY_MATRIX.md",
  "02_CURRENT_ARCHITECTURE_ASSESSMENT.md",
  "03_GAP_AND_DEPENDENCY_ANALYSIS.md",
  "04_SOURCE_REUSE_DECISIONS.md",
  "05_TARGET_ARCHITECTURE.md",
  "06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md",
  "07_MODEL_AND_PROVIDER_STRATEGY.md",
  "08_ROADMAP.md",
  "09_TASK_PROGRAM.md",
  "10_BENCHMARK_AND_EVALUATION.md",
  "11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md",
  "12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md",
  "13_ADVERSARIAL_REVIEW.md",
  "OPUS_IMPLEMENTATION_HANDOFF.md",
  "FOUNDER_DECISIONS_REQUESTED.md",
  "SOURCES.md",
];
const rootEntries = new Set(fs.readdirSync(root));
const proposedCommands = new Set(registry.proposedCommands ?? []);
const COMMAND = /yamakan\.[a-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*/g;
for (const task of tasks)
  for (const text of task.interfaces ?? [])
    for (const name of text.match(COMMAND) ?? []) proposedCommands.add(name);
const PATH_TOKEN = /^\.?[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_.@-]+)+\/?$/;
const legacySet = new Set(legacyIds);

function checkText(name, text) {
  const at = name + ": ";
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1].replace(/[.,;:]+$/, "");
    if (PATH_TOKEN.test(token) && rootEntries.has(token.split("/")[0])) {
      const clean = token.replace(/\/$/, "");
      check(
        exists(clean) || proposedPaths.has(clean) || proposedPaths.has(token),
        at + "names a path that is not on main and is not declared as proposed: " + token,
      );
    }
    if (/^yamakan\.[a-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*$/.test(token))
      check(
        commandSource.includes('"' + token + '"') || proposedCommands.has(token),
        at + "names a command that is neither registered nor proposed by a card: " + token,
      );
  }
  for (const id of text.match(/\bMPR-\d{3}\b/g) ?? [])
    check(byId.has(id), at + "unknown card " + id);
  for (const id of text.match(/\bSS-\d{3}[ab]?\b/g) ?? [])
    check(ssState.has(id), at + "unknown System Supremacy card " + id);
  for (const id of text.match(/\bYU-\d{3}\b/g) ?? [])
    check(legacySet.has(id), at + "unknown Ultimate plan task " + id);
  for (const id of text.match(/\bFD-\d+\b/g) ?? [])
    check(decisionIds.has(id), at + "unknown founder decision " + id);
  check(
    !/\.(ts|tsx|mjs|rs|json|md|yml):\d+/.test(text),
    at + "cites a line number; cite the symbol or command instead",
  );
}

const documentHeads = [];
for (const name of REQUIRED_DOCUMENTS) {
  const file = path.join(directory, name);
  if (!check(fs.existsSync(file), "missing document " + name)) continue;
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const head = text.split("\n").slice(0, 8).join("\n");
  check(/^# \S/.test(text), name + ": must start with a level-one title");
  documentHeads.push({ name, head });
  check(
    head.includes(registry.baselineMain),
    name + ": baseline line missing or names another commit",
  );
  checkText(name, text);
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    check(
      fs.existsSync(path.resolve(directory, target)),
      name + ": link target does not exist: " + match[1],
    );
  }
}
for (const message of headerIssues(registry, documentHeads, recordText))
  check(false, message);
checkText("TASK_REGISTRY_ADDENDUM.json", JSON.stringify(registry));
checkText("LEGACY_RECONCILIATION_ADDENDUM.json", JSON.stringify(reconciliation));
for (const name of fs.readdirSync(directory))
  if (name.endsWith(".md"))
    check(REQUIRED_DOCUMENTS.includes(name), "unexpected document " + name);
section("documents (" + REQUIRED_DOCUMENTS.length + ")", mark);

// ---------------------------------------------------------------- result
for (const name of passed) console.log("ok    " + name);
if (errors.length) {
  for (const message of errors) console.error("FAIL  " + message);
  console.error("\n" + errors.length + " problem(s). The package is not valid.");
  process.exit(1);
}
console.log(
  "\nPackage valid at registry baseline " + registry.baselineMain.slice(0, 7) +
    ": " + tasks.length + " cards, " + legacyIds.length +
    " Ultimate plan tasks and " + ssState.size +
    " System Supremacy cards reconciled. This is a structural check, not a review.",
);
