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

// An upload streams into the store and can be large, so its deadline grows with its declared
// size: two minutes, plus time at a floor far below anything a local client sends at. Only the
// arriving counts: once the body has all come, the work after it is not cut short.
export const UPLOAD_GRACE_MS = 120_000;
export const UPLOAD_FLOOR_BYTES_PER_SECOND = 256 * 1024;
export const uploadDeadlineMs = (declaredBytes: number) =>
  UPLOAD_GRACE_MS +
  Math.ceil(
    (Math.max(0, declaredBytes) / UPLOAD_FLOOR_BYTES_PER_SECOND) * 1000,
  );

export function guardUpload(
  req: Readable,
  declaredBytes: number,
  deadlineMs = uploadDeadlineMs(declaredBytes),
) {
  const late = setTimeout(
    () => req.destroy(new Error("The upload took too long to arrive.")),
    deadlineMs,
  );
  const done = () => clearTimeout(late);
  req.once("end", done);
  req.once("close", done);
  return done;
}
