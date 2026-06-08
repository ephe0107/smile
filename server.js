const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MESSAGE_FILE = path.join(DATA_DIR, "messages.jsonl");

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

function serveFile(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });
    response.end(contents);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request is too large"));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function saveMessage(request, response) {
  try {
    const body = await readRequestBody(request);
    const message = JSON.parse(body);

    const name = String(message.name || "").trim();
    const email = String(message.email || "").trim();
    const note = String(message.message || "").trim();

    if (!name || !email || !note) {
      sendJson(response, 400, { error: "Please fill out every field." });
      return;
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(
      MESSAGE_FILE,
      JSON.stringify({ name, email, message: note, createdAt: new Date().toISOString() }) + "\n"
    );

    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { error: "Something went wrong. Please try again." });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/contact") {
    saveMessage(request, response);
    return;
  }

  if (request.method === "GET") {
    serveFile(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`smile 2032 is running at http://localhost:${PORT}`);
});
