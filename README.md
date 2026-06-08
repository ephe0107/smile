# 20 to 32 Smile Check

A polished full-stack oral health education platform for youth.

Users answer a 10-question Smile Check, receive a Smile Score out of 100, unlock badges and achievements, review a personalized oral health report, see a visual risk dashboard, get dynamic recommendations, compare progress over time, try a dental myth quiz, and finish with a certificate screen.

## How to Run It Locally

From the project folder, run:

```bash
HOST=127.0.0.1 node server.js
```

Then open:

```text
http://localhost:3000
```

You can also run:

```bash
npm start
```

if `npm` is available on your computer.

## Files

- `index.html` - the page structure and all website sections.
- `style.css` - the design, colors, layout, responsiveness, and animations.
- `script.js` - the quiz, category scoring, visual dashboard, recommendations, achievements, progress tracking, myth quiz, and frontend error handling.
- `server.js` - the backend server and API endpoints.
- `package.json` - project metadata and start scripts.
- `README.md` - this guide.

## Backend API

The backend uses local file storage and saves quiz history in:

```text
data/results.json
```

That file is ignored by Git so local results do not get uploaded.

Endpoints:

- `POST /results` - saves a completed quiz result.
- `GET /results` - returns previous quiz results.

Saved fields:

- `score`
- `riskLevel`
- `badge`
- `categoryScores`
- `report`
- `recommendations`
- `achievements`
- `strongestHabit`
- `weakestHabit`
- `trend`
- `completedAt`

## Deployment Note

Because this version has a backend, it cannot be hosted by GitHub Pages alone. GitHub Pages can host static websites, but it cannot run `server.js`.

Beginner-friendly full-stack hosting options include Render, Railway, Fly.io, or a similar Node.js hosting service.

The server uses `process.env.PORT`, which is what most hosting services provide automatically.

## Educational Note

This project is for preventive oral health education only. It does not diagnose dental problems or replace advice from a dentist or other health professional.
