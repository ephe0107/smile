/* Integration tests. These need a database: set DATABASE_URL (npm run db:up
   starts one locally). Without it they skip rather than fail, so the pure
   unit tests still run anywhere. */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

require("./config");

const hasDatabase = Boolean(process.env.DATABASE_URL);

if (!hasDatabase) {
  test("integration tests skipped: DATABASE_URL is not set", { skip: true }, () => {});
} else {
  const { buildApp } = require("./app");
  const { migrate } = require("./db/migrate");
  const { query, closePool } = require("./db");
  const summaryCache = require("./lib/summary-cache");

  // Distinct per run so a failed run cannot leak rows into the next one.
  const CLIENT_A = `test-a-${crypto.randomUUID()}`;
  const CLIENT_B = `test-b-${crypto.randomUUID()}`;

  function resultPayload(clientId, score, overrides = {}) {
    return {
      clientId,
      score,
      riskLevel: "Low Risk",
      badge: { name: "Bright Smile", icon: "S", message: "Great work" },
      categoryScores: {
        brushing: { label: "Brushing", score: 90 },
        diet: { label: "Diet", score: 40 },
      },
      recommendations: ["sugary drinks: swap one soda for water"],
      achievements: [{ name: "First Check", icon: "T", description: "Completed", unlocked: true }],
      report: [{ category: "Brushing", score: 90, explanation: "Strong routine." }],
      ...overrides,
    };
  }

  let app;

  test.before(async () => {
    await migrate({ logger: { log() {} } });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  test.beforeEach(() => summaryCache.invalidate());

  test.after(async () => {
    await query("delete from results where client_id = any($1)", [[CLIENT_A, CLIENT_B]]);
    await app?.close();
    await closePool();
  });

  test("GET /health reports the database", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok", database: "ok" });
  });

  test("the page is served from public/", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.body, /Smile Check/i);
  });

  test("GET /results without a clientId is refused", async () => {
    const response = await app.inject({ method: "GET", url: "/results" });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /clientId/);
  });

  test("POST /results stores a result and reports a flat trend first time", async () => {
    const response = await app.inject({ method: "POST", url: "/results", payload: resultPayload(CLIENT_A, 82) });

    assert.equal(response.statusCode, 201);
    const { result } = response.json();
    assert.equal(result.score, 82);
    assert.deepEqual(result.trend, { previousScore: null, change: 0, direction: "flat" });
    assert.equal(result.badge.name, "Bright Smile");
  });

  test("a second result is scored against the first", async () => {
    const response = await app.inject({ method: "POST", url: "/results", payload: resultPayload(CLIENT_A, 90) });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json().result.trend, { previousScore: 82, change: 8, direction: "up" });
  });

  test("one client cannot read another client's results", async () => {
    await app.inject({ method: "POST", url: "/results", payload: resultPayload(CLIENT_B, 55) });

    const mine = await app.inject({ method: "GET", url: `/results?clientId=${CLIENT_A}` });
    const theirs = await app.inject({ method: "GET", url: `/results?clientId=${CLIENT_B}` });

    const myScores = mine.json().results.map((row) => row.score).sort();
    const theirScores = theirs.json().results.map((row) => row.score).sort();

    assert.deepEqual(myScores, [82, 90]);
    assert.deepEqual(theirScores, [55]);
    assert.ok(!myScores.includes(55), "client A must not see client B's result");
  });

  test("an invalid score is rejected before it reaches the database", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/results",
      payload: resultPayload(CLIENT_A, 500),
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /score/);
  });

  test("a result missing its report is rejected", async () => {
    const payload = resultPayload(CLIENT_A, 70);
    delete payload.report;

    const response = await app.inject({ method: "POST", url: "/results", payload });
    assert.equal(response.statusCode, 400);
  });

  test("GET /analytics/summary exposes no per-record field", async () => {
    const response = await app.inject({ method: "GET", url: "/analytics/summary" });

    assert.equal(response.statusCode, 200);
    ["report", "badge", "completedAt", "clientId", "explanation", "recommendations"].forEach((field) => {
      assert.ok(!response.body.includes(`"${field}"`), `summary must not expose ${field}`);
    });

    const summary = response.json();
    assert.ok(Number.isInteger(summary.results.total));
    assert.equal(summary.minCohort, 5);
  });

  test("a cross-site write is refused", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/comments",
      headers: { "sec-fetch-site": "cross-site" },
      payload: { name: "Someone", comment: "A cross-site comment attempt." },
    });

    assert.equal(response.statusCode, 403);
  });

  test("a same-origin write is allowed", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/comments",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { name: "Someone", comment: "A perfectly ordinary comment." },
    });

    assert.equal(response.statusCode, 201);
    // New comments are held for moderation, so they must not appear publicly.
    const listed = await app.inject({ method: "GET", url: "/comments" });
    const bodies = listed.json().comments.map((row) => row.comment);
    assert.ok(!bodies.includes("A perfectly ordinary comment."), "unmoderated comments must stay hidden");
  });

  test("engagement events are accepted and carry no identity", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/engagement-analytics",
      payload: { type: "myth_quiz_answer", section: "myths", value: true },
    });

    assert.equal(response.statusCode, 201);
    const { event } = response.json();
    assert.equal(event.value, true);
    assert.ok(!("clientId" in event) && !("userId" in event));

    const columns = await query(
      "select column_name from information_schema.columns where table_name = 'engagement_events'"
    );
    const names = columns.rows.map((row) => row.column_name);
    assert.ok(!names.includes("user_id"), "engagement_events must never gain an identity column");
    assert.ok(!names.includes("client_id"), "engagement_events must never gain an identity column");
  });

  test("an out-of-range explorer age is rejected", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/explorer-analytics",
      payload: { type: "age_lookup", age: 99 },
    });

    assert.equal(response.statusCode, 400);
  });

  test("moderation requires the admin PIN when one is configured", async () => {
    // commentRoutes reads ADMIN_PIN at registration, so this needs its own app.
    const previous = process.env.ADMIN_PIN;
    process.env.ADMIN_PIN = "test-pin-1234";

    const guarded = await buildApp({ logger: false });
    await guarded.ready();

    try {
      const denied = await guarded.inject({ method: "GET", url: "/comments/pending" });
      assert.equal(denied.statusCode, 401);

      const allowed = await guarded.inject({
        method: "GET",
        url: "/comments/pending",
        headers: { "x-admin-pin": "test-pin-1234" },
      });
      assert.equal(allowed.statusCode, 200);

      const wrongLength = await guarded.inject({
        method: "GET",
        url: "/comments/pending",
        headers: { "x-admin-pin": "short" },
      });
      assert.equal(wrongLength.statusCode, 401);
    } finally {
      await guarded.close();
      if (previous === undefined) delete process.env.ADMIN_PIN;
      else process.env.ADMIN_PIN = previous;
    }
  });
}
