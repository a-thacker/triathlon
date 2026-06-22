-- ============================================================
-- TRIATHLON TIMING APP — SUPABASE SETUP SCRIPT v5
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. PARTICIPANTS
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  race_number integer not null,
  first_name text not null,
  last_name text not null,
  age integer,
  gender text check (gender in ('male','female','other')),
  race_type text not null check (race_type in ('kids','adult')),
  registration_date date not null default current_date,
  checked_in boolean not null default false,
  paid boolean not null default false,
  received_swag_bag boolean not null default false,
  is_team boolean not null default false,
  team_color text,
  team_role text check (team_role in ('swimmer','biker','runner')),
  tshirt_size text,
  exclude_from_results boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. RACE EVENTS (start / end / reset per race)
create table if not exists race_events (
  id uuid primary key default gen_random_uuid(),
  race_type text not null check (race_type in ('kids','adult')),
  event_type text not null check (event_type in ('start','end','reset')),
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 3. TIMING RECORDS
-- Individual racers: one row per participant, keyed by participant_id
-- Teams: one row per team, keyed by team_color+race_type, participant_id is null
-- Adult stage order:
--   swim_complete = end of swim   (starts T1)
--   bike_start    = begin bike    (ends T1)
--   bike_complete = end of bike   (starts T2)
--   run_start     = begin run     (ends T2)
--   finish_time   = race finish
create table if not exists timing_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  team_color text,
  race_type text not null check (race_type in ('kids','adult')),
  swim_complete timestamptz,
  bike_start    timestamptz,
  bike_complete timestamptz,
  run_start     timestamptz,
  finish_time   timestamptz,
  dnf boolean not null default false,
  created_at timestamptz not null default now(),
  -- individual racers: unique on participant_id
  -- teams: unique on team_color+race_type
  constraint uq_individual unique (participant_id),
  constraint uq_team unique (team_color, race_type)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_participants_race_type   on participants(race_type);
create index if not exists idx_participants_race_number on participants(race_type, race_number);
create index if not exists idx_participants_team        on participants(team_color, race_type);
create index if not exists idx_timing_participant       on timing_records(participant_id);
create index if not exists idx_timing_team              on timing_records(team_color, race_type);
create index if not exists idx_race_events_type         on race_events(race_type, event_type);

-- ============================================================
-- ROW LEVEL SECURITY — disabled for v1 (no auth)
-- ============================================================
alter table participants disable row level security;
alter table race_events   disable row level security;
alter table timing_records disable row level security;

-- ============================================================
-- MIGRATION: if tables already exist, run these instead:
--
-- alter table participants drop column if exists swimmer_name;
-- alter table participants drop column if exists biker_name;
-- alter table participants drop column if exists runner_name;
-- alter table participants add column if not exists team_role text
-- alter table participants add column if not exists tshirt_size text;
-- alter table participants add column if not exists exclude_from_results boolean not null default false;
--   check (team_role in ('swimmer','biker','runner'));
--
-- drop table if exists timing_records;
-- (then re-run the create table timing_records block above)
--
-- ============================================================

-- 4. APP SETTINGS (single-row config table)
create table if not exists app_settings (
  id integer primary key default 1,
  kids_results_released boolean not null default false,
  adults_results_released boolean not null default false,
  -- Which result categories to show on the TV/Roku race clock once released.
  -- Stored as a jsonb object: { overall: bool, men: bool, women: bool, team: bool, age_group: bool }
  clock_display_categories jsonb not null default '{"overall":true,"men":true,"women":true,"team":false,"age_group":false}'::jsonb,
  constraint single_row check (id = 1)
);

-- Insert the one settings row if it doesn't exist
insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings disable row level security;

-- MIGRATION: if table doesn't exist yet, run the create above.
-- If it already exists, run this instead:
-- alter table app_settings add column if not exists clock_display_categories jsonb not null default '{"overall":true,"men":true,"women":true,"team":false,"age_group":false}'::jsonb;
