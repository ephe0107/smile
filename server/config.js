/* ==========================================================
   Configuration, read once at startup.

   Loading happens here rather than in each module so that a missing or
   malformed setting fails loudly at boot instead of at the first request
   that happens to need it.
   ========================================================== */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");

// Node loads .env natively; no dotenv dependency needed. Real environment
// variables always win, so Render's dashboard values are never overridden
// by a stray file.
if (fs.existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    console.warn(`Could not read .env: ${error.message}`);
  }
}

const isProduction = process.env.NODE_ENV === "production";

function required(name) {
  const value = process.env[name];

  if (!value) {
    // In development a clear message beats a crash; in production a missing
    // secret must stop the deploy rather than silently weaken the app.
    if (isProduction) {
      throw new Error(`${name} must be set in production.`);
    }
    return "";
  }

  return value;
}

const config = {
  isProduction,
  root: ROOT,
  publicDir: path.join(ROOT, "public"),
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",

  databaseUrl: process.env.DATABASE_URL || "",
  appOrigin: (process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ""),
  sessionSecret: required("SESSION_SECRET"),

  mail: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.MAIL_FROM || "Smile Check <noreply@example.com>",
  },

  // Legacy file-backed storage, still used by the import script.
  dataDir: process.env.DATA_DIR || path.join(ROOT, "data"),
  seedDemoData: process.env.SEED_DEMO_DATA !== "false",
};

// Fail fast on the settings that silently degrade security if absent.
function assertProductionConfig() {
  const missing = [];

  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.sessionSecret) missing.push("SESSION_SECRET");
  if (!process.env.APP_ORIGIN) missing.push("APP_ORIGIN");

  if (missing.length && config.isProduction) {
    throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
  }

  return missing;
}

module.exports = { config, assertProductionConfig };
