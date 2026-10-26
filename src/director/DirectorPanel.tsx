import { useEffect, useRef, useState } from "react";
import {
  DIRECTOR_ENABLED,
  directorCapability,
} from "../../core/director-flags.ts";
import { OPERATION_LABELS } from "../../core/engines/reasons.ts";

type Client = {
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>;
};

type EngineOperation = {
  operation: string;
  available: boolean;
  message: string;
};

// Which generative operations could run, each with its plain reason. A late
// answer after unmount is dropped; a failed call shows nothing. Asked once
// per mount (the host passes a new client object on every render).
function EngineOperations({ client }: { client: Client }) {
  const [operations, setOperations] = useState<EngineOperation[] | null>(null);
  const caller = useRef(client);
  useEffect(() => {
    let current = true;
    caller.current
      .call("yamakan.engines.capabilities", {})
      .then((result) => {
        if (current)
          setOperations(
            (result as { operations: EngineOperation[] }).operations,
          );
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  if (!operations) return null;
  return (
    <ul data-testid="engine-operations" aria-label="Generative operations">
      {operations.map((o) => (
        <li
          key={o.operation}
          data-operation={o.operation}
          data-available={String(o.available)}
        >
          {OPERATION_LABELS[o.operation] ?? o.operation}: {o.message}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  projectId: string | null;
  client: Client;
};

/**
 * Manual Director controls. Human approval uses browser-principal scopes.
 * Model-dependent stages are listed as unsupported, not invoked.
 */
export function DirectorPanel({ projectId, client }: Props) {
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
      <EngineOperations client={client} />
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
