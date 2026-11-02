import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { api } from "./api.mjs";
mkdirSync(".data", { recursive: true });
const sqlite = new DatabaseSync(".data/settle.sqlite");
sqlite.exec(readFileSync("drizzle/0000_workspace.sql", "utf8"));
const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...values) {
        args = values;
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
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      sqlite.exec("COMMIT");
      return out;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".csv": "text/csv",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    let response;
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 35e6) {
          res.writeHead(413);
          res.end("File too large");
          return;
        }
        chunks.push(c);
      }
      response = await api(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(req.method === "GET" ? {} : { body: Buffer.concat(chunks) }),
        }),
        { DB },
      );
    } else {
      let path = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = resolve("public", "." + path);
      if (!file.startsWith(resolve("public") + sep))
        throw Error("Invalid path");
      try {
        response = new Response(readFileSync(file), {
          headers: {
            "Content-Type": mime[extname(file)] || "application/octet-stream",
          },
        });
      } catch {
        response = new Response("Not found", { status: 404 });
      }
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end("Server error");
  }
}).listen(3000, "127.0.0.1", () =>
  console.log("Settle ready at http://localhost:3000"),
);
