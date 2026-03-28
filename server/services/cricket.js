// Cricket game logic.
// Segments in play: 15, 16, 17, 18, 19, 20, 25 (bull)

export const CRICKET_SEGMENTS = [20, 19, 18, 17, 16, 15, 25]

/**
 * Process a single dart throw in Cricket.
 * Returns updated state for the throwing player's segment marks and points.
 *
 * @param {object} state - Current cricket state map: { [playerId]: { [segment]: { marks, points } } }
 * @param {number} playerId - The player throwing
 * @param {number} segment - Dart segment hit (must be in CRICKET_SEGMENTS, else ignored)
 * @param {number} multiplier - 1 (single), 2 (double), 3 (triple)
 * @param {number[]} allPlayerIds - All player IDs in the game (to check if segment is closed by everyone)
 * @returns {{ newMarks: number, pointsScored: number }}
 */
export function processCricketDart(state, playerId, segment, multiplier, allPlayerIds) {
  if (!CRICKET_SEGMENTS.includes(segment)) {
    return { newMarks: 0, pointsScored: 0 }
  }

  const playerState = state[playerId] ?? {}
  const currentMarks = playerState[segment]?.marks ?? 0

  if (currentMarks >= 3) {
    // Already closed by this player — check if we can score points
    const allClosed = allPlayerIds.every(id => (state[id]?.[segment]?.marks ?? 0) >= 3)
    if (allClosed) {
      // Everyone has closed it — no points possible
      return { newMarks: 3, pointsScored: 0 }
    }
    // This player owns it — score points
    const pointsScored = segment === 25 ? 25 * multiplier : segment * multiplier
    return { newMarks: 3, pointsScored }
  }

  // Add marks (capped at 3)
  const marksAdded = Math.min(multiplier, 3 - currentMarks)
  const newMarks = currentMarks + marksAdded
  const leftoverMultiplier = multiplier - marksAdded

  let pointsScored = 0
  if (newMarks >= 3 && leftoverMultiplier > 0) {
    // Closed with darts to spare — score points with leftovers
    const allClosed = allPlayerIds.every(id => id === playerId || (state[id]?.[segment]?.marks ?? 0) >= 3)
    if (!allClosed) {
      pointsScored = segment === 25 ? 25 * leftoverMultiplier : segment * leftoverMultiplier
    }
  }

  return { newMarks, pointsScored }
}

/**
 * Check if a player has won Cricket.
 * A player wins when:
 * 1. They have closed all 7 segments (≥3 marks each)
 * 2. They have the highest (or tied highest) points total
 *
 * @param {object} state - Full cricket state map
 * @param {number} playerId - Player to check
 * @param {number[]} allPlayerIds
 * @returns {boolean}
 */
export function checkCricketWin(state, playerId, allPlayerIds) {
  const playerState = state[playerId] ?? {}

  // Check all segments closed
  const allClosed = CRICKET_SEGMENTS.every(
    seg => (playerState[seg]?.marks ?? 0) >= 3
  )
  if (!allClosed) return false

  // Check points lead (must have >= all others)
  const myPoints = CRICKET_SEGMENTS.reduce(
    (sum, seg) => sum + (playerState[seg]?.points ?? 0), 0
  )

  for (const otherId of allPlayerIds) {
    if (otherId === playerId) continue
    const otherState = state[otherId] ?? {}
    const otherPoints = CRICKET_SEGMENTS.reduce(
      (sum, seg) => sum + (otherState[seg]?.points ?? 0), 0
    )
    if (otherPoints > myPoints) return false
  }

  return true
}
