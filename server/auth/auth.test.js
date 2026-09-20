/* Authentication integration tests. Need a database: set DATABASE_URL
   (npm run db:up starts one locally). Without it they skip. */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

require("../config");

// The auth limiter is deliberately tight (10 per 10 minutes), which a test
// file exercising the whole flow would trip immediately. Raised here and
// tested on purpose in "the sign-in endpoint is rate limited" below, which
// builds its own app with the real ceiling.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || "10000";

const hasDatabase = Boolean(process.env.DATABASE_URL);

if (!hasDatabase) {
  test("auth tests skipped: DATABASE_URL is not set", { skip: true }, () => {});
} else {
  const { buildApp } = require("../app");
  const { migrate } = require("../db/migrate");
  const { query, closePool } = require("../db");
  const { hashCode, generateCode, normalizeEmail } = require("./tokens");
  const { SESSION_COOKIE } = require("./session");

  // Unique per run so a failed run cannot poison the next one.
  const RUN = crypto.randomUUID().slice(0, 8);
  const EMAIL_A = `auth-a-${RUN}@example.test`;
  const EMAIL_B = `auth-b-${RUN}@example.test`;

  let app;

  function resultPayload(score, overrides = {}) {
    return {
      score,
      riskLevel: "Low Risk",
      badge: { name: "Bright Smile", icon: "S", message: "Great" },
      categoryScores: { brushing: { label: "Brushing", score: 90 }, diet: { label: "Diet", score: 40 } },
      recommendations: ["sugary drinks: swap one soda for water"],
      achievements: [{ name: "First", icon: "T", description: "Completed", unlocked: true }],
      report: [{ category: "Brushing", score: 90, explanation: "Strong." }],
      ...overrides,
    };
  }

  // The code only exists in the email, so tests read the hash-matched row
  // directly rather than scraping a log.
  async function currentCodeFor(email) {
    const { rows } = await query(
      `select t.id, t.user_id from login_tokens t
       join users u on u.id = t.user_id
       where u.email = $1 and t.consumed_at is null
       order by t.created_at desc limit 1`,
      [normalizeEmail(email)]
    );

    if (!rows.length) return null;

    // Recover the code by trying candidates is infeasible by design, so the
    // test sets a known one instead.
    const code = generateCode();
    await query("update login_tokens set token_hash = $1 where id = $2", [
      hashCode(rows[0].user_id, code),
      rows[0].id,
    ]);

    return code;
  }

  function sessionCookieFrom(response) {
    const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE);
    return cookie ? `${cookie.name}=${cookie.value}` : null;
  }

  async function signIn(email) {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email, ageConfirmed: true },
    });

    const code = await currentCodeFor(email);

    const verified = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email, code },
    });

    return { response: verified, cookie: sessionCookieFrom(verified), code };
  }

  test.before(async () => {
    await migrate({ logger: { log() {} } });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  test.after(async () => {
    await query("delete from users where email = any($1)", [[EMAIL_A, EMAIL_B]]);
    await app?.close();
    await closePool();
  });

  test("requesting a code without confirming age is refused", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: false },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /13 and up/);
  });

  test("the response is identical whether or not the address has an account", async () => {
    const existing = await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: true },
    });

    const unknown = await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: `never-seen-${RUN}@example.test`, ageConfirmed: true },
    });

    // Otherwise this endpoint answers "does this person have an account?"
    assert.equal(existing.statusCode, unknown.statusCode);
    assert.deepEqual(existing.json(), unknown.json());

    await query("delete from users where email = $1", [`never-seen-${RUN}@example.test`]);
  });

  test("only the hash of a code is stored", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: true },
    });

    const { rows } = await query(
      `select t.token_hash from login_tokens t join users u on u.id = t.user_id
       where u.email = $1 order by t.created_at desc limit 1`,
      [EMAIL_A]
    );

    assert.ok(Buffer.isBuffer(rows[0].token_hash));
    assert.equal(rows[0].token_hash.length, 32, "sha256 digest");
  });

  test("a wrong code is refused", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: true },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, code: "000000" },
    });

    assert.equal(response.statusCode, 401);
  });

  test("a correct code signs in and sets an HttpOnly cookie", async () => {
    const { response, cookie } = await signIn(EMAIL_A);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.email, EMAIL_A);
    assert.ok(cookie, "a session cookie must be set");

    const raw = response.cookies.find((item) => item.name === SESSION_COOKIE);
    assert.equal(raw.httpOnly, true, "page scripts must not be able to read the session");
    assert.equal(raw.sameSite, "Lax");
    assert.equal(raw.path, "/");
  });

  test("a code cannot be used twice", async () => {
    const { code } = await signIn(EMAIL_A);

    const replay = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, code },
    });

    assert.equal(replay.statusCode, 401);
  });

  test("an expired code is refused", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: true },
    });

    const code = await currentCodeFor(EMAIL_A);
    await query(
      `update login_tokens set expires_at = now() - interval '1 minute'
       where user_id = (select id from users where email = $1) and consumed_at is null`,
      [EMAIL_A]
    );

    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, code },
    });

    assert.equal(response.statusCode, 401);
  });

  test("five wrong guesses burn the code", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, ageConfirmed: true },
    });

    const code = await currentCodeFor(EMAIL_A);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.inject({
        method: "POST",
        url: "/auth/verify-code",
        headers: { "sec-fetch-site": "same-origin" },
        payload: { email: EMAIL_A, code: "111111" },
      });
    }

    // Even the right code is dead once the attempt budget is spent.
    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A, code },
    });

    assert.equal(response.statusCode, 401);
  });

  test("email matching ignores case", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/request-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A.toUpperCase(), ageConfirmed: true },
    });

    const code = await currentCodeFor(EMAIL_A);

    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-code",
      headers: { "sec-fetch-site": "same-origin" },
      payload: { email: EMAIL_A.toUpperCase(), code },
    });

    assert.equal(response.statusCode, 200);

    const { rows } = await query("select count(*)::int as count from users where lower(email) = $1", [
      EMAIL_A.toLowerCase(),
    ]);
    assert.equal(rows[0].count, 1, "differing case must not create a second account");
  });

  test("signing in writes an identity row, which is the OIDC seam", async () => {
    const { rows } = await query(
      `select i.provider, i.provider_subject from identities i
       join users u on u.id = i.user_id where u.email = $1`,
      [EMAIL_A]
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].provider, "email");
    assert.equal(rows[0].provider_subject, EMAIL_A);
  });

  test("/me routes refuse an unauthenticated caller", async () => {
    for (const [method, url] of [
      ["GET", "/me/results"],
      ["POST", "/me/results"],
      ["GET", "/me/export"],
      ["DELETE", "/me"],
    ]) {
      const response = await app.inject({
        method,
        url,
        headers: { "sec-fetch-site": "same-origin" },
        ...(method === "POST" ? { payload: resultPayload(70) } : {}),
      });

      assert.equal(response.statusCode, 401, `${method} ${url} must require a session`);
    }
  });

  test("a forged session cookie is rejected", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me/results",
      headers: { cookie: `${SESSION_COOKIE}=not-a-real-signed-token` },
    });

    assert.equal(response.statusCode, 401);
  });

  test("results save to the account and the trend chains", async () => {
    const { cookie } = await signIn(EMAIL_A);

    const first = await app.inject({
      method: "POST",
      url: "/me/results",
      headers: { cookie, "sec-fetch-site": "same-origin" },
      payload: resultPayload(70),
    });

    assert.equal(first.statusCode, 201);
    assert.deepEqual(first.json().result.trend, { previousScore: null, change: 0, direction: "flat" });

    const second = await app.inject({
      method: "POST",
      url: "/me/results",
      headers: { cookie, "sec-fetch-site": "same-origin" },
      payload: resultPayload(85),
    });

    assert.deepEqual(second.json().result.trend, { previousScore: 70, change: 15, direction: "up" });
  });

  test("one account cannot see another's results", async () => {
    const a = await signIn(EMAIL_A);
    const b = await signIn(EMAIL_B);

    await app.inject({
      method: "POST",
      url: "/me/results",
      headers: { cookie: b.cookie, "sec-fetch-site": "same-origin" },
      payload: resultPayload(42),
    });

    const mine = await app.inject({ method: "GET", url: "/me/results", headers: { cookie: a.cookie } });
    const theirs = await app.inject({ method: "GET", url: "/me/results", headers: { cookie: b.cookie } });

    const myScores = mine.json().results.map((row) => row.score);
    const theirScores = theirs.json().results.map((row) => row.score);

    assert.ok(!myScores.includes(42), "account A must never see account B's result");
    assert.deepEqual(theirScores, [42]);
  });

  test("a signed-in save carries no browser identifier", async () => {
    const { cookie } = await signIn(EMAIL_A);

    await app.inject({
      method: "POST",
      url: "/me/results",
      headers: { cookie, "sec-fetch-site": "same-origin" },
      // A client that tries to set one anyway must not have it honoured.
      payload: { ...resultPayload(77), clientId: "smuggled-identifier" },
    });

    const { rows } = await query(
      `select r.client_id from results r join users u on u.id = r.user_id
       where u.email = $1 and r.score = 77`,
      [EMAIL_A]
    );

    assert.ok(rows.length > 0);
    assert.equal(rows[0].client_id, null, "the session is the only identity that counts");
  });

  test("export returns this account's data and says what it cannot include", async () => {
    const { cookie } = await signIn(EMAIL_A);

    const response = await app.inject({ method: "GET", url: "/me/export", headers: { cookie } });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.account.email, EMAIL_A);
    assert.ok(Array.isArray(body.results) && body.results.length > 0);
    assert.match(body.note, /without any link to your account/);
    assert.match(response.headers["content-disposition"], /attachment/);
  });

  test("signing out revokes the session server-side", async () => {
    const { cookie } = await signIn(EMAIL_A);

    const before = await app.inject({ method: "GET", url: "/me/results", headers: { cookie } });
    assert.equal(before.statusCode, 200);

    await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie, "sec-fetch-site": "same-origin" },
    });

    // The same cookie must now be worthless, not merely cleared in the browser.
    const after = await app.inject({ method: "GET", url: "/me/results", headers: { cookie } });
    assert.equal(after.statusCode, 401);
  });

  test("deleting an account erases its results and leaves other accounts alone", async () => {
    const a = await signIn(EMAIL_A);
    const b = await signIn(EMAIL_B);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/me",
      headers: { cookie: b.cookie, "sec-fetch-site": "same-origin" },
    });

    assert.equal(deleted.statusCode, 200);

    const gone = await query("select count(*)::int as count from users where email = $1", [EMAIL_B]);
    assert.equal(gone.rows[0].count, 0);

    // Cascade must take the health answers with it, not just the name.
    const orphans = await query(
      "select count(*)::int as count from results where user_id is not null and user_id not in (select id from users)"
    );
    assert.equal(orphans.rows[0].count, 0);

    const survivor = await app.inject({ method: "GET", url: "/me/results", headers: { cookie: a.cookie } });
    assert.equal(survivor.statusCode, 200, "deleting one account must not disturb another");
    assert.ok(survivor.json().results.length > 0);
  });

  test("the sign-in endpoint is rate limited", async () => {
    // Its own app, with a real (low) ceiling: this is the endpoint worth
    // attacking, so the limit existing is itself worth asserting.
    const previous = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = "3";

    const limited = await buildApp({ logger: false });
    await limited.ready();

    try {
      const email = `ratelimit-${RUN}@example.test`;
      const codes = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await limited.inject({
          method: "POST",
          url: "/auth/request-code",
          headers: { "sec-fetch-site": "same-origin" },
          payload: { email, ageConfirmed: true },
        });
        codes.push(response.statusCode);
      }

      assert.ok(codes.includes(429), `expected a 429 among ${codes.join(", ")}`);
      await query("delete from users where email = $1", [email]);
    } finally {
      await limited.close();
      if (previous === undefined) delete process.env.AUTH_RATE_LIMIT_MAX;
      else process.env.AUTH_RATE_LIMIT_MAX = previous;
    }
  });

  test("engagement_events still has no identity column after accounts exist", async () => {
    const { rows } = await query(
      "select column_name from information_schema.columns where table_name = 'engagement_events'"
    );
    const names = rows.map((row) => row.column_name);

    assert.ok(!names.includes("user_id"), "analytics must never be linkable to a person");
    assert.ok(!names.includes("client_id"));
  });
}
