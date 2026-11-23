// MPR-204: the approvals without which nothing leaves this computer, uses a remote allowance or is
// downloaded. The store, the commands and the authorisation are the real ones.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  Scopes,
  commands,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { bumpDirectorEpoch } from "../core/director/runtime.ts";
import { kaggleNetwork } from "../core/engines/kaggle.ts";
import {
  GATE_LIMITS,
  approveGate,
  consumeGates,
  gateState,
  listGateApprovals,
  requireGate,
  revokeGate,
  type GateApproval,
  type GateAsk,
} from "../core/gates.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const b of bases)
    await rm(b, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
});
const PLAIN = { proxyConfigured: false, certificateOverride: false };
const ASK: GateAsk = {
  kind: "egress",
  route: "kaggle",
  host: "kaggle.com",
  account: "someone",
  purpose: "generation",
  network: PLAIN,
};
const SPEND: GateAsk = { ...ASK, kind: "spend" };
const HOUR = 3_600_000;
const reason = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};
const answered = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-gates-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    kaggle: { cli: path.join(root, "no-such-kaggle.exe"), username: "someone" },
  } as unknown as CommandContext;
  const call = async (operation: string, input: object, over: object = {}) =>
    (await execute({ ...ctx, ...over } as CommandContext, operation, input))
      .result as any;
  const approve = (over: object = {}, more: object = {}) =>
    call(
      "yamakan.gates.approve",
      {
        kind: "egress",
        route: "kaggle",
        host: "kaggle.com",
        account: "someone",
        purpose: "generation",
        ttlMs: HOUR,
        limit: { runs: 2, units: 1_000_000 },
        ...over,
      },
      more,
    ) as Promise<GateApproval>;
  const rows = () =>
    store.read(
      (db) =>
        (
          db.prepare("SELECT count(*) AS n FROM gate_approvals").get() as {
            n: number;
          }
        ).n,
    );
  return { root, store, ctx, call, approve, rows };
}
const give = (
  store: ProjectStore,
  ask: GateAsk = ASK,
  over: { ttlMs?: number; runs?: number; units?: number; nowMs?: number } = {},
) =>
  approveGate(store, {
    ask,
    ttlMs: over.ttlMs ?? HOUR,
    limit: { runs: over.runs ?? 2, units: over.units ?? 1_000 },
    principalId: "browser-ui",
    nowMs: over.nowMs,
  });

test("without an approval a gate is closed, and an approval binds kind, route, host, account and purpose exactly", async () => {
  const { store } = await workspace();
  assert.deepEqual(gateState(store, ASK), {
    kind: "egress",
    state: "missing",
    approvalId: null,
    expiresAt: null,
    runsLeft: 0,
    unitsLeft: 0,
    uses: 0,
  });
  assert.equal(
    reason(() => requireGate(store, ASK)),
    "CAPABILITY_UNAVAILABLE: No one has approved contacting kaggle.com as someone. A person approves it on the Create page first.",
  );
  assert.equal(
    reason(() => requireGate(store, SPEND)),
    "CAPABILITY_UNAVAILABLE: No one has approved using the allowance of kaggle.com as someone. A person approves it on the Create page first.",
  );
  const { id } = give(store);
  assert.equal(requireGate(store, ASK).approvalId, id);
  for (const over of [
    { kind: "spend" },
    { kind: "download" },
    { route: "kaggle2" },
    { route: "kagg" },
    { host: "kaggle.com.evil.example" },
    { host: "www.kaggle.com" },
    { host: "%" },
    { account: "someone else" },
    { account: "Someone" },
    { account: "" },
    { account: "someone " },
    { host: "kaggle.com " },
    { host: "KAGGLE.COM" },
    { route: "Kaggle" },
    { account: "someone\uD800" },
    { host: "kaggle.com\uDFFF" },
    { purpose: "qualification" },
  ])
    assert.match(
      reason(() => requireGate(store, { ...ASK, ...over } as GateAsk)),
      /^CAPABILITY_UNAVAILABLE/,
      JSON.stringify(over),
    );
});

