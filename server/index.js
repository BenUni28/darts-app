import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

// Importing db triggers connection.js which opens the database,
// sets pragmas, and runs any pending migrations automatically.
import './db/connection.js'

import playersRouter from './routes/players.js'
import gamesRouter   from './routes/games.js'
import statsRouter   from './routes/stats.js'
import { errorHandler } from './middleware/errors.js'

const app = express()
const PORT = process.env.PORT || 3001

// --- Middleware ---
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' })) // Vite dev server
app.use(express.json())

// --- Routes ---
app.use('/api/players', playersRouter)
app.use('/api/games',   gamesRouter)
app.use('/api/stats',   statsRouter)

// Health check — useful to verify the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// --- Error handler (must be last) ---
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`)
})
