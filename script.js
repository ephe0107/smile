/* ==========================================================
   20 to 32 Smile Check
   Frontend logic: quiz, category report, visual dashboard,
   achievements, trends, saved history, myths, and certificate.
   ========================================================== */

const RESULTS_API = "/results";
const EXPLORER_ANALYTICS_API = "/explorer-analytics";

// Category explanations turn the score into education, not just a number.
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

// Each answer includes specific feedback used by the recommendation engine.
const quizQuestions = [
  {
    question: "How many times do you brush per day?",
    category: "brushing",
    topic: "brushing frequency",
    answers: [
      { text: "Twice or more", score: 10, feedback: "Your brushing frequency is strong. Keep brushing morning and night." },
      { text: "Once", score: 6, feedback: "Brushing once helps, but plaque can build up again before the day ends." },
      { text: "Not every day", score: 2, feedback: "Skipping brushing gives plaque more time to sit on teeth and irritate gums." },
      { text: "I rarely brush", score: 0, feedback: "A simple goal is brushing once tonight, then building toward twice daily." },
    ],
  },
  {
    question: "How often do you floss?",
    category: "flossing",
    topic: "flossing",
    answers: [
      { text: "Every day", score: 10, feedback: "Daily flossing helps clean the tight spaces between teeth." },
      { text: "A few times a week", score: 7, feedback: "You already floss sometimes. Try linking it to one daily routine, like bedtime." },
      { text: "Sometimes", score: 4, feedback: "Food and plaque can remain between teeth where toothbrushes cannot reach." },
      { text: "Almost never", score: 0, feedback: "Start with one or two teeth at a time so flossing feels less overwhelming." },
    ],
  },
  {
    question: "Do you use fluoride toothpaste?",
    category: "fluoride",
    topic: "fluoride toothpaste",
    answers: [
      { text: "Yes, every time", score: 10, feedback: "Fluoride toothpaste gives your enamel regular support." },
      { text: "Sometimes", score: 6, feedback: "Using fluoride toothpaste every time gives your teeth more consistent protection." },
      { text: "I am not sure", score: 4, feedback: "Check the toothpaste label for fluoride so you know your enamel is getting support." },
      { text: "No", score: 0, feedback: "Fluoride toothpaste is one of the easiest daily ways to help prevent cavities." },
    ],
  },
  {
    question: "How many sugary drinks do you have per week?",
    category: "diet",
    topic: "sugary drinks",
    answers: [
      { text: "0 to 1", score: 10, feedback: "Low sugary drink intake is a strong protective habit." },
      { text: "2 to 3", score: 7, feedback: "A few sugary drinks are manageable, especially if water is your usual choice." },
      { text: "4 to 6", score: 4, feedback: "Frequent sugary drinks can expose teeth to repeated acid attacks." },
      { text: "7 or more", score: 0, feedback: "Daily sugary drinks can raise cavity risk. Try replacing one with water this week." },
    ],
  },
  {
    question: "How often do you eat candy or sticky snacks?",
    category: "diet",
    topic: "sticky snacks",
    answers: [
      { text: "Rarely", score: 10, feedback: "Rare sticky snacks mean less sugar clinging to teeth." },
      { text: "A few times a week", score: 7, feedback: "Keeping sticky snacks occasional is a good prevention strategy." },
      { text: "Most days", score: 3, feedback: "Sticky snacks can cling to grooves and between teeth after eating." },
      { text: "Many times a day", score: 0, feedback: "Frequent snacking gives bacteria more chances to make acids throughout the day." },
    ],
  },
  {
    question: "When was your last dental checkup?",
    category: "care",
    topic: "dental checkups",
    answers: [
      { text: "Within the last 6 months", score: 10, feedback: "Regular checkups support prevention and early care." },
      { text: "Within the last year", score: 8, feedback: "A yearly checkup is helpful; ask your dentist what schedule fits you best." },
      { text: "More than a year ago", score: 4, feedback: "A checkup can catch small issues before they turn into bigger problems." },
      { text: "I do not remember", score: 1, feedback: "If you cannot remember your last visit, it may be time to ask about booking one." },
    ],
  },
  {
    question: "Do your gums bleed when brushing or flossing?",
    category: "care",
    topic: "gum bleeding",
    answers: [
      { text: "No", score: 10, feedback: "No bleeding is a positive sign for gum health." },
      { text: "Only rarely", score: 7, feedback: "Rare bleeding can happen, but keep watching your gums and brushing gently." },
      { text: "Sometimes", score: 3, feedback: "Bleeding gums can mean plaque is irritating the gumline." },
      { text: "Often", score: 0, feedback: "Frequent gum bleeding is a reason to improve daily care and ask a dental professional." },
    ],
  },
  {
    question: "Do you drink water after meals or snacks?",
    category: "diet",
    topic: "water after eating",
    answers: [
      { text: "Almost always", score: 10, feedback: "Water after eating helps rinse away food particles and sugars." },
      { text: "Sometimes", score: 6, feedback: "Drinking water more often after snacks can help reduce leftover sugars." },
      { text: "Rarely", score: 2, feedback: "Without water, sugars and food particles may sit on teeth longer." },
      { text: "I mostly drink something else", score: 0, feedback: "Replacing after-snack drinks with water is a simple tooth-friendly upgrade." },
    ],
  },
  {
    question: "Do you brush before bed?",
    category: "brushing",
    topic: "bedtime brushing",
    answers: [
      { text: "Every night", score: 10, feedback: "Bedtime brushing removes plaque before it sits overnight." },
      { text: "Most nights", score: 7, feedback: "You are close. A bedtime reminder can make this habit automatic." },
      { text: "Sometimes", score: 3, feedback: "Plaque left overnight has more time to bother teeth and gums." },
      { text: "Rarely", score: 0, feedback: "Brushing before bed is one of the highest-impact habits to build first." },
    ],
  },
  {
    question: "Do you know how long to brush for?",
    category: "brushing",
    topic: "brushing duration",
    answers: [
      { text: "Yes, about 2 minutes", score: 10, feedback: "Two minutes gives you time to reach all sides of your teeth." },
      { text: "I brush for about 1 minute", score: 5, feedback: "One minute can miss areas. Try a song or timer to reach two minutes." },
      { text: "I brush very quickly", score: 2, feedback: "Quick brushing often skips gumline areas and back teeth." },
      { text: "I am not sure", score: 3, feedback: "Use a timer once to learn what two minutes feels like." },
    ],
  },
];

