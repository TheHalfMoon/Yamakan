// Newline-delimited framing for the MCP stdio transport, bounded in UTF-8
// bytes: a line longer than `maxLineBytes` is reported as oversized and
// never parsed, and no more than that many bytes of an unfinished line are
// ever retained. The rest of an oversized line is discarded up to its
// newline, so its tail cannot be mistaken for a new message.
import { RESOURCE_POLICY } from "../core/command/policy.ts";

// Transport limits (docs/OPERATIONAL_CONTRACTS.md, "MCP transport"). A line
// is one JSON-RPC message, capped like a REST request body. At most
// `inFlight` requests run at once and at most about `outputBytes` of
// responses wait for the client to read them; past either, the server stops
// reading stdin until it catches up, so a flood waits in the client's pipe
// instead of this process's memory. Nothing is refused for being busy.
export const MCP_LIMITS = Object.freeze({
  lineBytes: RESOURCE_POLICY.enforced.requestBytes,
  inFlight: 16,
  outputBytes: 1024 * 1024,
});

export type Frame = { line: string } | { oversized: true };

export class LineFramer {
  readonly maxLineBytes: number;
  #partial = "";
  #partialBytes = 0;
  #discarding = false;

  constructor(maxLineBytes: number) {
    this.maxLineBytes = maxLineBytes;
  }

  push(chunk: string): Frame[] {
    const frames: Frame[] = [];
    let start = 0;
    let newline: number;
    while ((newline = chunk.indexOf("\n", start)) >= 0) {
      const piece = chunk.slice(start, newline);
      start = newline + 1;
      if (this.#discarding) {
        // The oversized line was already reported when it crossed the limit.
        this.#discarding = false;
        continue;
      }
      const bytes = this.#partialBytes + Buffer.byteLength(piece, "utf8");
      const line = bytes > this.maxLineBytes ? null : this.#partial + piece;
      this.#partial = "";
      this.#partialBytes = 0;
      if (line === null) frames.push({ oversized: true });
      else if (line.trim()) frames.push({ line: line.trim() });
    }
    if (this.#discarding) return frames;
    const rest = chunk.slice(start);
    const bytes = this.#partialBytes + Buffer.byteLength(rest, "utf8");
    if (bytes > this.maxLineBytes) {
      frames.push({ oversized: true });
      this.#partial = "";
      this.#partialBytes = 0;
      this.#discarding = true;
    } else {
      this.#partial += rest;
      this.#partialBytes = bytes;
    }
    return frames;
  }

  // Bytes of the unfinished line currently held (for tests and evidence).
  get retainedBytes() {
    return this.#partialBytes;
  }
}
