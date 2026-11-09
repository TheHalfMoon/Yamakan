// Reading a command's body. It is small, so it has a deadline as a whole: a client sending a
// byte now and then would otherwise hold the connection, as the idle timeout restarts with
// each.
import type { Readable } from "node:stream";

export const BODY_DEADLINE_MS = 30_000;

export async function readBody(
  req: Readable,
  max: number,
  deadlineMs = BODY_DEADLINE_MS,
) {
  const chunks: Buffer[] = [];
  let size = 0;
  const late = setTimeout(
    () => req.destroy(new Error("The request took too long to arrive.")),
    deadlineMs,
  );
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > max) throw new Error("Request size limit exceeded.");
      chunks.push(chunk);
    }
  } finally {
    clearTimeout(late);
  }
  return Buffer.concat(chunks);
}
