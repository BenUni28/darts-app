// Thin fetch wrapper for all API calls.
// All requests go to /api — Vite proxies them to the Express server.

const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(BASE + path, opts)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data
}

// Players
export const api = {
  players: {
    list:    ()           => request('GET',   '/players'),
    get:     (id)         => request('GET',   `/players/${id}`),
    history: (id)         => request('GET',   `/players/${id}/history`),
    create:  (body)       => request('POST',  '/players', body),
    update:  (id, body)   => request('PATCH', `/players/${id}`, body)
  },

  games: {
    list:    (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request('GET', `/games${qs ? '?' + qs : ''}`)
    },
    get:     (id)          => request('GET',    `/games/${id}`),
    create:  (body)        => request('POST',   '/games', body),
    turns:   (id, legId)   => request('GET',    `/games/${id}/turns?leg_id=${legId}`),
    submit:  (id, body)    => request('POST',   `/games/${id}/turns`, body),
    undo:    (id)          => request('DELETE', `/games/${id}/turns/last`),
    abandon: (id)          => request('PATCH',  `/games/${id}`, { status: 'abandoned' })
  },

  stats: {
    leaderboard: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request('GET', `/stats/leaderboard${qs ? '?' + qs : ''}`)
    },
    headToHead:  (a, b)        => request('GET', `/stats/head-to-head?player_a=${a}&player_b=${b}`),
    milestones:  ()            => request('GET', '/stats/milestones')
  }
}
