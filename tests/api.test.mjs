import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { api } from "../src/api.mjs";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("drizzle/0000_workspace.sql", "utf8"));
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          return sqlite.prepare(sql).run(...args);
        },
      };
    },
    async batch(a) {
      sqlite.exec("BEGIN");
      try {
        for (const s of a) await s.run();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
async function call(DB, path, body, cookie, origin = "http://localhost") {
  return api(
    new Request("http://localhost/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body ? { "content-type": "application/json", origin } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { DB },
  );
}
async function signIn(DB, founder = false) {
  const res = await call(DB, "login", {
    email: founder ? "founder@demo.settle" : "finance@demo.settle",
    password: "demo-settle",
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}
test("authentication, origin policy, role restrictions, and logout", async () => {
  const DB = database();
  assert.equal((await call(DB, "state")).status, 401);
  assert.equal(
    (
      await call(DB, "login", {
        email: "finance@demo.settle",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (await call(DB, "login", {}, undefined, "https://evil.example")).status,
    403,
  );
  const cookie = await signIn(DB);
  const state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(state.orders.length, 480);
  assert.equal(
    (await call(DB, "rates", { rates: state.rates }, cookie)).status,
    403,
  );
  assert.equal((await call(DB, "logout", {}, cookie)).status, 200);
  assert.equal((await call(DB, "state", undefined, cookie)).status, 401);
});
test("imports are validated before writes; mappings version, reuse, rollback", async () => {
  const DB = database(),
    cookie = await signIn(DB, true);
  await call(DB, "state", undefined, cookie);
  const mapping = { id: "Order", received: "Payout" },
    body = {
      type: "Settlement",
      source: "Website",
      name: "test.csv",
      mapping,
      rows: [
        { Order: "ORD-W-204118", Payout: "1409" },
        { Order: "missing", Payout: "invalid" },
      ],
    };
  assert.equal((await call(DB, "import", body, cookie)).status, 422);
  let state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(state.orders.find((o) => o.id === "ORD-W-204118").received, 0);
  body.rows.pop();
  assert.equal((await call(DB, "import", body, cookie)).status, 200);
  assert.equal((await call(DB, "import", body, cookie)).status, 200);
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").status,
    "Settled",
  );
  assert.deepEqual(
    state.mappings.map((m) => m.version),
    [1, 2],
  );
  assert.equal(
    (await call(DB, "rollback", { id: state.mappings[0].id }, cookie)).status,
    200,
  );
  body.mapping.customer = "Name";
  assert.equal((await call(DB, "import", body, cookie)).status, 400);
});
test("claim transitions, receipt persistence, rate recalculation", async () => {
  const DB = database(),
    cookie = await signIn(DB, true);
  let state = await (await call(DB, "state", undefined, cookie)).json();
  await call(
    DB,
    "claim",
    { ids: ["ORD-W-204118"], status: "Recovered" },
    cookie,
  );
  state.rates[0].fee = 80;
  assert.equal(
    (await call(DB, "rates", { rates: state.rates }, cookie)).status,
    200,
  );
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").claim,
    "Recovered",
  );
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").expected,
    1419,
  );
  const returned = state.orders.find((o) => o.status === "Return not received");
  await call(DB, "receipt", { id: returned.id, receipt: "WH-TEST" }, cookie);
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === returned.id).receipt,
    "WH-TEST",
  );
});

test("unmatched payouts require human approval and never close claims automatically", async () => {
  const DB = database(),
    cookie = await signIn(DB);
  let before = await (await call(DB, "state", undefined, cookie)).json();
  const body = {
    type: "Settlement",
    source: "Website",
    name: "missing-id.csv",
    mapping: { received: "Payout", value: "Gross", reference: "AWB" },
    rows: [{ Payout: 1409, Gross: 1499, AWB: "AWB-204118" }],
  };
  const response = await call(DB, "import", body, cookie);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reviewRows, 1);
  let state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(state.orders.find((o) => o.id === "ORD-W-204118").received, 0);
  const pending = state.reviews.find((r) => r.status === "Pending");
  assert.ok(pending.candidates.some((c) => c.id === "ORD-W-204118"));
  assert.equal(
    (
      await call(
        DB,
        "review",
        { id: pending.id, action: "approve", orderId: "ORD-W-204118" },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        DB,
        "review",
        {
          id: pending.id,
          action: "approve",
          orderId: "ORD-W-204118",
          approved: true,
        },
        cookie,
      )
    ).status,
    200,
  );
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").status,
    "Settled",
  );
  assert.equal(state.orders.find((o) => o.id === "ORD-W-204118").claim, "Open");
  assert.equal(state.reviews[0].status, "Approved");
  assert.equal(
    (
      await call(
        DB,
        "review",
        {
          id: pending.id,
          action: "approve",
          orderId: "ORD-W-204118",
          approved: true,
        },
        cookie,
      )
    ).status,
    404,
  );
});
test("payout transaction aggregation is idempotent by source/type/filename and preserves evidence", async () => {
  const DB = database(),
    cookie = await signIn(DB);
  await call(DB, "state", undefined, cookie);
  const body = {
    type: "COD",
    source: "Website",
    name: "partial-a.csv",
    mode: "transactions",
    mapping: { id: "Order", received: "Payout", tcs: "TCS", tds: "TDS" },
    rows: [
      { Order: "ORD-W-204118", Payout: 600, TCS: 0, TDS: 0 },
      { Order: "ORD-W-204118", Payout: 300, TCS: 0, TDS: 0 },
    ],
  };
  assert.equal((await call(DB, "import", body, cookie)).status, 200);
  assert.equal((await call(DB, "import", body, cookie)).status, 200);
  let state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(state.orders.find((o) => o.id === "ORD-W-204118").received, 900);
  body.name = "partial-b.csv";
  body.rows = [{ Order: "ORD-W-204118", Payout: 509, TCS: 0, TDS: 0 }];
  await call(DB, "import", body, cookie);
  state = await (await call(DB, "state", undefined, cookie)).json();
  const o = state.orders.find((o) => o.id === "ORD-W-204118");
  assert.equal(o.received, 1409);
  assert.equal(o.status, "Settled");
  assert.equal(o.evidence.length, 3);
  assert.deepEqual(o.evidence[0].rows, [2, 3]);
});
test("a database failure rolls back both imported records and mapping history", async () => {
  const DB = database(),
    cookie = await signIn(DB);
  await call(DB, "state", undefined, cookie);
  const batch = DB.batch.bind(DB);
  DB.batch = (a) =>
    batch([...a, DB.prepare("INSERT INTO does_not_exist VALUES (1)")]);
  const res = await call(
    DB,
    "import",
    {
      type: "COD",
      source: "Website",
      name: "atomic.csv",
      mapping: { id: "Order", received: "Payout" },
      rows: [{ Order: "ORD-W-204118", Payout: 1409 }],
    },
    cookie,
  );
  assert.equal(res.status, 500);
  DB.batch = batch;
  const state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(state.orders.find((o) => o.id === "ORD-W-204118").received, 0);
  assert.equal(state.mappings.length, 0);
  assert.equal(state.uploads.length, 1);
});

test("separate reviewed partial payouts add together and repeated file rows remain idempotent", async () => {
  const DB = database(),
    cookie = await signIn(DB);
  await call(DB, "state", undefined, cookie);
  const body = {
    type: "COD",
    source: "Website",
    name: "review-parts.csv",
    mode: "transactions",
    mapping: { received: "Payout", value: "Gross" },
    rows: [
      { Payout: 600, Gross: 1499 },
      { Payout: 809, Gross: 1499 },
    ],
  };
  await call(DB, "import", body, cookie);
  let state = await (await call(DB, "state", undefined, cookie)).json();
  for (const r of state.reviews)
    assert.equal(
      (
        await call(
          DB,
          "review",
          {
            id: r.id,
            action: "approve",
            orderId: "ORD-W-204118",
            approved: true,
          },
          cookie,
        )
      ).status,
      200,
    );
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").received,
    1409,
  );
  await call(DB, "import", body, cookie);
  state = await (await call(DB, "state", undefined, cookie)).json();
  for (const r of state.reviews.filter((r) => r.status === "Pending"))
    await call(
      DB,
      "review",
      { id: r.id, action: "approve", orderId: "ORD-W-204118", approved: true },
      cookie,
    );
  state = await (await call(DB, "state", undefined, cookie)).json();
  assert.equal(
    state.orders.find((o) => o.id === "ORD-W-204118").received,
    1409,
  );
});
