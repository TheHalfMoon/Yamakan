import { useEffect, useRef, useState } from "react";
import {
  DIRECTOR_ENABLED,
  directorCapability,
} from "../../core/director-flags.ts";
import { MESSAGES, type MessageKey } from "../i18n.ts";

type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};

type Translate = (key: MessageKey) => string;
type EngineOperation = {
  operation: string;
  available: boolean;
  verified: boolean;
  reason: string | null;
};
const known = (key: string): key is MessageKey =>
  Object.hasOwn(MESSAGES.en, key);
// Only a well-formed answer is shown; anything else is "not known".
const parseOperations = (value: unknown): EngineOperation[] | null => {
  const list = (value as { operations?: unknown } | null)?.operations;
  if (!Array.isArray(list)) return null;
  const ok = list.every(
    (o) =>
      o &&
      typeof o.operation === "string" &&
      typeof o.available === "boolean" &&
      typeof o.verified === "boolean" &&
      (o.reason === null || typeof o.reason === "string"),
  );
  return ok ? (list as EngineOperation[]) : null;
};

// Which generative operations could run, each with its plain reason in the
// interface language. A late answer after unmount is dropped; a failed or
// malformed answer says the state is not known. Asked once per mount (the
// host passes a new client object on every render).
function EngineOperations({ client, t }: { client: Client; t: Translate }) {
  const [operations, setOperations] = useState<
    EngineOperation[] | "unknown" | null
  >(null);
  const caller = useRef(client);
  useEffect(() => {
    let current = true;
    caller.current
      .call("yamakan.engines.capabilities", {})
      .then((result) => {
        if (current) setOperations(parseOperations(result) ?? "unknown");
      })
      .catch(() => {
        if (current) setOperations("unknown");
      });
    return () => {
      current = false;
    };
  }, []);
  if (!operations) return null;
  if (operations === "unknown")
    return <p data-testid="engine-operations-unknown">{t("engine.unknown")}</p>;
  const label = (op: string) => {
    const key = `engine.op.${op}`;
    return known(key) ? t(key) : op;
  };
  const reason = (o: EngineOperation) => {
    if (o.available)
      return o.verified ? t("engine.available") : t("engine.present");
    const key = `engine.reason.${o.reason}`;
    return known(key) ? t(key) : t("engine.unknown");
  };
  return (
    <ul data-testid="engine-operations" aria-label={t("engine.list")}>
      {operations.map((o) => (
        <li
          key={o.operation}
          data-operation={o.operation}
          data-available={String(o.available)}
          data-reason={o.reason ?? ""}
        >
          {label(o.operation)}: {reason(o)}
        </li>
      ))}
    </ul>
  );
}

type StoryItem =
  | { kind: "story"; id: string; title: string; shots: number; cards: number }
  | {
      kind: "pack";
      id: string;
      name: string;
      entries: number;
      likeness: number;
    };
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.hasOwn(values, k) ? String(values[k]) : m,
  );
// A story or pack as read back (YU-031); anything malformed is skipped.
function storyItem(value: unknown): StoryItem | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.id !== "string") return null;
  const content = v.content as Record<string, unknown> | null;
  if (v.kind === "story" && content && Array.isArray(content.scenes)) {
    const shots = content.scenes.flatMap((s: { shots?: unknown }) =>
      Array.isArray(s?.shots)
        ? (s.shots as { selectedTakeId?: unknown }[])
        : [],
    );
    return {
      kind: "story",
      id: v.id,
      title: String(content.title ?? ""),
      shots: shots.length,
      cards: shots.filter((s) => s?.selectedTakeId === null).length,
    };
  }
  if (v.kind === "referencePack" && content && Array.isArray(content.entries)) {
    const entries = content.entries as { consentId?: unknown }[];
    return {
      kind: "pack",
      id: v.id,
      name: String(content.name ?? ""),
      entries: entries.length,
      likeness: entries.filter((e) => typeof e?.consentId === "string").length,
    };
  }
  return null;
}