test("half a character is not the one it would be stored as", async () => {
  const { store } = await workspace();
  // What both halves become in the database.
  give(store, { ...ASK, account: "someone\uFFFD" });
  for (const half of ["\uD800", "\uDFFF"])
    for (const kind of ["egress", "spend"] as const)
      assert.equal(
        gateState(store, { ...ASK, kind, account: `someone${half}` }).state,
        "missing",
      );
  assert.match(
    reason(() => give(store, { ...ASK, account: "someone\uD800" })),
    /^VALIDATION/,
  );
  // A whole one is as any other.
  give(store, { ...ASK, account: "someone\u{1F600}" });
  assert.equal(
    gateState(store, { ...ASK, account: "someone\u{1F600}" }).state,
    "approved",
  );
});

test("an approval lasts until it expires, and a revoked or an older epoch's one does not count", async () => {
  const { root, store } = await workspace();
  const { id } = give(store, ASK, { nowMs: 1_000, ttlMs: 60_000 });
  assert.equal(gateState(store, ASK, 60_999).state, "approved");
  assert.equal(gateState(store, ASK, 61_000).state, "expired");
  // A clock set back does not bring one to life before it was given.
  assert.equal(gateState(store, ASK, 1_000).state, "approved");
  assert.equal(gateState(store, ASK, 999).state, "expired");
  assert.match(
    reason(() => requireGate(store, ASK, 61_000)),
    /The approval has expired, or this computer's clock is before it, for contacting kaggle\.com as someone/,
  );
  // The newest counts, whatever an older one says.
  const second = give(store);
  assert.equal(requireGate(store, ASK).approvalId, second.id);
  revokeGate(store, {
    approvalId: second.id,
    principalId: "browser-ui",
    network: PLAIN,
  });
  assert.equal(gateState(store, ASK, 2_000).state, "revoked");
  assert.match(
    reason(() => requireGate(store, ASK, 2_000)),
    /The approval was revoked for contacting/,
  );
  assert.match(
    reason(() =>
      revokeGate(store, {
        approvalId: second.id,
        principalId: "browser-ui",
        network: PLAIN,
      }),
    ),
    /^VALIDATION: Approval is already revoked\./,
  );
  assert.match(
    reason(() =>
      revokeGate(store, {
        approvalId: "00000000-0000-4000-8000-000000000000",
        principalId: "browser-ui",
        network: PLAIN,
      }),
    ),
    /^NOT_FOUND/,
  );
  give(store);
  assert.equal(gateState(store, ASK).state, "approved");
  store.transaction((db) => bumpDirectorEpoch(db));
  assert.equal(gateState(store, ASK).state, "voided");
  assert.match(
    reason(() => requireGate(store, ASK)),
    /The approval was voided by a restore for contacting/,
  );
  assert.equal(
    listGateApprovals(store, PLAIN).approvals.find((a) => a.id === id)!.state,
    "voided",
  );
  give(store);
  assert.equal(gateState(store, ASK).state, "approved");
  // One planted at an epoch to come is no more of this one.
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  db.prepare(
    "INSERT INTO gate_approvals(id, kind, route, host, account, purpose, proxy_configured, certificate_override, limit_runs, limit_units, limit_unit, granted_at, expires_at, grantor_principal_id, epoch) SELECT ?, kind, route, host, account, purpose, proxy_configured, certificate_override, limit_runs, limit_units, limit_unit, granted_at, expires_at, grantor_principal_id, epoch + 1 FROM gate_approvals ORDER BY n DESC LIMIT 1",
  ).run(crypto.randomUUID());
  db.close();
  assert.equal(gateState(store, ASK).state, "voided");
});

