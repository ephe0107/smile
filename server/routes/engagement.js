/* ==========================================================
   Anonymous education engagement and explorer telemetry.

   Neither table has an identity column and neither ever gains one. These
   events describe what parts of the site get used, which is a property of
   the site. Joined to an account they would instead be a behavioural
   profile of a named minor.
   ========================================================== */

const { query } = require("../db");
const summaryCache = require("../lib/summary-cache");
const { engagementEventBody, explorerEventBody } = require("../lib/schemas");

async function engagementRoutes(fastify) {
  fastify.post("/engagement-analytics", { schema: { body: engagementEventBody } }, async (request, reply) => {
    const { type, section, detail, value } = request.body;

    const { rows } = await query(
      `insert into engagement_events (type, section, detail, value)
       values ($1, $2, $3, $4)
       returning id, type, section, detail, value, created_at`,
      [
        type.trim(),
        section ? section.trim() : null,
        detail ? detail.trim() : null,
        value === undefined || value === null ? null : JSON.stringify(value),
      ]
    );

    summaryCache.invalidate();

    const row = rows[0];
    return reply.code(201).send({
      event: {
        id: row.id,
        type: row.type,
        section: row.section,
        detail: row.detail,
        value: row.value,
        createdAt: row.created_at,
      },
    });
  });

  fastify.post("/explorer-analytics", { schema: { body: explorerEventBody } }, async (request, reply) => {
    const { type, age, toothId, toothName, status } = request.body;

    const { rows } = await query(
      `insert into explorer_events (type, age, tooth_id, tooth_name, status)
       values ($1, $2, $3, $4, $5)
       returning id, type, age, tooth_id, tooth_name, status, created_at`,
      [type, age, toothId || null, toothName || null, status || null]
    );

    const row = rows[0];
    return reply.code(201).send({
      event: {
        id: row.id,
        type: row.type,
        age: row.age,
        toothId: row.tooth_id,
        toothName: row.tooth_name,
        status: row.status,
        createdAt: row.created_at,
      },
    });
  });
}

module.exports = { engagementRoutes };
