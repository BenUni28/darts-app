import db from '../connection.js'

export function getAllPlayers() {
  return db.prepare(`
    SELECT
      p.id, p.name, p.avatar, p.created_at, p.is_active,
      COALESCE(ps.games_played, 0)  AS games_played,
      COALESCE(ps.games_won, 0)     AS games_won,
      COALESCE(ps.count_180, 0)     AS count_180,
      COALESCE(ps.best_checkout, 0) AS best_checkout,
      CASE
        WHEN COALESCE(ps.total_turns, 0) = 0 THEN 0
        ELSE ROUND(CAST(ps.total_scored AS REAL) / ps.total_turns, 2)
      END AS avg_per_turn
    FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.is_active = 1
    ORDER BY p.name COLLATE NOCASE
  `).all()
}

export function getPlayerById(id) {
  return db.prepare(`
    SELECT
      p.*,
      COALESCE(ps.games_played, 0)      AS games_played,
      COALESCE(ps.games_won, 0)         AS games_won,
      COALESCE(ps.legs_played, 0)       AS legs_played,
      COALESCE(ps.legs_won, 0)          AS legs_won,
      COALESCE(ps.total_turns, 0)       AS total_turns,
      COALESCE(ps.total_scored, 0)      AS total_scored,
      COALESCE(ps.best_checkout, 0)     AS best_checkout,
      COALESCE(ps.highest_turn, 0)      AS highest_turn,
      COALESCE(ps.count_180, 0)         AS count_180,
      COALESCE(ps.count_140_plus, 0)    AS count_140_plus,
      COALESCE(ps.count_100_plus, 0)    AS count_100_plus,
      COALESCE(ps.count_bust, 0)        AS count_bust,
      CASE
        WHEN COALESCE(ps.total_turns, 0) = 0 THEN 0
        ELSE ROUND(CAST(ps.total_scored AS REAL) / ps.total_turns, 2)
      END AS avg_per_turn
    FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.id = ?
  `).get(id)
}

export function createPlayer({ name, avatar = null }) {
  const stmt = db.prepare(
    'INSERT INTO players (name, avatar) VALUES (?, ?)'
  )
  const result = stmt.run(name, avatar)
  return getPlayerById(result.lastInsertRowid)
}

export function updatePlayer(id, { name, avatar, is_active }) {
  const fields = []
  const values = []

  if (name !== undefined)      { fields.push('name = ?');      values.push(name) }
  if (avatar !== undefined)    { fields.push('avatar = ?');    values.push(avatar) }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active) }

  if (fields.length === 0) return getPlayerById(id)

  values.push(id)
  db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getPlayerById(id)
}

export function getPlayerHistory(id, limit = 20) {
  return db.prepare(`
    SELECT
      g.id, g.game_type, g.status, g.started_at, g.completed_at,
      g.legs_to_win,
      CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END AS won,
      gp.legs_won,
      GROUP_CONCAT(p2.name, ', ') AS opponents
    FROM games g
    JOIN game_players gp  ON g.id = gp.game_id AND gp.player_id = ?
    JOIN game_players gp2 ON g.id = gp2.game_id AND gp2.player_id != ?
    JOIN players p2       ON gp2.player_id = p2.id
    WHERE g.status != 'abandoned'
    GROUP BY g.id
    ORDER BY g.started_at DESC
    LIMIT ?
  `).all(id, id, id, limit)
}

export function playerExists(name) {
  return db.prepare(
    'SELECT id FROM players WHERE name = ? COLLATE NOCASE'
  ).get(name) !== undefined
}
