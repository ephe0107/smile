/* ==========================================================
   Population analytics: aggregation and disclosure policy.

   Split into two layers on purpose.

   * "compute" turns raw records into raw counts. There are two of these --
     one over in-memory arrays (the legacy JSON files, and the tests) and one
     in SQL (server/db/analytics.js). Both produce the same shape.
   * "finalize" applies the disclosure policy to those counts. There is only
     one of these, so the rules below hold no matter where the numbers came
     from.

   The module exists because the dashboards used to receive every saved
   result and aggregate in the browser. Those records carry health habits,
   risk levels, and personalized report text, so they must never leave the
   server. Aggregate here, ship only the aggregate.
   ========================================================== */

// Below this many people, a "population" statistic describes individuals.
// Breakdowns smaller than this are withheld rather than published.
const MIN_COHORT = 5;

const CATEGORY_KEYS = ["brushing", "flossing", "diet", "fluoride", "care"];
const RISK_LEVELS = ["Low Risk", "Moderate Risk", "High Risk"];
const EVIDENCE_EVENT_TYPES = ["science_popup", "evidence_layer"];
const SCORE_BUCKETS = ["0-49", "50-64", "65-79", "80-89", "90-100"];

const NOT_ENOUGH_DATA = { label: "Not enough data yet", count: 0 };

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    if (key === null || key === undefined || key === "") return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

// Drops any bucket that describes fewer than MIN_COHORT people. Label
// breakdowns are the identifying ones -- "one person's weakest area is
// flossing" is a fact about a person, not a population.
//
// Deliberately NOT applied to the score and risk distributions: those are
// fixed, coarse vocabularies that partition a cohort already known to be at
// least MIN_COHORT, and dropping a slice would leave the donut summing to
// less than 100% -- misreporting the population to avoid a disclosure risk
// that a 3-way split does not carry.
function suppressSmallBuckets(counts, minCohort = MIN_COHORT) {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count >= minCohort));
}

function mostCommonFromCounts(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return { ...NOT_ENOUGH_DATA };

  const [label, count] = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { label, count };
}

function scoreBucketFor(score) {
  if (score < 50) return "0-49";
  if (score < 65) return "50-64";
  if (score < 80) return "65-79";
  if (score < 90) return "80-89";
  return "90-100";
}

function emptyScoreDistribution() {
  return SCORE_BUCKETS.reduce((buckets, key) => ({ ...buckets, [key]: 0 }), {});
}

function emptyRiskCounts() {
  return RISK_LEVELS.reduce((counts, level) => ({ ...counts, [level]: 0 }), {});
}

// The weakest category on a single result, by label.
//
// Ties are common -- roughly 7% of results have two categories sharing the
// lowest score -- so the tie-break is explicit and alphabetical. Without it
// the winner depends on key order, which differs between a JSON object and a
// jsonb column, and the same data would produce two different answers
// depending on where it was stored.
function weakestCategoryLabel(result) {
  const categories = Object.values(result.categoryScores || {}).filter(
    (category) => category && category.label !== undefined && category.score !== undefined
  );
  if (!categories.length) return null;

  const weakest = [...categories].sort(
    (a, b) => Number(a.score) - Number(b.score) || String(a.label).localeCompare(String(b.label))
  )[0];
  return weakest && weakest.label ? String(weakest.label) : null;
}

// Recommendations read "Flossing: try a floss pick before bed". The part
// before the colon is the habit area, which is what the dashboard groups by.
function recommendationTopic(recommendation) {
  return String(recommendation).split(":")[0].trim();
}

/* ---------- compute: records -> raw counts (in-memory) ---------- */

function computeRawResultStats(results) {
  const total = results.length;
  const scoreDistribution = emptyScoreDistribution();
  const riskCounts = emptyRiskCounts();
  const categoryTotals = {};
  const categoryCounts = {};
  let scoreSum = 0;
  let unlockedAchievements = 0;

  results.forEach((result) => {
    const score = Number(result.score) || 0;
    scoreSum += score;
    scoreDistribution[scoreBucketFor(score)] += 1;

    if (RISK_LEVELS.includes(result.riskLevel)) {
      riskCounts[result.riskLevel] += 1;
    }

    CATEGORY_KEYS.forEach((key) => {
      const value = Number(result.categoryScores?.[key]?.score);
      if (!Number.isFinite(value)) return;
      categoryTotals[key] = (categoryTotals[key] || 0) + value;
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    });

    unlockedAchievements += (result.achievements || []).filter((item) => item.unlocked).length;
  });

  return {
    total,
    averageScore: total ? Math.round(scoreSum / total) : 0,
    scoreDistribution,
    riskCounts,
    categoryAverages: CATEGORY_KEYS.reduce((averages, key) => {
      const count = categoryCounts[key] || 0;
      averages[key] = count ? Math.round(categoryTotals[key] / count) : null;
      return averages;
    }, {}),
    weaknessCounts: countBy(results.map(weakestCategoryLabel).filter(Boolean), (label) => label),
    recommendationCounts: countBy(
      results.flatMap((result) => result.recommendations || []).map(recommendationTopic),
      (topic) => topic
    ),
    unlockedAchievements,
  };
}