// The project's stories and reference packs, read again at each revision
// of the open project, or when asked (another client may have saved one).
function StoryPacks({
  projectId,
  revision,
  client,
  t,
}: {
  projectId: string;
  revision: number | null;
  client: Client;
  t: Translate;
}) {
  const [items, setItems] = useState<StoryItem[] | "unknown" | null>(null);
  const [reads, setReads] = useState(0);
  const caller = useRef(client);
  useEffect(() => {
    let current = true;
    (async () => {
      const refs = (await caller.current.call("yamakan.document.list", {
        projectId,
      })) as { id?: unknown; kind?: unknown }[];
      const wanted = (Array.isArray(refs) ? refs : []).filter(
        (r) =>
          typeof r?.id === "string" &&
          (r.kind === "story" || r.kind === "referencePack"),
      );
      const read = await Promise.all(
        wanted.map((r) =>
          caller.current.call("yamakan.document.get", {
            projectId,
            documentId: r.id,
          }),
        ),
      );
      return read.map(storyItem).filter((x): x is StoryItem => x !== null);
    })()
      .then((list) => {
        if (current) setItems(list);
      })
      .catch(() => {
        if (current) setItems("unknown");
      });
    return () => {
      current = false;
    };
  }, [projectId, revision, reads]);
  if (!items || items === "unknown") return null;
  return (
    <section
      data-testid="story-packs"
      data-reads={reads}
      aria-label={t("story.list")}
    >
      <button
        type="button"
        data-testid="story-refresh"
        onClick={() => setReads((n) => n + 1)}
      >
        {t("story.refresh")}
      </button>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.id} data-kind={item.kind}>
              {item.kind === "story"
                ? fill(t("story.summary"), item)
                : fill(t("story.pack"), item)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("story.none")}</p>
      )}
    </section>
  );
}

type Props = {
  projectId: string | null;
  revision?: number | null;
  client: Client;
  t: Translate;
};

/**
 * Manual Director controls. Human approval uses browser-principal scopes.
 * Model-dependent stages are listed as unsupported, not invoked.
 */
export function DirectorPanel({
  projectId,
  revision = null,
  client,
  t,
}: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!DIRECTOR_ENABLED) {
    return (
      <section
        data-testid="director-panel"
        data-director-enabled="false"
        aria-label="Director"
      >
        <p data-testid="director-disabled-reason">
          {directorCapability().reason}
        </p>
      </section>
    );
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setStatus(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  return (
    <section
      data-testid="director-panel"
      data-director-enabled="true"
      data-director-status={status}
      data-director-run={runId ?? ""}
      aria-label="Director"
    >
      <p data-testid="director-unsupported">
        unsupported: {(directorCapability().unsupported ?? []).join(", ")}
      </p>
      <EngineOperations client={client} t={t} />
      {projectId ? (
        <StoryPacks
          key={projectId}
          projectId={projectId}
          revision={revision}
          client={client}
          t={t}
        />
      ) : null}
      <p>
        <button
          type="button"
          data-testid="director-start"
          disabled={!projectId}
          onClick={() =>
            run("starting", async () => {
              if (!projectId) throw new Error("No project");
              const result = (await client.call("yamakan.director.start", {
                projectId,
                pipelineName: "framework-smoke",
              })) as { id: string };
              setRunId(result.id);
              setDetail(JSON.stringify(result));
              setStatus("started");
            })
          }
        >
          Start framework-smoke
        </button>
      </p>
      <p>
        <button
          type="button"
          data-testid="director-next"
          disabled={!runId}
          onClick={() =>
            run("next", async () => {
              if (!runId) throw new Error("No run");
              const result = await client.call("yamakan.director.next", {
                runId,
              });
              setDetail(JSON.stringify(result));
              setStatus("next");
            })
          }
        >
          Next stage
        </button>
      </p>
      {detail ? (
        <pre data-testid="director-detail" dir="ltr">
          {detail}
        </pre>
      ) : null}
      {error ? (
        <p role="alert" data-testid="director-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
