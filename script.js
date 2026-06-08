/* ==========================================================
   20 to 32 Smile Check
   Frontend logic: quiz, scoring, saved results dashboard,
   myth quiz, and certificate screen.
   ========================================================== */

// The frontend talks to these backend endpoints.
const RESULTS_API = "/results";

// These are the 10 Smile Check questions.
// Each answer has a score. Higher score = healthier habit.
const quizQuestions = [
  {
    question: "How many times do you brush per day?",
    topic: "brushing",
    recommendation: "Aim to brush twice a day, especially once before bed.",
    answers: [
      { text: "Twice or more", score: 10 },
      { text: "Once", score: 6 },
      { text: "Not every day", score: 2 },
      { text: "I rarely brush", score: 0 },
    ],
  },
  {
    question: "How often do you floss?",
    topic: "flossing",
    recommendation: "Try flossing once a day to clean between teeth where a toothbrush cannot reach.",
    answers: [
      { text: "Every day", score: 10 },
      { text: "A few times a week", score: 7 },
      { text: "Sometimes", score: 4 },
      { text: "Almost never", score: 0 },
    ],
  },
  {
    question: "Do you use fluoride toothpaste?",
    topic: "fluoride",
    recommendation: "Use fluoride toothpaste because fluoride helps strengthen enamel and prevent cavities.",
    answers: [
      { text: "Yes, every time", score: 10 },
      { text: "Sometimes", score: 6 },
      { text: "I am not sure", score: 4 },
      { text: "No", score: 0 },
    ],
  },
  {
    question: "How many sugary drinks do you have per week?",
    topic: "sugary drinks",
    recommendation: "Try swapping sugary drinks for water more often to reduce acid attacks on teeth.",
    answers: [
      { text: "0 to 1", score: 10 },
      { text: "2 to 3", score: 7 },
      { text: "4 to 6", score: 4 },
      { text: "7 or more", score: 0 },
    ],
  },
  {
    question: "How often do you eat candy or sticky snacks?",
    topic: "snacks",
    recommendation: "Limit sticky candy and frequent sugary snacks because they can cling to teeth.",
    answers: [
      { text: "Rarely", score: 10 },
      { text: "A few times a week", score: 7 },
      { text: "Most days", score: 3 },
      { text: "Many times a day", score: 0 },
    ],
  },
  {
    question: "When was your last dental checkup?",
    topic: "checkups",
    recommendation: "Regular dental checkups can help catch small problems before they become bigger.",
    answers: [
      { text: "Within the last 6 months", score: 10 },
      { text: "Within the last year", score: 8 },
      { text: "More than a year ago", score: 4 },
      { text: "I do not remember", score: 1 },
    ],
  },
  {
    question: "Do your gums bleed when brushing or flossing?",
    topic: "gum health",
    recommendation: "Bleeding gums can be a sign to improve gum care and ask a dental professional for advice.",
    answers: [
      { text: "No", score: 10 },
      { text: "Only rarely", score: 7 },
      { text: "Sometimes", score: 3 },
      { text: "Often", score: 0 },
    ],
  },
  {
    question: "Do you drink water after meals or snacks?",
    topic: "water",
    recommendation: "Drinking water after meals and snacks helps rinse away sugars and food particles.",
    answers: [
      { text: "Almost always", score: 10 },
      { text: "Sometimes", score: 6 },
      { text: "Rarely", score: 2 },
      { text: "I mostly drink something else", score: 0 },
    ],
  },
  {
    question: "Do you brush before bed?",
    topic: "bedtime brushing",
    recommendation: "Brushing before bed is important because plaque can sit on teeth overnight.",
    answers: [
      { text: "Every night", score: 10 },
      { text: "Most nights", score: 7 },
      { text: "Sometimes", score: 3 },
      { text: "Rarely", score: 0 },
    ],
  },
  {
    question: "Do you know how long to brush for?",
    topic: "brush time",
    recommendation: "Brush for about two minutes so every area of your mouth gets attention.",
    answers: [
      { text: "Yes, about 2 minutes", score: 10 },
      { text: "I brush for about 1 minute", score: 5 },
      { text: "I brush very quickly", score: 2 },
      { text: "I am not sure", score: 3 },
    ],
  },
];

// True/false myth quiz cards.
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

