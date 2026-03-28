import { Router } from 'express'
import { validateCreateGame, validateSubmitTurn } from '../middleware/validate.js'
import { httpError } from '../middleware/errors.js'
import { createGame, getGameState, listGames, abandonGame, getGameById, getLegTurns } from '../db/queries/games.js'
import { submitTurn, undoLastTurn } from '../db/queries/turns.js'
import { rebuildPlayerStats } from '../db/queries/stats.js'

const router = Router()

// GET /api/games
router.get('/', (req, res) => {
  const { status, limit, offset } = req.query
  res.json(listGames({ status, limit: Number(limit) || 20, offset: Number(offset) || 0 }))
})

// POST /api/games — create and start a new game
router.post('/', validateCreateGame, (req, res, next) => {
  try {
    const game = createGame(req.body)
    res.status(201).json(game)
  } catch (err) {
    next(err)
  }
})

// GET /api/games/:id — full game state
router.get('/:id', (req, res, next) => {
  const game = getGameState(Number(req.params.id))
  if (!game) return next(httpError(404, 'Game not found'))
  res.json(game)
})

// GET /api/games/:id/turns — turn history for the active leg
router.get('/:id/turns', (req, res, next) => {
  const game = getGameById(Number(req.params.id))
  if (!game) return next(httpError(404, 'Game not found'))

  // Find active leg id from query or use latest
  const legId = req.query.leg_id ? Number(req.query.leg_id) : null
  if (!legId) return res.json([])
  res.json(getLegTurns(legId))
})

// POST /api/games/:id/turns — submit a turn
router.post('/:id/turns', validateSubmitTurn, (req, res, next) => {
  try {
    const result = submitTurn({
      gameId: Number(req.params.id),
      ...req.body
    })

    // If the game just completed, rebuild stats for all players in the game
    if (result.gameComplete) {
      const game = getGameById(Number(req.params.id))
      const gameState = getGameState(Number(req.params.id))
      for (const player of gameState.players) {
        rebuildPlayerStats(player.id)
      }
    }

    // Return updated game state so the client can re-render
    const updatedState = getGameState(Number(req.params.id))
    res.json({ ...result, game: updatedState })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/games/:id/turns/last — undo last turn
router.delete('/:id/turns/last', (req, res, next) => {
  try {
    const result = undoLastTurn(Number(req.params.id))
    const updatedState = getGameState(Number(req.params.id))
    res.json({ ...result, game: updatedState })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/games/:id — abandon a game
router.patch('/:id', (req, res, next) => {
  if (req.body.status !== 'abandoned') {
    return next(httpError(400, 'Only status: abandoned is supported'))
  }
  const game = getGameById(Number(req.params.id))
  if (!game) return next(httpError(404, 'Game not found'))
  abandonGame(Number(req.params.id))
  res.json({ success: true })
})

export default router
