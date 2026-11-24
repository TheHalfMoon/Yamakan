// Whether a database is made as this build makes its own (core/workspace-schema.ts): what a restore
// asks of a backup before it reads or changes anything in it.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { assertWorkspaceSchema } from "../core/workspace-schema.ts";
import { WORKSPACE_SCHEMA_STEPS as STEPS } from "../core/store.ts";

const made = (version: number, over = "") => {
  const db = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
    enableDoubleQuotedStringLiterals: true,
  });
  for (const step of STEPS.slice(0, version)) db.exec(step);
  db.exec(over);
  return db;
};
const asked = (db: DatabaseSync, version: number, steps = STEPS) => {
  try {
    assertWorkspaceSchema(db, steps, version);
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code === "RECOVERY_REQUIRED"
      ? (e as Error).message
      : `unexpected: ${(e as Error).message}`;
  } finally {
    db.close();
  }
};

test("every version this build knows is made as itself, and as no other", () => {
  for (let version = 1; version <= STEPS.length; version++) {
    assert.equal(asked(made(version), version), "ok", `${version}`);
    // A step that changes nothing but the approvals, or only an index of them, is the one that
    // is not looked at.
    if (version < STEPS.length - 1)
      assert.notEqual(asked(made(version), version + 1), "ok", `${version}`);
  }
  for (const version of [0, -1, STEPS.length + 1, 1.5, Number.NaN])
    assert.match(
      asked(made(STEPS.length), version),
      /a version this build does not know/,
    );
});

// A small schema, so that each rule is changed alone.
const OWN = [
  `CREATE TABLE a(id INTEGER PRIMARY KEY CHECK(id = 1), word TEXT NOT NULL DEFAULT 'x' COLLATE NOCASE, n INTEGER UNIQUE, s TEXT GENERATED ALWAYS AS (word || 'y') VIRTUAL);
CREATE TABLE b(id TEXT PRIMARY KEY, a INTEGER REFERENCES a(id) ON DELETE CASCADE, UNIQUE(a, id) ON CONFLICT IGNORE) STRICT, WITHOUT ROWID;
CREATE INDEX b_a ON b(a) WHERE a > 0;`,
];
const like = (sql: string) => {
  const db = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
  });
  db.exec(sql);
  return asked(db, 1, OWN);
};
const [own] = OWN as [string];

test("how a statement is spaced, cased, quoted or commented is no part of it", () => {
  assert.equal(like(own), "ok");
  for (const same of [
    own.replaceAll(" ", "\n  "),
    own
      .replace("CREATE TABLE a", 'create table "A"')
      .replace("word TEXT", "[Word] text"),
    own.replace("word TEXT", "`word` /* a word */ TEXT -- of it\n"),
    `${own.replaceAll("TABLE a(", "TABLE z(").replaceAll("REFERENCES a(", "REFERENCES z(")}
ALTER TABLE z RENAME TO a;`,
    // What counts and what is measured hold no rule.
    `${own} CREATE TABLE gate_approvals(x); CREATE INDEX gate_x ON gate_approvals(x); ANALYZE;`,
  ])
    assert.equal(like(same), "ok", same);
});

test("each rule that is another, missing or more is refused", () => {
  for (const [from, to] of [
    ["CHECK(id = 1)", "CHECK(id > 0)"],
    ["CHECK(id = 1)", ""],
    ["NOT NULL", ""],
    ["DEFAULT 'x'", "DEFAULT 'X'"],
    ["DEFAULT 'x'", 'DEFAULT " x"'],
    ["COLLATE NOCASE", "COLLATE BINARY"],
    ["n INTEGER UNIQUE", "n INTEGER"],
    ["n INTEGER UNIQUE", "n INTEGER UNIQUE ON CONFLICT REPLACE"],
    ["n INTEGER UNIQUE", "n TEXT UNIQUE"],
    ["word || 'y'", "word || 'z'"],
    ["VIRTUAL", "STORED"],
    ["REFERENCES a(id) ON DELETE CASCADE", ""],
    ["ON DELETE CASCADE", "ON DELETE SET NULL"],
    ["ON DELETE CASCADE", "ON DELETE CASCADE ON UPDATE CASCADE"],
    ["REFERENCES a(id)", "REFERENCES a(n)"],
    ["ON CONFLICT IGNORE", "ON CONFLICT REPLACE"],
    ["UNIQUE(a, id)", "UNIQUE(id, a)"],
    ["STRICT, WITHOUT ROWID", "WITHOUT ROWID"],
    ["STRICT, WITHOUT ROWID", "STRICT"],
    ["WHERE a > 0", ""],
    ["CREATE INDEX", "CREATE UNIQUE INDEX"],
    ["ON b(a) WHERE", "ON b(a DESC) WHERE"],
    ["CREATE INDEX b_a ON b(a) WHERE a > 0;", ""],
    ["word TEXT", "word TEXT, more TEXT"],
    // A word of SQL in quotes is a name: here a type, and no rule.
    [
      "INTEGER PRIMARY KEY CHECK(id = 1)",
      'INTEGER "PRIMARY" "KEY" CHECK(id = 1)',
    ],
    ["n INTEGER UNIQUE", 'n INTEGER "UNIQUE"'],
  ] as const) {
    assert.ok(own.includes(from), from);
    assert.match(
      like(own.replace(from, to)),
      /not made as this workspace makes its own \((table|index) /,
      `${from} -> ${to}`,
    );
  }
  for (const more of [
    "CREATE TABLE c(x);",
    "CREATE INDEX c ON a(word);",
    "CREATE VIEW c AS SELECT 1;",
    "CREATE TRIGGER c AFTER INSERT ON a BEGIN SELECT 1; END;",
    "CREATE TABLE gate_approvals_asked(x);",
    "CREATE VIRTUAL TABLE c USING fts5(x);",
  ])
    assert.match(
      like(own + more),
      /something this workspace never creates/,
      more,
    );
  assert.match(
    like(
      own
        .replace("CREATE TABLE b", "CREATE TABLE c")
        .replace("ON b(a)", "ON c(a)"),
    ),
    /not made as this workspace makes its own/,
  );
  // The backup's own words are not said.
  assert.doesNotMatch(
    like(`${own} CREATE TABLE "C:\\Users\\someone"(x);`),
    /someone/,
  );
});