// App state: these values change as someone uses the quiz.
let currentQuestionIndex = 0;
let selectedAnswers = Array(quizQuestions.length).fill(null);
let finalResult = null;

// HTML elements used by the app.
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
const recommendationList = document.querySelector("#recommendationList");
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

// Shows one main app screen at a time.
function showScreen(screenId) {
  screens.forEach((screen) => {
    screen.classList.toggle("active-screen", screen.id === screenId);
  });

  document.querySelector(`#${screenId}`).scrollIntoView({ behavior: "smooth", block: "start" });
}

// Draws the current quiz question and answer buttons.
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

// Calculates the Smile Score out of 100.
function calculateScore() {
  const total = quizQuestions.reduce((sum, question, index) => {
    const selectedIndex = selectedAnswers[index];
    return sum + question.answers[selectedIndex].score;
  }, 0);

  return Math.round(total);
}

// Badge ranges requested in the project brief.
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

// Risk ranges requested in the project brief.
function getRiskLevel(score) {
  if (score >= 80) {
    return { label: "Low Risk", className: "" };
  }

  if (score >= 50) {
    return { label: "Moderate Risk", className: "moderate" };
  }

  return { label: "High Risk", className: "high" };
}

// Builds recommendations from the answers with lower scores.
function getRecommendations() {
  const weakAreas = quizQuestions.filter((question, index) => {
    const selectedIndex = selectedAnswers[index];
    return question.answers[selectedIndex].score < 7;
  });

  if (weakAreas.length === 0) {
    return [
      "Keep your routine consistent: brush twice a day, floss daily, and use fluoride toothpaste.",
      "Keep choosing water often and continue regular dental checkups.",
      "Share what you know with a friend who wants to improve their smile habits.",
    ];
  }

  return weakAreas.map((question) => question.recommendation);
}

// Creates the complete result object that will be saved to the backend.
function buildResult() {
  const score = calculateScore();
  const risk = getRiskLevel(score);
  const badge = getBadge(score);

  return {
    score,
    riskLevel: risk.label,
    riskClassName: risk.className,
    badge,
    recommendations: getRecommendations(),
  };
}

// Saves a completed result to the backend.
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
    saveStatus.textContent = "Saved to your dashboard.";
    saveStatus.className = "save-status success";
  } catch (error) {
    saveStatus.textContent = `Result shown, but save failed: ${error.message}`;
    saveStatus.className = "save-status error";
  }
}

// Fills in the results screen and then asks the backend to save it.
function renderResults() {
  finalResult = buildResult();

  scoreNumber.textContent = finalResult.score;
  riskLevel.textContent = finalResult.riskLevel;
  riskLevel.className = `risk-pill ${finalResult.riskClassName}`;
  badgeIcon.textContent = finalResult.badge.icon;
  badgeName.textContent = finalResult.badge.name;
  badgeMessage.textContent = finalResult.badge.message;

  recommendationList.innerHTML = "";
  finalResult.recommendations.forEach((recommendation) => {
    const item = document.createElement("li");
    item.textContent = recommendation;
    recommendationList.appendChild(item);
  });

  saveResult(finalResult);
}

// Loads previous results from the backend and draws the dashboard.
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

// Draws saved result cards.
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

    card.innerHTML = `
      <div class="history-badge">${result.badge.icon}</div>
      <div>
        <h3>${result.badge.name}</h3>
        <p>${result.riskLevel} • Completed ${date}</p>
      </div>
      <div class="history-score">${result.score}/100</div>
    `;

    historyList.appendChild(card);
  });
}

// Creates the five myth quiz cards and adds instant feedback.
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

// Fills in the final certificate screen.
function renderCertificate() {
  if (!finalResult) {
    finalResult = buildResult();
  }

  certificateBadge.textContent = finalResult.badge.icon;
  certificateBadgeName.textContent = finalResult.badge.name;
  certificateScore.textContent = `${finalResult.score}/100`;
}

// Returns the app to the beginning.
function restartApp() {
  currentQuestionIndex = 0;
  selectedAnswers = Array(quizQuestions.length).fill(null);
  finalResult = null;
  renderQuestion();
  showScreen("home");
}

// Button events are listed together here so they are easy to find.
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

// Header links can open hidden interactive screens.
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

// Draw the first quiz question in case someone jumps directly to the quiz section.
renderQuestion();
