// Pure scoring logic for X01 games (501, 301).
// No database calls — input in, result out. Easy to test.

/**
 * Calculate the result of a turn in an X01 game.
 *
 * @param {number} remaining   - Score remaining before this turn
 * @param {number} scored      - Total scored this turn (0-180)
 * @param {boolean} doubleOut  - Whether the game requires a double to finish
 * @param {object|null} lastDart - { segment, multiplier } of the finishing dart (needed for double-out check)
 * @returns {{ remaining: number, isBust: boolean, isWin: boolean, newRemaining: number }}
 */
export function calcTurn(remaining, scored, doubleOut = true, lastDart = null) {
  const newRemaining = remaining - scored

  // Bust conditions:
  // 1. Went below zero
  // 2. Landed exactly on 1 (can't finish — no double = 1, but 1 isn't a valid double)
  // 3. Hit zero but the last dart wasn't a double (when double-out is required)
  if (newRemaining < 0) {
    return { isBust: true, isWin: false, newRemaining: remaining }
  }

  if (newRemaining === 1) {
    return { isBust: true, isWin: false, newRemaining: remaining }
  }

  if (newRemaining === 0) {
    if (doubleOut && lastDart) {
      const isDouble = lastDart.multiplier === 2 ||
        (lastDart.segment === 25 && lastDart.multiplier === 2) // bullseye
      if (!isDouble) {
        return { isBust: true, isWin: false, newRemaining: remaining }
      }
    }
    return { isBust: false, isWin: true, newRemaining: 0 }
  }

  return { isBust: false, isWin: false, newRemaining }
}

/**
 * Calculate the 3-dart average from a list of turns.
 * Busted turns are excluded (they don't count toward the average).
 *
 * @param {Array<{score: number, is_bust: number}>} turns
 * @returns {number} average rounded to 2 decimal places, or 0 if no valid turns
 */
export function calcAverage(turns) {
  const validTurns = turns.filter(t => t.is_bust === 0)
  if (validTurns.length === 0) return 0
  const total = validTurns.reduce((sum, t) => sum + t.score, 0)
  return Math.round((total / validTurns.length) * 100) / 100
}

/**
 * Get the starting score for a game type.
 * @param {'501'|'301'} gameType
 * @returns {number}
 */
export function startingScore(gameType) {
  return parseInt(gameType, 10)
}

/**
 * Returns true if the score is a valid dart turn total (0–180).
 * Also rejects physically impossible scores like 179, 178, 177 etc.
 */
const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179])

export function isValidTurnScore(score) {
  if (score < 0 || score > 180) return false
  if (IMPOSSIBLE_SCORES.has(score)) return false
  return true
}
