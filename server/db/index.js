/* ==========================================================
   Postgres connection pool.

   Uses the pooled connection string (Neon's -pooler host) so several app
   instances can run without exhausting backend connections. Keep max small:
   the pooler multiplexes, the app does not need a large local pool.
   ========================================================== */

const { Pool } = require("pg");

require("../config"); // loads .env before DATABASE_URL is read

let pool = null;

function connectionString() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance."
    );
  }

  return url;
}

function getPool() {
  if (pool) return pool;

  const url = connectionString();
  // Neon and most managed providers require TLS. A local docker Postgres does
  // not have a certificate, so only demand TLS when talking to a remote host.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

  pool = new Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocal ? false : { rejectUnauthorized: true },
  });

  // A pool error with no listener takes the process down. Log and let the
  // pool replace the connection instead.
  pool.on("error", (error) => {
    console.error(`Postgres pool error: ${error.message}`);
  });

  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

// Runs fn inside a transaction, rolling back on any throw.
async function withTransaction(fn) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const { rows } = await query("select 1 as ok");
  return rows[0]?.ok === 1;
}

async function closePool() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}

module.exports = { getPool, query, withTransaction, healthCheck, closePool };
