# 20 to 32 Smile Check

A polished full-stack oral health education platform for youth.

Users answer a 10-question Smile Check, receive a Smile Score out of 100, unlock badges and achievements, review a personalized oral health report, see a visual risk dashboard, get dynamic recommendations, compare progress over time, try a dental myth quiz, and finish with a certificate screen.

The platform connects its learning features to integrated oral health education themes, including clinical sciences, oral biosciences, evidence-based prevention, health promotion, social access factors, professional communication, and interprofessional collaboration.

The project also includes an admin analytics dashboard that uses saved backend results and anonymous education engagement events to measure educational impact and identify oral health education gaps in youth populations.

It also includes a Tooth Development Explorer for ages 5 to 18, with an interactive dental chart, expected eruption guidance, primary tooth loss notes, age-specific clinical relevance, prevention guidance, biology explanations, and engagement analytics.

A dedicated Project Impact page presents the problem, mission, integrated education themes, platform features, live backend metrics, communication goals, and future expansion plan in a format suitable for a dental school admissions committee.

## How to Run It Locally

The backend needs Postgres. With Docker running:

```bash
npm install
npm run db:up                 # Postgres 16 in a container
cp .env.example .env          # then fill in SESSION_SECRET
npm start                     # applies migrations, then serves
```

Then open:

```text
http://localhost:3000
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`npm run db:down` removes the container when you are finished.

### Commands

| Command | What it does |
| --- | --- |
| `npm start` | Applies pending migrations, then serves the site and API |
| `npm test` | Runs unit and integration tests |
| `npm run migrate` | Applies pending migrations only |
| `npm run seed:db` | Generates demo data and loads it into Postgres |
| `npm run import` | Loads existing `data/*.json` into Postgres (one-time, re-runnable) |
| `npm run db:up` / `db:down` | Starts / removes the local Postgres container |

## Seed Demo Data

To make the dashboards look actively used for demos or presentations, run:

```bash
npm run seed:db
```

That writes the demo files and loads them into Postgres. `npm run seed` on its
own only writes the files.

This creates:

- 521 realistic seeded demo quiz results
- Realistic habits, scores, risk levels, recommendations, achievements, reports, and integrated category scores
- Demo tooth explorer engagement analytics
- 1,011 demo education engagement analytics events for learning modules, prevention actions, and quiz interactions

Seeded records are clearly marked with:

```text
isDemo: true
source: seeded-demo-data
```

The dashboard labels also identify seeded demo data so it is not mistaken for real participant data.

## Files

- `public/index.html` - the page structure and all website sections.
- `public/style.css` - the design system: colour tokens, type scale, radii, shadows, layout, and responsiveness.
- `public/script.js` - the quiz, scoring, dashboards, explorer, progress tracking, myth quiz, and frontend error handling.
- `server.js` - entry point: applies migrations, then starts the server.
- `server/app.js` - the Fastify application: security headers, rate limiting, routes.
- `server/config.js` - environment configuration, validated at boot.
- `server/db/` - connection pool, migration runner, SQL migrations, and SQL aggregates.
- `server/lib/analytics-summary.js` - aggregation and the disclosure policy.
- `server/routes/` - one module per API area.
- `scripts/seed-demo-data.js` - creates realistic seeded demo data for dashboards.
- `scripts/import-json-data.js` - one-time import of `data/*.json` into Postgres.
- `README.md` - this guide.

## Backend API

The backend is [Fastify](https://fastify.dev) on Postgres. The schema lives in
`server/db/migrations/` and is applied automatically at startup.

The older JSON files under `data/` are read by `npm run import`, which copies
them into Postgres. They are gitignored so personal or demo results are never
uploaded.

Endpoints:

- `POST /results` - saves a completed quiz result.
- `GET /results?clientId=...` - returns saved results for that one browser. The `clientId` is
  required. This endpoint used to return every saved result to any caller; it no longer does.
- `GET /analytics/summary` - aggregate population figures for the Analytics and Impact
  dashboards. Counts, averages, and distributions only - individual results never leave the server.
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

## Data Privacy

Saved results describe a person's health habits, so the backend treats them as personal data:

- **Aggregate, don't ship.** The dashboards receive finished statistics from
  `/analytics/summary`, not the underlying records. Aggregation runs in
  `server/lib/analytics-summary.js`.
- **A cohort floor.** Population figures are withheld until at least 5 people have completed a
  Smile Check, and any label breakdown covering fewer than 5 people is dropped. Below that, an
  "average" is just one person's answers restated.
- **Scoped reads.** Saved history is only ever returned for an explicitly requested `clientId`.

## Navigation

The header carries the six main screens: **Home**, **Smile Check**, **My report**, **History**,
**Analytics**, and **Impact**. The Tooth Explorer, Myth Quiz, oral health team, parent resources,
and About page are reached from the four cards on the home screen and the footer links.

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

Open the **Tooth Explorer** card on the home screen, or the footer link of the same name.

The explorer lets users select ages 5 to 18 and shows:

- Teeth expected to be present
- Teeth likely erupting
- Primary teeth typically lost around that age
- Hover/tap details for each tooth
- Age-specific educational facts
- Common challenges, prevention steps, biological explanations, and clinical relevance by age group

Engagement events are stored anonymously in the `explorer_events` table.
Like all engagement telemetry here, they carry no identifier for the person
who generated them.

## Deployment Note

Because this version has a backend and a database, it cannot be hosted by
GitHub Pages alone. GitHub Pages serves static files; it cannot run
`server.js` or reach Postgres.

`render.yaml` configures Render as a Node web service running `npm start`,
which applies pending migrations and then serves. The server reads
`process.env.PORT`, which Render provides.

### Database

Any Postgres works. [Neon](https://neon.tech) has a free tier that suits this
project: serverless, scales to zero, and supports branching so development runs
against a copy rather than live data. Use the **pooled** connection string --
the host containing `-pooler` -- so several instances share a small connection
budget.

Alternatives: Supabase (free Postgres plus auth and storage, though free
projects pause after about a week idle), Turso (generous free tier, SQLite
semantics), or Render's own Postgres (co-located, but free instances expire).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres connection string |
| `SESSION_SECRET` | yes | Signs the session cookie; Render generates it |
| `APP_ORIGIN` | yes | Public URL; every write is checked against it |
| `ADMIN_PIN` | yes | Required before comments can be moderated |
| `RESEND_API_KEY` | for email | Sends sign-in codes |
| `NODE_ENV` | yes | `production` enables HSTS and strict config checks |

The app refuses to start in production if `DATABASE_URL`, `SESSION_SECRET`, or
`APP_ORIGIN` is missing, rather than starting in a weakened state.

### Migrating off the JSON files

The pre-Postgres deploy kept its data on a Render disk at `/var/data`. To carry
it over, keep the disk mounted, set `DATABASE_URL`, and run once:

```bash
npm run import
```

It is re-runnable: rows are inserted by their existing id and skipped if
already present. Imported records stay anonymous -- nothing is attached to an
account. Once the import is done, the disk and `DATA_DIR` can both be removed.

## Educational Note

This project is for preventive oral health education only. It does not diagnose dental problems or replace advice from a dentist or other health professional.