test("a proxy or a certificate setting that came or went closes an approval (OA-20)", async () => {
  const { store } = await workspace();
  const PROXY = { proxyConfigured: true, certificateOverride: false };
  const CERTIFICATE = { proxyConfigured: false, certificateOverride: true };
  const BOTH = { proxyConfigured: true, certificateOverride: true };
  const given = [PLAIN, PROXY, CERTIFICATE, BOTH];
  for (const network of given) {
    give(store, { ...ASK, network });
    for (const now of given)
      assert.equal(
        gateState(store, { ...ASK, network: now }).state,
        now === network ? "approved" : "changed",
      );
  }
  assert.match(
    reason(() => requireGate(store, ASK)),
    /^CAPABILITY_UNAVAILABLE: The network settings are not those of the approval/,
  );
  // Nor is it used.
  assert.match(
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], "run")),
    /^CAPABILITY_UNAVAILABLE: The network settings/,
  );
  assert.equal(
    gateState(store, { ...ASK, network: BOTH }).runsLeft,
    2,
    "nothing was counted",
  );
  // The facts are read from what the CLI would be given, and never the values.
  const read = (env: NodeJS.ProcessEnv) => kaggleNetwork(env);
  assert.deepEqual(read({}), PLAIN);
  assert.deepEqual(read({ PATH: "x", NO_PROXY: "localhost" }), PLAIN);
  assert.deepEqual(read({ HTTPS_PROXY: "" }), PLAIN);
  assert.deepEqual(read({ KAGGLE_CONFIG_DIR: "x", KAGGLE_KEY: "k" }), PLAIN);
  for (const name of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "KAGGLE_PROXY",
    "KAGGLE_Proxy",
    "KAGGLE_API_ENDPOINT",
  ])
    assert.deepEqual(read({ [name]: "http://u:p@h:1" }), PROXY, name);
  for (const name of [
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
    "SSL_CERT_FILE",
    "KAGGLE_SSL_CA_CERT",
    "KAGGLE_Verify_SSL",
  ])
    assert.deepEqual(read({ [name]: "C:/x.pem" }), CERTIFICATE, name);
  assert.deepEqual(
    read({ ALL_PROXY: "socks5://h", SSL_CERT_FILE: "C:/x.pem" }),
    BOTH,
  );
});

