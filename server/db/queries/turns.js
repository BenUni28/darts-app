import db from '../connection.js'
import { calcTurn, startingScore } from '../../services/scoring.js'

/**
 * Submit a turn (3-dart visit) for an X01 game.
 * Everything — insert turn, insert darts, check for leg/game win — happens
 * atomically inside one transaction.
 *
 * @param {object} opts
 * @param {number} opts.gameId
 * @param {number} opts.playerId
 * @param {number} opts.score         - Total for this visit (0–180)
 * @param {Array}  opts.darts         - [{ segment, multiplier }, ...] up to 3 darts
 * @returns {{ turn, legComplete, gameComplete, isBust }}
 */
export function submitTurn({ gameId, playerId, score, darts = [] }) {
  return db.transaction(() => {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId)
    if (!game) throw new Error('Game not found')
    if (game.status !== 'in_progress') throw new Error('Game is not in progress')

    const leg = db.prepare(`
      SELECT * FROM legs WHERE game_id = ? AND status = 'in_progress'
      ORDER BY leg_number DESC LIMIT 1
    `).get(gameId)
    if (!leg) throw new Error('No active leg found')

    // Get player's current remaining score
    const lastTurn = db.prepare(`
      SELECT remaining FROM turns
      WHERE leg_id = ? AND player_id = ?
      ORDER BY turn_number DESC LIMIT 1
    `).get(leg.id, playerId)

    const currentRemaining = lastTurn?.remaining ?? startingScore(game.game_type)

    // Determine turn number (next in sequence for this leg)
    const turnCount = db.prepare(
      'SELECT COUNT(*) AS cnt FROM turns WHERE leg_id = ?'
    ).get(leg.id).cnt
    const turnNumber = turnCount + 1

    // Check bust / win
    const lastDart = darts.length > 0 ? darts[darts.length - 1] : null
    const { isBust, isWin, newRemaining } = calcTurn(
      currentRemaining, score, game.double_out === 1, lastDart
    )

    // Insert the turn
    const turnResult = db.prepare(`
      INSERT INTO turns (leg_id, player_id, turn_number, score, is_bust, remaining)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(leg.id, playerId, turnNumber, score, isBust ? 1 : 0, newRemaining)

    const turnId = turnResult.lastInsertRowid

    // Insert individual darts (if provided)
    if (darts.length > 0) {
      const insertDart = db.prepare(`
        INSERT INTO darts (turn_id, dart_number, segment, multiplier, score)
        VALUES (?, ?, ?, ?, ?)
      `)
      darts.forEach((dart, i) => {
        const dartScore = dart.segment === 25 && dart.multiplier === 2 ? 50
          : dart.segment === 25 ? 25
          : dart.segment * dart.multiplier
        insertDart.run(turnId, i + 1, dart.segment, dart.multiplier, dartScore)
      })
    }

    let legComplete = false
    let gameComplete = false

    if (isWin) {
      // Close this leg
      db.prepare(`
        UPDATE legs
        SET status = 'completed', winner_id = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(playerId, leg.id)

      // Increment legs_won for this player
      db.prepare(`
        UPDATE game_players SET legs_won = legs_won + 1
        WHERE game_id = ? AND player_id = ?
      `).run(gameId, playerId)

      legComplete = true

      // Check if player has won the match
      const gp = db.prepare(`
        SELECT legs_won FROM game_players WHERE game_id = ? AND player_id = ?
      `).get(gameId, playerId)

      if (gp.legs_won >= game.legs_to_win) {
        db.prepare(`
          UPDATE games
          SET status = 'completed', winner_id = ?, completed_at = datetime('now')
          WHERE id = ?
        `).run(playerId, gameId)
        gameComplete = true
      } else {
        // Start the next leg
        const nextLegNumber = leg.leg_number + 1
        db.prepare(`
          INSERT INTO legs (game_id, leg_number) VALUES (?, ?)
        `).run(gameId, nextLegNumber)
      }
    }

    return {
      turnId,
      isBust,
      isWin,
      newRemaining,
      legComplete,
      gameComplete
    }
  })()
}

/**
 * Undo the last turn in the active leg of a game.
 * Deletes the turn (and its darts cascade), reverts leg/game status if needed.
 */
export function undoLastTurn(gameId) {
  return db.transaction(() => {
    // Find the active (or just-completed) leg
    const leg = db.prepare(`
      SELECT * FROM legs WHERE game_id = ?
      ORDER BY leg_number DESC LIMIT 1
    `).get(gameId)
    if (!leg) throw new Error('No leg found')

    // Find the last turn
    const lastTurn = db.prepare(`
      SELECT * FROM turns WHERE leg_id = ?
      ORDER BY turn_number DESC LIMIT 1
    `).get(leg.id)
    if (!lastTurn) throw new Error('No turns to undo')

    // If the leg was completed, reopen it and decrement legs_won
    if (leg.status === 'completed') {
      db.prepare(`
        UPDATE legs SET status = 'in_progress', winner_id = NULL, completed_at = NULL
        WHERE id = ?
      `).run(leg.id)

      db.prepare(`
        UPDATE game_players SET legs_won = MAX(0, legs_won - 1)
        WHERE game_id = ? AND player_id = ?
      `).run(gameId, leg.winner_id)

      // If the game was completed too, reopen it
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId)
      if (game.status === 'completed') {
        db.prepare(`
          UPDATE games SET status = 'in_progress', winner_id = NULL, completed_at = NULL
          WHERE id = ?
        `).run(gameId)
      }
    }

    // Delete the turn (darts cascade automatically)
    db.prepare('DELETE FROM turns WHERE id = ?').run(lastTurn.id)

    return { undonePlayerId: lastTurn.player_id }
  })()
}
