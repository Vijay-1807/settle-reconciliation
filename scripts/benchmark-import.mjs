import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import * as XLSX from "xlsx";
import { api } from "../src/api.mjs";
import { reconcileAll, summary, seed } from "../src/engine.mjs";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync("drizzle/0000_workspace.sql", "utf8"));
const DB = {
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
const call = (path, body, cookie) =>
  api(
    new Request("http://localhost/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { DB },
  );
const login = await call("login", {
    email: "finance@demo.settle",
    password: "demo-settle",
  }),
  cookie = login.headers.get("set-cookie").split(";")[0];
await call("state", undefined, cookie);
const csv =
  "Order ID,Channel,Value,Payment,Delivery Status,Date,Partner\n" +
  Array.from(
    { length: 100000 },
    (_, i) => `PERF-${i},Website,1499,COD,Delivered,2026-10-18,Courier Alpha`,
  ).join("\n");
const start = performance.now();
const book = XLSX.read(csv, { type: "string" }),
  rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
    raw: false,
  });
const parsed = performance.now();
const response = await call(
  "import",
  {
    type: "Orders",
    source: "Website",
    name: "benchmark-100k.csv",
    mapping: {
      id: "Order ID",
      channel: "Channel",
      value: "Value",
      payment: "Payment",
      delivery: "Delivery Status",
      date: "Date",
      partner: "Partner",
    },
    rows,
  },
  cookie,
);
if (response.status !== 200) throw Error(await response.text());
const stored = performance.now();
const all = sqlite
  .prepare("SELECT data FROM orders WHERE id LIKE 'PERF-%'")
  .all()
  .map((r) => JSON.parse(r.data));
const result = reconcileAll(all, seed().rates);
summary(result);
const elapsed = performance.now() - start;
const report = {
  rows: rows.length,
  parsedMs: Math.round(parsed - start),
  validatedAndPersistedMs: Math.round(stored - parsed),
  totalMs: Math.round(elapsed),
  underOneMinute: elapsed < 60000,
  scope:
    "Local CSV parse, API validation, in-memory SQLite persistence, reconciliation and summary. Excludes HTTP network and browser rendering.",
  runtime: process.version,
};
writeFileSync(
  "benchmark-import-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
sqlite.close();
if (!report.underOneMinute) process.exitCode = 1;