test("a limit is counted before the send and never refunded, and the same generation is counted once", async () => {
  const { store } = await workspace();
  give(store, ASK, { runs: 2, units: 1_000 });
  give(store, SPEND, { runs: 3, units: 100 });
  const use = (useId: string, bytes: number, seconds: number) =>
    reason(() =>
      consumeGates(
        store,
        [
          { ask: ASK, units: bytes },
          { ask: SPEND, units: seconds },
        ],
        useId,
      ),
    );
  const left = () => [
    gateState(store, ASK).runsLeft,
    gateState(store, ASK).unitsLeft,
    gateState(store, SPEND).runsLeft,
    gateState(store, SPEND).unitsLeft,
  ];
  assert.equal(use("one", 400, 60), "ok");
  assert.deepEqual(left(), [1, 600, 2, 40]);
  assert.equal(use("one", 400, 60), "ok");
  assert.deepEqual(left(), [1, 600, 2, 40]);
  // All of them or none: the second gate refuses, and the first counts nothing.
  assert.match(
    use("two", 100, 41),
    /^CAPABILITY_UNAVAILABLE: The approval is used up for using the allowance of kaggle\.com/,
  );
  assert.deepEqual(left(), [1, 600, 2, 40]);
  assert.equal(use("three", 600, 40), "ok");
  assert.deepEqual(left(), [0, 0, 1, 0]);
  assert.equal(gateState(store, ASK).state, "exhausted");
  assert.match(use("four", 0, 0), /The approval is used up for contacting/);
  // What was counted may still be followed, and the same run may be counted again for nothing.
  assert.equal(
    reason(() => requireGate(store, ASK)),
    "ok",
  );
  assert.equal(use("three", 600, 40), "ok");
  for (const units of [-1, 1.5, Number.NaN, Number.MAX_VALUE])
    assert.match(use("x", units, 0), /^VALIDATION/, String(units));
  // The same use with another amount is no repeat of it.
  assert.match(use("three", 599, 40), /^CAPABILITY_UNAVAILABLE/);
  // Asked for nothing, for the same gate twice, or by no proper name.
  for (const [asks, id] of [
    [[], "x"],
    [
      [
        { ask: SPEND, units: 0 },
        {
          ask: { ...SPEND, network: { ...PLAIN, proxyConfigured: true } },
          units: 0,
        },
      ],
      "x",
    ],
    [[{ ask: SPEND, units: 0 }], ""],
    [[{ ask: SPEND, units: 0 }], "x".repeat(81)],
  ] as const)
    assert.equal(
      reason(() => consumeGates(store, [...asks], id)),
      "VALIDATION: A use names each gate once.",
    );
  assert.deepEqual(left(), [0, 0, 1, 0]);
  // An allowance that is used up is no permission to use it again.
  assert.match(
    reason(() => requireGate(store, SPEND)),
    /The approval is used up for using the allowance/,
  );
  // An approval of nothing, which nothing was counted on, allows nothing.
  give(store, ASK, { units: 0 });
  assert.match(
    reason(() => requireGate(store, ASK)),
    /The approval is used up/,
  );
  // A use of nothing is a use, and is counted once.
  give(store, ASK, { runs: 3, units: 10 });
  for (const n of [1, 2])
    assert.equal(
      reason(() => consumeGates(store, [{ ask: ASK, units: 0 }], "nothing")),
      "ok",
      String(n),
    );
  assert.equal(gateState(store, ASK).uses, 1);
  assert.equal(
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], "nothing")),
    "VALIDATION: The same use was counted with another amount.",
  );
  // A use is bound to its approval: revoking it ends even the same run's.
  const again = give(store, ASK);
  assert.equal(
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], "five")),
    "ok",
  );
  revokeGate(store, {
    approvalId: again.id,
    principalId: "browser-ui",
    network: PLAIN,
  });
  assert.match(
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], "five")),
    /revoked/,
  );
});

test("two starts racing for the last run of an approval: one is counted", async () => {
  const { root, store } = await workspace();
  give(store, ASK, { runs: 1 });
  // Another connection to the same database, as another process would have.
  const other = new DatabaseSync(path.join(root, "workspace.sqlite"));
  other.exec("BEGIN IMMEDIATE");
  assert.match(
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], "a")),
    /^BUSY/,
  );
  other.exec("ROLLBACK");
  other.close();
  const outcomes = ["a", "b"].map((id) =>
    reason(() => consumeGates(store, [{ ask: ASK, units: 1 }], id)),
  );
  assert.equal(outcomes[0], "ok");
  assert.match(outcomes[1]!, /^CAPABILITY_UNAVAILABLE/);
  assert.equal(gateState(store, ASK).uses, 1);
});

test("a download approval cannot be recorded, nor one planted be used", async () => {
  const { store, root, approve, rows } = await workspace();
  assert.equal(
    await answered(approve({ kind: "download" })),
    "CAPABILITY_UNAVAILABLE: This build downloads nothing.",
  );
  const download: GateAsk = { ...ASK, kind: "download" };
  assert.match(
    reason(() => give(store, download)),
    /^CAPABILITY_UNAVAILABLE: This build downloads nothing\./,
  );
  assert.equal(rows(), 0);
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  const epoch = store.read(
    (d) =>
      (
        d.prepare("SELECT value FROM director_epoch").get() as {
          value: number;
        }
      ).value,
  );
  for (const at of [epoch - 1, epoch, epoch + 1])
    db.prepare(
      "INSERT INTO gate_approvals(id, kind, route, host, account, purpose, proxy_configured, certificate_override, limit_runs, limit_units, limit_unit, granted_at, expires_at, grantor_principal_id, epoch) VALUES (?, 'download', 'kaggle', 'kaggle.com', 'someone', 'generation', 0, 0, 9, 9, 'bytes', 0, 9999999999999, 'browser-ui', ?)",
    ).run(crypto.randomUUID(), at);
  db.close();
  assert.equal(gateState(store, download).state, "missing");
  assert.equal(
    reason(() => requireGate(store, download)),
    "CAPABILITY_UNAVAILABLE: This build downloads nothing.",
  );
  assert.equal(
    reason(() => consumeGates(store, [{ ask: download, units: 1 }], "x")),
    "CAPABILITY_UNAVAILABLE: This build downloads nothing.",
  );
});

