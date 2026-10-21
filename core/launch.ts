import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { safePath } from "./paths.ts";

export const LAUNCH_TTL_MS = 60_000;
const LAUNCH_FILE = "launch";

export type LaunchRecord = {
  secret: string;
  expiresAt: number;
  url: string;
};

export async function writeLaunchLink(
  root: string,
  origin: string,
  now = Date.now(),
): Promise<LaunchRecord> {
  const secret = randomBytes(32).toString("hex");
  const expiresAt = now + LAUNCH_TTL_MS;
  const url = `${origin}/#launch=${secret}`;
  const file = await safePath(root, LAUNCH_FILE);
  await unlink(file).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
  });
  await writeFile(file, `${url}\n${expiresAt}\n`, { mode: 0o600, flag: "wx" });
  return { secret, expiresAt, url };
}

export async function readLaunchRecord(
  root: string,
): Promise<LaunchRecord | null> {
  const file = await safePath(root, LAUNCH_FILE);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  const [urlLine, expiresLine] = text.split("\n");
  const secret = /#launch=([a-f0-9]{64})$/.exec(urlLine.trim())?.[1];
  const expiresAt = Number(expiresLine?.trim());
  if (
    !secret ||
    !urlLine.startsWith("http://127.0.0.1:") ||
    !Number.isFinite(expiresAt)
  )
    return null;
  return { secret, expiresAt, url: urlLine.trim() };
}

export async function consumeLaunchSecret(
  root: string,
  secret: string,
  now = Date.now(),
): Promise<
  | { ok: true; record: LaunchRecord }
  | { ok: false; reason: "missing" | "expired" | "used" | "invalid" }
> {
  const record = await readLaunchRecord(root);
  if (!record) return { ok: false, reason: "missing" };
  if (record.secret !== secret) return { ok: false, reason: "invalid" };
  if (now > record.expiresAt) {
    await unlink(await safePath(root, LAUNCH_FILE)).catch(() => {});
    return { ok: false, reason: "expired" };
  }
  await unlink(await safePath(root, LAUNCH_FILE));
  return { ok: true, record };
}