const myths = [
  {
    statement: "Baby teeth do not matter.",
    correctAnswer: false,
    feedback: "Myth. Baby teeth help with chewing, speech, and holding space for adult teeth.",
  },
  {
    statement: "Juice is always healthy for teeth.",
    correctAnswer: false,
    feedback: "Myth. Juice can contain sugar and acid, so water is usually the better everyday drink.",
  },
  {
    statement: "Flossing cleans areas brushing cannot reach.",
    correctAnswer: true,
    feedback: "True. Floss can clean between teeth where toothbrush bristles may not reach.",
  },
  {
    statement: "Brushing harder is better.",
    correctAnswer: false,
    feedback: "Myth. Gentle brushing with good technique is better than scrubbing hard.",
  },
  {
    statement: "Dental checkups help prevent problems early.",
    correctAnswer: true,
    feedback: "True. Checkups can help find issues before they become more serious.",
  },
];

const achievementRules = [
  {
    name: "Smile Champion",
    icon: "🏆",
    description: "Score 90 or higher.",
    isUnlocked: (result) => result.score >= 90,
  },
  {
    name: "Plaque Fighter",
    icon: "🛡️",
    description: "Score 75 or higher.",
    isUnlocked: (result) => result.score >= 75,
  },
  {
    name: "Floss Master",
    icon: "🧵",
    description: "Show a strong flossing habit.",
    isUnlocked: (result) => result.categoryScores.flossing.score >= 80,
  },
  {
    name: "Sugar Detective",
    icon: "🔎",
    description: "Keep diet risk low.",
    isUnlocked: (result) => result.categoryScores.diet.score >= 80,
  },
  {
    name: "Prevention Pro",
    icon: "📅",
    description: "Stay current with professional care.",
    isUnlocked: (result) => result.categoryScores.care.score >= 80,
  },
];

const toothData = [
  { id: "UR8", name: "Upper right third molar", type: "permanent", presentFrom: 17, erupting: [17, 18], fact: "Third molars are often called wisdom teeth and may not erupt for everyone." },
  { id: "UR7", name: "Upper right second molar", type: "permanent", presentFrom: 12, erupting: [12, 13], fact: "Second molars often arrive around the early teen years." },
  { id: "UR6", name: "Upper right first molar", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "First permanent molars erupt behind baby teeth and are easy to miss." },
  { id: "UR5", name: "Upper right second premolar", type: "permanent", presentFrom: 10, erupting: [10, 12], fact: "Premolars replace baby molars and help grind food." },
  { id: "UR4", name: "Upper right first premolar", type: "permanent", presentFrom: 10, erupting: [10, 11], fact: "Premolars are part of the transition from primary to permanent teeth." },
  { id: "UR3", name: "Upper right canine", type: "permanent", presentFrom: 11, erupting: [11, 12], fact: "Canines help guide the bite and tear food." },
  { id: "UR2", name: "Upper right lateral incisor", type: "permanent", presentFrom: 8, erupting: [8, 9], fact: "Lateral incisors help shape the smile." },
  { id: "UR1", name: "Upper right central incisor", type: "permanent", presentFrom: 7, erupting: [7, 8], fact: "Front permanent incisors are usually among the first visible adult teeth." },
  { id: "UL1", name: "Upper left central incisor", type: "permanent", presentFrom: 7, erupting: [7, 8], fact: "Front permanent incisors are usually among the first visible adult teeth." },
  { id: "UL2", name: "Upper left lateral incisor", type: "permanent", presentFrom: 8, erupting: [8, 9], fact: "Lateral incisors help shape the smile." },
  { id: "UL3", name: "Upper left canine", type: "permanent", presentFrom: 11, erupting: [11, 12], fact: "Canines help guide the bite and tear food." },
  { id: "UL4", name: "Upper left first premolar", type: "permanent", presentFrom: 10, erupting: [10, 11], fact: "Premolars are part of the transition from primary to permanent teeth." },
  { id: "UL5", name: "Upper left second premolar", type: "permanent", presentFrom: 10, erupting: [10, 12], fact: "Premolars replace baby molars and help grind food." },
  { id: "UL6", name: "Upper left first molar", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "First permanent molars erupt behind baby teeth and are easy to miss." },
  { id: "UL7", name: "Upper left second molar", type: "permanent", presentFrom: 12, erupting: [12, 13], fact: "Second molars often arrive around the early teen years." },
  { id: "UL8", name: "Upper left third molar", type: "permanent", presentFrom: 17, erupting: [17, 18], fact: "Third molars are often called wisdom teeth and may not erupt for everyone." },
  { id: "LR8", name: "Lower right third molar", type: "permanent", presentFrom: 17, erupting: [17, 18], fact: "Wisdom teeth vary a lot, so dental professionals monitor them with exams and X-rays." },
  { id: "LR7", name: "Lower right second molar", type: "permanent", presentFrom: 11, erupting: [11, 13], fact: "Lower second molars often erupt slightly before or around upper second molars." },
  { id: "LR6", name: "Lower right first molar", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "Six-year molars are permanent and do not replace a baby tooth." },
  { id: "LR5", name: "Lower right second premolar", type: "permanent", presentFrom: 11, erupting: [11, 12], fact: "Second premolars usually replace second primary molars." },
  { id: "LR4", name: "Lower right first premolar", type: "permanent", presentFrom: 10, erupting: [10, 12], fact: "Premolars are only in the permanent set of teeth." },
  { id: "LR3", name: "Lower right canine", type: "permanent", presentFrom: 9, erupting: [9, 10], fact: "Lower canines often erupt before upper canines." },
  { id: "LR2", name: "Lower right lateral incisor", type: "permanent", presentFrom: 7, erupting: [7, 8], fact: "Lower incisors often appear early in the mixed dentition stage." },
  { id: "LR1", name: "Lower right central incisor", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "Lower central incisors are often among the first baby teeth to be replaced." },
  { id: "LL1", name: "Lower left central incisor", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "Lower central incisors are often among the first baby teeth to be replaced." },
  { id: "LL2", name: "Lower left lateral incisor", type: "permanent", presentFrom: 7, erupting: [7, 8], fact: "Lower incisors often appear early in the mixed dentition stage." },
  { id: "LL3", name: "Lower left canine", type: "permanent", presentFrom: 9, erupting: [9, 10], fact: "Lower canines often erupt before upper canines." },
  { id: "LL4", name: "Lower left first premolar", type: "permanent", presentFrom: 10, erupting: [10, 12], fact: "Premolars are only in the permanent set of teeth." },
  { id: "LL5", name: "Lower left second premolar", type: "permanent", presentFrom: 11, erupting: [11, 12], fact: "Second premolars usually replace second primary molars." },
  { id: "LL6", name: "Lower left first molar", type: "permanent", presentFrom: 6, erupting: [6, 7], fact: "Six-year molars are permanent and do not replace a baby tooth." },
  { id: "LL7", name: "Lower left second molar", type: "permanent", presentFrom: 11, erupting: [11, 13], fact: "Lower second molars often erupt slightly before or around upper second molars." },
  { id: "LL8", name: "Lower left third molar", type: "permanent", presentFrom: 17, erupting: [17, 18], fact: "Wisdom teeth vary a lot, so dental professionals monitor them with exams and X-rays." },
];

