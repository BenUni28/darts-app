import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Importing db triggers connection.js which opens the database,
// sets pragmas, and runs any pending migrations automatically.
import './db/connection.js'

import playersRouter from './routes/players.js'
import gamesRouter   from './routes/games.js'
import statsRouter   from './routes/stats.js'
import { errorHandler } from './middleware/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3001

// --- Middleware ---
app.use(helmet())
// In production the frontend is served by this same server, so no CORS needed.
// In dev, allow the Vite dev server on localhost.
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173' }))
app.use(express.json())

// --- Routes ---
app.use('/api/players', playersRouter)
app.use('/api/games',   gamesRouter)
app.use('/api/stats',   statsRouter)

// Health check — useful to verify the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// --- Serve built frontend in production ---
// Vite builds to /dist. In production Railway runs `npm start` (no Vite dev server),
// so Express delivers the static files and handles client-side routing via the catch-all.
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  // All non-API routes → index.html (SPA hash routing works without this,
  // but it future-proofs against history-mode routing)
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

// --- Error handler (must be last) ---
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`)
})
