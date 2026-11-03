import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const root = path.resolve(directory, "../../..");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const sha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const requiredIds = [
  "SS-001",
  "SS-002",
  "SS-003",
  "SS-004",
  "SS-004a",
  "SS-004b",
  "SS-005",
  "SS-005a",
  "SS-005b",
  "R-01",
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "SS-006",
  "SS-007",
  "SS-008",
  "SS-009",
  "SS-010",
  "SS-011",
  "SS-012",
  "SS-013",
  "SS-014",
  "SS-015",
  "SS-016",
  "SS-017",
  "SS-018",
  "SS-019",
  "X-01",
  "X-02",
  "X-03",
];
const legacyIds = [
  "YU-000",
  "YU-001",
  "YU-002",
  "YU-003",
  "YU-010",
  "YU-011",
  "YU-012",
  "YU-013",
  "YU-014",
  "YU-015",
  "YU-016",
  "YU-017",
  "YU-018",
  "YU-019",
  "YU-020",
  "YU-021",
  "YU-022",
  "YU-023",
  "YU-024",
  "YU-025",
  "YU-026",
  "YU-030",
  "YU-031",
  "YU-032",
  "YU-040",
  "YU-041",
  "YU-042",
  "YU-043",
  "YU-050",
  "YU-051",
  "YU-060",
  "YU-061",
  "YU-062",
  "YU-070",
  "YU-071",
  "YU-072",
  "YU-080",
  "YU-081",
  "YU-090",
  "YU-091",
  "YU-092",
  "YU-093",
  "YU-100",
  "YU-101",
];
const researchIds = ["R-01", "R-02", "R-03", "R-04", "R-05"];

function graphIssues(tasks) {
  const issues = [],
    ids = tasks.map((t) => t.id),
    byId = new Map(tasks.map((t) => [t.id, t]));
  if (byId.size !== ids.length) issues.push("duplicate task identity");
  for (const task of tasks) {
    if (!Array.isArray(task.dependsOn)) {
      issues.push("missing dependency list: " + task.id);
      continue;
    }
    if (new Set(task.dependsOn).size !== task.dependsOn.length)
      issues.push("duplicate dependency: " + task.id);
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency))
        issues.push("missing dependency: " + task.id + " -> " + dependency);
      if (dependency === task.id) issues.push("self dependency: " + task.id);
    }
  }
  const active = new Set(),
    done = new Set();
  function visit(id) {
    if (active.has(id)) {
      issues.push("dependency cycle at " + id);
      return;
    }
    if (done.has(id) || !byId.has(id)) return;
    active.add(id);
    for (const dependency of byId.get(id).dependsOn ?? []) visit(dependency);
    active.delete(id);
    done.add(id);
  }
  for (const id of ids) visit(id);
  return issues;
}

function readinessIssues(gates) {
  const issues = [];
  for (const id of researchIds)
    if (gates.researchTasks?.[id] !== "VERIFIED")
      issues.push(id + " not independently VERIFIED");
  for (const name of [
    "architectureReview",
    "correctnessReview",
    "securityReview",
  ]) {
    const review = gates[name];
    if (
      review?.status !== "PASS" ||
      review.mustFix !== 0 ||
      !sha(review.reviewedHead)
    )
      issues.push(name + " missing qualified verdict");
    else if (review.reviewedHead !== gates.exactHeadCi?.head)
      issues.push(name + " not bound to final CI head");
  }
  if (gates.validation?.status !== "PASS" || !gates.validation.receipt)
    issues.push("planning validation receipt missing");
  if (
    gates.exactHeadCi?.status !== "PASS" ||
    !sha(gates.exactHeadCi.head) ||
    !/^https:\/\/github\.com\/TheHalfMoon\/Yamakan\/actions\/runs\/\d+$/.test(
      gates.exactHeadCi.runUrl ?? "",
    )
  )
    issues.push("exact-head CI receipt missing");
  if (gates.merge?.status !== "MERGED" || !sha(gates.merge.mainSha))
    issues.push("normal planning merge missing");
  if (
    gates.postMainVerification?.status !== "PASS" ||
    !gates.postMainVerification.receipt ||
    !sha(gates.postMainVerification.mainSha) ||
    gates.postMainVerification.mainSha !== gates.merge?.mainSha
  )
    issues.push("post-main verification missing or mismatched");
  return issues;
}

