/* ==========================================================
   Population aggregates, computed in Postgres.

   Produces exactly the raw-count shape that
   server/lib/analytics-summary.js expects, so the disclosure policy (the
   cohort floor, the small-bucket suppression) is applied by the same tested
   code that serves the in-memory path.

   Aggregating in SQL rather than loading rows keeps this O(1) in memory as
   the result table grows.
   ========================================================== */

const { query } = require("./index");
const { CATEGORY_KEYS } = require("../lib/analytics-summary");

// Averages one category's score across every result. The key is interpolated
// rather than bound because identifiers cannot be parameters -- CATEGORY_KEYS
// is a module constant, never user input, and is re-checked here.
function categoryAverageExpression(key) {
  if (!CATEGORY_KEYS.includes(key)) {
    throw new Error(`Unknown category key: ${key}`);
  }

  return `round(avg((category_scores -> '${key}' ->> 'score')::numeric)) as avg_${key}`;
}

const HEADLINE_SQL = `
  select
    count(*)::int                                                      as total,
    coalesce(round(avg(score)), 0)::int                                as average_score,
    count(*) filter (where score < 50)::int                            as bucket_0_49,
    count(*) filter (where score >= 50 and score < 65)::int            as bucket_50_64,
    count(*) filter (where score >= 65 and score < 80)::int            as bucket_65_79,
    count(*) filter (where score >= 80 and score < 90)::int            as bucket_80_89,
    count(*) filter (where score >= 90)::int                           as bucket_90_100,
    count(*) filter (where risk_level = 'Low Risk')::int               as risk_low,
    count(*) filter (where risk_level = 'Moderate Risk')::int          as risk_moderate,
    count(*) filter (where risk_level = 'High Risk')::int              as risk_high,
    ${CATEGORY_KEYS.map(categoryAverageExpression).join(",\n    ")}
  from results
`;

// The weakest category on each result, then grouped. The inner lateral picks
// the lowest-scoring entry of that row's category_scores object, breaking ties
// alphabetically by label to match weakestCategoryLabel() exactly -- see the
// comment there for why the tie-break has to be explicit.
const WEAKNESS_SQL = `
  select label, count(*)::int as count
  from (
    select (
      select entry.value ->> 'label'
      from jsonb_each(r.category_scores) as entry
      where jsonb_typeof(entry.value) = 'object'
        and entry.value ? 'label'
        and entry.value ? 'score'
      order by (entry.value ->> 'score')::numeric asc, entry.value ->> 'label' asc
      limit 1
    ) as label
    from results r
    where jsonb_typeof(r.category_scores) = 'object'
  ) weakest
  where label is not null and label <> ''
  group by label
`;

// "Flossing: try a floss pick before bed" groups under "Flossing".
const RECOMMENDATION_SQL = `
  select btrim(split_part(recommendation, ':', 1)) as topic, count(*)::int as count
  from results r,
       lateral jsonb_array_elements_text(r.recommendations) as recommendation
  where jsonb_typeof(r.recommendations) = 'array'
  group by topic
  having btrim(split_part(recommendation, ':', 1)) <> ''
`;

// Compared as jsonb rather than cast to boolean so a malformed value in an
// imported row cannot abort the whole query.
const ACHIEVEMENTS_SQL = `
  select count(*)::int as unlocked
  from results r,
       lateral jsonb_array_elements(r.achievements) as achievement
  where jsonb_typeof(r.achievements) = 'array'
    and achievement -> 'unlocked' = 'true'::jsonb
`;

const ENGAGEMENT_SQL = `
  select
    count(*)::int                                                          as total_events,
    count(*) filter (where type = 'module_open')::int                      as module_opens,
    count(*) filter (where type = 'prevention_checklist')::int             as prevention_actions,
    count(*) filter (where type in ('science_popup', 'evidence_layer'))::int as science_popups,
    count(*) filter (where type = 'myth_quiz_answer')::int                 as myth_answers,
    count(*) filter (where type = 'myth_quiz_answer'
                       and value = 'true'::jsonb)::int                     as myth_correct
  from engagement_events
`;

const SECTION_SQL = `
  select coalesce(nullif(btrim(section), ''), 'General') as section, count(*)::int as count
  from engagement_events
  group by section
`;

function toCountMap(rows, keyColumn) {
  return rows.reduce((counts, row) => {
    counts[row[keyColumn]] = Number(row.count);
    return counts;
  }, {});
}

function nullableInt(value) {
  return value === null || value === undefined ? null : Number(value);
}

async function rawResultStats() {
  const [headline, weakness, recommendations, achievements] = await Promise.all([
    query(HEADLINE_SQL),
    query(WEAKNESS_SQL),
    query(RECOMMENDATION_SQL),
    query(ACHIEVEMENTS_SQL),
  ]);

  const row = headline.rows[0] || {};

  return {
    total: Number(row.total) || 0,
    averageScore: Number(row.average_score) || 0,
    scoreDistribution: {
      "0-49": Number(row.bucket_0_49) || 0,
      "50-64": Number(row.bucket_50_64) || 0,
      "65-79": Number(row.bucket_65_79) || 0,
      "80-89": Number(row.bucket_80_89) || 0,
      "90-100": Number(row.bucket_90_100) || 0,
    },
    riskCounts: {
      "Low Risk": Number(row.risk_low) || 0,
      "Moderate Risk": Number(row.risk_moderate) || 0,
      "High Risk": Number(row.risk_high) || 0,
    },
    categoryAverages: CATEGORY_KEYS.reduce((averages, key) => {
      averages[key] = nullableInt(row[`avg_${key}`]);
      return averages;
    }, {}),
    weaknessCounts: toCountMap(weakness.rows, "label"),
    recommendationCounts: toCountMap(recommendations.rows, "topic"),
    unlockedAchievements: Number(achievements.rows[0]?.unlocked) || 0,
  };
}

async function rawEngagementStats() {
  const [totals, sections] = await Promise.all([query(ENGAGEMENT_SQL), query(SECTION_SQL)]);
  const row = totals.rows[0] || {};

  return {
    totalEvents: Number(row.total_events) || 0,
    moduleOpens: Number(row.module_opens) || 0,
    preventionActions: Number(row.prevention_actions) || 0,
    sciencePopups: Number(row.science_popups) || 0,
    mythAnswers: Number(row.myth_answers) || 0,
    mythCorrect: Number(row.myth_correct) || 0,
    sectionCounts: toCountMap(sections.rows, "section"),
  };
}

module.exports = { rawResultStats, rawEngagementStats };
