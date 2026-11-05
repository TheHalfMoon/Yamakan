import { access, lstat, mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
export async function safePath(
  root: string,
  ...parts: string[]
): Promise<string> {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  const relative = path.relative(base, target);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    parts.some((p) => p.includes("\0"))
  )
    throw new Error("Path escapes workspace.");
  let cursor = base;
  for (const part of [".", ...relative.split(path.sep).filter(Boolean)]) {
    cursor = path.resolve(cursor, part);
    try {
      if ((await lstat(cursor)).isSymbolicLink())
        throw new Error("Symbolic links are not allowed.");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return target;
}
// Present while a restore is writing a folder. `restore.json` is what commits a
// restore: with it present the mark is only left over, and is cleared.
export const RESTORE_UNFINISHED = "restore.unfinished";
export async function isUnfinishedRestore(root: string) {
  const here = (name: string) =>
    access(path.join(root, name)).then(
      () => true,
      () => false,
    );
  if (!(await here(RESTORE_UNFINISHED))) return false;
  if (!(await here("restore.json"))) return true;
  await rm(path.join(root, RESTORE_UNFINISHED), { force: true });
  return false;
}

export async function initializeRoot(root: string): Promise<string> {
  const absolute = path.resolve(root);
  await safePath(absolute);
  await mkdir(absolute, { recursive: true });
  const actual = await realpath(absolute);
  if (actual.toLowerCase() !== absolute.toLowerCase())
    throw new Error("Workspace root cannot contain symbolic links.");
  return actual;
}
