// A real person's likeness, used only with their consent: recorded, sent on, revoked and
// linked to a still here, at the browser, by a person. The service checks every one of these
// again, and refuses what does not hold.
import React, { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import {
  CONSENT_DAYS,
  NAME_LIMIT,
  VERSION_LIMIT,
  consentState,
  dateOf,
  daysToMs,
  grantable,
  peopleOf,
  personPack,
  sendFor,
  type ListedConsent,
} from "./create-people.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export type PeopleApi = {
  list: () => Promise<readonly ListedConsent[]>;
  // Which stills each consent is linked to, across the project's packs.
  links: () => Promise<readonly { consentId: string; assetId: string }[]>;
  // Each says whether it was done; why not is not shown beyond that.
  grant: (input: {
    characterId: string;
    purpose: "likeness-generate" | "likeness-send";
    version: string;
    ttlMs: number;
    coversConsentId?: string;
  }) => Promise<boolean>;
  revoke: (consentId: string) => Promise<boolean>;
  revalidate: (consentId: string) => Promise<boolean>;
  link: (pack: ReturnType<typeof personPack>) => Promise<boolean>;
};

const STATE_NAMES: Record<string, MessageKey> = {
  revoked: "create.peopleState.revoked",
  expired: "create.peopleState.expired",
  revalidate: "create.peopleState.revalidate",
};