test("a person approves the route's own host and account, inside the bounds, and nothing else is written", async () => {
  const { approve, rows, call, store, ctx } = await workspace();
  const given = await approve();
  assert.deepEqual(
    { ...given, id: "", grantedAt: 0, expiresAt: 0 },
    {
      id: "",
      kind: "egress",
      route: "kaggle",
      host: "kaggle.com",
      account: "someone",
      purpose: "generation",
      network: kaggleNetwork(process.env),
      limit: { runs: 2, units: 1_000_000, unit: "bytes" },
      grantedAt: 0,
      expiresAt: 0,
      grantorPrincipalId: "browser-ui",
      revokedAt: null,
      state: "approved",
      runsLeft: 2,
      unitsLeft: 1_000_000,
    },
  );
  assert.equal(given.expiresAt - given.grantedAt, HOUR);
  assert.equal((await approve({ kind: "spend" })).limit.unit, "seconds");
  const before = rows();
  for (const [over, why] of [
    [{ host: "kaggle.org" }, "VALIDATION"],
    [{ host: "www.kaggle.com" }, "VALIDATION"],
    [{ host: "Kaggle.com" }, "VALIDATION"],
    [{ host: "kaggle.com/x" }, "VALIDATION"],
    [{ host: "https://kaggle.com" }, "VALIDATION"],
    [{ host: "..\\kaggle.com" }, "VALIDATION"],
    [{ host: "" }, "VALIDATION"],
    [{ host: "k".repeat(254) }, "VALIDATION"],
    [{ account: "someone else" }, "VALIDATION"],
    [{ account: "Someone" }, "VALIDATION"],
    [{ account: "someone " }, "VALIDATION"],
    [{ account: "" }, "VALIDATION"],
    [{ account: "a".repeat(81) }, "VALIDATION"],
    [{ account: "C:\\Users\\someone" }, "VALIDATION"],
    [{ route: "comfyui" }, "VALIDATION"],
    [{ kind: "money" }, "VALIDATION"],
    [{ purpose: "anything" }, "VALIDATION"],
    [{ ttlMs: 59_999 }, "VALIDATION"],
    [{ ttlMs: GATE_LIMITS.ttlMsMost + 1 }, "VALIDATION"],
    [{ ttlMs: 60_000.5 }, "VALIDATION"],
    [{ limit: { runs: 0, units: 1 } }, "VALIDATION"],
    [{ limit: { runs: 1_001, units: 1 } }, "VALIDATION"],
    [{ limit: { runs: 1, units: -1 } }, "VALIDATION"],
    [{ limit: { runs: 1, units: 2 ** 40 + 1 } }, "VALIDATION"],
    [{ limit: { runs: 1, units: 1, euros: 1 } }, "VALIDATION"],
    [{ network: PLAIN }, "VALIDATION"],
    [{ nowMs: 0 }, "VALIDATION"],
  ] as const)
    assert.match(
      await answered(approve(over)),
      new RegExp(`^${why}`),
      JSON.stringify(over),
    );
  assert.equal(
    await answered(approve({}, { kaggle: undefined })),
    "CAPABILITY_UNAVAILABLE: This service was not set up to use that route.",
  );
  assert.equal(rows(), before);
  // The widest there is.
  await approve({
    ttlMs: GATE_LIMITS.ttlMsMost,
    limit: { runs: 1_000, units: 2 ** 40 },
  });
  await approve({ ttlMs: 60_000, limit: { runs: 1, units: 0 } });
  // The module's own bounds, whoever calls it.
  for (const over of [
    { ttlMs: 59_999 },
    { ttlMs: GATE_LIMITS.ttlMsMost + 1 },
    { runs: 0 },
    { runs: 1_001 },
    { units: -1 },
    { units: 2 ** 40 + 1 },
  ])
    assert.match(
      reason(() => give(store, ASK, over)),
      /^VALIDATION/,
    );
  for (const input of [{}, { approvalId: "x" }, { approvalId: "../x" }])
    assert.match(
      await answered(call("yamakan.gates.revoke", input)),
      /^VALIDATION/,
    );
  assert.match(
    await answered(call("yamakan.gates.list", { kind: "egress" })),
    /^VALIDATION/,
  );
  assert.ok(ctx);
});

