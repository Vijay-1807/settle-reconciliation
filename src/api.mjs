import {
  seed,
  reconcileAll,
  summary,
  fields,
  suggestMapping,
  validateRow,
  channels,
} from "./engine.mjs";
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const attempts = new Map();
async function setting(db) {
  const row = await db
    .prepare("SELECT data FROM settings WHERE id = ?")
    .bind("workspace")
    .first();
  return row ? JSON.parse(row.data) : null;
}
async function save(db, state) {
  await db
    .prepare(
      "INSERT INTO settings (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .bind("workspace", JSON.stringify(state))
    .run();
}
async function writeOrders(db, orders) {
  const statements = [];
  for (let i = 0; i < orders.length; i += 500)
    statements.push(
      db
        .prepare(
          "INSERT INTO orders (id,data) SELECT json_extract(value,'$.id'), value FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
        .bind(JSON.stringify(orders.slice(i, i + 500))),
    );
  for (let i = 0; i < statements.length; i += 20)
    await db.batch(statements.slice(i, i + 20));
}
async function readOrders(db) {
  const { results } = await db
    .prepare("SELECT data FROM orders ORDER BY id")
    .all();
  return results.map((o) => JSON.parse(o.data));
}
async function init(db) {
  let state = await setting(db);
  if (!state) {
    const { orders, ...config } = seed();
    await writeOrders(db, orders);
    await save(db, config);
    state = config;
  }
  return state;
}
export async function api(request, env) {
  try {
    const db = env.DB,
      url = new URL(request.url),
      path = url.pathname.replace("/api/", "");
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        throw fail("Origin not allowed", 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw fail("JSON request required", 415);
    }
    if (path === "login" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "local",
        a = attempts.get(ip) || { count: 0, time: Date.now() };
      if (Date.now() - a.time > 60000) {
        a.count = 0;
        a.time = Date.now();
      }
      a.count++;
      attempts.set(ip, a);
      if (a.count > 15)
        throw fail("Too many attempts. Try again in a minute.", 429);
      const { email, password } = await request.json();
      const role =
        email === "founder@demo.settle"
          ? "co-founder"
          : email === "finance@demo.settle"
            ? "finance executive"
            : null;
      if (!role || password !== "demo-settle")
        throw fail("Email or password is incorrect", 401);
      const id = crypto.randomUUID(),
        user = {
          email,
          role,
          name: role === "co-founder" ? "Ananya Rao" : "Vijay B",
          id,
        };
      await db
        .prepare("INSERT INTO sessions (id,data,expires) VALUES (?,?,?)")
        .bind(id, JSON.stringify(user), Date.now() + 86400000)
        .run();
      return json({ user }, 200, {
        "Set-Cookie": `settle_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
      });
    }
    const sid = request.headers
      .get("cookie")
      ?.match(/settle_session=([a-f0-9-]+)/)?.[1];
    const session = sid
      ? await db
          .prepare("SELECT data FROM sessions WHERE id = ? AND expires > ?")
          .bind(sid, Date.now())
          .first()
      : null;
    if (!session) throw fail("Please sign in to your workspace", 401);
    const user = JSON.parse(session.data);
    if (path === "logout") {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "settle_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    const state = await init(db);
    if (path === "state" && request.method === "GET") {
      const all = reconcileAll(await readOrders(db), state.rates);
      return json({ ...state, user, orders: all, summary: summary(all) });
    }
    if (request.method !== "POST") throw fail("Not found", 404);
    const bodyText = await request.text();
    if (bodyText.length > 35e6)
      throw fail("File is too large. Maximum 25 MB.", 413);
    const body = JSON.parse(bodyText);
    if (["rates", "rollback"].includes(path) && user.role !== "co-founder")
      throw fail(
        "Only the co-founder can change rate cards or roll back mappings",
        403,
      );
    if (path === "suggest") {
      if (
        !Array.isArray(body.headers) ||
        body.headers.length > 150 ||
        body.headers.some((h) => typeof h !== "string" || h.length > 200) ||
        !fields[body.type]
      )
        throw fail("Invalid file headers");
      return json({
        suggestions: suggestMapping(body.headers, body.type, state.mappings),
        provider: "Local n-gram nearest-neighbour model",
        notice:
          "Similarity scores are not probabilities. Review and approve before import.",
      });
    }
    if (path === "import") {
      const { type, source, mapping, rows, name } = body;
      if (
        !fields[type] ||
        !Array.isArray(rows) ||
        !rows.length ||
        rows.length > 100000
      )
        throw fail("Upload between 1 and 100,000 rows");
      if (
        typeof source !== "string" ||
        source.length > 100 ||
        typeof name !== "string" ||
        !name ||
        !mapping ||
        fields[type].some((f) => !mapping[f]) ||
        Object.keys(mapping).some((f) => !fields[type].includes(f))
      )
        throw fail("Map only the required fields before importing");
      const all = await readOrders(db),
        index = new Map(all.map((o) => [o.id, o])),
        errors = [],
        changes = [],
        seen = new Set();
      for (let i = 0; i < rows.length; i++) {
        const row = Object.fromEntries(
          Object.entries(mapping).map(([f, c]) => [f, rows[i][c]]),
        );
        const error = validateRow(row, type);
        if (error || seen.has(String(row.id))) {
          errors.push({
            row: i + 2,
            error: error || "Duplicate order ID in this file",
          });
          continue;
        }
        seen.add(String(row.id));
        let existing = index.get(String(row.id));
        if (type !== "Orders" && !existing) {
          errors.push({
            row: i + 2,
            error: "Order not found. Upload the order file first.",
          });
          continue;
        }
        const o =
          type === "Orders"
            ? {
                ...existing,
                ...row,
                id: String(row.id),
                value: Number(row.value),
                received: existing?.received || 0,
                freight: existing?.freight || 60,
                receipt: existing?.receipt || "",
                claim: existing?.claim || "Open",
              }
            : {
                ...existing,
                ...Object.fromEntries(
                  Object.entries(row).map(([k, v]) => [
                    k,
                    ["received", "freight"].includes(k) ? Number(v) : String(v),
                  ]),
                ),
              };
        o.source = String(name).slice(0, 150);
        o.sourceRow = i + 2;
        index.set(o.id, o);
        changes.push(o);
      }
      if (errors.length)
        return json(
          {
            error: `${errors.length} rows need attention. Nothing was imported.`,
            errors: errors.slice(0, 50),
          },
          422,
        );
      await writeOrders(db, changes);
      state.mappings.push({
        id: crypto.randomUUID(),
        source,
        type,
        mapping,
        headers: Object.values(mapping),
        version:
          state.mappings.filter((m) => m.source === source && m.type === type)
            .length + 1,
        date: new Date().toISOString(),
        approvedBy: user.name,
      });
      state.uploads.unshift({
        id: crypto.randomUUID(),
        name: String(name).slice(0, 150),
        source,
        type,
        rows: changes.length,
        date: new Date().toISOString(),
        status: "Completed",
      });
      state.audit.unshift({
        action: `Imported ${changes.length} ${type.toLowerCase()} rows`,
        by: user.name,
        date: new Date().toISOString(),
      });
      await save(db, state);
      return json({ imported: changes.length });
    }
    if (path === "rates") {
      if (
        !Array.isArray(body.rates) ||
        body.rates.length !== channels.length ||
        new Set(body.rates.map((r) => r.channel)).size !== channels.length
      )
        throw fail("Supply a rate card for each channel");
      for (const r of body.rates) {
        if (
          !channels.includes(r.channel) ||
          [
            "commission",
            "fee",
            "freight",
            "returnFee",
            "tcs",
            "tds",
            "dueDays",
            "returnDays",
          ].some((f) => !Number.isFinite(Number(r[f])) || Number(r[f]) < 0) ||
          r.commission > 100 ||
          r.tcs > 100 ||
          r.tds > 100
        )
          throw fail(
            "Rates must be valid non-negative numbers; percentages cannot exceed 100",
          );
      }
      state.rates = body.rates;
      state.audit.unshift({
        action: "Updated rate cards",
        by: user.name,
        date: new Date().toISOString(),
      });
      await save(db, state);
      return json({ ok: true });
    }
    if (path === "claim") {
      if (
        !["Open", "In progress", "Recovered", "Rejected"].includes(
          body.status,
        ) ||
        !Array.isArray(body.ids) ||
        body.ids.length > 100000
      )
        throw fail("Invalid claim update");
      const index = new Set(body.ids);
      const changed = (await readOrders(db))
        .filter((o) => index.has(o.id))
        .map((o) => ({ ...o, claim: body.status }));
      await writeOrders(db, changed);
      state.audit.unshift({
        action: `${changed.length} claims marked ${body.status}`,
        by: user.name,
        date: new Date().toISOString(),
      });
      await save(db, state);
      return json({ updated: changed.length });
    }
    if (path === "receipt") {
      const o = (await readOrders(db)).find((o) => o.id === body.id);
      if (!o || !String(body.receipt || "").trim())
        throw fail("Order and receipt scan are required");
      o.receipt = String(body.receipt).slice(0, 100);
      o.delivery = "Returned to warehouse";
      await writeOrders(db, [o]);
      return json({ ok: true });
    }
    if (path === "rollback") {
      const m = state.mappings.find((m) => m.id === body.id);
      if (!m) throw fail("Mapping not found");
      state.mappings.push({
        ...m,
        id: crypto.randomUUID(),
        version:
          state.mappings.filter(
            (x) => x.source === m.source && x.type === m.type,
          ).length + 1,
        date: new Date().toISOString(),
        approvedBy: user.name,
      });
      await save(db, state);
      return json({ ok: true });
    }
    throw fail("Not found", 404);
  } catch (error) {
    return json(
      {
        error: error.status
          ? error.message
          : "Request could not be completed. Check the file and try again.",
      },
      error.status || 500,
    );
  }
}
