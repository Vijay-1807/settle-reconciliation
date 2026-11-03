import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  reconcile,
  reconcileAll,
  defaultRates,
  suggestMapping,
  summary,
  validateRow,
} from "../src/engine.mjs";
test("the three supplied examples reconcile exactly", () => {
  const s = seed();
  const a = reconcileAll(s.orders.slice(0, 3), s.rates);
  assert.deepEqual(
    a.map((o) => [o.expected, o.received, o.difference]),
    [
      [1409, 0, -1409],
      [899, 862, -37],
      [-96, -142, -46],
    ],
  );
  assert.deepEqual(
    a.map((o) => o.status),
    ["Unpaid past due", "Short-paid", "Short-paid"],
  );
});
test("tax deductions are expected deductions, never leakage", () => {
  const r = { ...defaultRates[1], fee: 0, commission: 0, tcs: 0.5, tds: 0.1 };
  const o = reconcile(
    {
      id: "1",
      channel: r.channel,
      value: 1000,
      received: 994,
      freight: 60,
      date: "2026-10-01",
      delivery: "Delivered",
    },
    [r],
  );
  assert.equal(o.tcs, 5);
  assert.equal(o.tds, 1);
  assert.equal(o.status, "Settled");
  assert.equal(o.risk, 0);
});
test("ten rupee tolerance is strict and due windows are respected", () => {
  const base = {
    channel: "Website",
    value: 1000,
    received: 900,
    freight: 70,
    date: "2026-11-01",
    delivery: "Delivered",
  };
  assert.equal(reconcile(base).risk, 0);
  assert.equal(reconcile({ ...base, received: 899 }).status, "Short-paid");
  assert.equal(
    reconcile({ ...base, received: 0 }).status,
    "Awaiting settlement",
  );
  assert.equal(reconcile({ ...base, received: 0 }).risk, 0);
  assert.equal(
    reconcile({ ...base, received: 0, date: "2026-10-25" }).status,
    "Unpaid past due",
  );
});
test("return scan clears missing return risk, freight is independently flagged", () => {
  const base = {
    channel: "Website",
    value: 1000,
    received: -96,
    freight: 106,
    date: "2026-10-01",
    delivery: "Return in transit",
  };
  const o = reconcile(base);
  assert.deepEqual(o.issues, ["Return not received", "Freight overcharged"]);
  assert.equal(o.risk, 1046);
  assert.equal(reconcile({ ...base, receipt: "WH-1" }).risk, 46);
});
test("classifier suggests known headers and abstains on ambiguity", () => {
  const m = suggestMapping(["Order ID", "Net payout"], "Settlement");
  assert.equal(m[0].column, "Order ID");
  assert.equal(m[1].column, "Net payout");
  const unknown = suggestMapping(["mystery_zzz"], "COD");
  assert.equal(unknown[0].column, "");
  const ambiguous = suggestMapping(
    ["Order ID", "Order No", "Amount Paid"],
    "COD",
  );
  assert.equal(ambiguous[0].column, "");
});
test("classifier learns only from approved mapping examples", () => {
  const a = suggestMapping(["ABC991", "Order ID"], "COD", [
    { type: "COD", mapping: { received: "ABC991" } },
  ]);
  assert.equal(a[1].column, "ABC991");
});
test("exact value mapping wins before an optional tax fuzzy match", () => {
  const m = suggestMapping(["Gross amount", "Net payout"], "Settlement");
  assert.equal(m.find((s) => s.field === "value").column, "Gross amount");
  assert.equal(m.find((s) => s.field === "tcs").column, "");
});
test("invalid amounts and dates are rejected", () => {
  assert.match(validateRow({ id: "1", received: "nan" }, "COD"), /Invalid/);
  assert.match(
    validateRow(
      { id: "1", channel: "Website", value: -1, date: "2026-10-01" },
      "Orders",
    ),
    /positive/,
  );
});
test("partner summary reconciles to total risk", () => {
  const s = seed(),
    a = reconcileAll(s.orders, s.rates),
    sums = summary(a);
  assert.equal(
    Math.round(sums.partners.reduce((s, p) => s + p.risk, 0) * 100),
    Math.round(sums.risk * 100),
  );
});

test("courier weight slabs round up actual weight rather than billed weight", () => {
  const s = seed(),
    base = { ...s.orders[0], weightKg: 1.1, billedWeightKg: 2, freight: 160 };
  const o = reconcile(base, s.rates);
  assert.equal(o.freightExpected, 110);
  assert.equal(o.freightGap, 50);
  assert.equal(
    reconcile({ ...base, weightKg: 1 }, s.rates).freightExpected,
    85,
  );
});
test("reported taxes change the expected net without becoming leakage", () => {
  const s = seed(),
    o = reconcile(
      { ...s.orders[1], taxTcs: 12, taxTds: 3, received: 891.2 },
      s.rates,
    );
  assert.equal(o.expected, 891.2);
  assert.equal(o.tcs, 12);
  assert.equal(o.tds, 3);
  assert.equal(o.risk, 0);
});
test("invalid calendar dates, whitespace IDs, missing amounts and negative freight are rejected", () => {
  const valid = {
    id: "A",
    channel: "Website",
    partner: "Courier Alpha",
    value: 1000,
    payment: "COD",
    date: "2026-02-30",
  };
  assert.match(validateRow(valid, "Orders"), /ISO date/);
  assert.match(validateRow({ ...valid, id: "   " }, "Orders"), /order ID/);
  assert.match(validateRow({ id: "A" }, "Settlement"), /received/);
  assert.match(validateRow({ id: "A", freight: -10 }, "Freight"), /freight/);
});
