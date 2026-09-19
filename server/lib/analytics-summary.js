/* ==========================================================
   Population analytics aggregation.

   This module is deliberately pure: it takes arrays in and returns
   a plain summary object. Nothing here touches the filesystem, the
   database, or an HTTP response, so the same code serves the current
   JSON-file backend and the Postgres backend that replaces it.

   It exists because the dashboards used to receive every saved result
   and aggregate in the browser. Those records carry health habits,
   risk levels, and personalized report text, so they must never leave
   the server. Aggregate here, ship only the aggregate.
   ========================================================== */

// Below this many people, a "population" statistic describes individuals.
// Breakdowns smaller than this are withheld rather than published.
const MIN_COHORT = 5;

const CATEGORY_KEYS = ["brushing", "flossing", "diet", "fluoride", "care"];
const RISK_LEVELS = ["Low Risk", "Moderate Risk", "High Risk"];
const EVIDENCE_EVENT_TYPES = ["science_popup", "evidence_layer"];

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
  return { "0-49": 0, "50-64": 0, "65-79": 0, "80-89": 0, "90-100": 0 };
}

function emptyRiskCounts() {
  return RISK_LEVELS.reduce((counts, level) => ({ ...counts, [level]: 0 }), {});
}

// The weakest category on a single result, by label, matching what the
// browser used to compute in getWeaknessCounts().
function weakestCategoryLabel(result) {
  const categories = Object.values(result.categoryScores || {});
  if (!categories.length) return null;

  const weakest = [...categories].sort((a, b) => Number(a.score) - Number(b.score))[0];
  return weakest && weakest.label ? String(weakest.label) : null;
}

// Recommendations read "Flossing: try a floss pick before bed". The part
// before the colon is the habit area, which is what the dashboard groups by.
function recommendationTopic(recommendation) {
  return String(recommendation).split(":")[0].trim();
}

function summarizeResults(results, minCohort) {
  const total = results.length;

  // With fewer people than the cohort floor, every "average" is a
  // near-direct readout of one person's answers. Report the count only.
  if (total < minCohort) {
    return { total, suppressed: true };
  }

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

  const weaknessCounts = suppressSmallBuckets(
    countBy(results.map(weakestCategoryLabel).filter(Boolean), (label) => label),
    minCohort
  );

  const recommendationCounts = suppressSmallBuckets(
    countBy(
      results.flatMap((result) => result.recommendations || []).map(recommendationTopic),
      (topic) => topic
    ),
    minCohort
  );

  const categoryAverages = CATEGORY_KEYS.reduce((averages, key) => {
    const count = categoryCounts[key] || 0;
    averages[key] = count ? Math.round(categoryTotals[key] / count) : null;
    return averages;
  }, {});

  return {
    total,
    suppressed: false,
    averageScore: Math.round(scoreSum / total),
    scoreDistribution,
    riskCounts,
    riskPercentages: RISK_LEVELS.reduce((percentages, level) => {
      percentages[level] = percent(riskCounts[level], total);
      return percentages;
    }, {}),
    weaknessCounts,
    recommendationCounts,
    categoryAverages,
    unlockedAchievements,
    commonWeakness: mostCommonFromCounts(weaknessCounts),
    commonRecommendation: mostCommonFromCounts(recommendationCounts),
  };
}

function summarizeEngagement(engagement, minCohort) {
  const events = Array.isArray(engagement) ? engagement : [];
  const mythAnswers = events.filter((event) => event.type === "myth_quiz_answer");
  const correctMythAnswers = mythAnswers.filter((event) => event.value === true).length;
  const sectionCounts = suppressSmallBuckets(
    countBy(events, (event) => event.section || "General"),
    minCohort
  );

  return {
    totalEvents: events.length,
    moduleOpens: events.filter((event) => event.type === "module_open").length,
    preventionActions: events.filter((event) => event.type === "prevention_checklist").length,
    sciencePopups: events.filter((event) => EVIDENCE_EVENT_TYPES.includes(event.type)).length,
    // A "100% accuracy" built from two answers is noise, not a finding.
    mythCorrectRate:
      mythAnswers.length >= minCohort ? `${percent(correctMythAnswers, mythAnswers.length)}%` : "Not enough data",
    commonSection: mostCommonFromCounts(sectionCounts),
  };
}

function buildAnalyticsSummary(results = [], engagement = [], options = {}) {
  const minCohort = Number.isInteger(options.minCohort) ? options.minCohort : MIN_COHORT;

  return {
    generatedAt: new Date().toISOString(),
    minCohort,
    results: summarizeResults(Array.isArray(results) ? results : [], minCohort),
    engagement: summarizeEngagement(engagement, minCohort),
  };
}

module.exports = {
  MIN_COHORT,
  CATEGORY_KEYS,
  RISK_LEVELS,
  buildAnalyticsSummary,
  summarizeResults,
  summarizeEngagement,
  percent,
  countBy,
  mostCommonFromCounts,
  suppressSmallBuckets,
  scoreBucketFor,
  weakestCategoryLabel,
  recommendationTopic,
};
