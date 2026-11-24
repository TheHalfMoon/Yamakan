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
  `CREATE TABLE a(id INTEGER PRIMARY KEY CHECK(id = 1), word TEXT NOT NULL DEFAULT 'x' COLLATE NOCASE, n INTEGER UNIQUE CHECK(n IS NOT NULL AND word <> 'b'), s TEXT GENERATED ALWAYS AS (word || 'y') VIRTUAL);
CREATE TABLE b(id TEXT PRIMARY KEY, a INTEGER REFERENCES a(id) ON DELETE CASCADE, UNIQUE(a, id) ON CONFLICT IGNORE) STRICT, WITHOUT ROWID;
CREATE INDEX b_a ON b(a) WHERE a > 0;`,
];
const like = (sql: string) => {
  const db = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
    enableDoubleQuotedStringLiterals: true,
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
      .replace("CREATE TABLE a", 'create table "a"')
      .replace("word TEXT", "[word] TEXT"),
    own.replace("word TEXT", "`word` /* a word */ TEXT -- of it\n"),
    `${own.replaceAll("TABLE a(", "TABLE z(").replaceAll("REFERENCES a(", "REFERENCES z(")}
ALTER TABLE z RENAME TO a;`,
    // What counts and what is measured hold no rule.
    `${own} CREATE TABLE q(n INTEGER PRIMARY KEY AUTOINCREMENT); DROP TABLE q; ANALYZE;`,
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
    // Where only the statement says it.
    ["word <> 'b'", "word <> 'B'"],
    ["n IS NOT NULL", 'n IS NOT "NULL"'],
    ["n IS NOT NULL", "n IS NOT 'NULL'"],
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
    "CREATE TABLE gate_approvals(x);",
    'CREATE TABLE "A\u212a"(x);',
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
    /something this workspace never creates/,
  );
  // The backup's own words are not said.
  assert.doesNotMatch(
    like(`${own} CREATE TABLE "C:\\Users\\someone"(x);`),
    /someone/,
  );
});

test("a database of many things or long words is refused at once", () => {
  const began = performance.now();
  const many = Array.from(
    { length: 3000 },
    (_, n) => `CREATE TABLE many_${n}(x);`,
  ).join("");
  assert.match(like(own + many), /something this workspace never creates/);
  const long = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
  });
  long.exec(own.replace("word TEXT", `word /* ${"/* ".repeat(5_000)} */ TEXT`));
  assert.match(asked(long, 1, OWN), /not made as this workspace makes its own/);
  const huge = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
  });
  huge.exec(own.replace("DEFAULT 'x'", `DEFAULT '${"x".repeat(2_000_000)}'`));
  assert.match(asked(huge, 1, OWN), /not made as this workspace makes its own/);
  assert.ok(performance.now() - began < 10_000);
});

test("a row of SQLite's own table that is not as it writes them is refused", () => {
  for (const sql of [
    "UPDATE sqlite_master SET type = 'Table' WHERE name = 'a'",
    "UPDATE sqlite_master SET tbl_name = 'A' WHERE name = 'a'",
    "UPDATE sqlite_master SET name = CAST('a' AS BLOB) WHERE name = 'a'",
    "INSERT INTO sqlite_master(type, name, tbl_name, rootpage, sql) VALUES ('Trigger', 'zz', 'A', 0, 'CREATE TRIGGER zz AFTER INSERT ON a BEGIN SELECT 1; END')",
    "INSERT INTO sqlite_master(type, name, tbl_name, rootpage, sql) SELECT type, name, tbl_name, rootpage, sql FROM sqlite_master WHERE name = 'a'",
    "INSERT INTO sqlite_master(type, name, tbl_name, rootpage, sql) VALUES ('table', 'sqlite_stat1', 'sqlite_stat1', 0, 'CREATE TABLE sqlite_stat1(tbl,idx,stat,more)')",
  ]) {
    const db = new DatabaseSync(":memory:", {
      enableForeignKeyConstraints: false,
    });
    db.exec(own);
    db.enableDefensive?.(false);
    db.exec(
      `PRAGMA writable_schema = ON; ${sql}; PRAGMA writable_schema = OFF;`,
    );
    assert.match(
      asked(db, 1, OWN),
      /something this workspace never creates|not made as/,
      sql,
    );
  }
});
