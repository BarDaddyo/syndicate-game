-- The Syndicate — Complete Database Schema
-- Run this entire script in the Supabase SQL Editor

-- Clean slate
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PLAYERS
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  team_number INTEGER NOT NULL CHECK (team_number BETWEEN 1 AND 23),
  team_position INTEGER NOT NULL DEFAULT 0,
  constraint_role TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_players_team ON players(team_number);

-- TEAMS
CREATE TABLE teams (
  team_number INTEGER PRIMARY KEY CHECK (team_number BETWEEN 1 AND 23),
  score INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 6
);

-- GAME STATE (single row, id always 1)
CREATE TABLE game_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_round INTEGER NOT NULL DEFAULT 0,
  round_status TEXT NOT NULL DEFAULT 'waiting',
  round_start_time TIMESTAMPTZ,
  wildcard_winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT single_row CHECK (id = 1)
);

-- SUBMISSIONS
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_number INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  answer NUMERIC NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded INTEGER,
  UNIQUE(team_number, round_number)
);
CREATE INDEX idx_submissions_round ON submissions(round_number);
CREATE INDEX idx_submissions_team ON submissions(team_number);

-- Seed data
INSERT INTO game_state (id, current_round, round_status, wildcard_winners)
VALUES (1, 0, 'waiting', '[]');

INSERT INTO teams (team_number, size) VALUES
(1,6),(2,6),(3,6),(4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),
(11,6),(12,6),(13,6),(14,6),(15,6),(16,6),(17,6),(18,6),(19,6),(20,6),
(21,6),(22,6),(23,7);

-- Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon key (appropriate for classroom/game context)
CREATE POLICY "anon_all_players" ON players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_teams" ON teams FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_game_state" ON game_state FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_submissions" ON submissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable Realtime publication
-- If this fails, go to: Supabase Dashboard > Database > Replication > Add each table manually
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