const primaryLossByAge = {
  5: [],
  6: ["Lower central incisors may begin loosening"],
  7: ["Upper central incisors", "Lower lateral incisors"],
  8: ["Upper lateral incisors"],
  9: ["Lower canines may begin exfoliating"],
  10: ["First primary molars", "Lower canines"],
  11: ["Second primary molars", "Upper canines"],
  12: ["Remaining primary molars or canines"],
  13: ["Most primary teeth are usually lost"],
  14: [],
  15: [],
  16: [],
  17: [],
  18: [],
};

const ageFacts = {
  5: ["Primary dentition", "Most children still have many primary teeth at age 5."],
  6: ["Six-year molars", "First permanent molars can erupt behind baby teeth without replacing one."],
  7: ["Front tooth transition", "Central incisors are commonly changing during this stage."],
  8: ["Mixed dentition", "A mix of primary and permanent teeth is expected."],
  9: ["Canine watch", "Lower canines may begin changing before upper canines."],
  10: ["Premolar transition", "Premolars begin replacing primary molars for many children."],
  11: ["Active eruption", "Canines, premolars, and second molars may be changing."],
  12: ["Teen dentition", "Most permanent teeth except wisdom teeth are often present or erupting."],
  13: ["Permanent smile", "Most primary teeth have usually been replaced by this age."],
  14: ["Settling bite", "Orthodontic care may focus on alignment and bite development."],
  15: ["Maintenance stage", "Prevention and hygiene become especially important for long-term health."],
  16: ["Third molar monitoring", "Dental teams may begin watching wisdom tooth development."],
  17: ["Wisdom tooth range", "Third molars may begin erupting for some teens."],
  18: ["Adult dentition", "Most permanent teeth are present, though wisdom teeth vary widely."],
};

let currentQuestionIndex = 0;
let selectedAnswers = Array(quizQuestions.length).fill(null);
let finalResult = null;

const screens = document.querySelectorAll(".section-screen");
const startQuizBtn = document.querySelector("#startQuizBtn");
const questionCounter = document.querySelector("#questionCounter");
const progressPercent = document.querySelector("#progressPercent");
const quizProgress = document.querySelector("#quizProgress");
const questionText = document.querySelector("#questionText");
const answerGrid = document.querySelector("#answerGrid");
const prevQuestionBtn = document.querySelector("#prevQuestionBtn");
const nextQuestionBtn = document.querySelector("#nextQuestionBtn");
const scoreNumber = document.querySelector("#scoreNumber");
const riskLevel = document.querySelector("#riskLevel");
const badgeIcon = document.querySelector("#badgeIcon");
const badgeName = document.querySelector("#badgeName");
const badgeMessage = document.querySelector("#badgeMessage");
const riskDashboardTitle = document.querySelector("#riskDashboardTitle");
const trendSummary = document.querySelector("#trendSummary");
const scoreChart = document.querySelector("#scoreChart");
const scoreChartLabel = document.querySelector("#scoreChartLabel");
const strongestHabit = document.querySelector("#strongestHabit");
const strongestHabitText = document.querySelector("#strongestHabitText");
const weakestHabit = document.querySelector("#weakestHabit");
const weakestHabitText = document.querySelector("#weakestHabitText");
const categoryList = document.querySelector("#categoryList");
const recommendationList = document.querySelector("#recommendationList");
const achievementList = document.querySelector("#achievementList");
const saveStatus = document.querySelector("#saveStatus");
const viewDashboardBtn = document.querySelector("#viewDashboardBtn");
const goToMythsBtn = document.querySelector("#goToMythsBtn");
const retakeQuizBtn = document.querySelector("#retakeQuizBtn");
const historyStatus = document.querySelector("#historyStatus");
const historyList = document.querySelector("#historyList");
const refreshHistoryBtn = document.querySelector("#refreshHistoryBtn");
const dashboardRetakeBtn = document.querySelector("#dashboardRetakeBtn");
const selectedAge = document.querySelector("#selectedAge");
const ageSlider = document.querySelector("#ageSlider");
const presentCount = document.querySelector("#presentCount");
const presentText = document.querySelector("#presentText");
const presentDiagram = document.querySelector("#presentDiagram");
const eruptingCount = document.querySelector("#eruptingCount");
const eruptingText = document.querySelector("#eruptingText");
const eruptingDiagram = document.querySelector("#eruptingDiagram");
const lostCount = document.querySelector("#lostCount");
const lostText = document.querySelector("#lostText");
const lostDiagram = document.querySelector("#lostDiagram");
const dentalChart = document.querySelector("#dentalChart");
const toothInfo = document.querySelector("#toothInfo");
const ageFactTitle = document.querySelector("#ageFactTitle");
const ageFact = document.querySelector("#ageFact");
const explorerStatus = document.querySelector("#explorerStatus");
const analyticsStatus = document.querySelector("#analyticsStatus");
const refreshAnalyticsBtn = document.querySelector("#refreshAnalyticsBtn");
const metricGrid = document.querySelector("#metricGrid");
const scoreDistributionChart = document.querySelector("#scoreDistributionChart");
const riskDistributionChart = document.querySelector("#riskDistributionChart");
const issueChart = document.querySelector("#issueChart");
const impactHeadline = document.querySelector("#impactHeadline");
const impactSummary = document.querySelector("#impactSummary");
const impactMetricsStatus = document.querySelector("#impactMetricsStatus");
const refreshImpactBtn = document.querySelector("#refreshImpactBtn");
const impactMetricsGrid = document.querySelector("#impactMetricsGrid");
const mythList = document.querySelector("#mythList");
const certificateBtn = document.querySelector("#certificateBtn");
const certificateBadge = document.querySelector("#certificateBadge");
const certificateBadgeName = document.querySelector("#certificateBadgeName");
const certificateScore = document.querySelector("#certificateScore");
const restartBtn = document.querySelector("#restartBtn");

