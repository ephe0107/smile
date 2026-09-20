/* ==========================================================
   Sessions.

   Opaque random tokens in an HttpOnly cookie, stored server-side as a hash.

   Not JWTs, on purpose. A JWT cannot be revoked without building the same
   server-side table anyway, and the usual place people put one -- localStorage
   -- is readable by any injected script. A cookie the page's own JavaScript
   cannot read, backed by a row that can be deleted, is both simpler and
   strictly safer for health-related data.
   ========================================================== */

const crypto = require("crypto");

const { query } = require("../db");
const { config } = require("../config");

const SESSION_COOKIE = "smile_session";

// Two clocks: a sliding one that signs out an abandoned session, and a hard
// ceiling that a long-lived stolen token cannot outrun.
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

// Only refresh last_seen_at when it is meaningfully stale, so ordinary
// browsing does not write a row on every request.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest();
}

function cookieOptions(maxAgeMs = IDLE_MS) {
  return {
    httpOnly: true, // page scripts cannot read it, so an XSS cannot exfiltrate it
    sameSite: "lax", // blocks cross-site POSTs from carrying it
    secure: config.isProduction, // localhost is http, production is not
    path: "/",
    signed: true,
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

async function createSession(userId) {
  const token = generateSessionToken();
  const now = Date.now();

  await query(
    `insert into sessions (user_id, token_hash, idle_expires_at, absolute_expires_at)
     values ($1, $2, $3, $4)`,
    [userId, hashSessionToken(token), new Date(now + IDLE_MS), new Date(now + ABSOLUTE_MS)]
  );

  return { token, maxAgeMs: IDLE_MS };
}

// Returns the signed-in user, or null. Expiry is enforced in the query rather
// than in JavaScript so a clock-skewed app server cannot accept a dead session.
async function readSession(token) {
  if (!token) return null;

  const { rows } = await query(
    `select s.id as session_id, s.last_seen_at, u.id, u.email, u.display_name, u.role,
            u.age_confirmed_at, u.email_verified_at, u.created_at
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.idle_expires_at > now()
       and s.absolute_expires_at > now()`,
    [hashSessionToken(token)]
  );

  if (!rows.length) return null;
  const row = rows[0];

  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    // Slide the idle window, never past the absolute ceiling.
    await query(
      `update sessions
       set last_seen_at = now(),
           idle_expires_at = least(now() + $2::interval, absolute_expires_at)
       where id = $1`,
      [row.session_id, `${Math.floor(IDLE_MS / 1000)} seconds`]
    );
  }

  return {
    sessionId: row.session_id,
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    ageConfirmedAt: row.age_confirmed_at,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
  };
}

async function revokeSession(token) {
  if (!token) return;
  await query("update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [
    hashSessionToken(token),
  ]);
}

async function revokeAllSessions(userId) {
  const { rowCount } = await query(
    "update sessions set revoked_at = now() where user_id = $1 and revoked_at is null",
    [userId]
  );
  return rowCount;
}

// Expired rows carry no live credential, but they are still a record of when
// someone was using the site. Sweeping them is both hygiene and data minimization.
async function cleanupExpired() {
  const sessions = await query(
    "delete from sessions where absolute_expires_at < now() or (revoked_at is not null and revoked_at < now() - interval '7 days')"
  );
  const tokens = await query(
    "delete from login_tokens where expires_at < now() - interval '1 day'"
  );

  return { sessions: sessions.rowCount, loginTokens: tokens.rowCount };
}

module.exports = {
  SESSION_COOKIE,
  IDLE_MS,
  ABSOLUTE_MS,
  generateSessionToken,
  hashSessionToken,
  cookieOptions,
  createSession,
  readSession,
  revokeSession,
  revokeAllSessions,
  cleanupExpired,
};
