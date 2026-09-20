/* ==========================================================
   Sign-in, sign-out, and the account's own data.

   The flow: request a code by email, type it back, get a session cookie.
   No password is ever created, stored, reset, or breached.
   ========================================================== */

const { query, withTransaction } = require("../db");
const {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  expiryFromNow,
  isWellFormedCode,
  normalizeEmail,
  looksLikeEmail,
} = require("./tokens");
const {
  SESSION_COOKIE,
  createSession,
  cookieOptions,
  revokeSession,
  revokeAllSessions,
} = require("./session");
const { sendSignInCode } = require("./email");
const { loadUser, requireSession } = require("./guard");

// Accounts are for 13 and over. Under that, the app still works in full --
// it just stays anonymous and local, which avoids holding a younger child's
// data at all rather than trying to manage consent for it.
const MINIMUM_AGE = 13;

const requestCodeBody = {
  type: "object",
  required: ["email", "ageConfirmed"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    ageConfirmed: { type: "boolean" },
    displayName: { type: "string", maxLength: 60 },
  },
};

const verifyCodeBody = {
  type: "object",
  required: ["email", "code"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    code: { type: "string", minLength: 4, maxLength: 12 },
  },
};

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? user.display_name ?? null,
    role: user.role,
    createdAt: user.createdAt ?? user.created_at,
  };
}

async function findOrCreateUser(email, displayName) {
  return withTransaction(async (client) => {
    const existing = await client.query("select id, email, display_name, role, created_at from users where email = $1", [
      email,
    ]);

    if (existing.rows.length) return existing.rows[0];

    const created = await client.query(
      `insert into users (email, display_name, age_confirmed_at)
       values ($1, $2, now())
       returning id, email, display_name, role, created_at`,
      [email, displayName || null]
    );

    // The identity row is what makes adding Google or a school SSO additive
    // later: same user_id, different provider.
    await client.query(
      `insert into identities (user_id, provider, provider_subject)
       values ($1, 'email', $2)
       on conflict (provider, provider_subject) do nothing`,
      [created.rows[0].id, email]
    );

    return created.rows[0];
  });
}

async function authRoutes(fastify) {
  // Sign-in attempts are rate limited far harder than ordinary browsing:
  // this is the endpoint worth attacking.
  const authLimit = {
    rateLimit: { max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10), timeWindow: "10 minutes" },
  };

  fastify.post(
    "/auth/request-code",
    { schema: { body: requestCodeBody }, config: authLimit },
    async (request, reply) => {
      const email = normalizeEmail(request.body.email);

      if (!looksLikeEmail(email)) {
        return reply.code(400).send({ error: "That does not look like an email address." });
      }

      if (request.body.ageConfirmed !== true) {
        return reply.code(400).send({
          error: `Accounts are for ages ${MINIMUM_AGE} and up. You can keep using the Smile Check without one.`,
        });
      }

      const user = await findOrCreateUser(email, request.body.displayName);
      const code = generateCode();

      // Any earlier unused code stops working the moment a new one is sent,
      // so a code read over someone's shoulder has a short life.
      await query(
        "update login_tokens set consumed_at = now() where user_id = $1 and purpose = 'sign_in' and consumed_at is null",
        [user.id]
      );

      await query(
        `insert into login_tokens (user_id, token_hash, purpose, expires_at)
         values ($1, $2, 'sign_in', $3)`,
        [user.id, hashCode(user.id, code), expiryFromNow()]
      );

      try {
        await sendSignInCode(email, code, { ttlMs: CODE_TTL_MS });
      } catch (error) {
        request.log.error({ err: error }, "sign-in code could not be sent");
        return reply.code(502).send({ error: "We could not send the email just now. Please try again." });
      }

      // Always the same answer, whether or not that address has an account.
      // Otherwise this endpoint becomes a way to ask "is this person a user?"
      return {
        message: "If that address can receive mail, a sign-in code is on its way.",
        expiresInMinutes: Math.round(CODE_TTL_MS / 60000),
      };
    }
  );

  fastify.post(
    "/auth/verify-code",
    { schema: { body: verifyCodeBody }, config: authLimit },
    async (request, reply) => {
      const email = normalizeEmail(request.body.email);
      const code = String(request.body.code).trim();

      // One message for every failure below. Distinguishing "no such account"
      // from "wrong code" would leak which addresses are registered.
      const refuse = () => reply.code(401).send({ error: "That code is not valid. Request a new one." });

      if (!looksLikeEmail(email) || !isWellFormedCode(code)) return refuse();

      const users = await query("select id, email, display_name, role, created_at from users where email = $1", [email]);
      if (!users.rows.length) return refuse();

      const user = users.rows[0];

      const tokens = await query(
        `select id, attempts, expires_at from login_tokens
         where user_id = $1 and purpose = 'sign_in' and consumed_at is null
         order by created_at desc
         limit 1`,
        [user.id]
      );

      if (!tokens.rows.length) return refuse();
      const token = tokens.rows[0];

      if (new Date(token.expires_at).getTime() <= Date.now()) return refuse();

      if (token.attempts >= MAX_ATTEMPTS) {
        await query("update login_tokens set consumed_at = now() where id = $1", [token.id]);
        return refuse();
      }

      // Matching by hash rather than comparing strings: there is no plaintext
      // code on the server to compare against, and no timing signal to read.
      const matched = await query(
        "select id from login_tokens where id = $1 and token_hash = $2 and consumed_at is null",
        [token.id, hashCode(user.id, code)]
      );

      if (!matched.rows.length) {
        await query("update login_tokens set attempts = attempts + 1 where id = $1", [token.id]);
        return refuse();
      }

      // Single use, marked before the session exists so a replay cannot race it.
      const consumed = await query(
        "update login_tokens set consumed_at = now() where id = $1 and consumed_at is null returning id",
        [token.id]
      );
      if (!consumed.rows.length) return refuse();

      await query(
        `update users
         set email_verified_at = coalesce(email_verified_at, now()),
             age_confirmed_at = coalesce(age_confirmed_at, now()),
             updated_at = now()
         where id = $1`,
        [user.id]
      );

      const { token: sessionToken, maxAgeMs } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, sessionToken, cookieOptions(maxAgeMs));

      return { user: publicUser(user) };
    }
  );

  fastify.post("/auth/logout", async (request, reply) => {
    await loadUser(request);
    await revokeSession(request.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { message: "Signed out." };
  });

  fastify.post("/auth/logout-all", { preHandler: requireSession }, async (request, reply) => {
    const revoked = await revokeAllSessions(request.user.id);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { message: "Signed out on every device.", sessions: revoked };
  });

  // Tells the page whether to show "Sign in" or the account menu. Public on
  // purpose: signed out is a valid answer, not an error.
  fastify.get("/auth/me", async (request) => {
    const user = await loadUser(request);
    return { user: user ? publicUser(user) : null };
  });
}

module.exports = { authRoutes, publicUser, MINIMUM_AGE };