function showScreen(screenId) {
  screens.forEach((screen) => {
    screen.classList.toggle("active-screen", screen.id === screenId);
  });

  document.querySelector(`#${screenId}`).scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectedAnswerFor(index) {
  const selectedIndex = selectedAnswers[index];
  return quizQuestions[index].answers[selectedIndex];
}

function renderQuestion() {
  const question = quizQuestions[currentQuestionIndex];
  const progress = Math.round(((currentQuestionIndex + 1) / quizQuestions.length) * 100);

  questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
  progressPercent.textContent = `${progress}%`;
  quizProgress.style.width = `${progress}%`;
  questionText.textContent = question.question;
  answerGrid.innerHTML = "";

  question.answers.forEach((answer, answerIndex) => {
    const button = document.createElement("button");
    button.className = "answer-option";
    button.type = "button";

    if (selectedAnswers[currentQuestionIndex] === answerIndex) {
      button.classList.add("selected");
    }

    button.innerHTML = `
      <span class="answer-marker">${String.fromCharCode(65 + answerIndex)}</span>
      <span>${answer.text}</span>
    `;

    button.addEventListener("click", () => {
      selectedAnswers[currentQuestionIndex] = answerIndex;
      renderQuestion();
    });

    answerGrid.appendChild(button);
  });

  prevQuestionBtn.disabled = currentQuestionIndex === 0;
  nextQuestionBtn.textContent = currentQuestionIndex === quizQuestions.length - 1 ? "See Results" : "Next";
}

function calculateScore() {
  const total = quizQuestions.reduce((sum, question, index) => {
    return sum + selectedAnswerFor(index).score;
  }, 0);

  return Math.round(total);
}

function getBadge(score) {
  if (score >= 90) {
    return {
      name: "Smile Champion",
      icon: "🏆",
      message: "Amazing routine. Your daily habits are strongly supporting your smile.",
    };
  }

  if (score >= 75) {
    return {
      name: "Plaque Fighter",
      icon: "🛡️",
      message: "Great work. A few small upgrades can make your routine even stronger.",
    };
  }

  if (score >= 50) {
    return {
      name: "Cavity Defender",
      icon: "⚔️",
      message: "You have some helpful habits and a few clear areas to improve.",
    };
  }

  return {
    name: "Smile Starter",
    icon: "🌱",
    message: "This is a good starting point. Small daily changes can make a big difference.",
  };
}

function getRiskLevel(score) {
  if (score >= 80) {
    return { label: "Low Risk", className: "" };
  }

  if (score >= 50) {
    return { label: "Moderate Risk", className: "moderate" };
  }

  return { label: "High Risk", className: "high" };
}

function getCategoryScores() {
  return Object.fromEntries(
    Object.entries(categoryInfo).map(([categoryKey, info]) => {
      const categoryQuestions = quizQuestions
        .map((question, index) => ({ question, answer: selectedAnswerFor(index) }))
        .filter((item) => item.question.category === categoryKey);
      const earned = categoryQuestions.reduce((sum, item) => sum + item.answer.score, 0);
      const possible = categoryQuestions.length * 10;

      return [
        categoryKey,
        {
          label: info.label,
          score: Math.round((earned / possible) * 100),
          explanation: info.explanation,
        },
      ];
    })
  );
}

function getHabitExtremes() {
  const scoredHabits = quizQuestions.map((question, index) => ({
    topic: question.topic,
    score: selectedAnswerFor(index).score,
    feedback: selectedAnswerFor(index).feedback,
  }));

  const sorted = [...scoredHabits].sort((a, b) => a.score - b.score);

  return {
    weakest: sorted[0],
    strongest: sorted[sorted.length - 1],
  };
}

function getRecommendations() {
  const recommendations = quizQuestions
    .map((question, index) => ({
      topic: question.topic,
      score: selectedAnswerFor(index).score,
      text: selectedAnswerFor(index).feedback,
    }))
    .filter((item) => item.score < 8)
    .sort((a, b) => a.score - b.score)
    .map((item) => `${item.topic}: ${item.text}`);

  if (recommendations.length) {
    return recommendations.slice(0, 6);
  }

  return [
    "brushing: Keep brushing twice daily for about two minutes.",
    "flossing: Keep flossing daily to clean between teeth.",
    "prevention: Keep regular dental visits so small issues can be caught early.",
  ];
}

function getAchievements(partialResult) {
  return achievementRules.map((achievement) => ({
    name: achievement.name,
    icon: achievement.icon,
    description: achievement.description,
    unlocked: achievement.isUnlocked(partialResult),
  }));
}

function buildReport(categoryScores) {
  return Object.values(categoryScores).map((category) => ({
    category: category.label,
    score: category.score,
    explanation: category.explanation,
  }));
}

function buildResult() {
  const score = calculateScore();
  const risk = getRiskLevel(score);
  const badge = getBadge(score);
  const categoryScores = getCategoryScores();
  const habits = getHabitExtremes();
  const baseResult = {
    score,
    riskLevel: risk.label,
    riskClassName: risk.className,
    badge,
    categoryScores,
    strongestHabit: habits.strongest,
    weakestHabit: habits.weakest,
    recommendations: getRecommendations(),
    report: buildReport(categoryScores),
  };

  return {
    ...baseResult,
    achievements: getAchievements(baseResult),
  };
}

function renderCategoryReport(categoryScores) {
  categoryList.innerHTML = "";

  Object.values(categoryScores).forEach((category) => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <div class="category-topline">
        <div>
          <span>${category.label}</span>
          <strong>${category.score}/100</strong>
        </div>
      </div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill" style="--value: ${category.score}%"></div>
      </div>
      <p>${category.explanation}</p>
    `;

    categoryList.appendChild(card);
  });
}

function renderAchievements(achievements) {
  achievementList.innerHTML = "";

  achievements.forEach((achievement) => {
    const item = document.createElement("div");
    item.className = `achievement-item ${achievement.unlocked ? "unlocked" : ""}`;
    item.innerHTML = `
      <span>${achievement.icon}</span>
      <strong>${achievement.name}</strong>
      <p>${achievement.unlocked ? "Unlocked" : achievement.description}</p>
    `;

    achievementList.appendChild(item);
  });
}

function renderTrend(trend) {
  if (!trend || trend.previousScore === null || trend.previousScore === undefined) {
    trendSummary.textContent = "This is your first saved result. Retake the quiz later to track progress.";
    return;
  }

  if (trend.change > 0) {
    trendSummary.textContent = `Progress tracking: up ${trend.change} points from your previous score of ${trend.previousScore}.`;
    return;
  }

  if (trend.change < 0) {
    trendSummary.textContent = `Progress tracking: down ${Math.abs(trend.change)} points from your previous score of ${trend.previousScore}.`;
    return;
  }

  trendSummary.textContent = `Progress tracking: no change from your previous score of ${trend.previousScore}.`;
}

async function saveResult(result) {
  saveStatus.textContent = "Saving your result...";
  saveStatus.className = "save-status";

  try {
    const response = await fetch(RESULTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The result could not be saved.");
    }

    finalResult = data.result;
    renderTrend(finalResult.trend);
    saveStatus.textContent = "Saved to your dashboard.";
    saveStatus.className = "save-status success";
  } catch (error) {
    saveStatus.textContent = `Result shown, but save failed: ${error.message}`;
    saveStatus.className = "save-status error";
  }
}

function renderResults() {
  finalResult = buildResult();

  scoreNumber.textContent = finalResult.score;
  riskLevel.textContent = finalResult.riskLevel;
  riskLevel.className = `risk-pill ${finalResult.riskClassName}`;
  badgeIcon.textContent = finalResult.badge.icon;
  badgeName.textContent = finalResult.badge.name;
  badgeMessage.textContent = finalResult.badge.message;
  riskDashboardTitle.textContent = `${finalResult.riskLevel} • ${finalResult.badge.name}`;
  scoreChart.style.setProperty("--score", finalResult.score);
  scoreChartLabel.textContent = `${finalResult.score}%`;
  strongestHabit.textContent = finalResult.strongestHabit.topic;
  strongestHabitText.textContent = finalResult.strongestHabit.feedback;
  weakestHabit.textContent = finalResult.weakestHabit.topic;
  weakestHabitText.textContent = finalResult.weakestHabit.feedback;
  renderTrend(null);
  renderCategoryReport(finalResult.categoryScores);
  renderAchievements(finalResult.achievements);

  recommendationList.innerHTML = "";
  finalResult.recommendations.forEach((recommendation) => {
    const item = document.createElement("li");
    item.textContent = recommendation;
    recommendationList.appendChild(item);
  });

  saveResult(finalResult);
}

async function loadHistory() {
  historyStatus.textContent = "Loading saved results...";
  historyList.innerHTML = "";

  try {
    const response = await fetch(RESULTS_API);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Saved results could not be loaded.");
    }

    renderHistory(data.results);
  } catch (error) {
    historyStatus.textContent = `Could not load history: ${error.message}`;
    historyList.innerHTML = `
      <div class="empty-history">
        The dashboard needs the backend running to show saved results.
      </div>
    `;
  }
}

function formatTrend(change) {
  if (change > 0) {
    return { text: `+${change}`, className: "" };
  }

  if (change < 0) {
    return { text: `${change}`, className: "down" };
  }

  return { text: "0", className: "flat" };
}

function renderHistory(results) {
  historyList.innerHTML = "";

  if (!results.length) {
    historyStatus.textContent = "No saved results yet.";
    historyList.innerHTML = `
      <div class="empty-history">
        Complete the Smile Check once and your result will appear here.
      </div>
    `;
    return;
  }

  const demoCount = results.filter((result) => result.isDemo).length;
  historyStatus.textContent = `${results.length} saved result${results.length === 1 ? "" : "s"}${demoCount ? ` • ${demoCount} seeded demo` : ""}`;

  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "history-card";
    const date = new Date(result.completedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const unlockedCount = (result.achievements || []).filter((achievement) => achievement.unlocked).length;
    const trend = formatTrend(result.trend ? result.trend.change : 0);

    card.innerHTML = `
      <div class="history-badge">${result.badge.icon}</div>
      <div>
        <h3>${result.badge.name}</h3>
        <p>${result.riskLevel} • ${unlockedCount} achievements • ${date}${result.isDemo ? " • Demo data" : ""}</p>
      </div>
      <div class="history-score">${result.score}/100</div>
      <div class="history-trend ${trend.className}">${trend.text}</div>
    `;

    historyList.appendChild(card);
  });
}

function getToothStatus(tooth, age) {
  if (tooth.erupting.includes(age)) {
    return "erupting";
  }

  if (age >= tooth.presentFrom) {
    return "present";
  }

  return "later";
}

function summarizeTeeth(teeth) {
  if (!teeth.length) {
    return "None typically expected for this category at this exact age.";
  }

  return teeth
    .slice(0, 6)
    .map((tooth) => tooth.name.replace(/^(Upper|Lower) /, ""))
    .join(", ") + (teeth.length > 6 ? `, and ${teeth.length - 6} more` : "");
}

function toothSvg(label) {
  return `
    <svg viewBox="0 0 48 58" aria-hidden="true">
      <path class="tooth-crown" d="M13.5 5.5c4.2 0 6.3 2.1 10.5 2.1s6.3-2.1 10.5-2.1c7.9 0 13 6.5 11.1 16.1-1.2 6.1-3.8 9.8-6 15.6-2.2 5.8-3.3 15.2-8.1 15.2-4.1 0-3.6-12.4-7.5-12.4s-3.4 12.4-7.5 12.4c-4.8 0-5.9-9.4-8.1-15.2-2.2-5.8-4.8-9.5-6-15.6C.5 12 5.6 5.5 13.5 5.5Z" />
      <text x="24" y="27" text-anchor="middle" class="tooth-label">${label}</text>
    </svg>
  `;
}

function renderMiniDiagram(container, items, status, fallbackLabels = []) {
  container.innerHTML = "";
  const visualItems = items.slice(0, 8);

  if (!visualItems.length && fallbackLabels.length) {
    fallbackLabels.slice(0, 4).forEach((label) => {
      const item = document.createElement("div");
      item.className = `mini-tooth ${status}`;
      item.innerHTML = toothSvg("P");
      item.title = label;
      container.appendChild(item);
    });
    return;
  }

  if (!visualItems.length) {
    container.innerHTML = `<span class="mini-empty">No major changes</span>`;
    return;
  }

  visualItems.forEach((tooth) => {
    const item = document.createElement("div");
    item.className = `mini-tooth ${status}`;
    item.innerHTML = toothSvg(tooth.id.slice(-1));
    item.title = tooth.name;
    container.appendChild(item);
  });
}

async function trackExplorerEvent(event) {
  try {
    await fetch(EXPLORER_ANALYTICS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    explorerStatus.textContent = "Explorer interaction saved.";
    explorerStatus.className = "save-status success";
  } catch (error) {
    explorerStatus.textContent = "Explorer is working, but analytics could not be saved.";
    explorerStatus.className = "save-status error";
  }
}

function updateToothInfo(tooth, status, age) {
  const statusText = {
    present: "Expected to be present",
    erupting: "Likely erupting",
    later: "Not typically expected yet",
  };

  toothInfo.innerHTML = `
    <strong>${tooth.name}</strong>
    <span>${statusText[status]} at age ${age}</span>
    <p>${tooth.fact}</p>
  `;
}

function renderDentalChart(age) {
  dentalChart.innerHTML = "";

  toothData.forEach((tooth) => {
    if (tooth.id === "LR8") {
      const divider = document.createElement("div");
      divider.className = "arch-divider";
      divider.textContent = "Lower arch";
      dentalChart.appendChild(divider);
    }

    const status = getToothStatus(tooth, age);
    const button = document.createElement("button");
    button.className = `tooth-button ${status}`;
    button.type = "button";
    button.title = `${tooth.name}: ${status}`;
    button.setAttribute("aria-label", `${tooth.name}, ${status}`);
    button.innerHTML = `
      ${toothSvg(tooth.id.slice(-1))}
      <span>${tooth.id}</span>
    `;

    const handleInteraction = () => {
      updateToothInfo(tooth, status, age);
    };

    button.addEventListener("mouseenter", handleInteraction);
    button.addEventListener("focus", handleInteraction);
    button.addEventListener("click", () => {
      handleInteraction();
      trackExplorerEvent({
        type: "tooth_interaction",
        age,
        toothId: tooth.id,
        toothName: tooth.name,
        status,
      });
    });

    dentalChart.appendChild(button);
  });
}

function renderExplorer(age) {
  const present = toothData.filter((tooth) => getToothStatus(tooth, age) === "present");
  const erupting = toothData.filter((tooth) => getToothStatus(tooth, age) === "erupting");
  const lost = primaryLossByAge[age] || [];
  const fact = ageFacts[age];

  selectedAge.textContent = age;
  presentCount.textContent = present.length;
  presentText.textContent = summarizeTeeth(present);
  renderMiniDiagram(presentDiagram, present, "present");
  eruptingCount.textContent = erupting.length;
  eruptingText.textContent = summarizeTeeth(erupting);
  renderMiniDiagram(eruptingDiagram, erupting, "erupting");
  lostCount.textContent = lost.length;
  lostText.textContent = lost.length ? lost.join(", ") : "No major primary tooth loss is typically centered at this age.";
  renderMiniDiagram(lostDiagram, [], "lost", lost);
  ageFactTitle.textContent = fact[0];
  ageFact.textContent = fact[1];
  toothInfo.textContent = "Hover, tap, or focus a tooth to see development details.";
  renderDentalChart(age);
}

function saveAgeLookup() {
  trackExplorerEvent({
    type: "age_lookup",
    age: Number(ageSlider.value),
  });
}

function percent(part, total) {
  if (!total) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function mostCommonFromCounts(counts) {
  const entries = Object.entries(counts);

  if (!entries.length) {
    return { label: "Not enough data yet", count: 0 };
  }

  const [label, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return { label, count };
}

function getWeaknessCounts(results) {
  return results.reduce((counts, result) => {
    const categories = Object.values(result.categoryScores || {});
    const weakest = categories.sort((a, b) => Number(a.score) - Number(b.score))[0];

    if (weakest) {
      counts[weakest.label] = (counts[weakest.label] || 0) + 1;
    }

    return counts;
  }, {});
}

function getScoreDistribution(results) {
  const buckets = {
    "0-49": 0,
    "50-64": 0,
    "65-79": 0,
    "80-89": 0,
    "90-100": 0,
  };

  results.forEach((result) => {
    if (result.score < 50) {
      buckets["0-49"] += 1;
    } else if (result.score < 65) {
      buckets["50-64"] += 1;
    } else if (result.score < 80) {
      buckets["65-79"] += 1;
    } else if (result.score < 90) {
      buckets["80-89"] += 1;
    } else {
      buckets["90-100"] += 1;
    }
  });

  return buckets;
}

function renderMetricCards(metrics) {
  metricGrid.innerHTML = "";

  metrics.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <p>${metric.note}</p>
    `;

    metricGrid.appendChild(card);
  });
}

