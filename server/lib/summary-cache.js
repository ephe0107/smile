/* ==========================================================
   In-process cache for the analytics summary.

   A plain module rather than a Fastify decorator: decorating inside a route
   plugin only reaches that plugin's encapsulated context, so the routes that
   need to invalidate the cache could not see it.

   Each instance caches independently. That is correct for a 60-second TTL --
   the figures are aggregates, and two instances briefly disagreeing by one
   result does not matter.
   ========================================================== */

const CACHE_MS = Number(process.env.ANALYTICS_CACHE_MS || 60_000);

let cache = { expiresAt: 0, payload: null };

function read() {
  if (!cache.payload || cache.expiresAt <= Date.now()) return null;
  return cache.payload;
}

function write(payload) {
  cache = { expiresAt: Date.now() + CACHE_MS, payload };
  return payload;
}

// Called after any write that changes the figures. Purely in-memory, so it
// cannot throw and cannot fail a request that has already been committed.
function invalidate() {
  cache = { expiresAt: 0, payload: null };
}

module.exports = { read, write, invalidate, CACHE_MS };
