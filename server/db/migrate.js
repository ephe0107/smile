/* ==========================================================
   Migration runner.

   Applies every .sql file in migrations/ that has not been applied yet, in
   filename order, each inside its own transaction. Re-running is a no-op,
   so it is safe to call on every deploy.

   Run with: npm run migrate
   ========================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getPool, closePool } = require("./index");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename    text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    )
  `);
}

function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      return {
        filename,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex").slice(0, 16),
      };
    });
}

async function migrate({ logger = console } = {}) {
  const pool = getPool();
  const client = await pool.connect();
  const applied = [];

  try {
    await ensureMigrationsTable(client);

    const { rows } = await client.query("select filename, checksum from schema_migrations");
    const alreadyApplied = new Map(rows.map((row) => [row.filename, row.checksum]));

    for (const migration of readMigrations()) {
      const previousChecksum = alreadyApplied.get(migration.filename);

      if (previousChecksum) {
        // An edited migration means the database and the repo disagree about
        // what the schema is. Fail loudly rather than silently skipping.
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `${migration.filename} was modified after it was applied. ` +
              `Add a new migration instead of editing an applied one.`
          );
        }
        continue;
      }

      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query("insert into schema_migrations (filename, checksum) values ($1, $2)", [
          migration.filename,
          migration.checksum,
        ]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw new Error(`${migration.filename} failed: ${error.message}`);
      }

      applied.push(migration.filename);
      logger.log(`applied ${migration.filename}`);
    }

    if (!applied.length) logger.log("schema is up to date");
    return applied;
  } finally {
    client.release();
  }
}

module.exports = { migrate, readMigrations };

if (require.main === module) {
  migrate()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(`Migration failed: ${error.message}`);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
