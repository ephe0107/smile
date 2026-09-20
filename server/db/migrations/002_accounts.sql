-- Phase 2: accounts.
--
-- The shape here is chosen so that adding OpenID Connect later is additive.
-- Credentials never live on the user row: they live in `identities`, keyed by
-- (provider, provider_subject). Emailed sign-in codes write provider 'email';
-- a Google or school SSO login later writes provider 'google' with the `sub`
-- claim, against the same user_id. No migration, and no change to how any
-- result is queried.

create extension if not exists citext;

-- citext so "Sam@example.com" and "sam@example.com" are the same account and
-- cannot both be registered.
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  email             citext      not null unique,
  email_verified_at timestamptz,
  display_name      text,
  role              text        not null default 'user' check (role in ('user', 'admin')),
  -- The 13+ attestation. A timestamp, not a date of birth: the app needs to
  -- know the box was ticked, not how old anyone is.
  age_confirmed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references users (id) on delete cascade,
  provider         text        not null,
  provider_subject text        not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_subject)
);

create index if not exists identities_user_id_idx on identities (user_id);

-- Emailed sign-in codes. Only the hash is stored, so a database leak does not
-- hand over live codes, and `attempts` bounds brute force against the 10-minute
-- window.
create table if not exists login_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references users (id) on delete cascade,
  token_hash bytea       not null unique,
  purpose    text        not null default 'sign_in' check (purpose in ('sign_in', 'delete_account')),
  attempts   integer     not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_tokens_user_purpose_idx on login_tokens (user_id, purpose, consumed_at);
create index if not exists login_tokens_expires_at_idx on login_tokens (expires_at);

-- Opaque session tokens, again stored only as a hash. Server-side rows rather
-- than a JWT so a session can actually be revoked -- "sign out everywhere"
-- and account deletion both need that, and a stolen token must be stoppable.
create table if not exists sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid        not null references users (id) on delete cascade,
  token_hash          bytea       not null unique,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  idle_expires_at     timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at          timestamptz
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_absolute_expires_at_idx on sessions (absolute_expires_at);

-- Results gain an owner. Cascade on delete: "delete my account" has to mean
-- the health answers go too, not just the name on them.
alter table results add column if not exists user_id uuid references users (id) on delete cascade;
create index if not exists results_user_id_completed_at_idx on results (user_id, completed_at desc);

-- Comments gain an optional author. Set null rather than cascade: an approved
-- comment is published content, and removing the account should unlink it
-- rather than silently rewrite what is on the page.
alter table comments add column if not exists user_id uuid references users (id) on delete set null;

-- Deliberately absent: any identity column on engagement_events or
-- explorer_events. See 001_init.sql.
