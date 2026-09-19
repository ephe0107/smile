-- Phase 1: the data the JSON files already held, with real constraints.
-- Every table here is anonymous. Accounts arrive in 002.

-- One saved Smile Check. client_id is the browser-generated identifier the
-- app used before accounts existed; 002 adds user_id alongside it.
create table if not exists results (
  id               uuid primary key default gen_random_uuid(),
  client_id        text,
  score            integer     not null check (score between 0 and 100),
  risk_level       text        not null check (risk_level in ('Low Risk', 'Moderate Risk', 'High Risk')),
  badge            jsonb       not null default '{}'::jsonb,
  category_scores  jsonb       not null default '{}'::jsonb,
  education_scores jsonb       not null default '{}'::jsonb,
  strongest_habit  jsonb       not null default '{}'::jsonb,
  weakest_habit    jsonb       not null default '{}'::jsonb,
  recommendations  jsonb       not null default '[]'::jsonb,
  report           jsonb       not null default '[]'::jsonb,
  achievements     jsonb       not null default '[]'::jsonb,
  trend            jsonb       not null default '{}'::jsonb,
  is_demo          boolean     not null default false,
  source           text,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Serves both "this browser's history, newest first" and the population scan.
create index if not exists results_client_id_completed_at_idx on results (client_id, completed_at desc);
create index if not exists results_completed_at_idx on results (completed_at desc);

-- Education engagement telemetry. There is deliberately no identity column
-- here and 002 does not add one: behavioural telemetry joined to a named
-- account is a behavioural profile of a minor, and every dashboard that reads
-- this table only ever reads it in aggregate.
create table if not exists engagement_events (
  id         uuid primary key default gen_random_uuid(),
  type       text        not null,
  section    text,
  detail     text,
  value      jsonb,
  is_demo    boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists engagement_events_created_at_idx on engagement_events (created_at desc);
create index if not exists engagement_events_type_idx on engagement_events (type);

-- Tooth Development Explorer interactions. Also identity-free.
create table if not exists explorer_events (
  id         uuid primary key default gen_random_uuid(),
  type       text        not null check (type in ('age_lookup', 'tooth_interaction')),
  age        integer     not null check (age between 5 and 18),
  tooth_id   text,
  tooth_name text,
  status     text,
  is_demo    boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists explorer_events_created_at_idx on explorer_events (created_at desc);

-- Visitor comments, held for moderation before they appear.
create table if not exists comments (
  id           uuid primary key default gen_random_uuid(),
  display_name text        not null,
  body         text        not null,
  status       text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create index if not exists comments_status_created_at_idx on comments (status, created_at desc);
