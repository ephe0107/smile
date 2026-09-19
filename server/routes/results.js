/* ==========================================================
   Saved Smile Check results.

   Reads are scoped to an explicitly supplied clientId. There is no
   "return everything" path: population figures come from /analytics/summary
   as aggregates.
   ========================================================== */

const { query } = require("../db");
const summaryCache = require("../lib/summary-cache");
const { saveResultBody, clientIdQuery } = require("../lib/schemas");

const HISTORY_LIMIT = 100;

const RESULT_COLUMNS = `
  id, client_id, score, risk_level, badge, category_scores, education_scores,
  strongest_habit, weakest_habit, recommendations, report, achievements, trend, completed_at
`;

function rowToResult(row) {
  return {
    id: row.id,
    score: Number(row.score),
    riskLevel: row.risk_level,
    badge: row.badge || {},
    categoryScores: row.category_scores || {},
    educationScores: row.education_scores || {},
    strongestHabit: row.strongest_habit || {},
    weakestHabit: row.weakest_habit || {},
    recommendations: row.recommendations || [],
    report: row.report || [],
    achievements: row.achievements || [],
    trend: row.trend || { previousScore: null, change: 0, direction: "flat" },
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
  };
}

function normalizeHabit(habit = {}) {
  return {
    topic: String(habit.topic || "").trim().slice(0, 120),
    score: Number(habit.score) || 0,
    feedback: String(habit.feedback || "").trim().slice(0, 600),
  };
}

// Progress is measured against this browser's own previous check.
async function buildTrend(clientId, score) {
  if (!clientId) {
    return { previousScore: null, change: 0, direction: "flat" };
  }

  const { rows } = await query(
    "select score from results where client_id = $1 order by completed_at desc limit 1",
    [clientId]
  );

  const previousScore = rows.length ? Number(rows[0].score) : null;
  const change = previousScore === null ? 0 : score - previousScore;

  return {
    previousScore,
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

async function resultRoutes(fastify) {
  fastify.post("/results", { schema: { body: saveResultBody } }, async (request, reply) => {
    const body = request.body;
    const clientId = String(body.clientId || "").trim().slice(0, 64) || null;
    const trend = await buildTrend(clientId, body.score);

    const { rows } = await query(
      `insert into results (
         client_id, score, risk_level, badge, category_scores, education_scores,
         strongest_habit, weakest_habit, recommendations, report, achievements, trend
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning ${RESULT_COLUMNS}`,
      [
        clientId,
        body.score,
        body.riskLevel,
        JSON.stringify({
          name: String(body.badge.name).trim(),
          icon: String(body.badge.icon).trim(),
          message: String(body.badge.message || "").trim(),
        }),
        JSON.stringify(body.categoryScores || {}),
        JSON.stringify(body.educationScores || body.curriculumScores || {}),
        JSON.stringify(normalizeHabit(body.strongestHabit)),
        JSON.stringify(normalizeHabit(body.weakestHabit)),
        JSON.stringify(body.recommendations.map((item) => String(item).trim()).filter(Boolean)),
        JSON.stringify(
          body.report.map((item) => ({
            category: String(item.category || "").trim(),
            score: Number(item.score) || 0,
            explanation: String(item.explanation || "").trim(),
          }))
        ),
        JSON.stringify(
          body.achievements.map((item) => ({
            name: String(item.name || "").trim(),
            icon: String(item.icon || "").trim(),
            description: String(item.description || "").trim(),
            unlocked: Boolean(item.unlocked),
          }))
        ),
        JSON.stringify(trend),
      ]
    );

    summaryCache.invalidate();
    return reply.code(201).send({ result: rowToResult(rows[0]) });
  });

  fastify.get("/results", { schema: { querystring: clientIdQuery } }, async (request) => {
    const { rows } = await query(
      `select ${RESULT_COLUMNS} from results
       where client_id = $1
       order by completed_at desc
       limit ${HISTORY_LIMIT}`,
      [request.query.clientId]
    );

    return { results: rows.map(rowToResult) };
  });
}

module.exports = { resultRoutes, rowToResult };
