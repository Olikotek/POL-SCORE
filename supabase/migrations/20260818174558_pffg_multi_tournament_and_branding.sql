/*
# PFFG multi-tournament isolation, registrations, league points & branding

## Overview
Adds the missing multi-tournament infrastructure that the frontend already
references (tournaments, league_points, tournament_registrations), extends the
players / flights / flight_players / scores tables with tournament scoping
columns, and adds a customizable federation logo_url to tournament_settings.
All statements are idempotent (IF NOT EXISTS) and non-destructive — no existing
data is dropped or rewritten.

## New tables
1. `tournaments` — one row per event.
   - id (uuid PK), name, course_name, date, is_league, is_polish_open,
     status ('draft'|'active'|'completed'), round1_course_id, round2_course_id,
     round1_approved, round2_started, created_at.
2. `league_points` — computed points per player per completed tournament.
   - id (uuid PK), tournament_id (FK), player_id (FK), rank, strokes, points,
     category, unique (tournament_id, player_id).
3. `tournament_registrations` — player sign-ups per tournament.
   - id (uuid PK), tournament_id (FK), player_id (FK), payment_method,
     created_at, unique (tournament_id, player_id).

## Modified tables
- `players`: + is_active (bool default true), user_id (uuid), email (text),
  gender (text), preferred_foot (text), birth_date (date), city (text),
  ball_model (text), role (text default 'player').
- `flights`: + tournament_id (uuid nullable, FK tournaments).
- `flight_players`: + tournament_id (uuid nullable, FK tournaments).
- `scores`: + tournament_id (uuid nullable, FK tournaments).
- `tournament_settings`: + logo_url (text).

## Security
RLS enabled on all new tables with permissive anon+authenticated CRUD
(the app is a public live scoreboard, data is intentionally shared).

## Realtime
New tables added to the supabase_realtime publication.
*/

-- ---------- players: extended profile columns ----------
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_foot text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ball_model text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'player';

-- ---------- tournaments ----------
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course_name text,
  date text NOT NULL DEFAULT to_char(now()::date, 'YYYY-MM-DD'),
  is_league boolean NOT NULL DEFAULT true,
  is_polish_open boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed')),
  round1_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  round2_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  round1_approved boolean NOT NULL DEFAULT false,
  round2_started boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ---------- league_points ----------
CREATE TABLE IF NOT EXISTS league_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rank int NOT NULL,
  strokes int NOT NULL DEFAULT 0,
  points numeric NOT NULL DEFAULT 0,
  category text,
  UNIQUE (tournament_id, player_id)
);

-- ---------- tournament_registrations ----------
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'on_site',
  created_at timestamptz DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);

-- ---------- flights / flight_players / scores: tournament scoping ----------
ALTER TABLE flights ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE flight_players ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;

-- ---------- tournament_settings: logo ----------
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS logo_url text;

-- ---------- RLS for new tables ----------
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tournaments" ON tournaments;
CREATE POLICY "select_tournaments" ON tournaments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_tournaments" ON tournaments;
CREATE POLICY "insert_tournaments" ON tournaments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_tournaments" ON tournaments;
CREATE POLICY "update_tournaments" ON tournaments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_tournaments" ON tournaments;
CREATE POLICY "delete_tournaments" ON tournaments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_league_points" ON league_points;
CREATE POLICY "select_league_points" ON league_points FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_league_points" ON league_points;
CREATE POLICY "insert_league_points" ON league_points FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_league_points" ON league_points;
CREATE POLICY "update_league_points" ON league_points FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_league_points" ON league_points;
CREATE POLICY "delete_league_points" ON league_points FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_tournament_registrations" ON tournament_registrations;
CREATE POLICY "select_tournament_registrations" ON tournament_registrations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_tournament_registrations" ON tournament_registrations;
CREATE POLICY "insert_tournament_registrations" ON tournament_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_tournament_registrations" ON tournament_registrations;
CREATE POLICY "update_tournament_registrations" ON tournament_registrations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_tournament_registrations" ON tournament_registrations;
CREATE POLICY "delete_tournament_registrations" ON tournament_registrations FOR DELETE TO anon, authenticated USING (true);

-- ---------- Realtime for new tables ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournaments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'league_points') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE league_points;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_registrations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_registrations;
  END IF;
END $$;
