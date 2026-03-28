import db from '../connection.js'

/**
 * Rebuild player_stats for a single player after a completed game.
 * Uses a transaction + upsert — runs once per completed game.
 *
 * This is intentionally written as explicit SQL so you can see exactly
 * what "denormalized stats cache" means in practice.
 */
export function rebuildPlayerStats(playerId) {
  return db.transaction(() => {
    // --- X01 stats ---
    const x01 = db.prepare(`
      SELECT
        COUNT(DISTINCT g.id)              AS games_played,
        COUNT(DISTINCT CASE WHEN g.winner_id = ? THEN g.id END) AS games_won,
        COUNT(DISTINCT l.id)              AS legs_played,
        COUNT(DISTINCT CASE WHEN l.winner_id = ? THEN l.id END) AS legs_won,
        COUNT(CASE WHEN t.is_bust = 0 THEN 1 END)               AS total_turns,
        SUM(CASE WHEN t.is_bust = 0 THEN t.score ELSE 0 END)    AS total_scored,
        MAX(CASE WHEN t.is_bust = 0 THEN t.score END)           AS highest_turn,
        COUNT(CASE WHEN t.score = 180 AND t.is_bust = 0 THEN 1 END)       AS count_180,
        COUNT(CASE WHEN t.score >= 140 AND t.score < 180 AND t.is_bust = 0 THEN 1 END) AS count_140_plus,
        COUNT(CASE WHEN t.score >= 100 AND t.score < 140 AND t.is_bust = 0 THEN 1 END) AS count_100_plus,
        COUNT(CASE WHEN t.is_bust = 1 THEN 1 END)               AS count_bust
      FROM games g
      JOIN legs l       ON l.game_id = g.id
      JOIN turns t      ON t.leg_id = l.id AND t.player_id = ?
      WHERE g.game_type IN ('501', '301')
        AND g.status = 'completed'
    `).get(playerId, playerId, playerId)

    // --- Best checkout (the winning turn's score when leg was won) ---
    const bestCheckout = db.prepare(`
      SELECT MAX(t.score) AS best_checkout
      FROM turns t
      JOIN legs l ON t.leg_id = l.id
      WHERE t.player_id = ?
        AND l.winner_id = ?
        AND t.remaining = 0
        AND t.is_bust = 0
    `).get(playerId, playerId)

    // --- Cricket stats ---
    const cricket = db.prepare(`
      SELECT
        COUNT(DISTINCT g.id) AS games_cricket,
        COUNT(DISTINCT CASE WHEN g.winner_id = ? THEN g.id END) AS games_cricket_won
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id AND gp.player_id = ?
      WHERE g.game_type = 'Cricket'
        AND g.status = 'completed'
    `).get(playerId, playerId)

    // Upsert into player_stats
    db.prepare(`
      INSERT INTO player_stats (
        player_id, games_played, games_won, legs_played, legs_won,
        total_turns, total_scored, best_checkout, highest_turn,
        count_180, count_140_plus, count_100_plus, count_bust,
        games_cricket, games_cricket_won, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(player_id) DO UPDATE SET
        games_played      = excluded.games_played,
        games_won         = excluded.games_won,
        legs_played       = excluded.legs_played,
        legs_won          = excluded.legs_won,
        total_turns       = excluded.total_turns,
        total_scored      = excluded.total_scored,
        best_checkout     = excluded.best_checkout,
        highest_turn      = excluded.highest_turn,
        count_180         = excluded.count_180,
        count_140_plus    = excluded.count_140_plus,
        count_100_plus    = excluded.count_100_plus,
        count_bust        = excluded.count_bust,
        games_cricket     = excluded.games_cricket,
        games_cricket_won = excluded.games_cricket_won,
        updated_at        = excluded.updated_at
    `).run(
      playerId,
      x01.games_played ?? 0,
      x01.games_won ?? 0,
      x01.legs_played ?? 0,
      x01.legs_won ?? 0,
      x01.total_turns ?? 0,
      x01.total_scored ?? 0,
      bestCheckout.best_checkout ?? null,
      x01.highest_turn ?? null,
      x01.count_180 ?? 0,
      x01.count_140_plus ?? 0,
      x01.count_100_plus ?? 0,
      x01.count_bust ?? 0,
      cricket.games_cricket ?? 0,
      cricket.games_cricket_won ?? 0
    )
  })()
}

/**
 * Leaderboard — top players sorted by 3-dart average.
 * Uses a CTE so the calculation is readable.
 */
export function getLeaderboard({ sortBy = 'avg', limit = 20 } = {}) {
  const orderClause = {
    avg:      'avg_per_turn DESC',
    wins:     'games_won DESC',
    '180s':   'count_180 DESC',
    checkout: 'best_checkout DESC'
  }[sortBy] ?? 'avg_per_turn DESC'

  return db.prepare(`
    WITH stats AS (
      SELECT
        p.id, p.name, p.avatar,
        COALESCE(ps.games_played, 0) AS games_played,
        COALESCE(ps.games_won, 0)    AS games_won,
        COALESCE(ps.count_180, 0)    AS count_180,
        COALESCE(ps.best_checkout, 0) AS best_checkout,
        COALESCE(ps.highest_turn, 0)  AS highest_turn,
        CASE
          WHEN COALESCE(ps.total_turns, 0) = 0 THEN 0
          ELSE ROUND(CAST(ps.total_scored AS REAL) / ps.total_turns, 2)
        END AS avg_per_turn,
        CASE
          WHEN COALESCE(ps.games_played, 0) = 0 THEN 0
          ELSE ROUND(CAST(ps.games_won AS REAL) / ps.games_played * 100, 1)
        END AS win_pct
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE p.is_active = 1
    )
    SELECT * FROM stats
    ORDER BY ${orderClause}
    LIMIT ?
  `).all(limit)
}

/**
 * Head-to-head record between two players.
 */
export function getHeadToHead(playerAId, playerBId) {
  return db.prepare(`
    SELECT
      COUNT(*)                                          AS total_games,
      SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) AS wins_a,
      SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) AS wins_b
    FROM games g
    JOIN game_players gpa ON g.id = gpa.game_id AND gpa.player_id = ?
    JOIN game_players gpb ON g.id = gpb.game_id AND gpb.player_id = ?
    WHERE g.status = 'completed'
  `).get(playerAId, playerBId, playerAId, playerBId)
}

/**
 * Recent milestones: 180s, high checkouts.
 */
export function getMilestones(limit = 20) {
  return db.prepare(`
    SELECT
      t.score,
      t.created_at,
      p.name AS player_name,
      g.game_type,
      CASE WHEN t.score = 180 THEN '180' ELSE 'HIGH_SCORE' END AS milestone_type
    FROM turns t
    JOIN players p   ON t.player_id = p.id
    JOIN legs l      ON t.leg_id = l.id
    JOIN games g     ON l.game_id = g.id
    WHERE t.score >= 100 AND t.is_bust = 0
    ORDER BY t.created_at DESC
    LIMIT ?
  `).all(limit)
}
