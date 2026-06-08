/* ==========================================================
   20 to 32 Smile Check
   Frontend logic: quiz, category report, visual dashboard,
   achievements, trends, saved history, myths, and certificate.
   ========================================================== */

const RESULTS_API = "/results";

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

  historyStatus.textContent = `${results.length} saved result${results.length === 1 ? "" : "s"}`;

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
        <p>${result.riskLevel} • ${unlockedCount} achievements • ${date}</p>
      </div>
      <div class="history-score">${result.score}/100</div>
      <div class="history-trend ${trend.className}">${trend.text}</div>
    `;

    historyList.appendChild(card);
  });
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

    if (screenId === "myths") {
      renderMyths();
    }

    showScreen(screenId);
  });
});

renderQuestion();
