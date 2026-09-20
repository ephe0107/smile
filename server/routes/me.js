/* ==========================================================
   The signed-in user's own data.

   Every query here is scoped by request.user.id, which comes from a signed
   cookie the page cannot read or forge. No route takes an identifier from
   the client and trusts it -- that was the flaw in the clientId design these
   routes replace.
   ========================================================== */

const { query } = require("../db");
const summaryCache = require("../lib/summary-cache");
const { saveResultBody } = require("../lib/schemas");
const { requireSession } = require("../auth/guard");
const { revokeAllSessions, SESSION_COOKIE } = require("../auth/session");
const { rowToResult } = require("./results");

const HISTORY_LIMIT = 200;

const RESULT_COLUMNS = `
  id, client_id, score, risk_level, badge, category_scores, education_scores,
  strongest_habit, weakest_habit, recommendations, report, achievements, trend, completed_at
`;

function normalizeHabit(habit = {}) {
  return {
    topic: String(habit.topic || "").trim().slice(0, 120),
    score: Number(habit.score) || 0,
    feedback: String(habit.feedback || "").trim().slice(0, 600),
  };
}

// Progress is measured against this user's own previous check, on any device.
// That is the thing an account buys over the old per-browser history.
async function buildTrend(userId, score) {
  const { rows } = await query(
    "select score from results where user_id = $1 order by completed_at desc limit 1",
    [userId]
  );

  const previousScore = rows.length ? Number(rows[0].score) : null;
  const change = previousScore === null ? 0 : score - previousScore;

  return {
    previousScore,
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

async function meRoutes(fastify) {
  fastify.get("/me/results", { preHandler: requireSession }, async (request) => {
    const { rows } = await query(
      `select ${RESULT_COLUMNS} from results
       where user_id = $1
       order by completed_at desc
       limit ${HISTORY_LIMIT}`,
      [request.user.id]
    );

    return { results: rows.map(rowToResult) };
  });

  fastify.post(
    "/me/results",
    { preHandler: requireSession, schema: { body: saveResultBody } },
    async (request, reply) => {
      const body = request.body;
      const trend = await buildTrend(request.user.id, body.score);

      const { rows } = await query(
        `insert into results (
           user_id, score, risk_level, badge, category_scores, education_scores,
           strongest_habit, weakest_habit, recommendations, report, achievements, trend
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning ${RESULT_COLUMNS}`,
        [
          request.user.id,
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
    }
  );

  // Everything held about this person, in one file. A privacy promise that
  // cannot be inspected is just a claim.
  fastify.get("/me/export", { preHandler: requireSession }, async (request, reply) => {
    const [results, comments, sessions] = await Promise.all([
      query(`select ${RESULT_COLUMNS} from results where user_id = $1 order by completed_at desc`, [request.user.id]),
      query("select id, display_name, body, status, created_at from comments where user_id = $1", [request.user.id]),
      query(
        `select id, created_at, last_seen_at, absolute_expires_at, revoked_at
         from sessions where user_id = $1 order by created_at desc`,
        [request.user.id]
      ),
    ]);

    reply.header("Content-Disposition", 'attachment; filename="smile-check-my-data.json"');

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: request.user.id,
        email: request.user.email,
        displayName: request.user.displayName,
        createdAt: request.user.createdAt,
      },
      results: results.rows.map(rowToResult),
      comments: comments.rows,
      sessions: sessions.rows,
      note:
        "Education engagement analytics are stored without any link to your account, " +
        "so they cannot be included here and cannot be traced back to you.",
    };
  });

  // Erasure. The foreign keys do the work: results cascade, comments unlink.
  fastify.delete("/me", { preHandler: requireSession }, async (request, reply) => {
    const userId = request.user.id;

    await revokeAllSessions(userId);
    await query("delete from users where id = $1", [userId]);

    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    summaryCache.invalidate();

    return { message: "Your account and saved results have been deleted." };
  });
}

module.exports = { meRoutes };