export function PeoplePanel(props: {
  busy: boolean;
  revision: number;
  t: Translate;
  api: PeopleApi;
  stills: readonly { id: string; name: string; hash: string }[];
}) {
  const { busy, t, api, stills } = props;
  const [consents, setConsents] = useState<readonly ListedConsent[]>([]);
  const [links, setLinks] = useState<
    readonly { consentId: string; assetId: string }[]
  >([]);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [days, setDays] = useState<number>(CONSENT_DAYS[1]);
  const [attested, setAttested] = useState(false);
  // Per consent to generate: the send tick, and the still chosen to link.
  const [sendTicked, setSendTicked] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  // A revoke is for good, so it asks twice.
  const [revoking, setRevoking] = useState<string | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loads = useRef(0);

  const reload = async () => {
    const started = ++loads.current;
    try {
      const [found, linked] = await Promise.all([api.list(), api.links()]);
      if (started !== loads.current) return;
      setConsents(found);
      setLinks(linked);
      setNow(Date.now());
      setProblem((was) => (was === "create.peopleUnread" ? null : was));
    } catch {
      if (started === loads.current) setProblem("create.peopleUnread");
    }
  };

  useEffect(() => {
    void reload();
    // A restore or undo can change what the project holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.revision]);

  const act = async (step: () => Promise<boolean>, after?: () => void) => {
    setProblem(null);
    setWorking(true);
    try {
      if (!(await step())) setProblem("create.peopleFailed");
      else after?.();
    } catch {
      setProblem("create.peopleFailed");
    } finally {
      setWorking(false);
      await reload();
    }
  };

  const off = busy || working;
  const people = peopleOf(consents);
  const stillName = (id: string) =>
    stills.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="create-people" data-testid="create-people">
      <h3>{t("create.peopleTitle")}</h3>
      <p className="note">{t("create.peopleNote")}</p>

      <fieldset className="create-people-grant">
        <label>
          {t("create.peopleName")}
          <input
            value={name}
            maxLength={NAME_LIMIT}
            data-testid="people-name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("create.peopleVersion")}
          <input
            value={version}
            maxLength={VERSION_LIMIT}
            data-testid="people-version"
            onChange={(e) => setVersion(e.target.value)}
          />
        </label>
        <label>
          {t("create.peopleDays")}
          <select
            value={days}
            data-testid="people-days"
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {CONSENT_DAYS.map((d) => (
              <option key={d} value={d}>
                {t("create.peopleDaysOption", { days: d })}
              </option>
            ))}
          </select>
        </label>
        <label className="create-agree">
          <input
            type="checkbox"
            checked={attested}
            data-testid="people-attest"
            onChange={(e) => setAttested(e.target.checked)}
          />
          <span>{t("create.peopleAttest")}</span>
        </label>
        <button
          type="button"
          disabled={off || !grantable({ name, version, attested })}
          data-testid="people-grant"
          onClick={() =>
            void act(
              () =>
                api.grant({
                  characterId: name.trim(),
                  purpose: "likeness-generate",
                  version: version.trim(),
                  ttlMs: daysToMs(days),
                }),
              () => {
                setName("");
                setVersion("");
                setAttested(false);
              },
            )
          }
        >
          {t("create.peopleGrant")}
        </button>
      </fieldset>

      {people.length === 0 && (
        <p className="note" data-testid="people-empty">
          {t("create.peopleEmpty")}
        </p>
      )}
      {people.map((person) => (
        <section
          key={person.characterId}
          className="create-person"
          data-testid="people-person"
        >
          <h4 dir="auto">{person.characterId}</h4>
          {person.generate.map((g) => {
            const state = consentState(g, now);
            const send = sendFor(person, g.id, now);
            const linked = links.filter((l) => l.consentId === g.id);
            const choice = linkChoice[g.id] ?? "";
            return (
              <div
                key={g.id}
                className="create-consent"
                data-testid="people-consent"
                data-state={state}
              >
                <p dir="auto">
                  {t("create.peopleGenerate", {
                    version: g.version,
                    until: dateOf(g.expiresAtMs),
                  })}
                  {state !== "standing" && (
                    <strong> {t(STATE_NAMES[state])}</strong>
                  )}
                </p>
                {linked.length > 0 && (
                  <p className="note" data-testid="people-linked">
                    {t("create.peopleLinked", {
                      names: linked.map((l) => stillName(l.assetId)).join(", "),
                    })}
                  </p>
                )}
                {state === "revalidate" && (
                  <button
                    type="button"
                    disabled={off}
                    data-testid="people-revalidate"
                    onClick={() => void act(() => api.revalidate(g.id))}
                  >
                    {t("create.peopleRevalidate")}
                  </button>
                )}
                {state === "standing" && (
                  <>
                    {send ? (
                      <p data-testid="people-send-standing">
                        {t("create.peopleSend", {
                          until: dateOf(send.expiresAtMs),
                        })}
                      </p>
                    ) : (
                      <>
                        <p className="note" data-testid="people-no-send">
                          {t("create.peopleNoSend")}
                        </p>
                        <label className="create-agree">
                          <input
                            type="checkbox"
                            checked={sendTicked === g.id}
                            data-testid="people-send-attest"
                            onChange={(e) =>
                              setSendTicked(e.target.checked ? g.id : null)
                            }
                          />
                          <span>{t("create.peopleSendAttest")}</span>
                        </label>
                        <button
                          type="button"
                          disabled={off || sendTicked !== g.id}
                          data-testid="people-allow-send"
                          onClick={() =>
                            void act(
                              () =>
                                api.grant({
                                  characterId: person.characterId,
                                  purpose: "likeness-send",
                                  version: g.version,
                                  ttlMs: Math.min(
                                    daysToMs(days),
                                    g.expiresAtMs - Date.now(),
                                  ),
                                  coversConsentId: g.id,
                                }),
                              () => setSendTicked(null),
                            )
                          }
                        >
                          {t("create.peopleAllowSend")}
                        </button>
                      </>
                    )}
                    {stills.length > 0 && (
                      <div className="create-person-link">
                        <select
                          value={choice}
                          aria-label={t("create.peopleLinkStill")}
                          data-testid="people-link-still"
                          onChange={(e) =>
                            setLinkChoice({
                              ...linkChoice,
                              [g.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            {t("create.peopleLinkStill")}
                          </option>
                          {stills.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={off || !choice}
                          data-testid="people-link"
                          onClick={() => {
                            const still = stills.find((s) => s.id === choice);
                            if (!still) return;
                            void act(
                              () =>
                                api.link(
                                  personPack(
                                    person.characterId,
                                    still,
                                    g.id,
                                    () => crypto.randomUUID(),
                                  ),
                                ),
                              () =>
                                setLinkChoice({ ...linkChoice, [g.id]: "" }),
                            );
                          }}
                        >
                          {t("create.peopleLink")}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {state !== "revoked" && (
                  <RevokeButton
                    id={g.id}
                    testid="people-revoke"
                    off={off}
                    t={t}
                    revoking={revoking}
                    setRevoking={setRevoking}
                    revoke={() => act(() => api.revoke(g.id))}
                  />
                )}
                {send && (
                  <RevokeButton
                    id={send.id}
                    testid="people-revoke-send"
                    off={off}
                    t={t}
                    revoking={revoking}
                    setRevoking={setRevoking}
                    revoke={() => act(() => api.revoke(send.id))}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}
      {problem && (
        <p role="alert" className="create-problem">
          {t(problem)}
        </p>
      )}
    </div>
  );
}

function RevokeButton(props: {
  id: string;
  testid: string;
  off: boolean;
  t: Translate;
  revoking: string | null;
  setRevoking: (id: string | null) => void;
  revoke: () => Promise<void>;
}) {
  const sure = props.revoking === props.id;
  return (
    <button
      type="button"
      disabled={props.off}
      data-testid={sure ? `${props.testid}-sure` : props.testid}
      onClick={() => {
        if (!sure) return props.setRevoking(props.id);
        props.setRevoking(null);
        void props.revoke();
      }}
    >
      {props.t(
        sure
          ? "create.peopleRevokeSure"
          : props.testid === "people-revoke-send"
            ? "create.peopleRevokeSend"
            : "create.peopleRevoke",
      )}
    </button>
  );
}
