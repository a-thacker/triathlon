-- ============================================================
-- TRIATHLON TIMING APP — SUPABASE SETUP SCRIPT
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

-- 3. TIMING RECORDS (one row per participant)
-- Adult stage order:
--   swim_complete = end of swim   (starts T1)
--   bike_start    = begin bike    (ends T1)
--   bike_complete = end of bike   (starts T2)
--   run_start     = begin run     (ends T2)
--   finish_time   = race finish
create table if not exists timing_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  race_type text not null check (race_type in ('kids','adult')),
  swim_complete timestamptz,
  bike_start    timestamptz,
  bike_complete timestamptz,
  run_start     timestamptz,
  finish_time   timestamptz,
  dnf boolean not null default false,
  created_at timestamptz not null default now(),
  unique(participant_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_participants_race_type on participants(race_type);
create index if not exists idx_participants_race_number on participants(race_type, race_number);
create index if not exists idx_timing_participant on timing_records(participant_id);
create index if not exists idx_race_events_type on race_events(race_type, event_type);

-- ============================================================
-- AUTO RACE NUMBER FUNCTION
-- ============================================================
create or replace function next_race_number(p_race_type text)
returns integer language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(max(race_number), 0) + 1
    into next_num
    from participants
   where race_type = p_race_type;
  return next_num;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY — disable for v1 (no auth)
-- ============================================================
alter table participants disable row level security;
alter table race_events disable row level security;
alter table timing_records disable row level security;

-- ============================================================
-- If you already ran the old schema and need to add the new
-- columns to an existing timing_records table, run these:
--
-- alter table timing_records add column if not exists bike_start timestamptz;
-- alter table timing_records add column if not exists run_start timestamptz;
-- alter table timing_records drop column if exists run_complete;
--
-- ============================================================

-- DONE — verify with:
-- select * from participants limit 1;
-- select * from race_events limit 1;
-- select * from timing_records limit 1;
