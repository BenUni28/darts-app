import { Router } from 'express'
import { validateCreatePlayer } from '../middleware/validate.js'
import { httpError } from '../middleware/errors.js'
import {
  getAllPlayers, getPlayerById, createPlayer,
  updatePlayer, getPlayerHistory, playerExists
} from '../db/queries/players.js'

const router = Router()

// GET /api/players
router.get('/', (req, res) => {
  res.json(getAllPlayers())
})

// GET /api/players/:id
router.get('/:id', (req, res, next) => {
  const player = getPlayerById(Number(req.params.id))
  if (!player) return next(httpError(404, 'Player not found'))
  res.json(player)
})

// GET /api/players/:id/history
router.get('/:id/history', (req, res, next) => {
  const player = getPlayerById(Number(req.params.id))
  if (!player) return next(httpError(404, 'Player not found'))
  const history = getPlayerHistory(Number(req.params.id))
  res.json(history)
})

// POST /api/players
router.post('/', validateCreatePlayer, (req, res, next) => {
  if (playerExists(req.body.name)) {
    return next(httpError(409, `Player "${req.body.name}" already exists`))
  }
  const player = createPlayer(req.body)
  res.status(201).json(player)
})

// PATCH /api/players/:id
router.patch('/:id', (req, res, next) => {
  const player = getPlayerById(Number(req.params.id))
  if (!player) return next(httpError(404, 'Player not found'))
  const updated = updatePlayer(Number(req.params.id), req.body)
  res.json(updated)
})

export default router
