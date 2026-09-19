/* ==========================================================
   20 to 32 Smile Check -- entry point.

   Applies any pending migrations, then starts the HTTP server. The
   application itself is built in server/app.js.
   ========================================================== */

const { config } = require("./server/config");
const { buildApp } = require("./server/app");
const { migrate } = require("./server/db/migrate");
const { closePool } = require("./server/db");

async function start() {
  // Running migrations at boot keeps a deploy to a single step. They are
  // idempotent, so several instances starting at once is safe.
  if (process.env.MIGRATE_ON_START !== "false") {
    await migrate();
  }

  const app = await buildApp();

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`20 to 32 Smile Check is running on port ${config.port}`);

  if (!config.isProduction) {
    console.log(`20 to 32 Smile Check is running at http://localhost:${config.port}`);
  }

  // Finish in-flight requests and release the pool rather than dropping
  // connections when the platform sends a restart signal.
  const shutdown = async (signal) => {
    app.log.info(`${signal} received, shutting down`);
    try {
      await app.close();
      await closePool();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return app;
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error(`Server could not start: ${error.message}`);
    await closePool().catch(() => {});
    process.exit(1);
  });
}

module.exports = { start };