function computeRawEngagementStats(engagement) {
  const events = Array.isArray(engagement) ? engagement : [];
  const mythAnswers = events.filter((event) => event.type === "myth_quiz_answer");

  return {
    totalEvents: events.length,
    moduleOpens: events.filter((event) => event.type === "module_open").length,
    preventionActions: events.filter((event) => event.type === "prevention_checklist").length,
    sciencePopups: events.filter((event) => EVIDENCE_EVENT_TYPES.includes(event.type)).length,
    mythAnswers: mythAnswers.length,
    mythCorrect: mythAnswers.filter((event) => event.value === true).length,
    sectionCounts: countBy(events, (event) => event.section || "General"),
  };
}

/* ---------- finalize: raw counts -> published summary ---------- */

function finalizeResultStats(raw, minCohort = MIN_COHORT) {
  const total = Number(raw.total) || 0;

  // With fewer people than the cohort floor, every "average" is a
  // near-direct readout of one person's answers. Report the count only.
  if (total < minCohort) {
    return { total, suppressed: true };
  }

  const riskCounts = { ...emptyRiskCounts(), ...(raw.riskCounts || {}) };
  const weaknessCounts = suppressSmallBuckets(raw.weaknessCounts || {}, minCohort);
  const recommendationCounts = suppressSmallBuckets(raw.recommendationCounts || {}, minCohort);

  return {
    total,
    suppressed: false,
    averageScore: Number(raw.averageScore) || 0,
    scoreDistribution: { ...emptyScoreDistribution(), ...(raw.scoreDistribution || {}) },
    riskCounts,
    riskPercentages: RISK_LEVELS.reduce((percentages, level) => {
      percentages[level] = percent(riskCounts[level], total);
      return percentages;
    }, {}),
    weaknessCounts,
    recommendationCounts,
    categoryAverages: raw.categoryAverages || {},
    unlockedAchievements: Number(raw.unlockedAchievements) || 0,
    commonWeakness: mostCommonFromCounts(weaknessCounts),
    commonRecommendation: mostCommonFromCounts(recommendationCounts),
  };
}

function finalizeEngagementStats(raw, minCohort = MIN_COHORT) {
  const mythAnswers = Number(raw.mythAnswers) || 0;

  return {
    totalEvents: Number(raw.totalEvents) || 0,
    moduleOpens: Number(raw.moduleOpens) || 0,
    preventionActions: Number(raw.preventionActions) || 0,
    sciencePopups: Number(raw.sciencePopups) || 0,
    // A "100% accuracy" built from two answers is noise, not a finding.
    mythCorrectRate:
      mythAnswers >= minCohort ? `${percent(Number(raw.mythCorrect) || 0, mythAnswers)}%` : "Not enough data",
    commonSection: mostCommonFromCounts(suppressSmallBuckets(raw.sectionCounts || {}, minCohort)),
  };
}

/* ---------- the in-memory entry points ---------- */

function summarizeResults(results, minCohort = MIN_COHORT) {
  return finalizeResultStats(computeRawResultStats(Array.isArray(results) ? results : []), minCohort);
}

function summarizeEngagement(engagement, minCohort = MIN_COHORT) {
  return finalizeEngagementStats(computeRawEngagementStats(engagement), minCohort);
}

function assembleSummary(rawResults, rawEngagement, minCohort = MIN_COHORT) {
  return {
    generatedAt: new Date().toISOString(),
    minCohort,
    results: finalizeResultStats(rawResults, minCohort),
    engagement: finalizeEngagementStats(rawEngagement, minCohort),
  };
}

function buildAnalyticsSummary(results = [], engagement = [], options = {}) {
  const minCohort = Number.isInteger(options.minCohort) ? options.minCohort : MIN_COHORT;

  return assembleSummary(
    computeRawResultStats(Array.isArray(results) ? results : []),
    computeRawEngagementStats(engagement),
    minCohort
  );
}

module.exports = {
  MIN_COHORT,
  CATEGORY_KEYS,
  RISK_LEVELS,
  SCORE_BUCKETS,
  buildAnalyticsSummary,
  assembleSummary,
  computeRawResultStats,
  computeRawEngagementStats,
  finalizeResultStats,
  finalizeEngagementStats,
  summarizeResults,
  summarizeEngagement,
  percent,
  countBy,
  mostCommonFromCounts,
  suppressSmallBuckets,
  scoreBucketFor,
  weakestCategoryLabel,
  recommendationTopic,
  emptyScoreDistribution,
  emptyRiskCounts,
};
