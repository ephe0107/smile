/* ==========================================================
   Fastify application.

   Assembles security middleware, static file serving, and the API routes.
   Kept separate from server.js so tests can build an app without binding
   a port.
   ========================================================== */

const path = require("path");

const Fastify = require("fastify");
const helmet = require("@fastify/helmet");
const cookie = require("@fastify/cookie");
const rateLimit = require("@fastify/rate-limit");
const fastifyStatic = require("@fastify/static");

const { config, assertProductionConfig } = require("./config");
const { healthCheck } = require("./db");
const { originGuard } = require("./lib/origin-check");
const { resultRoutes } = require("./routes/results");
const { analyticsRoutes } = require("./routes/analytics");
const { engagementRoutes } = require("./routes/engagement");
const { commentRoutes } = require("./routes/comments");
const { meRoutes } = require("./routes/me");
const { authRoutes } = require("./auth/routes");

// Anything that could carry a credential or a personal detail is stripped
// before a log line is written. Logs get shipped, tailed, and kept far longer
// than anyone intends, so they must not become a second copy of the data.
const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-admin-pin"]',
  'res.headers["set-cookie"]',
  "req.body.email",
  "req.body.code",
];

function buildLoggerOptions() {
  if (process.env.NODE_ENV === "test") return false;

  return {
    level: process.env.LOG_LEVEL || (config.isProduction ? "info" : "warn"),
    redact: { paths: REDACTED_PATHS, remove: true },
    serializers: {
      req(request) {
        return {
          method: request.method,
          // Query strings can carry a clientId; the path alone is enough.
          url: request.url.split("?")[0],
          remoteAddress: request.ip,
        };
      },
    },
  };
}

async function buildApp({ logger } = {}) {
  assertProductionConfig();

  const app = Fastify({
    logger: logger === undefined ? buildLoggerOptions() : logger,
    trustProxy: true, // Render terminates TLS; without this every client IP is the proxy's
    bodyLimit: 256 * 1024,
  });

  // Installed before any route plugin: Fastify copies the parent handler
  // into each child context at registration time, so a handler set after
  // the routes would never see their errors.
  app.setErrorHandler(async (error, request, reply) => {
    const status = error.statusCode || 500;

    // Schema failures describe what the client got wrong and are safe to
    // return. Everything else could name a table or a file path, so the
    // detail stays in the log and the caller gets a generic message.
    if (error.validation) {
      return reply.code(400).send({ error: `Invalid request: ${error.message}` });
    }

    if (status >= 500) {
      request.log.error({ err: error }, "request failed");
      return reply.code(status).send({ error: "Something went wrong. Please try again." });
    }

    return reply.code(status).send({ error: error.message });
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // No inline scripts anywhere in the page, so this stays strict. That
        // is the directive that actually stops injected script from running.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        // The charts set CSS custom properties through style attributes
        // (style="--pct: 72"). Allowing inline style attributes is a far
        // smaller concession than allowing inline script.
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"], // the certificate canvas exports a data: URL
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // Only meaningful over HTTPS, and setting it in development would pin
    // localhost to https in the browser's HSTS store.
    hsts: config.isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false, // would block the Google Fonts stylesheet
  });

  await app.register(cookie, {
    secret: config.sessionSecret,
    parseOptions: { httpOnly: true, sameSite: "lax", secure: config.isProduction, path: "/" },
  });

  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: "1 minute",
    // Only static assets are exempt -- one page load pulls a stylesheet, a
    // script, and several images, which would otherwise spend a visitor's
    // whole budget before they had done anything. Every API route, GET
    // included, stays limited; /auth/* narrows it further in its own config.
    allowList: (request) => request.method === "GET" && /\.[a-z0-9]{2,5}$/i.test(request.url.split("?")[0]),
  });

  // Every state-changing request must prove it came from our own origin.
  app.addHook("onRequest", originGuard(config.appOrigin));

  app.get("/health", async (_request, reply) => {
    try {
      await healthCheck();
      return { status: "ok", database: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "health check failed");
      return reply.code(503).send({ status: "degraded", database: "unavailable" });
    }
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(analyticsRoutes);
  await app.register(resultRoutes);
  await app.register(engagementRoutes);
  await app.register(commentRoutes);

  await app.register(fastifyStatic, {
    root: config.publicDir,
    index: ["index.html"],
    // Fingerprinted assets do not exist here, so let the browser revalidate
    // rather than serve a stale script after a deploy.
    cacheControl: true,
    maxAge: config.isProduction ? 300_000 : 0,
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === "GET" || request.method === "HEAD") {
      return reply.code(404).type("text/plain").send("Not found");
    }
    return reply.code(404).send({ error: "Not found." });
  });


  return app;
}

module.exports = { buildApp };
