const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MIN_COHORT,
  buildAnalyticsSummary,
  summarizeResults,
  summarizeEngagement,
  scoreBucketFor,
  weakestCategoryLabel,
  recommendationTopic,
  suppressSmallBuckets,
} = require("./analytics-summary");

function makeResult(overrides = {}) {
  return {
    score: 70,
    riskLevel: "Moderate Risk",
    categoryScores: {
      brushing: { label: "Brushing", score: 80 },
      flossing: { label: "Flossing", score: 60 },
      diet: { label: "Diet", score: 40 },
      fluoride: { label: "Fluoride Use", score: 70 },
      care: { label: "Professional Care", score: 90 },
    },
    recommendations: ["sugary drinks: swap one soda for water"],
    achievements: [{ unlocked: true }, { unlocked: false }],
    ...overrides,
  };
}

function cohortOf(count, overrides = {}) {
  return Array.from({ length: count }, () => makeResult(overrides));
}

test("score buckets match the dashboard's boundaries", () => {
  assert.equal(scoreBucketFor(0), "0-49");
  assert.equal(scoreBucketFor(49), "0-49");
  assert.equal(scoreBucketFor(50), "50-64");
  assert.equal(scoreBucketFor(64), "50-64");
  assert.equal(scoreBucketFor(65), "65-79");
  assert.equal(scoreBucketFor(79), "65-79");
  assert.equal(scoreBucketFor(80), "80-89");
  assert.equal(scoreBucketFor(89), "80-89");
  assert.equal(scoreBucketFor(90), "90-100");
  assert.equal(scoreBucketFor(100), "90-100");
});

test("weakest category is the lowest-scoring one, by label", () => {
  assert.equal(weakestCategoryLabel(makeResult()), "Diet");
  assert.equal(weakestCategoryLabel({ categoryScores: {} }), null);
  assert.equal(weakestCategoryLabel({}), null);
});

test("weakest category does not mutate the caller's data", () => {
  const result = makeResult();
  const before = Object.keys(result.categoryScores);
  weakestCategoryLabel(result);
  assert.deepEqual(Object.keys(result.categoryScores), before);
});

test("recommendation topic is the part before the colon", () => {
  assert.equal(recommendationTopic("flossing: floss before bed"), "flossing");
  assert.equal(recommendationTopic("brushing frequency"), "brushing frequency");
});

test("a cohort below the floor reports its size and nothing else", () => {
  const summary = summarizeResults(cohortOf(MIN_COHORT - 1), MIN_COHORT);

  assert.equal(summary.total, MIN_COHORT - 1);
  assert.equal(summary.suppressed, true);
  assert.equal(summary.averageScore, undefined);
  assert.equal(summary.scoreDistribution, undefined);
  assert.equal(summary.riskCounts, undefined);
  assert.equal(summary.categoryAverages, undefined);
});

test("a cohort at the floor reports full figures", () => {
  const summary = summarizeResults(cohortOf(MIN_COHORT), MIN_COHORT);

  assert.equal(summary.suppressed, false);
  assert.equal(summary.total, MIN_COHORT);
  assert.equal(summary.averageScore, 70);
  assert.equal(summary.riskCounts["Moderate Risk"], MIN_COHORT);
  assert.equal(summary.riskPercentages["Moderate Risk"], 100);
  assert.equal(summary.categoryAverages.diet, 40);
  assert.equal(summary.unlockedAchievements, MIN_COHORT);
});

test("label breakdowns below the floor are dropped", () => {
  const results = [
    ...cohortOf(MIN_COHORT),
    makeResult({
      categoryScores: { care: { label: "Professional Care", score: 5 } },
      recommendations: ["dental checkups: book a visit"],
    }),
  ];
  const summary = summarizeResults(results, MIN_COHORT);

  assert.equal(summary.weaknessCounts.Diet, MIN_COHORT);
  assert.ok(!("Professional Care" in summary.weaknessCounts), "rare weakness label must be withheld");
  assert.ok(!("dental checkups" in summary.recommendationCounts), "rare recommendation must be withheld");
  assert.equal(summary.commonWeakness.label, "Diet");
});

test("score and risk distributions are not suppressed once the cohort qualifies", () => {
  const results = [...cohortOf(MIN_COHORT), makeResult({ score: 95, riskLevel: "Low Risk" })];
  const summary = summarizeResults(results, MIN_COHORT);

  // A single person in a bucket is kept here on purpose: these are fixed,
  // coarse vocabularies and dropping a slice would misreport the total.
  assert.equal(summary.scoreDistribution["90-100"], 1);
  assert.equal(summary.riskCounts["Low Risk"], 1);
  assert.equal(
    Object.values(summary.scoreDistribution).reduce((a, b) => a + b, 0),
    results.length,
    "score buckets must account for every participant"
  );
});

test("suppressSmallBuckets keeps only buckets at or above the floor", () => {
  assert.deepEqual(suppressSmallBuckets({ a: 5, b: 4, c: 9 }, 5), { a: 5, c: 9 });
});

test("myth accuracy is withheld until enough answers exist", () => {
  const few = summarizeEngagement(
    [{ type: "myth_quiz_answer", value: true }, { type: "myth_quiz_answer", value: false }],
    MIN_COHORT
  );
  assert.equal(few.mythCorrectRate, "Not enough data");

  const enough = summarizeEngagement(
    Array.from({ length: MIN_COHORT }, (_, i) => ({ type: "myth_quiz_answer", value: i < 3 })),
    MIN_COHORT
  );
  assert.equal(enough.mythCorrectRate, "60%");
});

test("engagement counts the event types the dashboards display", () => {
  const summary = summarizeEngagement(
    [
      { type: "module_open", section: "prevention" },
      { type: "prevention_checklist", section: "prevention" },
      { type: "science_popup", section: "prevention" },
      { type: "evidence_layer", section: "prevention" },
      { type: "myth_quiz_answer", value: true, section: "myths" },
    ],
    MIN_COHORT
  );

  assert.equal(summary.totalEvents, 5);
  assert.equal(summary.moduleOpens, 1);
  assert.equal(summary.preventionActions, 1);
  assert.equal(summary.sciencePopups, 2, "science_popup and evidence_layer both count as evidence views");
});

test("the summary never carries per-record fields", () => {
  const payload = JSON.stringify(
    buildAnalyticsSummary(cohortOf(MIN_COHORT * 2), [{ type: "module_open", section: "prevention" }])
  );

  ["report", "badge", "completedAt", "clientId", "explanation", "strongestHabit"].forEach((field) => {
    assert.ok(!payload.includes(`"${field}"`), `summary must not expose ${field}`);
  });
});

test("empty input is handled without throwing", () => {
  const summary = buildAnalyticsSummary([], []);
  assert.equal(summary.results.total, 0);
  assert.equal(summary.results.suppressed, true);
  assert.equal(summary.engagement.totalEvents, 0);
  assert.equal(summary.engagement.commonSection.label, "Not enough data yet");
});
