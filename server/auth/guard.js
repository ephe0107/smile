/* ==========================================================
   Reading the session off a request.

   Plain functions rather than Fastify decorators: a decorator registered
   inside a route plugin is encapsulated to that plugin, which already cost
   us one bug in this project.
   ========================================================== */

const { readSession, SESSION_COOKIE } = require("./session");

function readSessionToken(request) {
  const raw = request.cookies?.[SESSION_COOKIE];
  if (!raw) return null;

  // The cookie is signed, so a tampered or forged value is rejected here
  // rather than becoming a database lookup.
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

// Attaches request.user (or null). Safe to call on public routes that merely
// want to know whether someone is signed in.
async function loadUser(request) {
  if (request.user !== undefined) return request.user;

  const token = readSessionToken(request);
  request.sessionToken = token;
  request.user = token ? await readSession(token) : null;

  return request.user;
}

// preHandler for routes that require an account.
async function requireSession(request, reply) {
  const user = await loadUser(request);

  if (!user) {
    reply.code(401).send({ error: "Please sign in to continue." });
  }
}

// preHandler for routes that require an admin account.
async function requireAdminUser(request, reply) {
  const user = await loadUser(request);

  if (!user) {
    reply.code(401).send({ error: "Please sign in to continue." });
    return;
  }

  if (user.role !== "admin") {
    // Deliberately the same shape as any other refusal: an admin-only route
    // should not confirm to a signed-in stranger that it exists for someone.
    reply.code(403).send({ error: "You do not have access to that." });
  }
}

module.exports = { loadUser, requireSession, requireAdminUser, readSessionToken };
