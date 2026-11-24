// Whether a database is made as this build makes its own at that version: every table, index,
// column, key and rule, and nothing beside them. A backup can come from anyone, and what a restore
// changes holds only while the tables have no rules of their own: a foreign key planted on one can
// set it back when a row elsewhere is deleted, and a column of another kind can hide a row from the
// change. The steps are pinned (tests/workspace-db.test.ts), so a workspace that any build has
// upgraded to that version is made the same.
import { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";

type Row = Record<string, unknown>;
type Entry = { type: string; name: string; table: string; sql: string | null };

// SQLite's own, as it makes them: the counters of AUTOINCREMENT and what ANALYZE measured.
const OWN: Readonly<Record<string, string>> = {
  sqlite_sequence: "CREATE TABLE sqlite_sequence(name,seq)",
  sqlite_stat1: "CREATE TABLE sqlite_stat1(tbl,idx,stat)",
  sqlite_stat4: "CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample)",
};
// What a statement may be longer than this build's own by: the quotes a rename writes.
const LONGER = 1024;

// SQLite reads A to Z as a to z, and no other letter as another.
const ascii = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

// A statement as its parts, however it is spaced, cased or quoted: renaming a table writes its
// name in quotes. Only a name this build knows loses its quotes, so that a word of SQL in quotes
// stays a name and not the rule it looks like.
function partsOf(sql: string, names: ReadonlySet<string>): string {
  const parts: string[] = [];
  for (const [part] of sql.matchAll(
    /'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|[ \t\n\f\r]+|[A-Za-z_][A-Za-z0-9_$]*|[\s\S]/g,
  )) {
    if (/^([ \t\n\f\r]|--|\/\*)/.test(part)) continue;
    const quoted = /^["`[]/.test(part) ? ascii(part.slice(1, -1)) : null;
    if (quoted !== null)
      parts.push(names.has(quoted) ? quoted : JSON.stringify(part));
    else parts.push(part.startsWith("'") ? part : ascii(part));
  }
  return parts.join("\u0001");
}

const keyOf = (e: Pick<Entry, "type" | "name">) => `${e.type} ${e.name}`;

// What a database holds, by its exact words. Nothing is read by its name here, so it costs no more
// than its rows, whatever they say.
function entriesOf(db: DatabaseSync, most: number): Entry[] | null {
  const { n } = db
    .prepare("SELECT count(*) AS n FROM sqlite_master")
    .get() as { n: number };
  if (n > most) return null;
  const odd = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE typeof(type) <> 'text' OR typeof(name) <> 'text' OR typeof(tbl_name) <> 'text' OR typeof(sql) NOT IN ('text', 'null') OR length(CAST(name AS BLOB)) > 200 OR length(CAST(tbl_name AS BLOB)) > 200 LIMIT 1",
    )
    .get();
  if (odd) return null;
  return db
    .prepare(
      "SELECT type, name, tbl_name AS \"table\", CASE WHEN length(CAST(sql AS BLOB)) > 65536 THEN '' ELSE sql END AS sql FROM sqlite_master ORDER BY rowid",
    )
    .all() as Entry[];
}

// How SQLite itself reads one, beside what its statement says.
function readingOf(db: DatabaseSync, { type, name }: Entry): string {
  const pragma = (sql: string) => db.prepare(sql).all(name) as Row[];
  if (type === "index")
    return JSON.stringify(
      pragma(
        "SELECT cid, name, desc, coll, key FROM pragma_index_xinfo(?) ORDER BY seqno",
      ).map((r) => Object.values(r)),
    );
  return JSON.stringify([
    pragma(
      'SELECT name, type, "notnull", dflt_value, pk, hidden FROM pragma_table_xinfo(?) ORDER BY cid',
    ).map((r) => Object.values(r)),
    pragma(
      'SELECT id, seq, "table", "from", "to", on_update, on_delete, "match" FROM pragma_foreign_key_list(?) ORDER BY id, seq',
    ).map((r) => Object.values(r)),
    pragma(
      'SELECT name, "unique", origin, partial FROM pragma_index_list(?) ORDER BY name',
    ).map((r) => Object.values(r)),
  ]);
}
// Of every table at once: asked of each, it costs the square of their number.
const kindsOf = (db: DatabaseSync) =>
  new Map(
    (
      db
        .prepare(
          "SELECT name, type, wr, strict FROM pragma_table_list WHERE schema = 'main'",
        )
        .all() as { name: string; type: string; wr: number; strict: number }[]
    ).map((k) => [k.name, `${k.type} ${k.wr} ${k.strict}`]),
  );

/** Refuses a database that is not made as this build makes one of its version. */
export function assertWorkspaceSchema(
  db: DatabaseSync,
  steps: readonly string[],
  version: number,
  // What is asked, and what then did not happen.
  said: { of: string; so: string } = {
    of: "The backup's database",
    so: "it was not restored",
  },
) {
  const refuse = (message: string): never => {
    throw new CommandError(
      "RECOVERY_REQUIRED",
      `${said.of} ${message}; ${said.so}.`,
    );
  };
  const MORE = "holds something this workspace never creates";
  if (!Number.isSafeInteger(version) || version < 1 || version > steps.length)
    refuse("is of a version this build does not know");
  const own = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
  });
  try {
    for (const step of steps.slice(0, version)) own.exec(step);
    const wanted = new Map(
      entriesOf(own, Number.MAX_SAFE_INTEGER)!
        .filter((e) => !Object.hasOwn(OWN, e.name))
        .map((e) => [keyOf(e), e]),
    );
    const names = new Set<string>();
    for (const e of wanted.values()) {
      names.add(ascii(e.name));
      if (e.type === "table")
        for (const c of own
          .prepare("SELECT name FROM pragma_table_xinfo(?)")
          .all(e.name) as { name: string }[])
          names.add(ascii(c.name));
    }
    // First what there is, by its words alone: a database with more, or with anything of another
    // kind, is refused before SQLite is asked about any of it.
    const entries =
      entriesOf(db, wanted.size + Object.keys(OWN).length) ?? refuse(MORE);
    const found = new Map<string, Entry>();
    for (const e of entries) {
      if (
        e.type === "table" &&
        e.table === e.name &&
        Object.hasOwn(OWN, e.name) &&
        OWN[e.name] === e.sql &&
        !found.has(keyOf(e))
      ) {
        found.set(keyOf(e), e);
        continue;
      }
      const same = wanted.get(keyOf(e));
      if (!same || found.has(keyOf(e))) refuse(MORE);
      // Only a name this build knows is said: another is the backup's own word.
      if (
        e.table !== same!.table ||
        (e.sql === null) !== (same!.sql === null) ||
        (e.sql !== null &&
          (e.sql.length > same!.sql!.length + LONGER ||
            partsOf(e.sql, names) !== partsOf(same!.sql!, names)))
      )
        refuse(`is not made as this workspace makes its own (${keyOf(e)})`);
      found.set(keyOf(e), e);
    }
    for (const key of wanted.keys())
      if (!found.has(key))
        refuse(`is not made as this workspace makes its own (${key})`);
    // Then how SQLite reads each of them.
    const [ownKinds, kinds] = [kindsOf(own), kindsOf(db)];
    for (const [key, e] of wanted)
      if (
        readingOf(db, e) !== readingOf(own, e) ||
        (e.type === "table" && kinds.get(e.name) !== ownKinds.get(e.name))
      )
        refuse(`is not made as this workspace makes its own (${key})`);
  } finally {
    own.close();
  }
}
