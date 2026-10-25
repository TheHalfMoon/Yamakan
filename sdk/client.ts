import type {
  Operation,
  OperationInput,
  OperationResult,
} from "../core/command/registry.ts";
import type { ErrorCode } from "../core/command/errors.ts";
import type { StagedDocumentReceipt } from "../core/store.ts";

export type { Operation, OperationInput, OperationResult };

export type { StagedDocumentReceipt };

export class YamakanError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly requestId: string | null;
  constructor(
    code: ErrorCode,
    message: string,
    retryable: boolean,
    requestId: string | null,
  ) {
    super(message);
    this.name = "YamakanError";
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

export type ClientOptions = {
  // Omit in the browser UI: requests go to the page's own origin.
  baseUrl?: string;
  // Local-client bearer credential read from the workspace token file.
  token?: string;
  // Extra headers for each request (the browser UI's session header).
  headers?: () => Record<string, string>;
  fetch?: typeof fetch;
};

// Results cross a JSON boundary, so typed results describe the decoded JSON shape.
export class YamakanClient {
  readonly #base: string;
  readonly #token: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #extra: () => Record<string, string>;
  constructor(options: ClientOptions = {}) {
    this.#base = options.baseUrl?.replace(/\/$/, "") ?? "";
    this.#token = options.token;
    this.#extra = options.headers ?? (() => ({}));
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  #headers(extra: Record<string, string> = {}) {
    const headers = { ...this.#extra(), ...extra };
    return this.#token
      ? { ...headers, Authorization: `Bearer ${this.#token}` }
      : headers;
  }
  async call<O extends Operation>(
    operation: O,
    parameters: OperationInput<O>,
    requestId?: string,
  ): Promise<OperationResult<O>> {
    const response = await this.#fetch(`${this.#base}/api/v1/call`, {
      method: "POST",
      headers: this.#headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        apiVersion: 1,
        operation,
        // An empty ID is sent, and refused, rather than silently dropped.
        ...(requestId !== undefined ? { requestId } : {}),
        parameters,
      }),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok || !value || "error" in value) {
      const e = value?.error;
      throw new YamakanError(
        e?.code ?? "INTERNAL",
        e?.message ?? `Request failed with HTTP ${response.status}.`,
        Boolean(e?.retryable),
        value?.requestId ?? null,
      );
    }
    return value.result as OperationResult<O>;
  }
  /**
   * Uploads one creative document's bytes to the staging route and returns
   * its sealed receipt. Reusing `requestId` after a lost response returns
   * the same receipt without the server reading the body again.
   */
  async stageDocument(
    projectId: string,
    body: Uint8Array,
    options: {
      kind: "studio" | "cinemaScene";
      schemaVersion: number;
      requestId: string;
    },
  ): Promise<StagedDocumentReceipt> {
    // WebCrypto: the same code runs in the browser UI and in Node.
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      body as Uint8Array<ArrayBuffer>,
    );
    const sha256 = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const response = await this.#fetch(
      `${this.#base}/api/v1/projects/${encodeURIComponent(projectId)}/documents/stage`,
      {
        method: "POST",
        // Content-Length comes from the body itself.
        headers: this.#headers({
          "Content-Type": "application/json",
          "X-Request-Id": options.requestId,
          "X-Content-SHA256": sha256,
          "X-Document-Kind": options.kind,
          "X-Document-Schema-Version": String(options.schemaVersion),
        }),
        body: body as Uint8Array<ArrayBuffer>,
      },
    );
    const value = await response.json().catch(() => null);
    if (!response.ok || !value || "error" in value) {
      const e = value?.error;
      throw new YamakanError(
        e?.code ?? "INTERNAL",
        e?.message ?? `Upload failed with HTTP ${response.status}.`,
        Boolean(e?.retryable),
        value?.requestId ?? null,
      );
    }
    return value as StagedDocumentReceipt;
  }
  /**
   * Saves a creative document as a new revision: stages its JSON, then
   * commits the sealed upload. One `requestId` makes the pair safe to
   * retry: the stage and the commit each replay their original result.
   */
  async saveDocument(input: {
    projectId: string;
    expectedRevision: number;
    documentId: string;
    kind: "studio" | "cinemaScene";
    schemaVersion: number;
    expectedContentHash: string | null;
    content: unknown;
    requestId: string;
  }) {
    const body = new TextEncoder().encode(JSON.stringify(input.content));
    const staged = await this.stageDocument(input.projectId, body, {
      kind: input.kind,
      schemaVersion: input.schemaVersion,
      requestId: `${input.requestId}.stage`,
    });
    return this.call(
      "yamakan.document.commit",
      {
        projectId: input.projectId,
        expectedRevision: input.expectedRevision,
        documentId: input.documentId,
        kind: input.kind,
        schemaVersion: input.schemaVersion,
        expectedContentHash: input.expectedContentHash,
        source: {
          stagedUploadId: staged.stagedUploadId,
          contentHash: staged.contentHash,
        },
      },
      `${input.requestId}.commit`,
    );
  }
  async catalog(): Promise<{
    apiVersion: number;
    service: string;
    tools: {
      name: Operation;
      scope: string;
      mutation: boolean;
      summary: string;
      inputSchema: Record<string, unknown>;
    }[];
  }> {
    const response = await this.#fetch(`${this.#base}/api/v1/tools`, {
      headers: this.#headers(),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok || !value) {
      const e = value?.error;
      throw new YamakanError(
        e?.code ?? "INTERNAL",
        e?.message ?? `Catalog request failed with HTTP ${response.status}.`,
        Boolean(e?.retryable),
        value?.requestId ?? null,
      );
    }
    return value;
  }
}
