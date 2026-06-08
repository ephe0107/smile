# 20 to 32 Smile Check

A polished full-stack oral health education platform for youth.

Users answer a 10-question Smile Check, receive a Smile Score out of 100, unlock badges and achievements, review a personalized oral health report, see a visual risk dashboard, get dynamic recommendations, compare progress over time, try a dental myth quiz, and finish with a certificate screen.

The platform connects its learning features to integrated oral health education themes, including clinical sciences, oral biosciences, evidence-based prevention, health promotion, social access factors, professional communication, and interprofessional collaboration.

The project also includes an admin analytics dashboard that uses saved backend results and anonymous education engagement events to measure educational impact and identify oral health education gaps in youth populations.

It also includes a Tooth Development Explorer for ages 5 to 18, with an interactive dental chart, expected eruption guidance, primary tooth loss notes, age-specific clinical relevance, prevention guidance, biology explanations, and engagement analytics.

A dedicated Project Impact page presents the problem, mission, integrated education themes, platform features, live backend metrics, communication goals, and future expansion plan in a format suitable for a dental school admissions committee.

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

## Seed Demo Data

To make the dashboards look actively used for demos or presentations, run:

```bash
npm run seed
```

or:

```bash
node scripts/seed-demo-data.js
```

This creates:

- 250 realistic seeded demo quiz results
- Realistic habits, scores, risk levels, recommendations, achievements, reports, and integrated category scores
- Demo tooth explorer engagement analytics
- Demo education engagement analytics for learning modules, prevention actions, and quiz interactions

Seeded records are clearly marked with:

```text
isDemo: true
source: seeded-demo-data
```

The dashboard labels also identify seeded demo data so it is not mistaken for real participant data.

## Files

- `index.html` - the page structure and all website sections.
- `style.css` - the design, colors, layout, responsiveness, and animations.
- `script.js` - the quiz, category scoring, visual dashboard, recommendations, achievements, tooth development explorer, progress tracking, admin analytics, myth quiz, and frontend error handling.
- `server.js` - the backend server and API endpoints.
- `package.json` - project metadata and start scripts.
- `scripts/seed-demo-data.js` - creates realistic seeded demo data for dashboards.
- `README.md` - this guide.

## Backend API

The backend uses local file storage and saves quiz history in:

```text
data/results.json
```

It also stores anonymous education engagement analytics in:

```text
data/engagement-analytics.json
```

Local data files are ignored by Git so personal or demo results do not get uploaded.

Endpoints:

- `POST /results` - saves a completed quiz result.
- `GET /results` - returns previous quiz results.
- `POST /explorer-analytics` - saves tooth development age lookups and tooth interactions.
- `POST /engagement-analytics` - saves anonymous education engagement events.
- `GET /engagement-analytics` - returns anonymous education engagement events for dashboards.

Saved fields:

- `score`
- `riskLevel`
- `badge`
- `categoryScores`
- `educationScores`
- `report`
- `recommendations`
- `achievements`
- `strongestHabit`
- `weakestHabit`
- `trend`
- `completedAt`

## Admin Analytics

Open the **Analytics** link in the top navigation after results have been saved.

The admin dashboard displays:

- Total quizzes completed
- Average Smile Score
- Low, Moderate, and High Risk percentages
- Most common weakness
- Most common recommendation
- Score distribution chart
- Risk distribution chart
- Most common oral health issues chart
- Education engagement events
- Prevention checklist actions
- Myth quiz learning performance

These insights demonstrate how the platform could be used as a public-health education tool to find prevention gaps across youth participants.

## Integrated Learning Features

The platform keeps the original youth-focused experience while adding:

- Evidence-based recommendation cards with "Why this matters" and "Science behind this recommendation."
- Clinical education cards explaining what dentists look for, such as plaque, gum health, early caries risk, erosion, orthodontic hygiene, and eruption patterns.
- A prevention plan with daily checklist actions, weekly goals, and habit-building guidance.
- An optional oral health access assessment that frames cost, transport, dental anxiety, and regular care as support factors, not personal failings.
- A "Meet Your Oral Health Team" section explaining how dentists, hygienists, physicians, pharmacists, dietitians, and other professionals work together.
- Parent and caregiver resources with age-specific guidance.

## Tooth Development Explorer

Open the **Teeth** link in the top navigation.

The explorer lets users select ages 5 to 18 and shows:

- Teeth expected to be present
- Teeth likely erupting
- Primary teeth typically lost around that age
- Hover/tap details for each tooth
- Age-specific educational facts
- Common challenges, prevention steps, biological explanations, and clinical relevance by age group

Engagement events are stored locally in:

```text
data/tooth-explorer-analytics.json
```

## Deployment Note

Because this version has a backend, it cannot be hosted by GitHub Pages alone. GitHub Pages can host static websites, but it cannot run `server.js`.

Beginner-friendly full-stack hosting options include Render, Railway, Fly.io, or a similar Node.js hosting service.

The server uses `process.env.PORT`, which is what most hosting services provide automatically.

## Educational Note

This project is for preventive oral health education only. It does not diagnose dental problems or replace advice from a dentist or other health professional.
