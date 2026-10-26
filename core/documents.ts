// Creative documents (YU-010, activation group AG-DOCS): immutable,
// content-addressed Studio canvases and Cinema scenes that belong to one
// project revision through canonical v5 document references. A document is
// stored as the canonical serialization of its validated content, so its
// hash names exactly what was accepted; bytes are bounded before any parse.
import { z } from "zod";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import { CommandError } from "./command/errors.ts";
import { StudioDocumentSchema, parseStudioCanvasJson } from "./studio.ts";
import type { StudioDocument } from "./studio.ts";
import { parseScene3D } from "./scene3d.ts";
import { DOCUMENT_LIMITS, DOCUMENT_SCHEMA_VERSIONS } from "./document-ref.ts";
import type { DocumentKind } from "./document-ref.ts";

export {
  DOCUMENT_LIMITS,
  DOCUMENT_SCHEMA_VERSIONS,
  DocumentKind,
  DocumentRefSchema,
} from "./document-ref.ts";
export type { DocumentRef } from "./document-ref.ts";

/**
 * AG-DOCS: user-visible document persistence (v5 writes from the UI, CLI
 * and agents). On since YU-010…YU-015 qualified together; the activation
 * receipt is docs/evidence/ultimate/receipts/AG-DOCS.json.
 */
export const CREATIVE_DOCUMENTS_ENABLED = true;

/**
 * Whether this service process accepts creative document writes: the
 * build's AG-DOCS flag, unless an operator turned writes off again with
 * YAMAKAN_AG_DOCS_OFF=1 (rollback without a rebuild; stored documents stay
 * readable and keep their references). The switch is read from the
 * service's own environment only, the service announces it at startup, and
 * no request can change it.
 */
export function creativeDocumentsEnabled(): boolean {
  return CREATIVE_DOCUMENTS_ENABLED && process.env.YAMAKAN_AG_DOCS_OFF !== "1";
}

export type ValidatedDocument = {
  kind: DocumentKind;
  schemaVersion: number;
  bytes: Buffer;
  hash: string;
  // Project assets the document needs; they must stay in the project.
  assetIds: string[];
  // Studio bitmaps (content-addressed objects) the document needs.
  objectDigests: string[];
};

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const tooDeep = () =>
  new CommandError(
    "LIMIT_EXCEEDED",
    `Document nesting exceeds depth ${DOCUMENT_LIMITS.depth}.`,
  );
const tooMany = () =>
  new CommandError(
    "LIMIT_EXCEEDED",
    `Document exceeds ${DOCUMENT_LIMITS.nodes} JSON nodes.`,
  );

// One linear pass over the text before JSON.parse, so a hostile document
// is refused without building it: nesting depth exactly, and an upper bound
// on values (every value after the first follows a comma, colon or opening
// bracket, counted outside strings; object members count twice).
function prescan(text: string) {
  let depth = 0;
  let tokens = 1;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c)
        i++; // backslash: skip the escaped character
      else if (c === 0x22) inString = false;
      continue;
    }
    if (c === 0x22) inString = true;
    else if (c === 0x5b || c === 0x7b) {
      if (++depth > DOCUMENT_LIMITS.depth) throw tooDeep();
      tokens++;
    } else if (c === 0x5d || c === 0x7d) depth--;
    else if (c === 0x2c || c === 0x3a) tokens++;
    if (tokens > 2 * DOCUMENT_LIMITS.nodes) throw tooMany();
  }
}

// Exact bounds on the parsed value, counting each value as it is reached.
function assertShape(value: unknown) {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 1;
  const push = (child: unknown, depth: number) => {
    if (++nodes > DOCUMENT_LIMITS.nodes) throw tooMany();
    stack.push({ value: child, depth });
  };
  while (stack.length) {
    const { value: node, depth } = stack.pop()!;
    if (node === null || typeof node !== "object") continue;
    if (depth >= DOCUMENT_LIMITS.depth) throw tooDeep();
    if (Array.isArray(node)) {
      for (const item of node) push(item, depth + 1);
      continue;
    }
    for (const key of Object.keys(node)) {
      if (PROTOTYPE_KEYS.has(key))
        throw new CommandError(
          "VALIDATION",
          "Prototype keys are not allowed in documents.",
        );
      push((node as Record<string, unknown>)[key], depth + 1);
    }
  }
}

function parseBounded(bytes: Uint8Array, what: string): unknown {
  if (bytes.byteLength > DOCUMENT_LIMITS.documentBytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `${what} exceeds ${DOCUMENT_LIMITS.documentBytes} bytes.`,
    );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CommandError("VALIDATION", `${what} is not valid UTF-8.`);
  }
  prescan(text);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CommandError("VALIDATION", `${what} is not valid JSON.`);
  }
  assertShape(value);
  return value;
}

const schemaError = (e: unknown, what: string): never => {
  if (e instanceof z.ZodError)
    throw new CommandError(
      "VALIDATION",
      e.issues.map((i) => i.message).join("; ") || `Invalid ${what}.`,
    );
  throw e;
};

