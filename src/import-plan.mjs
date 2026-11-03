import { validateRow, matchCandidates } from "./engine.mjs";

export function applyPartnerRow(existing, row, context) {
  const result = { ...existing };
  if (context.type === "Orders")
    Object.assign(result, row, {
      id: String(row.id).trim(),
      value: Number(row.value),
      weightKg: Number(row.weightKg || existing?.weightKg || 0.5),
      received: existing?.received ?? 0,
      freight: existing?.freight ?? 60,
      receipt: existing?.receipt || "",
      claim: existing?.claim || "Open",
    });
  if (["Settlement", "COD"].includes(context.type)) {
    if (context.mode === "transactions") {
      const key = JSON.stringify([
        context.source,
        context.type,
        context.name,
        ...(context.review ? context.rows : []),
      ]);
      const ledger = { ...(existing.payoutLedger || {}) };
      ledger[key] = {
        amount: Number(row.received),
        tcs: row.tcs === undefined ? null : Number(row.tcs),
        tds: row.tds === undefined ? null : Number(row.tds),
      };
      const baseline = existing.payoutBaseline ?? existing.received ?? 0;
      result.payoutLedger = ledger;
      result.payoutBaseline = baseline;
      result.received =
        Math.round(
          (baseline + Object.values(ledger).reduce((s, r) => s + r.amount, 0)) *
            100,
        ) / 100;
      for (const [f, k] of [
        ["taxTcs", "tcs"],
        ["taxTds", "tds"],
      ])
        if (Object.values(ledger).some((r) => r[k] !== null))
          result[f] =
            (existing[k === "tcs" ? "taxBaselineTcs" : "taxBaselineTds"] ??
              existing[f] ??
              0) + Object.values(ledger).reduce((s, r) => s + (r[k] || 0), 0);
      result.taxBaselineTcs = existing.taxBaselineTcs ?? existing.taxTcs ?? 0;
      result.taxBaselineTds = existing.taxBaselineTds ?? existing.taxTds ?? 0;
    } else {
      result.received = Number(row.received);
      delete result.payoutLedger;
      delete result.payoutBaseline;
      delete result.taxBaselineTcs;
      delete result.taxBaselineTds;
      if (row.tcs !== undefined) result.taxTcs = Number(row.tcs);
      if (row.tds !== undefined) result.taxTds = Number(row.tds);
    }
  }
  if (context.type === "Freight") {
    result.freight = Number(row.freight);
    if (row.billedWeightKg !== undefined)
      result.billedWeightKg = Number(row.billedWeightKg);
  }
  if (context.type === "Returns") {
    result.receipt = String(row.receipt);
    result.delivery = "Returned to warehouse";
  }
  result.source = context.name;
  result.sourceRow = context.rows[0];
  result.evidence = [
    ...(existing?.evidence || []),
    {
      report: context.name,
      source: context.source,
      type: context.type,
      rows: context.rows,
      fields: row,
      date: context.date,
      mode: context.mode || "snapshot",
    },
  ];
  return result;
}

export function planImport(all, state, body, user) {
  const { mapping, rows, type, source, name, mode = "snapshot" } = body,
    index = new Map(all.map((o) => [o.id, o])),
    errors = [],
    groups = new Map(),
    reviews = [];
  const values = new Map(),
    references = new Map();
  for (const o of all) {
    const k = Number(o.value);
    if (!values.has(k)) values.set(k, []);
    values.get(k).push(o);
    if (o.reference) {
      if (!references.has(o.reference)) references.set(o.reference, []);
      references.get(o.reference).push(o);
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const row = Object.fromEntries(
      Object.entries(mapping)
        .filter(([, c]) => c)
        .map(([f, c]) => [
          f,
          typeof rows[i]?.[c] === "string" ? rows[i][c].trim() : rows[i]?.[c],
        ])
        .filter(
          ([f, v]) =>
            v !== undefined &&
            (v !== "" || ["id", "received", "freight", "receipt"].includes(f)),
        ),
    );
    const error = validateRow(row, type);
    if (error) {
      errors.push({ row: i + 2, error });
      continue;
    }
    const id = String(row.id || "").trim(),
      existing = index.get(id);
    if (type !== "Orders" && !existing) {
      if (reviews.length >= 500) {
        errors.push({
          row: i + 2,
          error:
            "More than 500 unmatched rows. Check the order file or column mapping first.",
        });
        break;
      }
      const pool = [
        ...new Map(
          [
            ...(references.get(row.reference) || []),
            ...(values.get(Number(row.value)) || []),
          ].map((o) => [o.id, o]),
        ).values(),
      ].slice(0, 500);
      reviews.push({
        id: crypto.randomUUID(),
        row,
        source,
        type,
        name,
        mode,
        sourceRows: [i + 2],
        status: "Pending",
        date: new Date().toISOString(),
        candidates: matchCandidates(
          row,
          pool,
          state.rates,
          source,
          state.couriers,
        ),
      });
      continue;
    }
    if (groups.has(id)) {
      if (!["Settlement", "COD"].includes(type) || mode !== "transactions") {
        errors.push({
          row: i + 2,
          error:
            "Duplicate order ID. For individual payouts, choose Payout transactions mode.",
        });
        continue;
      }
      const g = groups.get(id);
      g.rows.push(i + 2);
      g.row.received = Number(g.row.received) + Number(row.received);
      for (const k of ["tcs", "tds"])
        if (row[k] !== undefined)
          g.row[k] = Number(g.row[k] || 0) + Number(row[k]);
    } else groups.set(id, { row, rows: [i + 2] });
  }
  const changes = [...groups.entries()].map(([id, g]) =>
    applyPartnerRow(index.get(id), g.row, {
      type,
      source,
      name,
      mode,
      rows: g.rows,
      date: new Date().toISOString(),
    }),
  );
  return { changes, errors, reviews };
}
