import { Router } from 'express'
import { getLeaderboard, getHeadToHead, getMilestones } from '../db/queries/stats.js'

const router = Router()

// GET /api/stats/leaderboard?sortBy=avg&limit=20
router.get('/leaderboard', (req, res) => {
  const { sortBy = 'avg', limit = 20 } = req.query
  res.json(getLeaderboard({ sortBy, limit: Number(limit) }))
})

// GET /api/stats/head-to-head?player_a=1&player_b=2
router.get('/head-to-head', (req, res) => {
  const { player_a, player_b } = req.query
  if (!player_a || !player_b) {
    return res.status(400).json({ error: 'player_a and player_b query params required' })
  }
  res.json(getHeadToHead(Number(player_a), Number(player_b)))
})

// GET /api/stats/milestones?limit=20
router.get('/milestones', (req, res) => {
  const { limit = 20 } = req.query
  res.json(getMilestones(Number(limit)))
})

export default router
