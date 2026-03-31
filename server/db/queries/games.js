import db from '../connection.js'
import { startingScore } from '../../services/scoring.js'

/**
 * Create a new game + first leg + all game_player rows.
 * All inside a single transaction — either everything is created or nothing.
 */
export function createGame({ game_type, player_ids, legs_to_win = 1, double_out = 1 }) {
  return db.transaction(() => {
    // 1. Insert the game row
    const game = db.prepare(`
      INSERT INTO games (game_type, legs_to_win, double_out)
      VALUES (?, ?, ?)
    `).run(game_type, legs_to_win, double_out)

    const gameId = game.lastInsertRowid

    // 2. Insert game_players (one per participant, in the order supplied)
    const insertPlayer = db.prepare(`
      INSERT INTO game_players (game_id, player_id, turn_order)
      VALUES (?, ?, ?)
    `)
    for (let i = 0; i < player_ids.length; i++) {
      insertPlayer.run(gameId, player_ids[i], i + 1)
    }

    // 3. Insert the first leg
    db.prepare(`
      INSERT INTO legs (game_id, leg_number) VALUES (?, 1)
    `).run(gameId)

    // 4. For Cricket: seed the cricket_state rows for all players × all segments
    if (game_type === 'Cricket') {
      const legId = db.prepare(
        'SELECT id FROM legs WHERE game_id = ? AND leg_number = 1'
      ).get(gameId).id

      const insertMark = db.prepare(`
        INSERT INTO cricket_state (leg_id, player_id, segment)
        VALUES (?, ?, ?)
      `)
      const segments = [20, 19, 18, 17, 16, 15, 25]
      for (const pid of player_ids) {
        for (const seg of segments) {
          insertMark.run(legId, pid, seg)
        }
      }
    }

    return getGameState(gameId)
  })()
}

/**
 * Full game state — everything the UI needs in one query.
 * Returns the game, its players with current remaining scores, and the active leg.
 */
export function getGameState(gameId) {
  const game = db.prepare(`
    SELECT g.*,
           p.name AS winner_name
    FROM games g
    LEFT JOIN players p ON g.winner_id = p.id
    WHERE g.id = ?
  `).get(gameId)

  if (!game) return null

  // Get players ordered by turn_order, with their current remaining score
  const players = db.prepare(`
    SELECT
      p.id, p.name, p.avatar,
      gp.turn_order, gp.legs_won,
      -- Remaining = latest turn's remaining value (or starting score if no turns yet)
      COALESCE(
        (
          SELECT t.remaining
          FROM turns t
          JOIN legs l ON t.leg_id = l.id
          WHERE l.game_id = ? AND t.player_id = p.id
            AND l.status = 'in_progress'
          ORDER BY t.turn_number DESC
          LIMIT 1
        ),
        ?
      ) AS remaining
    FROM game_players gp
    JOIN players p ON gp.player_id = p.id
    WHERE gp.game_id = ?
    ORDER BY gp.turn_order
  `).all(gameId, startingScore(game.game_type), gameId)

  // Active leg
  const activeLeg = db.prepare(`
    SELECT * FROM legs
    WHERE game_id = ? AND status = 'in_progress'
    ORDER BY leg_number DESC
    LIMIT 1
  `).get(gameId)

  // Whose turn is it?
  // In a best-of series the starting player rotates each leg:
  // leg 1 → turn_order 1 starts, leg 2 → turn_order 2 starts, etc.
  // We rotate the players array by (leg_number - 1) % numPlayers so the
  // player with the fewest turns is found in the correct priority order.
  let currentPlayerId = null
  if (activeLeg) {
    const turnCounts = db.prepare(`
      SELECT t.player_id, COUNT(*) AS turn_count
      FROM turns t
      WHERE t.leg_id = ?
      GROUP BY t.player_id
    `).all(activeLeg.id)

    const countMap = Object.fromEntries(turnCounts.map(r => [r.player_id, r.turn_count]))

    const offset = (activeLeg.leg_number - 1) % players.length
    const rotated = [...players.slice(offset), ...players.slice(0, offset)]

    let minTurns = Infinity
    for (const p of rotated) {
      const count = countMap[p.id] ?? 0
      if (count < minTurns) {
        minTurns = count
        currentPlayerId = p.id
      }
    }
  }

  // For Cricket: attach the current marks/points state per player per segment
  let cricketState = null
  if (game.game_type === 'Cricket' && activeLeg) {
    const rows = db.prepare(
      'SELECT player_id, segment, marks, points FROM cricket_state WHERE leg_id = ?'
    ).all(activeLeg.id)
    cricketState = {}
    for (const row of rows) {
      if (!cricketState[row.player_id]) cricketState[row.player_id] = {}
      cricketState[row.player_id][row.segment] = { marks: row.marks, points: row.points }
    }
  }

  return { ...game, players, activeLeg, currentPlayerId, cricketState }
}

/**
 * Get recent turns for a leg (for the turn history display).
 */
export function getLegTurns(legId) {
  return db.prepare(`
    SELECT t.*, p.name AS player_name
    FROM turns t
    JOIN players p ON t.player_id = p.id
    WHERE t.leg_id = ?
    ORDER BY t.turn_number ASC
  `).all(legId)
}

/**
 * List games — optionally filtered by status.
 */
export function listGames({ status = null, limit = 20, offset = 0 } = {}) {
  const where = status ? 'WHERE g.status = ?' : ''
  const params = status ? [status, limit, offset] : [limit, offset]

  return db.prepare(`
    SELECT
      g.id, g.game_type, g.status, g.started_at, g.completed_at, g.legs_to_win,
      p.name AS winner_name,
      GROUP_CONCAT(pl.name, ' vs ') AS players
    FROM games g
    LEFT JOIN players p ON g.winner_id = p.id
    JOIN game_players gp ON g.id = gp.game_id
    JOIN players pl ON gp.player_id = pl.id
    ${where}
    GROUP BY g.id
    ORDER BY g.started_at DESC
    LIMIT ? OFFSET ?
  `).all(...params)
}

export function abandonGame(gameId) {
  db.prepare(`
    UPDATE games SET status = 'abandoned', completed_at = datetime('now')
    WHERE id = ? AND status = 'in_progress'
  `).run(gameId)
}

export function getGameById(gameId) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(gameId)
}
