/* ==========================================================
   Visitor comments, held for moderation.

   Admin access is still a shared PIN here, carried over from the file
   backend. Phase 5 replaces it with a role on a real account; the check is
   isolated in requireAdmin() so that swap touches one function.
   ========================================================== */

const crypto = require("crypto");

const { query } = require("../db");
const { commentBody, moderateCommentBody } = require("../lib/schemas");

const PUBLIC_LIMIT = 12;
const PENDING_LIMIT = 50;

// Compared with a timing-safe equality so the PIN cannot be recovered one
// character at a time by measuring how long the comparison takes.
function pinMatches(supplied, expected) {
  if (!supplied || !expected) return false;

  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function publicComment(row) {
  return {
    id: row.id,
    name: row.display_name,
    comment: row.body,
    createdAt: row.created_at,
  };
}

async function commentRoutes(fastify) {
  const adminPin = process.env.ADMIN_PIN || "";

  async function requireAdmin(request, reply) {
    // With no PIN configured the moderation queue is open. That is only
    // tolerable locally; production must set one.
    if (!adminPin) {
      if (process.env.NODE_ENV === "production") {
        reply.code(503).send({ error: "Moderation is unavailable until ADMIN_PIN is configured." });
        return;
      }
      return;
    }

    if (!pinMatches(request.headers["x-admin-pin"], adminPin)) {
      reply.code(401).send({ error: "Admin approval PIN required." });
    }
  }

  fastify.get("/comments", async () => {
    const { rows } = await query(
      `select id, display_name, body, created_at from comments
       where status = 'approved'
       order by created_at desc
       limit ${PUBLIC_LIMIT}`
    );

    return { comments: rows.map(publicComment) };
  });

  fastify.post("/comments", { schema: { body: commentBody } }, async (request, reply) => {
    const name = request.body.name.replace(/\s+/g, " ").trim();
    const body = request.body.comment.replace(/\s+/g, " ").trim();

    const { rows } = await query(
      `insert into comments (display_name, body) values ($1, $2)
       returning id, display_name, body, created_at`,
      [name, body]
    );

    return reply.code(201).send({
      comment: publicComment(rows[0]),
      message: "Thanks! Your comment was submitted for review.",
    });
  });

  fastify.get("/comments/pending", { preHandler: requireAdmin }, async () => {
    const { rows } = await query(
      `select id, display_name, body, status, created_at from comments
       where status = 'pending'
       order by created_at asc
       limit ${PENDING_LIMIT}`
    );

    return {
      comments: rows.map((row) => ({
        id: row.id,
        name: row.display_name,
        comment: row.body,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.post(
    "/comments/moderate",
    { preHandler: requireAdmin, schema: { body: moderateCommentBody } },
    async (request, reply) => {
      const status = request.body.action === "approve" ? "approved" : "rejected";

      const { rows } = await query(
        `update comments set status = $1, reviewed_at = now()
         where id = $2
         returning id, display_name, body, status, created_at, reviewed_at`,
        [status, request.body.id]
      );

      if (!rows.length) {
        return reply.code(404).send({ error: "Comment was not found." });
      }

      return {
        comment: {
          id: rows[0].id,
          name: rows[0].display_name,
          comment: rows[0].body,
          status: rows[0].status,
          createdAt: rows[0].created_at,
          reviewedAt: rows[0].reviewed_at,
        },
        message: `Comment ${status}.`,
      };
    }
  );
}

module.exports = { commentRoutes, pinMatches };
