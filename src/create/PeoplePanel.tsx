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
  newestSends,
  peopleOf,
  personPack,
  sendFor,
  sendTtl,
  withLink,
  type ListedConsent,
  type PersonPack,
} from "./create-people.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export type KeptPersonPack = {
  documentId: string;
  contentHash: string;
  pack: PersonPack;
};

export type PeopleApi = {
  list: () => Promise<readonly ListedConsent[]>;
  // The packs this page keeps, one per person, as they stand. A pack that cannot be read is
  // left out. Which stills a consent was ever linked to comes from the list instead.
  packs: () => Promise<{ people: readonly KeptPersonPack[] }>;
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
  link: (next: {
    documentId: string;
    expectedContentHash: string | null;
    pack: PersonPack;
  }) => Promise<boolean>;
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
  const [kept, setKept] = useState<readonly KeptPersonPack[]>([]);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [days, setDays] = useState<number>(CONSENT_DAYS[1]);
  const [attested, setAttested] = useState(false);
  // Per consent to generate: the send tick, and the still chosen to link.
  const [sendTicked, setSendTicked] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  // A revoke is for good, so it asks twice, and anything else in between asks again.
  const [revoking, setRevoking] = useState<string | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loads = useRef(0);

  const reload = async () => {
    const started = ++loads.current;
    try {
      const [found, packs] = await Promise.all([api.list(), api.packs()]);
      if (started !== loads.current) return;
      setConsents(found);
      setKept(packs.people);
      setNow(Date.now());
      setProblem((was) => (was === "create.peopleUnread" ? null : was));
    } catch {
      if (started === loads.current) setProblem("create.peopleUnread");
    }
  };

  useEffect(() => {
    setRevoking(null);
    void reload();
    // A restore or undo can change what the project holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.revision]);

  const act = async (
    step: () => Promise<boolean | MessageKey>,
    after?: () => void,
  ) => {
    setRevoking(null);
    setProblem(null);
    setWorking(true);
    try {
      const done = await step();
      if (done === true) after?.();
      else setProblem(done === false ? "create.peopleFailed" : done);
    } catch {
      setProblem("create.peopleFailed");
    } finally {
      setWorking(false);
      await reload();
    }
  };

  const link = (characterId: string, consentId: string, stillId: string) =>
    act(async () => {
      const still = stills.find((s) => s.id === stillId);
      if (!still) return false;
      // Their pack with the most room, if they have more than one.
      const [mine] = kept
        .filter((k) => k.pack.entries[0].characterId === characterId)
        .sort((x, y) => x.pack.entries.length - y.pack.entries.length);
      if (!mine)
        return api.link({
          documentId: crypto.randomUUID(),
          expectedContentHash: null,
          pack: personPack(characterId, still, consentId, () =>
            crypto.randomUUID(),
          ),
        });
      const stands = (id: string) => {
        const c = consents.find((x) => x.id === id);
        return Boolean(c && consentState(c, Date.now()) === "standing");
      };
      const next = withLink(
        mine.pack,
        still,
        consentId,
        () => crypto.randomUUID(),
        stands,
      );
      if (next === "already") return "create.peopleAlreadyLinked";
      // Full of standing links: a pack of its own for this one.
      if (next === "full")
        return api.link({
          documentId: crypto.randomUUID(),
          expectedContentHash: null,
          pack: personPack(characterId, still, consentId, () =>
            crypto.randomUUID(),
          ),
        });
      return api.link({
        documentId: mine.documentId,
        expectedContentHash: mine.contentHash,
        pack: next,
      });
    });

  const off = busy || working;
  const people = peopleOf(consents);
  // By hash, as the service links them: one no longer in the project shows its hash.
  const stillName = (hash: string) =>
    stills.find((s) => s.hash === hash)?.name ?? hash.slice(0, 8);

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
            // The newest consents to send naming it, in whatever state, to confirm again.
            const unconfirmed = newestSends(person, g.id).filter(
              (s) => consentState(s, now) === "revalidate",
            );
            // Every still ever linked to it, as the send check counts them.
            const linked = g.linkedAssetHashes;
            const choice = linkChoice[g.id] ?? "";
            // An expired consent still says who its linked stills show, and sending them
            // needs it covered too, so it may still be given consent to send.
            const mayCover =
              state === "standing" ||
              (state === "expired" && g.current && linked.length > 0);
            const ttl = sendTtl(g, daysToMs(days), now);
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
                      names: linked.map(stillName).join(", "),
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
                {unconfirmed.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={off || state === "revalidate"}
                    data-testid="people-revalidate-send"
                    onClick={() => void act(() => api.revalidate(s.id))}
                  >
                    {t("create.peopleRevalidateSend")}
                  </button>
                ))}
                {send && (
                  <p data-testid="people-send-standing">
                    {t("create.peopleSend", {
                      until: dateOf(send.expiresAtMs),
                    })}
                  </p>
                )}
                {!send && mayCover && unconfirmed.length === 0 && (
                  <>
                    <p className="note" data-testid="people-no-send">
                      {t(
                        state === "expired"
                          ? "create.peopleNoSendExpired"
                          : "create.peopleNoSend",
                      )}
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
                      disabled={off || sendTicked !== g.id || ttl === null}
                      data-testid="people-allow-send"
                      onClick={() => {
                        if (ttl === null) return;
                        void act(
                          () =>
                            api.grant({
                              characterId: person.characterId,
                              purpose: "likeness-send",
                              version: g.version,
                              ttlMs: ttl,
                              coversConsentId: g.id,
                            }),
                          () => setSendTicked(null),
                        );
                      }}
                    >
                      {t("create.peopleAllowSend", {
                        days: Math.max(1, Math.floor((ttl ?? 0) / 86_400_000)),
                      })}
                    </button>
                  </>
                )}
                {state === "standing" && stills.length > 0 && (
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
                      <option value="">{t("create.peopleLinkStill")}</option>
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
                      onClick={() =>
                        void link(person.characterId, g.id, choice).then(() =>
                          setLinkChoice((was) => ({ ...was, [g.id]: "" })),
                        )
                      }
                    >
                      {t("create.peopleLink")}
                    </button>
                  </div>
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
                {newestSends(person, g.id)
                  .filter((s) => consentState(s, now) !== "revoked")
                  .map((s) => (
                    <RevokeButton
                      key={s.id}
                      id={s.id}
                      testid="people-revoke-send"
                      off={off}
                      t={t}
                      revoking={revoking}
                      setRevoking={setRevoking}
                      revoke={() => act(() => api.revoke(s.id))}
                    />
                  ))}
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