if (process.argv.includes("--self-test")) {
  const graph = [
    { id: "a", dependsOn: [] },
    { id: "b", dependsOn: ["a"] },
  ];
  assert.deepEqual(graphIssues(graph), []);
  assert(
    graphIssues([...graph, graph[0]]).some((x) => x.includes("duplicate")),
  );
  assert(
    graphIssues([{ id: "a", dependsOn: ["missing"] }]).some((x) =>
      x.includes("missing"),
    ),
  );
  assert(
    graphIssues([{ id: "a", dependsOn: ["a"] }]).some((x) =>
      x.includes("self"),
    ),
  );
  assert(
    graphIssues([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]).some((x) => x.includes("cycle")),
  );
  assert(readinessIssues({}).length >= 10);
  const head = "a".repeat(40),
    main = "b".repeat(40);
  const ready = {
    researchTasks: Object.fromEntries(
      researchIds.map((id) => [id, "VERIFIED"]),
    ),
    validation: { status: "PASS", receipt: "recorded" },
    exactHeadCi: {
      status: "PASS",
      head,
      runUrl: "https://github.com/TheHalfMoon/Yamakan/actions/runs/1",
    },
    merge: { status: "MERGED", mainSha: main },
    postMainVerification: {
      status: "PASS",
      mainSha: main,
      receipt: "recorded",
    },
  };
  for (const name of [
    "architectureReview",
    "correctnessReview",
    "securityReview",
  ])
    ready[name] = { status: "PASS", mustFix: 0, reviewedHead: head };
  assert.deepEqual(readinessIssues(ready), []);
  ready.securityReview.reviewedHead = "c".repeat(40);
  assert(readinessIssues(ready).some((x) => x.includes("final CI head")));
  ready.securityReview.reviewedHead = head;
  ready.securityReview.mustFix = 1;
  assert(readinessIssues(ready).some((x) => x.includes("qualified verdict")));
  ready.securityReview.mustFix = 0;
  ready.postMainVerification.mainSha = head;
  assert(readinessIssues(ready).some((x) => x.includes("mismatched")));
  console.log("PASS: graph and readiness refusal controls (10 assertions).");
  process.exit(0);
}

const registry = read("TASK_REGISTRY.json"),
  gates = read("PLANNING_GATES.json");
const decisions = read("SUBSYSTEM_DECISIONS.json"),
  legacy = read("LEGACY_RECONCILIATION.json");
