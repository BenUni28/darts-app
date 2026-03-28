import { httpError } from './errors.js'

// Lightweight request body validators — no external library needed.

export function validateCreatePlayer(req, res, next) {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return next(httpError(400, 'name is required'))
  }
  if (name.trim().length > 32) {
    return next(httpError(400, 'name must be 32 characters or fewer'))
  }
  req.body.name = name.trim()
  next()
}

export function validateCreateGame(req, res, next) {
  const { game_type, player_ids, legs_to_win, double_out } = req.body

  if (!['501', '301', 'Cricket'].includes(game_type)) {
    return next(httpError(400, 'game_type must be 501, 301, or Cricket'))
  }
  if (!Array.isArray(player_ids) || player_ids.length < 2 || player_ids.length > 8) {
    return next(httpError(400, 'player_ids must be an array of 2–8 player IDs'))
  }
  if (legs_to_win !== undefined && (![1, 2, 3, 4, 5].includes(Number(legs_to_win)))) {
    return next(httpError(400, 'legs_to_win must be 1–5'))
  }
  next()
}

export function validateSubmitTurn(req, res, next) {
  const { player_id, score, darts } = req.body

  if (!player_id || typeof player_id !== 'number') {
    return next(httpError(400, 'player_id is required (number)'))
  }
  if (score === undefined || typeof score !== 'number' || score < 0 || score > 180) {
    return next(httpError(400, 'score must be a number between 0 and 180'))
  }
  if (darts !== undefined) {
    if (!Array.isArray(darts) || darts.length > 3) {
      return next(httpError(400, 'darts must be an array of up to 3 objects'))
    }
    for (const d of darts) {
      if (d.segment === undefined || d.multiplier === undefined) {
        return next(httpError(400, 'each dart needs segment and multiplier'))
      }
    }
  }
  next()
}