function renderHorizontalChart(container, counts, total) {
  container.innerHTML = "";

  Object.entries(counts).forEach(([label, count]) => {
    const value = percent(count, total);
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label">
        <span>${label}</span>
        <strong>${count} (${value}%)</strong>
      </div>
      <div class="chart-track">
        <div class="chart-fill" style="--value: ${value}%"></div>
      </div>
    `;

    container.appendChild(row);
  });
}

function renderRiskChart(counts, total) {
  riskDistributionChart.innerHTML = "";

  ["Low Risk", "Moderate Risk", "High Risk"].forEach((risk) => {
    const value = percent(counts[risk] || 0, total);
    const card = document.createElement("div");
    card.className = `risk-slice ${risk.toLowerCase().replace(" ", "-")}`;
    card.innerHTML = `
      <span>${risk}</span>
      <strong>${value}%</strong>
      <p>${counts[risk] || 0} result${counts[risk] === 1 ? "" : "s"}</p>
    `;

    riskDistributionChart.appendChild(card);
  });
}

function renderAnalytics(results) {
  const total = results.length;

  if (!total) {
    analyticsStatus.textContent = "No completed quizzes yet.";
    metricGrid.innerHTML = "";
    scoreDistributionChart.innerHTML = `<div class="empty-history">Complete quizzes to populate score distribution.</div>`;
    riskDistributionChart.innerHTML = `<div class="empty-history">Risk distribution will appear after results are saved.</div>`;
    issueChart.innerHTML = `<div class="empty-history">Common oral health issues will appear here.</div>`;
    impactHeadline.textContent = "No population data yet";
    impactSummary.textContent = "Once youth complete the quiz, this dashboard will reveal education gaps and prevention priorities.";
    return;
  }

  const averageScore = Math.round(results.reduce((sum, result) => sum + Number(result.score), 0) / total);
  const demoCount = results.filter((result) => result.isDemo).length;
  const riskCounts = countBy(results, (result) => result.riskLevel);
  const weaknessCounts = getWeaknessCounts(results);
  const recommendationCounts = countBy(
    results.flatMap((result) => result.recommendations || []),
    (recommendation) => recommendation.split(":")[0]
  );
  const commonWeakness = mostCommonFromCounts(weaknessCounts);
  const commonRecommendation = mostCommonFromCounts(recommendationCounts);

  analyticsStatus.textContent = `${total} completed quiz${total === 1 ? "" : "zes"} analyzed${demoCount ? ` • ${demoCount} seeded demo records` : ""}`;
  renderMetricCards([
    { label: "Total quizzes completed", value: total, note: "Saved completions in backend" },
    { label: "Average Smile Score", value: `${averageScore}/100`, note: "Overall education outcome" },
    { label: "Low Risk", value: `${percent(riskCounts["Low Risk"] || 0, total)}%`, note: "Participants with stronger prevention habits" },
    { label: "Moderate Risk", value: `${percent(riskCounts["Moderate Risk"] || 0, total)}%`, note: "Participants who may benefit from targeted support" },
    { label: "High Risk", value: `${percent(riskCounts["High Risk"] || 0, total)}%`, note: "Participants needing priority education" },
    { label: "Most common weakness", value: commonWeakness.label, note: `${commonWeakness.count} result${commonWeakness.count === 1 ? "" : "s"}` },
    { label: "Most common recommendation", value: commonRecommendation.label, note: `${commonRecommendation.count} time${commonRecommendation.count === 1 ? "" : "s"} recommended` },
  ]);

  renderHorizontalChart(scoreDistributionChart, getScoreDistribution(results), total);
  renderRiskChart(riskCounts, total);
  renderHorizontalChart(issueChart, weaknessCounts, total);

  impactHeadline.textContent = `${commonWeakness.label} is the clearest education gap`;
  impactSummary.textContent =
    `Across saved results, ${commonWeakness.label.toLowerCase()} appears most often as the weakest area. ` +
    `This suggests youth education should emphasize practical, repeated guidance around ${commonRecommendation.label.toLowerCase()} habits.`;
}

async function loadAnalytics() {
  analyticsStatus.textContent = "Loading analytics from saved results...";
  metricGrid.innerHTML = "";
  scoreDistributionChart.innerHTML = "";
  riskDistributionChart.innerHTML = "";
  issueChart.innerHTML = "";

  try {
    const response = await fetch(RESULTS_API);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analytics could not be loaded.");
    }

    renderAnalytics(data.results);
  } catch (error) {
    analyticsStatus.textContent = `Could not load analytics: ${error.message}`;
    scoreDistributionChart.innerHTML = `<div class="empty-history">Start the backend to calculate analytics.</div>`;
    riskDistributionChart.innerHTML = `<div class="empty-history">Risk data is unavailable right now.</div>`;
    issueChart.innerHTML = `<div class="empty-history">Issue data is unavailable right now.</div>`;
    impactHeadline.textContent = "Analytics unavailable";
    impactSummary.textContent = "The admin dashboard uses saved backend results, so the backend must be running.";
  }
}

function renderImpactMetricCards(results) {
  const total = results.length;

  if (!total) {
    impactMetricsStatus.textContent = "No completed quizzes yet. Complete a Smile Check to populate live metrics.";
    impactMetricsGrid.innerHTML = `
      <div class="empty-history">Live impact metrics will appear after quiz results are saved.</div>
    `;
    return;
  }

  const averageScore = Math.round(results.reduce((sum, result) => sum + Number(result.score), 0) / total);
  const demoCount = results.filter((result) => result.isDemo).length;
  const riskCounts = countBy(results, (result) => result.riskLevel);
  const weaknessCounts = getWeaknessCounts(results);
  const commonWeakness = mostCommonFromCounts(weaknessCounts);
  const unlockedAchievements = results.reduce((sum, result) => {
    return sum + (result.achievements || []).filter((achievement) => achievement.unlocked).length;
  }, 0);

  impactMetricsStatus.textContent = `${total} saved result${total === 1 ? "" : "s"} analyzed from backend data${demoCount ? ` (${demoCount} seeded demo records)` : ""}.`;

  const metrics = [
    { label: "Learner completions", value: total, note: "Completed Smile Score assessments" },
    { label: "Average Smile Score", value: `${averageScore}/100`, note: "Current prevention literacy indicator" },
    { label: "Low Risk", value: `${percent(riskCounts["Low Risk"] || 0, total)}%`, note: "Students showing stronger prevention habits" },
    { label: "Education gap", value: commonWeakness.label, note: "Most frequent weakest category" },
    { label: "Achievements unlocked", value: unlockedAchievements, note: "Positive reinforcement moments" },
    { label: "Moderate/High Risk", value: `${percent((riskCounts["Moderate Risk"] || 0) + (riskCounts["High Risk"] || 0), total)}%`, note: "Potential target group for outreach" },
    { label: "Seeded demo data", value: demoCount, note: "Clearly marked sample records for presentation" },
  ];

  impactMetricsGrid.innerHTML = "";
  metrics.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <p>${metric.note}</p>
    `;
    impactMetricsGrid.appendChild(card);
  });
}

