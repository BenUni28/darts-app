-- ============================================================
-- Migration 001 — Initial Schema
-- Creates all tables for the darts-app.
-- Run once. Never edit after applying to a live database;
-- add a new numbered migration file for any future changes.
-- ============================================================

-- ============================================================
-- PLAYERS
-- Every person who plays. Soft-deleted via is_active so
-- historical game data is never orphaned.
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    avatar     TEXT,                              -- emoji or short string
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    is_active  INTEGER NOT NULL DEFAULT 1         -- 0 = archived
);

-- Fast lookup by name (used in search / duplicate check)
CREATE INDEX IF NOT EXISTS idx_players_name ON players (name);

-- ============================================================
-- GAMES
-- One match session. Tracks type, status, and who won.
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type    TEXT    NOT NULL CHECK (game_type IN ('501', '301', 'Cricket')),
    status       TEXT    NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    legs_to_win  INTEGER NOT NULL DEFAULT 1,      -- first to N legs wins the match
    double_out   INTEGER NOT NULL DEFAULT 1,      -- 1 = must finish on a double
    started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    winner_id    INTEGER REFERENCES players (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_games_status     ON games (status);
CREATE INDEX IF NOT EXISTS idx_games_winner_id  ON games (winner_id);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON games (started_at);

-- ============================================================
-- GAME_PLAYERS
-- Junction table: which players are in which game.
-- turn_order determines who throws first (1 = first thrower).
-- ============================================================
CREATE TABLE IF NOT EXISTS game_players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    INTEGER NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES players (id) ON DELETE RESTRICT,
    turn_order INTEGER NOT NULL,
    legs_won   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (game_id, player_id),
    UNIQUE (game_id, turn_order)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id   ON game_players (game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players (player_id);

-- ============================================================
-- LEGS
-- One leg within a game. A match can have multiple legs
-- (e.g. best of 3). Each leg is played to a fresh starting score.
-- ============================================================
CREATE TABLE IF NOT EXISTS legs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id      INTEGER NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    leg_number   INTEGER NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
    started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    winner_id    INTEGER REFERENCES players (id) ON DELETE SET NULL,
    UNIQUE (game_id, leg_number)
);

CREATE INDEX IF NOT EXISTS idx_legs_game_id   ON legs (game_id);
CREATE INDEX IF NOT EXISTS idx_legs_winner_id ON legs (winner_id);

-- ============================================================
-- TURNS
-- One player's 3-dart visit in a leg.
-- score = total of the 3 darts thrown this visit.
-- remaining = score left AFTER this turn (or same as before if bust).
-- is_bust = 1 means the score didn't count.
-- ============================================================
CREATE TABLE IF NOT EXISTS turns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    leg_id      INTEGER NOT NULL REFERENCES legs (id) ON DELETE CASCADE,
    player_id   INTEGER NOT NULL REFERENCES players (id) ON DELETE RESTRICT,
    turn_number INTEGER NOT NULL,
    score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 180),
    is_bust     INTEGER NOT NULL DEFAULT 0,
    remaining   INTEGER NOT NULL,                 -- remaining AFTER this turn
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (leg_id, turn_number)
);

CREATE INDEX IF NOT EXISTS idx_turns_leg_id    ON turns (leg_id);
CREATE INDEX IF NOT EXISTS idx_turns_player_id ON turns (player_id);

-- ============================================================
-- DARTS
-- Individual dart within a turn. Optional granularity —
-- enables per-dart stats and checkout detection.
-- segment: 0 (miss) | 1-20 | 25 (bull)
-- multiplier: 1 (single) | 2 (double) | 3 (triple)
-- score is a GENERATED column: computed automatically from segment × multiplier.
-- ============================================================
CREATE TABLE IF NOT EXISTS darts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id     INTEGER NOT NULL REFERENCES turns (id) ON DELETE CASCADE,
    dart_number INTEGER NOT NULL CHECK (dart_number IN (1, 2, 3)),
    segment     INTEGER NOT NULL CHECK (segment BETWEEN 0 AND 25),
    multiplier  INTEGER NOT NULL DEFAULT 1 CHECK (multiplier IN (1, 2, 3)),
    score       INTEGER NOT NULL,                 -- stored explicitly for SQLite compatibility
    UNIQUE (turn_id, dart_number)
);

CREATE INDEX IF NOT EXISTS idx_darts_turn_id ON darts (turn_id);

-- ============================================================
-- CRICKET_STATE
-- Marks per segment per player per leg (Cricket games only).
-- 3 marks = segment closed/owned by this player.
-- ============================================================
CREATE TABLE IF NOT EXISTS cricket_state (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    leg_id    INTEGER NOT NULL REFERENCES legs (id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE RESTRICT,
    segment   INTEGER NOT NULL CHECK (segment IN (15, 16, 17, 18, 19, 20, 25)),
    marks     INTEGER NOT NULL DEFAULT 0 CHECK (marks BETWEEN 0 AND 3),
    points    INTEGER NOT NULL DEFAULT 0,         -- points scored on this segment after closing
    UNIQUE (leg_id, player_id, segment)
);

CREATE INDEX IF NOT EXISTS idx_cricket_state_leg_id    ON cricket_state (leg_id);
CREATE INDEX IF NOT EXISTS idx_cricket_state_player_id ON cricket_state (player_id);

-- ============================================================
-- PLAYER_STATS
-- Denormalized stats cache. Rebuilt after every completed game.
-- Trades write complexity for instant leaderboard reads.
-- One row per player — upserted, never manually inserted.
-- ============================================================
CREATE TABLE IF NOT EXISTS player_stats (
    player_id        INTEGER PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
    games_played     INTEGER NOT NULL DEFAULT 0,
    games_won        INTEGER NOT NULL DEFAULT 0,
    legs_played      INTEGER NOT NULL DEFAULT 0,
    legs_won         INTEGER NOT NULL DEFAULT 0,
    total_turns      INTEGER NOT NULL DEFAULT 0,
    total_scored     INTEGER NOT NULL DEFAULT 0,  -- sum of all non-bust turn scores
    best_checkout    INTEGER,
    highest_turn     INTEGER,                     -- highest single 3-dart score
    count_180        INTEGER NOT NULL DEFAULT 0,
    count_140_plus   INTEGER NOT NULL DEFAULT 0,
    count_100_plus   INTEGER NOT NULL DEFAULT 0,
    count_bust       INTEGER NOT NULL DEFAULT 0,
    -- Cricket
    games_cricket    INTEGER NOT NULL DEFAULT 0,
    games_cricket_won INTEGER NOT NULL DEFAULT 0,
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MIGRATIONS TRACKER
-- Records which migration files have been applied.
-- Prevents running the same migration twice.
-- ============================================================
CREATE TABLE IF NOT EXISTS migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