function validateStudio(value: unknown): {
  content: StudioDocument;
  assetIds: string[];
  objectDigests: string[];
} {
  let content: StudioDocument;
  try {
    content = StudioDocumentSchema.parse(value);
  } catch (e) {
    return schemaError(e, "Studio document");
  }
  // The canvas is carried as JSON text inside the document: it is bounded by
  // the same limits as the document itself, never parsed unbounded.
  parseBounded(Buffer.from(content.canvasJson, "utf8"), "Studio canvas");
  const canvas = parseStudioCanvasJson(content.canvasJson);
  if (canvas.version !== content.canvasSchemaVersion)
    throw new CommandError(
      "VALIDATION",
      "Studio canvasSchemaVersion does not match canvasJson version.",
    );
  if (new Set(content.bitmapAssetIds).size !== content.bitmapAssetIds.length)
    throw new CommandError(
      "VALIDATION",
      "Studio bitmap assets must be listed once.",
    );
  return {
    content,
    assetIds: [...content.bitmapAssetIds].sort(),
    objectDigests: canvasBitmapDigests(canvas),
  };
}

// Keys whose string values name canvas media (the engine's own extractor,
// src/studio/workbench/mediaReferences.ts, uses the same sets).
const IMAGE_NAME_KEYS = new Set(["imageName", "image_name"]);
const VIDEO_NAME_KEYS = new Set([
  "videoName",
  "video_name",
  "source_video_name",
]);
// Keys whose values fetch media from elsewhere. Free text (a text layer's
// words) may look like a URL and is not refused.
const URL_KEYS = new Set(["url", "src", "href", "uri"]);
const DIGEST = /^[a-f0-9]{64}$/;

/**
 * Every bitmap a Studio canvas names, anywhere in it. A persisted canvas
 * names bitmaps only by the SHA-256 of a Studio bitmap stored in its
 * project (imageName is that digest); any other name, a URL or a video
 * reference is refused, so a document can never point outside its project.
 */
export function canvasBitmapDigests(canvas: unknown): string[] {
  const digests = new Set<string>();
  const pending: unknown[] = [canvas];
  while (pending.length) {
    const node = pending.pop();
    if (Array.isArray(node)) {
      pending.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") {
        // Media fetched from anywhere but the project (staging candidates,
        // reference images): refused, whatever else the object names.
        if (URL_KEYS.has(key) && value !== "")
          throw new CommandError(
            "VALIDATION",
            "A Studio canvas cannot reference media by URL.",
          );
        if (VIDEO_NAME_KEYS.has(key))
          throw new CommandError(
            "VALIDATION",
            "Studio canvases cannot reference video.",
          );
        if (IMAGE_NAME_KEYS.has(key)) {
          if (!DIGEST.test(value))
            throw new CommandError(
              "VALIDATION",
              "A Studio canvas names bitmaps only by their stored SHA-256.",
            );
          digests.add(value);
        }
      } else if (value && typeof value === "object") pending.push(value);
    }
  }
  return [...digests].sort();
}

function validateScene(value: unknown): {
  content: unknown;
  assetIds: string[];
  objectDigests: string[];
} {
  const scene = parseScene3D(value);
  const ids = new Set<string>();
  for (const item of scene.items) if (item.assetId) ids.add(item.assetId);
  return { content: scene, assetIds: [...ids].sort(), objectDigests: [] };
}

/**
 * Validates untrusted document bytes of one kind and returns the canonical
 * bytes to store, their hash and the assets they reference. Raw and
 * canonical bytes are both bounded; nothing is parsed past the byte limit.
 */
export function validateDocument(
  kind: DocumentKind,
  schemaVersion: number,
  raw: Uint8Array,
): ValidatedDocument {
  if (DOCUMENT_SCHEMA_VERSIONS[kind] !== schemaVersion)
    throw new CommandError(
      "VALIDATION",
      `Unsupported ${kind} document schema version ${schemaVersion}.`,
    );
  const value = parseBounded(raw, "Document");
  const { content, assetIds, objectDigests } =
    kind === "studio" ? validateStudio(value) : validateScene(value);
  const bytes = Buffer.from(canonicalJson(content), "utf8");
  if (bytes.byteLength > DOCUMENT_LIMITS.documentBytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `Canonical document exceeds ${DOCUMENT_LIMITS.documentBytes} bytes.`,
    );
  return {
    kind,
    schemaVersion,
    bytes,
    hash: sha256Hex(bytes),
    assetIds,
    objectDigests,
  };
}

/** Assets a document references that the project does not hold. */
export function missingDocumentAssets(
  doc: Pick<ValidatedDocument, "assetIds">,
  projectAssetIds: Iterable<string>,
): string[] {
  const held = new Set(projectAssetIds);
  return doc.assetIds.filter((id) => !held.has(id));
}
