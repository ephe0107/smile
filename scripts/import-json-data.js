/* ==========================================================
   One-time import: data/*.json -> Postgres.

   Existing records are anonymous and stay that way. This is not history
   claiming -- nothing is attached to an account. It exists so the Analytics
   and Impact dashboards keep their population figures across the move off
   file storage.

   Safe to re-run: every row is inserted by its existing id with
   "on conflict do nothing".

   Run with: node scripts/import-json-data.js
   ========================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { config } = require("../server/config");
const { query, closePool } = require("../server/db");

const CHUNK_SIZE = 200;

function readJsonArray(filename) {
  const filePath = path.join(config.dataDir, filename);

  if (!fs.existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`${filename} is not readable JSON: ${error.message}`);
  }
}

function uuidOr(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : crypto.randomUUID();
}

function timestampOr(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function json(value, fallback) {
  return JSON.stringify(value === undefined || value === null ? fallback : value);
}

// Inserts rows in chunks so a large history does not become one enormous
// statement. Returns how many rows were new.
async function insertChunked(table, columns, rows, toValues) {
  let inserted = 0;

  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const params = [];
    const tuples = chunk.map((row) => {
      const values = toValues(row);
      const placeholders = values.map((_, index) => `$${params.length + index + 1}`);
      params.push(...values);
      return `(${placeholders.join(", ")})`;
    });

    const { rowCount } = await query(
      `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}
       on conflict (id) do nothing`,
      params
    );

    inserted += rowCount;
  }

  return inserted;
}

const RISK_LEVELS = ["Low Risk", "Moderate Risk", "High Risk"];

function importResults() {
  const rows = readJsonArray("results.json").filter((row) => {
    const score = Number(row.score);
    // The table enforces these; drop rather than abort the whole import.
    return Number.isFinite(score) && score >= 0 && score <= 100 && RISK_LEVELS.includes(row.riskLevel);
  });

  return insertChunked(
    "results",
    [
      "id", "client_id", "score", "risk_level", "badge", "category_scores", "education_scores",
      "strongest_habit", "weakest_habit", "recommendations", "report", "achievements", "trend",
      "is_demo", "source", "completed_at",
    ],
    rows,
    (row) => [
      uuidOr(row.id),
      row.clientId || null,
      Math.round(Number(row.score)),
      row.riskLevel,
      json(row.badge, {}),
      json(row.categoryScores, {}),
      json(row.educationScores ?? row.curriculumScores, {}),
      json(row.strongestHabit, {}),
      json(row.weakestHabit, {}),
      json(row.recommendations, []),
      json(row.report, []),
      json(row.achievements, []),
      json(row.trend, {}),
      Boolean(row.isDemo),
      row.source || null,
      timestampOr(row.completedAt),
    ]
  ).then((inserted) => ({ read: rows.length, inserted }));
}

function importEngagement() {
  const rows = readJsonArray("engagement-analytics.json").filter((row) => row && row.type);

  return insertChunked(
    "engagement_events",
    ["id", "type", "section", "detail", "value", "is_demo", "created_at"],
    rows,
    (row) => [
      uuidOr(row.id),
      String(row.type),
      row.section || null,
      row.detail || null,
      row.value === undefined || row.value === null ? null : JSON.stringify(row.value),
      Boolean(row.isDemo),
      timestampOr(row.createdAt),
    ]
  ).then((inserted) => ({ read: rows.length, inserted }));
}

function importExplorer() {
  const rows = readJsonArray("tooth-explorer-analytics.json").filter((row) => {
    const age = Number(row?.age);
    return ["age_lookup", "tooth_interaction"].includes(row?.type) && Number.isInteger(age) && age >= 5 && age <= 18;
  });

  return insertChunked(
    "explorer_events",
    ["id", "type", "age", "tooth_id", "tooth_name", "status", "is_demo", "created_at"],
    rows,
    (row) => [
      uuidOr(row.id),
      row.type,
      Number(row.age),
      row.toothId || null,
      row.toothName || null,
      row.status || null,
      Boolean(row.isDemo),
      timestampOr(row.createdAt),
    ]
  ).then((inserted) => ({ read: rows.length, inserted }));
}

function importComments() {
  const rows = readJsonArray("comments.json").filter((row) => row && row.name && row.comment);

  return insertChunked(
    "comments",
    ["id", "display_name", "body", "status", "created_at", "reviewed_at"],
    rows,
    (row) => [
      uuidOr(row.id),
      String(row.name),
      String(row.comment),
      ["pending", "approved", "rejected"].includes(row.status) ? row.status : "pending",
      timestampOr(row.createdAt),
      row.reviewedAt ? timestampOr(row.reviewedAt) : null,
    ]
  ).then((inserted) => ({ read: rows.length, inserted }));
}

async function importAll({ logger = console } = {}) {
  logger.log(`Reading from ${config.dataDir}`);

  const summary = {
    results: await importResults(),
    engagement: await importEngagement(),
    explorer: await importExplorer(),
    comments: await importComments(),
  };

  Object.entries(summary).forEach(([name, { read, inserted }]) => {
    const skipped = read - inserted;
    logger.log(`${name}: ${inserted} imported${skipped ? `, ${skipped} already present` : ""} (${read} read)`);
  });

  return summary;
}

module.exports = { importAll };

if (require.main === module) {
  importAll()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(`Import failed: ${error.message}`);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
