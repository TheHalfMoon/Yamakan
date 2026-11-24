// Whether a database is made as this build makes its own at that version: every table, index,
// column, key and rule, and nothing beside them. A backup can come from anyone, and what a restore
// changes holds only while the tables have no rules of their own: a foreign key planted on one can
// set it back when a row elsewhere is deleted, and a column of another kind can hide a row from the
// change. The steps are pinned (tests/workspace-db.test.ts), so a workspace that any build has
// upgraded to that version is made the same.
import { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import { GATES_TABLES } from "./gates-schema.ts";

type Row = Record<string, unknown>;
const lower = (value: unknown) => String(value).toLowerCase();
const isGate = (table: string) =>
  (GATES_TABLES as readonly string[]).includes(lower(table));

// SQLite's own, which hold no rule: the counters of AUTOINCREMENT and what ANALYZE measured.
const OWN = new Set(["sqlite_sequence", "sqlite_stat1", "sqlite_stat4"]);

// A statement as its parts, however it is spaced, cased or quoted: renaming a table writes its
// name in quotes. Only a name this build knows loses its quotes, so that a word of SQL in quotes
// stays a name and not the rule it looks like.
function partsOf(sql: string, names: ReadonlySet<string>): string {
  const parts: string[] = [];
  for (const [part] of sql.matchAll(
    /'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|\s+|[A-Za-z_][A-Za-z0-9_$]*|[\s\S]/g,
  )) {
    if (/^(\s|--|\/\*)/.test(part)) continue;
    const quoted = /^["`[]/.test(part) ? lower(part.slice(1, -1)) : null;
    if (quoted !== null)
      parts.push(names.has(quoted) ? quoted : JSON.stringify(part));
    else parts.push(part.startsWith("'") ? part : part.toLowerCase());
  }
  return parts.join("\u0001");
}

type Shape = { objects: Map<string, string>; names: Set<string> };
function shapeOf(db: DatabaseSync, known?: ReadonlySet<string>): Shape {
  const rows = db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master")
    .all() as { type: string; name: string; tbl_name: string; sql: unknown }[];
  const pragma = (sql: string, of: string) => db.prepare(sql).all(of) as Row[];
  const names = new Set<string>(known);
  if (!known)
    for (const { type, name } of rows) {
      names.add(lower(name));
      if (type === "table")
        for (const c of pragma("SELECT name FROM pragma_table_xinfo(?)", name))
          names.add(lower(c.name));
    }
  const objects = new Map<string, string>();
  for (const { type, name, tbl_name, sql } of rows) {
    if (isGate(tbl_name)) continue;
    if (OWN.has(lower(name)) && type === "table") continue;
    const of: unknown[] = [type, lower(tbl_name)];
    if (typeof sql === "string") of.push(partsOf(sql, names));
    if (type === "table") {
      const [kind] = pragma(
        "SELECT type, wr, strict FROM pragma_table_list WHERE schema = 'main' AND name = ?",
        name,
      );
      of.push(kind?.type, kind?.wr, kind?.strict);
      for (const c of pragma(
        'SELECT name, type, "notnull", dflt_value, pk, hidden FROM pragma_table_xinfo(?) ORDER BY cid',
        name,
      ))
        of.push(
          lower(c.name),
          lower(c.type),
          c.notnull,
          c.dflt_value,
          c.pk,
          c.hidden,
        );
      for (const k of pragma(
        'SELECT id, seq, "table", "from", "to", on_update, on_delete, "match" FROM pragma_foreign_key_list(?) ORDER BY id, seq',
        name,
      ))
        of.push(
          lower(k.table),
          lower(k.from),
          lower(k.to),
          k.on_update,
          k.on_delete,
          k.match,
        );
    } else if (type === "index")
      for (const i of pragma(
        "SELECT seqno, cid, name, desc, coll, key FROM pragma_index_xinfo(?) ORDER BY seqno",
        name,
      ))
        of.push(
          i.cid,
          i.name === null ? null : lower(i.name),
          i.desc,
          i.coll,
          i.key,
        );
    objects.set(`${type} ${lower(name)}`, JSON.stringify(of));
  }
  return { objects, names };
}

/** Refuses a database that is not made as this build makes one of its version. */
export function assertWorkspaceSchema(
  db: DatabaseSync,
  steps: readonly string[],
  version: number,
) {
  const refuse = (message: string): never => {
    throw new CommandError("RECOVERY_REQUIRED", message);
  };
  if (!Number.isSafeInteger(version) || version < 1 || version > steps.length)
    refuse(
      "The backup's database is of a version this build does not know; it was not restored.",
    );
  const own = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: false,
  });
  let wanted: Shape;
  try {
    for (const step of steps.slice(0, version)) own.exec(step);
    wanted = shapeOf(own);
  } finally {
    own.close();
  }
  const found = shapeOf(db, wanted.names);
  // Only names this build knows are said: another is the backup's own word.
  for (const [object, shape] of wanted.objects)
    if (found.objects.get(object) !== shape)
      refuse(
        `The backup's database is not made as this workspace makes its own (${object}); it was not restored.`,
      );
  if (found.objects.size !== wanted.objects.size)
    refuse(
      "The backup's database holds something this workspace never creates; it was not restored.",
    );
}
