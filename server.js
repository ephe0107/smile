/* ==========================================================
   20 to 32 Smile Check backend
   This server serves the website and saves quiz results locally.
   ========================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");

// These content types help the browser understand each file.
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(RESULTS_FILE)) {
    fs.writeFileSync(RESULTS_FILE, "[]");
  }
}

function readResults() {
  ensureDataFile();
  const file = fs.readFileSync(RESULTS_FILE, "utf8");
  const results = JSON.parse(file);
  return Array.isArray(results) ? results : [];
}

function writeResults(results) {
  ensureDataFile();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeResult(result) {
  const score = Number(result.score);
  const riskLevel = String(result.riskLevel || "").trim();
  const badge = result.badge || {};
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const achievements = Array.isArray(result.achievements) ? result.achievements : [];
  const report = Array.isArray(result.report) ? result.report : [];
  const categoryScores = result.categoryScores || {};
  const strongestHabit = result.strongestHabit || {};
  const weakestHabit = result.weakestHabit || {};

  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("Score must be a whole number from 0 to 100.");
  }

  if (!["Low Risk", "Moderate Risk", "High Risk"].includes(riskLevel)) {
    throw new Error("Risk level is missing or invalid.");
  }

  if (!badge.name || !badge.icon) {
    throw new Error("Badge name and icon are required.");
  }

  if (!recommendations.length) {
    throw new Error("At least one recommendation is required.");
  }

  if (!achievements.length) {
    throw new Error("At least one achievement record is required.");
  }

  if (!report.length) {
    throw new Error("The personalized report is required.");
  }

  return {
    id: crypto.randomUUID(),
    score,
    riskLevel,
    badge: {
      name: String(badge.name).trim(),
      icon: String(badge.icon).trim(),
      message: String(badge.message || "").trim(),
    },
    categoryScores,
    strongestHabit: {
      topic: String(strongestHabit.topic || "").trim(),
      score: Number(strongestHabit.score || 0),
      feedback: String(strongestHabit.feedback || "").trim(),
    },
    weakestHabit: {
      topic: String(weakestHabit.topic || "").trim(),
      score: Number(weakestHabit.score || 0),
      feedback: String(weakestHabit.feedback || "").trim(),
    },
    recommendations: recommendations.map((item) => String(item).trim()).filter(Boolean),
    report: report.map((item) => ({
      category: String(item.category || "").trim(),
      score: Number(item.score || 0),
      explanation: String(item.explanation || "").trim(),
    })),
    achievements: achievements.map((item) => ({
      name: String(item.name || "").trim(),
      icon: String(item.icon || "").trim(),
      description: String(item.description || "").trim(),
      unlocked: Boolean(item.unlocked),
    })),
    completedAt: new Date().toISOString(),
  };
}

function addProgressTrend(result, previousResult) {
  const previousScore = previousResult ? Number(previousResult.score) : null;
  const change = previousScore === null ? 0 : result.score - previousScore;

  return {
    ...result,
    trend: {
      previousScore,
      change,
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    },
  };
}

async function saveResult(request, response) {
  try {
    const body = await readRequestBody(request);
    const normalizedResult = normalizeResult(JSON.parse(body));
    const results = readResults();
    const result = addProgressTrend(normalizedResult, results[0]);

    results.unshift(result);
    writeResults(results.slice(0, 50));

    sendJson(response, 201, { result });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Result could not be saved." });
  }
}

function getResults(response) {
  try {
    sendJson(response, 200, { results: readResults() });
  } catch (error) {
    sendJson(response, 500, { error: "Saved results could not be loaded." });
  }
}

function serveFile(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/results" && request.method === "GET") {
    getResults(response);
    return;
  }

  if (request.url === "/results" && request.method === "POST") {
    saveResult(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveFile(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
});

server.on("error", (error) => {
  console.error(`Server could not start: ${error.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`20 to 32 Smile Check is running at http://localhost:${PORT}`);
});