async function loadImpactMetrics() {
  impactMetricsStatus.textContent = "Loading live impact metrics...";
  impactMetricsGrid.innerHTML = "";

  try {
    const response = await fetch(RESULTS_API);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impact metrics could not be loaded.");
    }

    renderImpactMetricCards(data.results);
  } catch (error) {
    impactMetricsStatus.textContent = `Could not load impact metrics: ${error.message}`;
    impactMetricsGrid.innerHTML = `
      <div class="empty-history">Start the backend to show live project impact metrics.</div>
    `;
  }
}

function renderMyths() {
  mythList.innerHTML = "";

  myths.forEach((myth, index) => {
    const card = document.createElement("article");
    card.className = "myth-card";
    card.innerHTML = `
      <h3>${index + 1}. ${myth.statement}</h3>
      <div class="myth-actions">
        <button class="btn btn-soft" type="button" data-answer="true">True</button>
        <button class="btn btn-soft" type="button" data-answer="false">False</button>
      </div>
      <p class="myth-feedback" role="status"></p>
    `;

    const feedback = card.querySelector(".myth-feedback");
    const buttons = card.querySelectorAll("button");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const userAnswer = button.dataset.answer === "true";
        const isCorrect = userAnswer === myth.correctAnswer;

        feedback.textContent = `${isCorrect ? "Correct!" : "Not quite."} ${myth.feedback}`;
        feedback.className = `myth-feedback ${isCorrect ? "correct" : "incorrect"}`;
      });
    });

    mythList.appendChild(card);
  });
}

