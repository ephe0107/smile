/* ==========================================================
   Emailed sign-in codes.

   A 6-digit code typed into the page, rather than a clickable magic link.
   Same passwordless flow, but immune to the two things that break links in
   practice: corporate mail scanners that follow every URL and silently burn
   single-use links, and the very common case of the email arriving on a
   phone while the quiz is open on a laptop.

   Only the hash of a code is ever stored. A database leak therefore hands
   over nothing usable, and there is no plaintext credential anywhere.
   ========================================================== */

const crypto = require("crypto");

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
// Bounds brute force: 5 guesses against a 1-in-a-million code inside a
// 10-minute window.
const MAX_ATTEMPTS = 5;

function generateCode() {
  // randomInt is uniform and cryptographically sourced. Math.random() is
  // neither, and a guessable code is a free login to someone else's account.
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

// The user id is mixed in so that two people holding the same 6-digit code at
// the same moment produce different hashes -- the unique index stays usable,
// and a code is only ever valid for the account it was sent to.
function hashCode(userId, code) {
  return crypto.createHash("sha256").update(`${userId}:${String(code).trim()}`).digest();
}

function expiryFromNow(now = Date.now()) {
  return new Date(now + CODE_TTL_MS);
}

function isWellFormedCode(code) {
  return typeof code === "string" && new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code.trim());
}

// Lowercased and trimmed before it ever reaches the database, so the citext
// column and the hash input agree on what "the same address" means.
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Deliberately permissive. Strict email regexes reject valid addresses; the
// real proof that an address works is that a code sent to it comes back.
function looksLikeEmail(email) {
  const value = normalizeEmail(email);
  return value.length >= 3 && value.length <= 254 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value);
}

module.exports = {
  CODE_LENGTH,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  expiryFromNow,
  isWellFormedCode,
  normalizeEmail,
  looksLikeEmail,
};
