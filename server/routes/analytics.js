/* ==========================================================
   Aggregate population figures.

   The only endpoint the dashboards call. Returns counts, averages, and
   distributions -- never a record.
   ========================================================== */

const { rawResultStats, rawEngagementStats } = require("../db/analytics");
const { assembleSummary, MIN_COHORT } = require("../lib/analytics-summary");
const summaryCache = require("../lib/summary-cache");

async function analyticsRoutes(fastify) {
  fastify.get("/analytics/summary", async (request, reply) => {
    let payload = summaryCache.read();

    if (!payload) {
      const [results, engagement] = await Promise.all([rawResultStats(), rawEngagementStats()]);
      payload = summaryCache.write(assembleSummary(results, engagement, MIN_COHORT));
    }

    // Aggregates are not secret, but they are not worth a stale CDN copy
    // either; let the browser reuse one for the cache window and no longer.
    reply.header("Cache-Control", `public, max-age=${Math.floor(summaryCache.CACHE_MS / 1000)}`);
    return payload;
  });
}

module.exports = { analyticsRoutes };
