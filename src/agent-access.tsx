import { useEffect, useState } from "react";
import { formatDate, type Lang, type MessageKey } from "./i18n.ts";
import {
  AGENT_SCOPES,
  AGENT_TOKEN_ENDS,
  agentCreateInput,
  agentTokenStatus,
  type AgentScope,
  type AgentTokenEnd,
  type AgentTokenRow,
} from "./agent-access.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
type Client = {
  call(operation: string, parameters: unknown): Promise<unknown>;
};

const SCOPE_KEYS = {
  "project:read": "agents.scope.projectRead",
  "project:write": "agents.scope.projectWrite",
  "project:recover": "agents.scope.projectRecover",
  "render:execute": "agents.scope.renderExecute",
  "job:read": "agents.scope.jobRead",
  "job:control": "agents.scope.jobControl",
} as const satisfies Record<AgentScope, MessageKey>;

const END_KEYS = {
  "7": "agents.end.7",
  "30": "agents.end.30",
  "90": "agents.end.90",
  never: "agents.end.never",
} as const satisfies Record<AgentTokenEnd, MessageKey>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The person's control over agent tokens: make one (shown once), see every one, revoke one.
 * Only the browser session can do any of this; the service refuses agents and the CLI.
 */
export function AgentAccess({
  client,
  t,
  lang,
}: {
  client: Client;
  t: Translate;
  lang: Lang;
}) {
  const [tokens, setTokens] = useState<AgentTokenRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<ReadonlySet<AgentScope>>(
    () => new Set<AgentScope>(["project:read"]),
  );
  const [end, setEnd] = useState<AgentTokenEnd | "">("");
  // The new token, shown once and kept only in this view until the person closes it.
  const [made, setMade] = useState<{ agentId: string; token: string } | null>(
    null,
  );
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = async () => {
    const listed = (await client.call("yamakan.agent.list", {})) as {
      tokens: AgentTokenRow[];
    };
    setTokens(listed.tokens);
  };
  useEffect(() => {
    load().catch((e: unknown) => setError(message(e)));
    // The page's one SDK client; loaded once when shown.
  }, []);

  const form = agentCreateInput({ label, scopes, end });
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    run(async () => {
      if (!form.ok) return;
      const result = (await client.call(
        "yamakan.agent.create",
        form.input,
      )) as { agentId: string; token: string };
      setMade({ agentId: result.agentId, token: result.token });
      setCopied(null);
      setLabel("");
      setEnd("");
      await load();
    });
  const revoke = (agentId: string) =>
    run(async () => {
      await client.call("yamakan.agent.revoke", { agentId });
      setConfirming(null);
      await load();
    });

  return (
    <section
      className="agent-access"
      aria-labelledby="agent-access-title"
      data-testid="agent-access"
    >
      <h3 id="agent-access-title">{t("agents.title")}</h3>
      <p>{t("agents.intro")}</p>

      {made ? (
        <div className="agent-access-made" role="status">
          <p>
            <strong>{t("agents.made.title")}</strong> {t("agents.made.once")}
          </p>
          <input
            readOnly
            dir="ltr"
            aria-label={t("agents.made.title")}
            data-testid="agent-access-token"
            value={made.token}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="agent-access-row">
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(made.token)
                  .then(() => setCopied("yes"))
                  .catch(() => setCopied("no"))
              }
            >
              {t("agents.made.copy")}
            </button>
            <button
              type="button"
              data-testid="agent-access-done"
              onClick={() => {
                setMade(null);
                setCopied(null);
              }}
            >
              {t("agents.made.done")}
            </button>
            {copied ? (
              <span aria-live="polite">
                {t(
                  copied === "yes"
                    ? "agents.made.copied"
                    : "agents.made.copyFailed",
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <form
        className="agent-access-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label>
          {t("agents.label")}{" "}
          <input
            data-testid="agent-access-label"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>{t("agents.scopes")}</legend>
          {AGENT_SCOPES.map((scope) => (
            <label key={scope}>
              <input
                type="checkbox"
                data-testid={`agent-access-scope-${scope}`}
                checked={scopes.has(scope)}
                onChange={(e) => {
                  const next = new Set(scopes);
                  if (e.target.checked) next.add(scope);
                  else next.delete(scope);
                  setScopes(next);
                }}
              />{" "}
              {t(SCOPE_KEYS[scope])}
            </label>
          ))}
        </fieldset>
        <label>
          {t("agents.end")}{" "}
          <select
            data-testid="agent-access-end"
            value={end}
            onChange={(e) => setEnd(e.target.value as AgentTokenEnd | "")}
          >
            <option value="">{t("agents.end.choose")}</option>
            {AGENT_TOKEN_ENDS.map((choice) => (
              <option key={choice} value={choice}>
                {t(END_KEYS[choice])}
              </option>
            ))}
          </select>
        </label>
        <div className="agent-access-row">
          <button
            type="submit"
            data-testid="agent-access-create"
            disabled={busy || !form.ok}
          >
            {t("agents.create")}
          </button>
          {!form.ok ? (
            <span data-testid="agent-access-why">
              {t(`agents.why.${form.reason}`)}
            </span>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" data-testid="agent-access-error">
          {error}
        </p>
      ) : null}

      {tokens === null ? (
        <p>{t("agents.loading")}</p>
      ) : tokens.length === 0 ? (
        <p data-testid="agent-access-empty">{t("agents.none")}</p>
      ) : (
        <ul className="agent-access-list" data-testid="agent-access-list">
          {tokens.map((row) => {
            const status = agentTokenStatus(row);
            return (
              <li
                key={row.agentId}
                data-testid="agent-access-item"
                data-status={status}
              >
                <strong>
                  <bdi>{row.label ?? t("agents.unnamed")}</bdi>
                </strong>{" "}
                <span>{t(`agents.status.${status}`)}</span>
                <br />
                <span>
                  {row.scopes
                    ? row.scopes
                        .map((s) =>
                          Object.hasOwn(SCOPE_KEYS, s)
                            ? t(SCOPE_KEYS[s as AgentScope])
                            : s,
                        )
                        .join(t("agents.separator"))
                    : t("agents.scopesUnreadable")}
                </span>
                <br />
                <span>
                  {t("agents.created", {
                    date: formatDate(lang, row.createdAt),
                  })}
                  {" · "}
                  {row.expiresAt
                    ? t("agents.ends", {
                        date: formatDate(lang, row.expiresAt),
                      })
                    : t("agents.endsNever")}
                </span>
                {!row.revoked ? (
                  <div className="agent-access-row">
                    {confirming === row.agentId ? (
                      <>
                        <button
                          type="button"
                          data-testid="agent-access-revoke-now"
                          disabled={busy}
                          onClick={() => void revoke(row.agentId)}
                        >
                          {t("agents.revokeNow")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                        >
                          {t("agents.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        data-testid="agent-access-revoke"
                        disabled={busy}
                        onClick={() => setConfirming(row.agentId)}
                      >
                        {t("agents.revoke")}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
