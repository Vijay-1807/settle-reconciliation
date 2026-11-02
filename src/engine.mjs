export const TODAY = "2026-11-02";
export const channels = [
  "Website",
  "Marketplace 1",
  "Marketplace 2",
  "Marketplace 3",
  "Quick commerce 1",
  "Quick commerce 2",
];
export const partners = ["Courier Alpha", "Courier Beta", ...channels.slice(1)];
export const defaultRates = channels.map((channel, i) => ({
  channel,
  commission: i === 0 ? 0 : 18,
  fee: i === 0 ? 90 : 78,
  freight: 60,
  returnFee: 96,
  tcs: i === 0 ? 0 : 0.5,
  tds: i === 0 ? 0 : 0.1,
  dueDays: 7,
  returnDays: 7,
}));
const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export function reconcile(order, rates = defaultRates, today = TODAY) {
  const r = rates.find((r) => r.channel === order.channel) || rates[0];
  const returned = /return/i.test(order.delivery || "");
  const tcs = round((order.value * r.tcs) / 100),
    tds = round((order.value * r.tds) / 100);
  const expected = returned
    ? -r.returnFee
    : round(
        order.value - (order.value * r.commission) / 100 - r.fee - tcs - tds,
      );
  const difference = round(Number(order.received || 0) - expected);
  const age = Math.max(
    0,
    Math.floor((Date.parse(today) - Date.parse(order.date)) / 86400000),
  );
  const freightGap = round(Math.max(0, Number(order.freight || 0) - r.freight));
  const issues = [];
  if (returned && !order.receipt && age > r.returnDays)
    issues.push("Return not received");
  if (freightGap > 10) issues.push("Freight overcharged");
  if (difference < -10) {
    if (!returned && Number(order.received || 0) === 0) {
      if (age > r.dueDays) issues.push("Unpaid past due");
    } else issues.push("Short-paid");
  }
  const status =
    issues[0] || (difference < -10 ? "Awaiting settlement" : "Settled");
  const risk = round(
    (issues.includes("Short-paid") || issues.includes("Unpaid past due")
      ? Math.max(0, -difference)
      : 0) +
      (returned && !order.receipt && age > r.returnDays ? order.value : 0) +
      (freightGap > 10 ? freightGap : 0),
  );
  return {
    ...order,
    expected,
    difference,
    tcs,
    tds,
    age,
    freightGap,
    status,
    issues,
    risk,
    rate: r,
  };
}
export function reconcileAll(orders, rates, today) {
  const byChannel = new Map(rates.map((r) => [r.channel, [r]]));
  return orders.map((o) =>
    reconcile(o, byChannel.get(o.channel) || rates, today),
  );
}
export function summary(orders) {
  const risk = orders.reduce((s, o) => s + o.risk, 0),
    exception = orders.filter((o) => o.issues.length);
  return {
    total: orders.length,
    risk: round(risk),
    expected: round(orders.reduce((s, o) => s + o.expected, 0)),
    received: round(orders.reduce((s, o) => s + o.received, 0)),
    matched: orders.filter((o) => o.status === "Settled").length,
    exceptions: exception.length,
    partners: partners
      .map((partner) => {
        const a = orders.filter((o) => o.partner === partner);
        return {
          partner,
          count: a.filter((o) => o.risk > 0).length,
          risk: round(a.reduce((s, o) => s + o.risk, 0)),
          tcs: round(a.reduce((s, o) => s + o.tcs, 0)),
          tds: round(a.reduce((s, o) => s + o.tds, 0)),
          ages: [0, 0, 0, 0].map((_, i) =>
            round(
              a
                .filter((o) =>
                  i === 0
                    ? o.age <= 7
                    : i === 1
                      ? o.age > 7 && o.age <= 14
                      : i === 2
                        ? o.age > 14 && o.age <= 30
                        : o.age > 30,
                )
                .reduce((s, o) => s + o.risk, 0),
            ),
          ),
        };
      })
      .filter((p) => p.count || p.tcs),
  };
}
export function seed() {
  const orders = [];
  for (let i = 0; i < 480; i++) {
    const channel = channels[i % 6],
      r = defaultRates[i % 6],
      value = [1499, 1199, 2398, 899, 1799, 2499][i % 6];
    const returned = i % 37 === 0;
    const date = new Date(Date.parse(TODAY) - (2 + (i % 42)) * 86400000)
      .toISOString()
      .slice(0, 10);
    let o = {
      id: `ORD-${i % 6 === 0 ? "W" : "M"}-${204000 + i}`,
      channel,
      value,
      payment: i % 3 === 0 ? "COD" : "Prepaid",
      delivery: returned ? "Return in transit" : "Delivered",
      received: 0,
      partner: i % 6 === 0 ? partners[i % 2] : channel,
      date,
      freight: 60,
      receipt: returned && i % 74 !== 0 ? "WH-" + i : "",
      claim: "Open",
      source: "October orders.csv",
      sourceRow: i + 2,
    };
    o.received = returned
      ? -96
      : round(
          value -
            (value * r.commission) / 100 -
            r.fee -
            (value * (r.tcs + r.tds)) / 100,
        );
    if (i % 11 === 0) o.received = 0;
    if (i % 13 === 0) o.received = round(o.received - 37);
    if (i % 17 === 0) o.freight = 106;
    orders.push(o);
  }
  orders[0] = {
    ...orders[0],
    id: "ORD-W-204118",
    value: 1499,
    received: 0,
    delivery: "Delivered",
    freight: 60,
    date: "2026-10-18",
    payment: "COD",
  };
  orders[1] = {
    ...orders[1],
    id: "ORD-M-88120",
    value: 1199,
    received: 862,
    channel: "Marketplace 1",
    date: "2026-10-21",
    expectedOverride: 899,
  };
  orders[2] = {
    ...orders[2],
    id: "ORD-W-204377",
    value: 2398,
    received: -142,
    channel: "Website",
    partner: "Courier Beta",
    delivery: "Returned to warehouse",
    receipt: "WH-1003",
    freight: 60,
    date: "2026-10-24",
  };
  // A dedicated fixed-fee card reproduces the brief's Marketplace 1 sample exactly.
  const rates = defaultRates.map((r) =>
    r.channel === "Marketplace 1" ? { ...r, commission: 0, fee: 292.8 } : r,
  );
  return {
    orders,
    rates,
    mappings: [],
    uploads: [
      {
        id: "seed-orders",
        name: "October orders.csv",
        source: "Website",
        type: "Orders",
        rows: 480,
        date: "2026-11-02T08:42:00Z",
        status: "Completed",
      },
    ],
    reviews: [],
    audit: [],
  };
}
export const fields = {
  Orders: ["id", "channel", "value", "payment", "delivery", "date", "partner"],
  Settlement: ["id", "received"],
  COD: ["id", "received"],
  Freight: ["id", "freight"],
  Returns: ["id", "receipt"],
};
export const aliases = {
  id: ["orderid", "orderno", "orderreference", "merchantorderid"],
  channel: ["channel", "saleschannel", "store"],
  value: ["value", "ordervalue", "grossamount", "total"],
  payment: ["payment", "paymentmethod", "paymentmode"],
  delivery: ["delivery", "deliverystatus", "status"],
  date: ["date", "orderdate", "delivereddate"],
  partner: ["partner", "courier", "vendor"],
  received: [
    "received",
    "netpayout",
    "settlementamount",
    "remittanceamount",
    "amountpaid",
  ],
  freight: ["freight", "freightamount", "shippingcharge", "billedfreight"],
  receipt: ["receipt", "warehousereceipt", "scanid"],
};
// A small, local nearest-neighbour classifier. Character n-gram vectors let the
// assistant generalise to changed headers. Approved mappings extend its examples.
// Scores are similarity measures, not calibrated probabilities.
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function vector(text) {
  const s = "^" + normalize(text) + "$";
  const v = new Map();
  for (let n = 2; n <= 3; n++)
    for (let i = 0; i <= s.length - n; i++) {
      const gram = s.slice(i, i + n);
      v.set(gram, (v.get(gram) || 0) + 1);
    }
  return v;
}
function similarity(a, b) {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (const [k, n] of a) {
    dot += n * (b.get(k) || 0);
    aa += n * n;
  }
  for (const n of b.values()) bb += n * n;
  return dot / Math.sqrt(aa * bb) || 0;
}
export function suggestMapping(headers, type, approved = []) {
  const examples = Object.fromEntries(
    fields[type].map((f) => [
      f,
      [
        ...aliases[f],
        ...approved
          .filter((m) => m.type === type && m.mapping[f])
          .map((m) => m.mapping[f]),
      ].map((text) => ({ text, vector: vector(text) })),
    ]),
  );
  const used = new Set();
  return fields[type].map((field) => {
    const ranked = headers
      .filter((h) => !used.has(h))
      .map((column) => ({
        column,
        score: Math.max(
          ...examples[field].map((e) =>
            normalize(e.text) === normalize(column)
              ? 0.99
              : similarity(vector(column), e.vector),
          ),
        ),
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const score = best?.score || 0;
    const ambiguous = ranked[1] && Math.abs(score - ranked[1].score) < 0.06;
    const column = score >= 0.52 && !ambiguous ? best.column : "";
    if (column) used.add(column);
    return {
      field,
      column,
      confidence: Math.round(score * 100) / 100,
      method: column ? "Local n-gram classifier" : "Needs review",
    };
  });
}
export function validateRow(row, type) {
  if (!row.id || String(row.id).length > 100)
    return "A valid order ID is required";
  if (type === "Orders") {
    if (!channels.includes(row.channel)) return "Unknown channel";
    if (!Number.isFinite(Number(row.value)) || Number(row.value) <= 0)
      return "Order value must be positive";
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(row.date))
    )
      return "Use an ISO date (YYYY-MM-DD)";
  }
  for (const key of ["received", "freight"])
    if (
      row[key] !== undefined &&
      (!Number.isFinite(Number(row[key])) || Math.abs(Number(row[key])) > 1e8)
    )
      return `Invalid ${key} amount`;
  return null;
}