function renderCertificate() {
  if (!finalResult) {
    finalResult = buildResult();
  }

  certificateBadge.textContent = finalResult.badge.icon;
  certificateBadgeName.textContent = finalResult.badge.name;
  certificateScore.textContent = `${finalResult.score}/100`;
}

function restartApp() {
  currentQuestionIndex = 0;
  selectedAnswers = Array(quizQuestions.length).fill(null);
  finalResult = null;
  renderQuestion();
  showScreen("home");
}

startQuizBtn.addEventListener("click", () => {
  currentQuestionIndex = 0;
  renderQuestion();
  showScreen("quiz");
});

prevQuestionBtn.addEventListener("click", () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex -= 1;
    renderQuestion();
  }
});

nextQuestionBtn.addEventListener("click", () => {
  const hasAnswer = selectedAnswers[currentQuestionIndex] !== null;

  if (!hasAnswer) {
    alert("Please choose an answer before moving on.");
    return;
  }

  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex += 1;
    renderQuestion();
    return;
  }

  renderResults();
  showScreen("results");
});

viewDashboardBtn.addEventListener("click", () => {
  loadHistory();
  showScreen("dashboard");
});

goToMythsBtn.addEventListener("click", () => {
  renderMyths();
  showScreen("myths");
});

retakeQuizBtn.addEventListener("click", () => {
  currentQuestionIndex = 0;
  renderQuestion();
  showScreen("quiz");
});

