import { Hono } from "hono";
import { serveStatic } from "hono/deno";

const app = new Hono();

// Baseline security headers. Keep CSP out of this layer until the built SPA's
// script/style/connect requirements have been verified; a broken CSP is worse
// than pretending we have one.
app.use("*", async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
});

// Explicit liveness endpoint for deployment/load-balancer checks.
app.get("/healthz", (c) => c.json({ ok: true }));

// Serve static assets from the production Vite build.
app.use("/assets/*", serveStatic({ root: "./dist/assets" }));
app.use("*", serveStatic({ root: "./dist" }));

// SPA fallback. Keep this last so real files and API/health routes win first.
app.get("*", serveStatic({ path: "./dist/index.html" }));

Deno.serve(app.fetch);
