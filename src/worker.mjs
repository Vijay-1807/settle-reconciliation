import { api } from "./api.mjs";
import assets from "./assets.generated.mjs";
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) return api(request, env);
    const key = path === "/" ? "/index.html" : path;
    if (!(key in assets)) return new Response("Not found", { status: 404 });
    const font = key.endsWith(".woff2");
    return new Response(
      font
        ? Uint8Array.from(atob(assets[key]), (c) => c.charCodeAt(0))
        : assets[key],
      {
        headers: {
          "Content-Type": font
            ? "font/woff2"
            : key.endsWith(".css")
              ? "text/css"
              : key.endsWith(".js")
                ? "text/javascript"
                : key.endsWith(".csv")
                  ? "text/csv"
                  : "text/html",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "same-origin",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
        },
      },
    );
  },
};