refreshHistoryBtn.addEventListener("click", loadHistory);

refreshAnalyticsBtn.addEventListener("click", loadAnalytics);

refreshImpactBtn.addEventListener("click", loadImpactMetrics);

ageSlider.addEventListener("input", () => {
  renderExplorer(Number(ageSlider.value));
});

ageSlider.addEventListener("change", saveAgeLookup);

dashboardRetakeBtn.addEventListener("click", () => {
  currentQuestionIndex = 0;
  renderQuestion();
  showScreen("quiz");
});

certificateBtn.addEventListener("click", () => {
  renderCertificate();
  showScreen("certificate");
});

restartBtn.addEventListener("click", restartApp);

document.querySelectorAll("[data-screen-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const screenId = link.dataset.screenLink;

    if (screenId === "quiz") {
      renderQuestion();
    }

    if (screenId === "dashboard") {
      loadHistory();
    }

    if (screenId === "explorer") {
      renderExplorer(Number(ageSlider.value));
      saveAgeLookup();
    }

    if (screenId === "admin") {
      loadAnalytics();
    }

    if (screenId === "impact") {
      loadImpactMetrics();
    }

    if (screenId === "myths") {
      renderMyths();
    }

    showScreen(screenId);
  });
});

renderQuestion();
renderExplorer(Number(ageSlider.value));