test("the commands read the network settings as they are when asked, and answer no value of them", async () => {
  const { approve, call, store } = await workspace();
  const SECRET = "http://user:secret-zq71@127.0.0.1:9";
  const names = ["HTTPS_PROXY", "SSL_CERT_FILE"] as const;
  const had = names.map((name) => process.env[name]);
  const set = (proxy: boolean, certificate: boolean) => {
    for (const [name, on] of [
      ["HTTPS_PROXY", proxy],
      ["SSL_CERT_FILE", certificate],
    ] as const)
      if (on) process.env[name] = SECRET;
      else delete process.env[name];
  };
  try {
    set(true, false);
    const given = await approve({}, { requestId: "n.1" });
    assert.deepEqual(given.network, {
      proxyConfigured: true,
      certificateOverride: false,
    });
    assert.equal(given.state, "approved");
    const states = async () =>
      (await call("yamakan.gates.list", {})).approvals.map(
        (a: GateApproval) => a.state,
      );
    assert.deepEqual(await states(), ["approved"]);
    set(true, true);
    assert.deepEqual(await states(), ["changed"]);
    set(false, false);
    assert.deepEqual(await states(), ["changed"]);
    const other = await approve({ kind: "spend" });
    assert.deepEqual(other.network, {
      proxyConfigured: false,
      certificateOverride: false,
    });
    set(true, false);
    assert.deepEqual(await states(), ["changed", "approved"]);
    const revoked = await call("yamakan.gates.revoke", {
      approvalId: given.id,
    });
    assert.deepEqual(revoked.network, given.network);
    const text = store.read((db) =>
      JSON.stringify([
        db.prepare("SELECT * FROM gate_approvals").all(),
        db.prepare("SELECT * FROM director_requests").all(),
      ]),
    );
    for (const said of [text, JSON.stringify([given, other, revoked])])
      assert.ok(!said.includes("zq71"));
  } finally {
    for (const [i, name] of names.entries())
      if (had[i] === undefined) delete process.env[name];
      else process.env[name] = had[i];
  }
});

test("only a person at the browser approves, revokes or lists", async () => {
  const { call, approve, ctx, rows } = await workspace();
  const { id } = await approve();
  const asks: [string, object][] = [
    [
      "yamakan.gates.approve",
      {
        kind: "egress",
        route: "kaggle",
        host: "kaggle.com",
        account: "someone",
        purpose: "generation",
        ttlMs: HOUR,
        limit: { runs: 1, units: 1 },
      },
    ],
    ["yamakan.gates.revoke", { approvalId: id }],
    ["yamakan.gates.list", {}],
  ];
  const agents = [
    { id: "agent:00000000-0000-4000-8000-000000000000", scopes: Scopes },
    { id: "local-client", scopes: Scopes },
    {
      id: "agent:00000000-0000-4000-8000-000000000000",
      scopes: ["project:write"],
    },
  ];
  for (const [operation, input] of asks) {
    for (const { id: who, scopes } of agents)
      assert.match(
        await answered(
          call(operation, input, {
            principal: { id: who, scopes: new Set(scopes) },
          }),
        ),
        /^SCOPE_DENIED/,
        `${who} ${operation}`,
      );
    assert.equal(commands[operation as keyof typeof commands].humanOnly, true);
  }
  assert.equal(rows(), 1);
  // No agent can be given the scopes.
  for (const scope of ["consent:grant", "consent:revoke"])
    assert.notEqual(
      await answered(
        execute(ctx, "yamakan.agent.create", {
          label: "x",
          scopes: ["project:read", scope],
        }),
      ),
      "ok",
    );
});