const sources = read("SOURCE_RETRIEVAL_MANIFEST.json");
check(
  registry.schema === "yamakan.system-improvement-plan/v2",
  "registry schema",
);
check(sha(registry.baselineMain), "baseline SHA");
check(registry.tasks.length === 31, "expected31 tasks");
check(
  JSON.stringify([...registry.tasks.map((t) => t.id)].sort()) ===
    JSON.stringify([...requiredIds].sort()),
  "stable31 task identities",
);
check(
  registry.executionHold === false && gates.implementationHold === false,
  "the founder handoff recorded on 2026-11-04 lifted the implementation hold",
);
check(
  /^RECORDED_\d{4}-\d{2}-\d{2}$/.test(gates.founderHandoff),
  "a lifted hold needs a recorded founder handoff",
);
check(
  JSON.stringify(registry.globalImplementationPrerequisites) ===
    JSON.stringify(researchIds),
  "all implementation requires five research gates",
);
errors.push(...graphIssues(registry.tasks));
const byId = new Map(registry.tasks.map((t) => [t.id, t]));
const researchOnly = registry.tasks.find((t) => t.id === "R-05").dependsOn;
check(
  JSON.stringify(researchOnly) === JSON.stringify(researchIds.slice(0, 4)),
  "R05 must not depend on new engineering during planning",
);
const arrayFields = [
  "verifiedPrerequisites",
  "targets",
  "interfaces",
  "implementationSequence",
  "acceptance",
  "negativeTests",
  "performanceCriteria",
  "compatibilityRequirements",
  "definitionOfDone",
  "sourceRecords",
];
for (const task of registry.tasks) {
  for (const field of [
    "objective",
    "title",
    "sourceDecision",
    "rollback",
    "owner",
    "gate",
    "executionGate",
  ])
    check(
      typeof task[field] === "string" && task[field].trim().length > 8,
      task.id + " missing " + field,
    );
  for (const field of arrayFields)
    check(
      Array.isArray(task[field]) && task[field].length > 0,
      task.id + " missing " + field,
    );
  check(
    Array.isArray(task.blockingExternalRequirements),
    task.id + " missing explicit external requirements",
  );
  check(
    task.implementationSequence.length >= 3,
    task.id + " lacks detailed sequence",
  );
  for (const target of task.targets)
    check(
      fs.existsSync(path.join(root, target)),
      task.id + " missing target " + target,
    );
  for (const record of task.sourceRecords)
    check(
      fs.existsSync(path.join(directory, record)),
      task.id + " missing source record " + record,
    );
  if (task.id.startsWith("R-"))
    check(
      task.state === gates.researchTasks[task.id],
      task.id + " differs from readiness gates",
    );
  // External gates are decided outside this program; nothing here closes them.
  if (task.id.startsWith("X-"))
    check(
      task.state === "EXTERNAL_BLOCKED",
      task.id + " is an external gate and must stay EXTERNAL_BLOCKED",
    );
  if (task.state === "VERIFIED" && !task.id.startsWith("R-")) {
    check(
      typeof task.evidence === "string" &&
        /\b[0-9a-f]{7,40}\b/.test(task.evidence),
      "verified implementation needs evidence naming a commit " + task.id,
    );
    for (const dep of task.dependsOn)
      check(
        byId.get(dep)?.state === "VERIFIED",
        task.id + " is verified before its dependency " + dep,
      );
  }
}
check(decisions.decisions.length === 16, "expected16 subsystem decisions");
check(
  new Set(decisions.decisions.map((d) => d.id)).size === 16,
  "duplicate decision ID",
);
for (const decision of decisions.decisions) {
  check(
    ["COPY", "ADAPT", "WRAP", "COMBINE", "BUILD", "DEFER", "REJECT"].includes(
      decision.decision,
    ),
    "invalid decision " + decision.id,
  );
  check(sha(decision.sha), "invalid selected-source pin " + decision.id);
  for (const field of [
    "subsystem",
    "repository",
    "functions",
    "dependencies",
    "integration",
    "rationale",
    "acceptance",
    "rollback",
    "license",
    "provenance",
    "compatibility",
    "security",
    "performance",
    "maintenance",
  ])
    check(
      typeof decision[field] === "string" && decision[field].length > 8,
      "decision field " + decision.id + "/" + field,
    );
  for (const module of decision.modules)
    check(
      fs.existsSync(path.join(root, module)),
      "missing selected module " + module,
    );
  for (const id of decision.taskIds)
    check(byId.has(id), "unknown decision task " + id);
}
check(legacy.tasks.length === 44, "expected44 legacy records");
check(
  JSON.stringify(legacy.tasks.map((t) => t.id).sort()) ===
    JSON.stringify([...legacyIds].sort()),
  "legacy IDs differ from pinned44-task registry",
);
for (const task of legacy.tasks) {
  check(
    !!task.disposition && !!task.limits,
    "legacy disposition missing " + task.id,
  );
  for (const successor of task.successors)
    check(byId.has(successor), "missing legacy successor " + successor);
  for (const receipt of task.evidence)
    check(
      fs.existsSync(path.join(root, receipt)),
      "missing legacy evidence " + receipt,
    );
}
for (const source of sources.files) {
  check(
    source.private === false,
    "private source in public retrieval manifest",
  );
  check(
    sha(source.sha) && /^[a-f0-9]{64}$/.test(source.sha256),
    "invalid retrieved source hash",
  );
  check(
    Number.isSafeInteger(source.bytes) && source.bytes > 0,
    "invalid retrieved source size",
  );
  check(
    !path.isAbsolute(source.file) && !source.file.split(/[\\/]/).includes(".."),
    "invalid source-relative path",
  );
}
// Link validation proves local targets exist, not that remote claims are true.
let links = 0;
for (const name of fs.readdirSync(directory).filter((n) => n.endsWith(".md"))) {
  const text = fs.readFileSync(path.join(directory, name), "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const relative = decodeURIComponent(target.split("#")[0]);
    const resolved = path.resolve(directory, relative);
    check(
      resolved.startsWith(root + path.sep),
      "link outside repository " + name + ": " + target,
    );
    check(fs.existsSync(resolved), "missing link " + name + ": " + target);
    links++;
  }
}
const afterPlanning = new Set(["SS-001", "SS-002", "SS-003", ...researchIds]);
const firstFive = ["SS-004a", "SS-005a", "SS-017", "SS-006", "SS-009"];
for (const id of firstFive)
  check(
    byId.get(id).dependsOn.every((dep) => afterPlanning.has(dep)),
    "first-five task has unfinished engineering dependency " + id,
  );
const readiness = readinessIssues(gates);
if (gates.status === "READY")
  check(readiness.length === 0, "READY claim without final gates");
const structurePassed = errors.length === 0;
if (process.argv.includes("--require-ready")) errors.push(...readiness);
console.log(
  JSON.stringify(
    {
      structuralStatus: structurePassed ? "PASS" : "FAIL",
      tasks: registry.tasks.length,
      subsystems: decisions.decisions.length,
      legacyTasks: legacy.tasks.length,
      publicSourceFiles: sources.files.length,
      localLinks: links,
      dependencyGraph: "acyclic if structuralStatus PASS",
      firstFiveAfterPlanning: firstFive,
      finalReadiness: readiness.length ? "NOT_READY" : "READY",
      missingReadinessGates: readiness,
      errors,
    },
    null,
    2,
  ),
);
process.exitCode = errors.length ? 1 : 0;
