/* ==========================================================
   Demo data seeding script
   Creates realistic seeded results and explorer analytics.
   Run with: node scripts/seed-demo-data.js
   ========================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");
const EXPLORER_ANALYTICS_FILE = path.join(DATA_DIR, "tooth-explorer-analytics.json");

const DEMO_COUNT = 250;
const DEMO_SOURCE = "seeded-demo-data";

const categoryInfo = {
  brushing: {
    label: "Brushing",
    explanation: "Brushing removes plaque from tooth surfaces before it can harden or feed cavity-causing bacteria.",
  },
  flossing: {
    label: "Flossing",
    explanation: "Flossing cleans between teeth where toothbrush bristles cannot fully reach.",
  },
  diet: {
    label: "Diet",
    explanation: "Sugary drinks and sticky snacks can fuel acid attacks that weaken enamel.",
  },
  fluoride: {
    label: "Fluoride Use",
    explanation: "Fluoride helps strengthen enamel and supports cavity prevention.",
  },
  care: {
    label: "Professional Care",
    explanation: "Dental visits can catch early problems and support prevention before issues become painful.",
  },
};

const recommendationBank = {
  brushing: [
    "brushing frequency: Brushing once helps, but plaque can build up again before the day ends.",
    "bedtime brushing: Brushing before bed is one of the highest-impact habits to build first.",
    "brushing duration: Try a song or timer to reach two minutes and cover all tooth surfaces.",
  ],
  flossing: [
    "flossing: Food and plaque can remain between teeth where toothbrushes cannot reach.",
    "flossing: Start with a few teeth at a time so flossing feels less overwhelming.",
  ],
  diet: [
    "sugary drinks: Frequent sugary drinks can expose teeth to repeated acid attacks.",
    "sticky snacks: Sticky snacks can cling to grooves and between teeth after eating.",
    "water after eating: Drinking water after snacks can help reduce leftover sugars.",
  ],
  fluoride: [
    "fluoride toothpaste: Check the toothpaste label for fluoride so enamel gets daily support.",
    "fluoride toothpaste: Fluoride toothpaste is one of the easiest daily ways to help prevent cavities.",
  ],
  care: [
    "dental checkups: A checkup can catch small issues before they turn into bigger problems.",
    "gum bleeding: Bleeding gums can mean plaque is irritating the gumline.",
  ],
};

const achievementRules = [
  { name: "Smile Champion", icon: "🏆", description: "Score 90 or higher.", isUnlocked: (result) => result.score >= 90 },
  { name: "Plaque Fighter", icon: "🛡️", description: "Score 75 or higher.", isUnlocked: (result) => result.score >= 75 },
  { name: "Floss Master", icon: "🧵", description: "Show a strong flossing habit.", isUnlocked: (result) => result.categoryScores.flossing.score >= 80 },
  { name: "Sugar Detective", icon: "🔎", description: "Keep diet risk low.", isUnlocked: (result) => result.categoryScores.diet.score >= 80 },
  { name: "Prevention Pro", icon: "📅", description: "Stay current with professional care.", isUnlocked: (result) => result.categoryScores.care.score >= 80 },
];

let seed = 2032;

function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromBand() {
  const roll = random();

  if (roll < 0.18) return randomInt(35, 49);
  if (roll < 0.58) return randomInt(50, 74);
  if (roll < 0.88) return randomInt(75, 89);
  return randomInt(90, 100);
}

function getRiskLevel(score) {
  if (score >= 80) return "Low Risk";
  if (score >= 50) return "Moderate Risk";
  return "High Risk";
}

function getBadge(score) {
  if (score >= 90) {
    return { name: "Smile Champion", icon: "🏆", message: "Amazing routine. Daily habits are strongly supporting this smile." };
  }
  if (score >= 75) {
    return { name: "Plaque Fighter", icon: "🛡️", message: "Strong prevention habits with a few opportunities to improve." };
  }
  if (score >= 50) {
    return { name: "Cavity Defender", icon: "⚔️", message: "Some helpful habits are present, with clear growth areas." };
  }
  return { name: "Smile Starter", icon: "🌱", message: "A starting point for building stronger daily prevention habits." };
}

function makeCategoryScores(score) {
  const weaknessProfiles = [
    ["flossing", "diet"],
    ["diet", "fluoride"],
    ["care", "flossing"],
    ["brushing", "diet"],
    ["fluoride", "care"],
  ];
  const weakCategories = pick(weaknessProfiles);
  const categoryScores = {};

  Object.entries(categoryInfo).forEach(([key, info]) => {
    const penalty = weakCategories.includes(key) ? randomInt(10, 28) : randomInt(-8, 12);
    const categoryScore = clamp(score - penalty + randomInt(-5, 5), 18, 100);
    categoryScores[key] = {
      label: info.label,
      score: categoryScore,
      explanation: info.explanation,
    };
  });

  return categoryScores;
}

function getHabitExtremes(categoryScores) {
  const sorted = Object.values(categoryScores).sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return {
    weakestHabit: {
      topic: weakest.label.toLowerCase(),
      score: Math.round(weakest.score / 10),
      feedback: `${weakest.label} is the lowest category and may need targeted education.`,
    },
    strongestHabit: {
      topic: strongest.label.toLowerCase(),
      score: Math.round(strongest.score / 10),
      feedback: `${strongest.label} is currently the strongest prevention area.`,
    },
  };
}

function makeRecommendations(categoryScores) {
  return Object.entries(categoryScores)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3)
    .flatMap(([key]) => recommendationBank[key].slice(0, 1));
}

function makeResult(index, previousResult) {
  const score = scoreFromBand();
  const categoryScores = makeCategoryScores(score);
  const { strongestHabit, weakestHabit } = getHabitExtremes(categoryScores);
  const recommendations = makeRecommendations(categoryScores);
  const baseResult = {
    id: crypto.randomUUID(),
    userId: `DEMO-${String(index + 1).padStart(3, "0")}`,
    isDemo: true,
    source: DEMO_SOURCE,
    score,
    riskLevel: getRiskLevel(score),
    badge: getBadge(score),
    categoryScores,
    strongestHabit,
    weakestHabit,
    recommendations,
    report: Object.values(categoryScores).map((category) => ({
      category: category.label,
      score: category.score,
      explanation: category.explanation,
    })),
    completedAt: new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000 - randomInt(0, 86400) * 1000).toISOString(),
  };

  const achievements = achievementRules.map((achievement) => ({
    name: achievement.name,
    icon: achievement.icon,
    description: achievement.description,
    unlocked: achievement.isUnlocked(baseResult),
  }));
  const previousScore = previousResult ? previousResult.score : null;
  const change = previousScore === null ? 0 : score - previousScore;

  return {
    ...baseResult,
    achievements,
    trend: {
      previousScore,
      change,
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    },
  };
}

function makeExplorerAnalytics() {
  const toothIds = ["UR6", "UL6", "LR6", "LL6", "UR1", "UL1", "LR1", "LL1", "UR7", "UL7", "LR7", "LL7"];
  const events = [];

  for (let i = 0; i < 420; i += 1) {
    const age = randomInt(5, 18);
    const isLookup = random() < 0.58;
    const toothId = pick(toothIds);
    events.push({
      id: crypto.randomUUID(),
      type: isLookup ? "age_lookup" : "tooth_interaction",
      age,
      toothId: isLookup ? null : toothId,
      toothName: isLookup ? null : `Demo tooth ${toothId}`,
      status: isLookup ? null : pick(["present", "erupting", "later"]),
      isDemo: true,
      source: DEMO_SOURCE,
      createdAt: new Date(Date.now() - randomInt(0, 60) * 24 * 60 * 60 * 1000 - randomInt(0, 86400) * 1000).toISOString(),
    });
  }

  return events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < DEMO_COUNT; i += 1) {
    results.push(makeResult(i, results[0]));
  }

  results.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  fs.writeFileSync(EXPLORER_ANALYTICS_FILE, JSON.stringify(makeExplorerAnalytics(), null, 2));

  console.log(`Seeded ${results.length} demo quiz results.`);
  console.log(`Seeded 420 demo tooth explorer analytics events.`);
  console.log("Demo data is marked with isDemo: true and source: seeded-demo-data.");
}

main();