test("approve and revoke replay a request id and refuse a reused one with different input", async () => {
  const { approve, call, rows, store } = await workspace();
  const first = await approve({}, { requestId: "g.1" });
  assert.deepEqual(await approve({}, { requestId: "g.1" }), first);
  assert.equal(rows(), 1);
  assert.match(
    await answered(approve({ ttlMs: 2 * HOUR }, { requestId: "g.1" })),
    /^IDEMPOTENCY_MISMATCH/,
  );
  const revoke = (requestId: string, approvalId = first.id) =>
    call("yamakan.gates.revoke", { approvalId }, { requestId });
  const revoked = await revoke("g.2");
  assert.equal(revoked.state, "revoked");
  assert.deepEqual(await revoke("g.2"), revoked);
  const other = await approve();
  assert.match(
    await answered(revoke("g.2", other.id)),
    /^IDEMPOTENCY_MISMATCH/,
  );
  assert.equal(
    gateState(store, { ...ASK, network: kaggleNetwork(process.env) }).state,
    "approved",
  );
  // A receipt of before a restore is not replayed as an approval.
  store.transaction((db) => bumpDirectorEpoch(db));
  assert.match(
    await answered(approve({}, { requestId: "g.1" })),
    /^REVISION_CONFLICT/,
  );
});

test("the list is bounded, newest first, with how each stands", async () => {
  const { call, store } = await workspace();
  assert.deepEqual(await call("yamakan.gates.list", {}), {
    approvals: [],
    more: false,
  });
  const network = kaggleNetwork(process.env);
  const ids = Array.from(
    { length: 205 },
    () => give(store, { ...ASK, network }).id,
  ).reverse();
  const { approvals, more } = await call("yamakan.gates.list", {});
  assert.equal(more, true);
  assert.ok(approvals.length > 50 && approvals.length <= GATE_LIMITS.listed);
  assert.deepEqual(
    approvals.map((a: GateApproval) => a.id),
    ids.slice(0, approvals.length),
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify({ approvals, more })) <=
      GATE_LIMITS.listBytes,
  );
  assert.ok(approvals.every((a: GateApproval) => a.state === "approved"));
  // By the index: one read of the place asked for.
  const plan = store.read((db) =>
    db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM gate_approvals a WHERE a.kind = ? AND a.route = ? AND a.host = ? AND a.account = ? AND a.purpose = ? ORDER BY a.n DESC LIMIT 1",
      )
      .all("egress", "kaggle", "kaggle.com", "someone", "generation"),
  ) as { detail: string }[];
  assert.match(plan[0]!.detail, /USING INDEX gate_approvals_asked/);
  assert.ok(!plan.some((p) => /SORT|TEMP B-TREE/.test(p.detail)));
});

test("no command changes or deletes an approval, and no row of the three tables is ever updated", async () => {
  for (const folder of ["core", "server", "cli", "mcp"])
    for (const name of await readdir(folder, { recursive: true })) {
      if (!name.endsWith(".ts")) continue;
      const text = await readFile(path.join(folder, name), "utf8");
      assert.doesNotMatch(
        text,
        /(?:UPDATE|DELETE FROM|REPLACE INTO|DROP TABLE|ALTER TABLE)\s+gate_approval/i,
        name,
      );
    }
});
