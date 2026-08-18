-- Drop legacy tables from the old schema if they exist
DROP TABLE IF EXISTS flight_players CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS flights CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tournament_settings CASCADE;
DROP TABLE IF EXISTS holes CASCADE;
DROP TABLE IF EXISTS course_holes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Courses
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Course holes (18 per course)
CREATE TABLE course_holes (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number int NOT NULL CHECK (number BETWEEN 1 AND 18),
  par int NOT NULL DEFAULT 4 CHECK (par BETWEEN 3 AND 5),
  meters int NOT NULL DEFAULT 120 CHECK (meters >= 0),
  PRIMARY KEY (course_id, number)
);

-- Players
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Men',
  avatar text,
  club text,
  flag text NOT NULL DEFAULT 'PL',
  is_amateur boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Flights
CREATE TABLE flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  round int NOT NULL DEFAULT 1 CHECK (round IN (1, 2)),
  start_hole int NOT NULL DEFAULT 1 CHECK (start_hole BETWEEN 1 AND 18),
  created_at timestamptz DEFAULT now()
);

-- Flight-Player join
CREATE TABLE flight_players (
  flight_id uuid NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (flight_id, player_id)
);

-- Scores
CREATE TABLE scores (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round int NOT NULL CHECK (round IN (1, 2)),
  hole_number int NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, round, hole_number)
);

-- Tournament settings (single row)
CREATE TABLE tournament_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tournament_name text NOT NULL DEFAULT 'Mistrzostwa Polski',
  round1_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  round2_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  round1_approved boolean NOT NULL DEFAULT false,
  round2_started boolean NOT NULL DEFAULT false
);

-- Seed a default course
INSERT INTO courses (name) VALUES ('Course A');

-- Seed 18 holes for Course A
INSERT INTO course_holes (course_id, number, par, meters)
SELECT (SELECT id FROM courses WHERE name = 'Course A' LIMIT 1), n, 4, 120
FROM generate_series(1, 18) AS n;

-- Seed settings row
INSERT INTO tournament_settings (id, round1_course_id)
SELECT 1, (SELECT id FROM courses WHERE name = 'Course A' LIMIT 1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

-- CRUD policies for all tables (public, anon+authenticated)
CREATE POLICY "select_courses" ON courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_courses" ON courses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_courses" ON courses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_courses" ON courses FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_course_holes" ON course_holes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_course_holes" ON course_holes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_course_holes" ON course_holes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_course_holes" ON course_holes FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_players" ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_players" ON players FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_players" ON players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_players" ON players FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_flights" ON flights FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_flights" ON flights FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_flights" ON flights FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_flights" ON flights FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_flight_players" ON flight_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_flight_players" ON flight_players FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_flight_players" ON flight_players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_flight_players" ON flight_players FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_scores" ON scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_scores" ON scores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_scores" ON scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_scores" ON scores FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_tournament_settings" ON tournament_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_tournament_settings" ON tournament_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_tournament_settings" ON tournament_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Enable realtime for all tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'courses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE courses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'course_holes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE course_holes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'flights') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE flights;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'flight_players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE flight_players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_settings;
  END IF;
END $$;