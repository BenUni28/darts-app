import { api } from '../api.js'

export async function statsPage(appEl) {
  // Fetch all data in parallel
  const [leaderboard, milestones, players] = await Promise.all([
    api.stats.leaderboard({ sortBy: 'avg', limit: 20 }),
    api.stats.milestones(),
    api.players.list()
  ])

  let sortBy = 'avg'

  function renderLeaderboard() {
    const sorted = [...leaderboard].sort((a, b) => {
      if (sortBy === 'avg')      return b.avg_per_turn - a.avg_per_turn
      if (sortBy === 'wins')     return b.games_won - a.games_won
      if (sortBy === '180s')     return b.count_180 - a.count_180
      if (sortBy === 'checkout') return b.best_checkout - a.best_checkout
      return 0
    })

    return `
      <div class="flex gap-2 mb-4" id="sort-btns">
        <button class="btn ${sortBy === 'avg'      ? 'btn-primary' : 'btn-ghost'} sort-btn" data-sort="avg">AVG</button>
        <button class="btn ${sortBy === 'wins'     ? 'btn-primary' : 'btn-ghost'} sort-btn" data-sort="wins">WINS</button>
        <button class="btn ${sortBy === '180s'     ? 'btn-primary' : 'btn-ghost'} sort-btn" data-sort="180s">180s</button>
        <button class="btn ${sortBy === 'checkout' ? 'btn-primary' : 'btn-ghost'} sort-btn" data-sort="checkout">CHECKOUT</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>PLAYER</th>
            <th>AVG</th>
            <th>GAMES</th>
            <th>WIN%</th>
            <th>180s</th>
            <th>BEST OUT</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((p, i) => `
            <tr>
              <td class="${i === 0 ? 'text-gold' : i === 1 ? 'text-muted' : ''}"
                  style="font-family:var(--font-pixel);font-size:10px">
                ${i === 0 ? '★' : i + 1}
              </td>
              <td><strong>${p.avatar ?? '🎯'} ${p.name}</strong></td>
              <td class="text-green" style="font-weight:700">${p.avg_per_turn ?? '—'}</td>
              <td>${p.games_played}</td>
              <td>${p.win_pct ?? 0}%</td>
              <td>${p.count_180 > 0 ? `<span class="text-gold">★ ${p.count_180}</span>` : '—'}</td>
              <td>${p.best_checkout > 0 ? p.best_checkout : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  function renderMilestones() {
    if (milestones.length === 0) {
      return `<p class="text-muted" style="font-size:11px">No milestones yet — play some games!</p>`
    }
    return milestones.map(m => `
      <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--surface-2)">
        <div>
          <span class="${m.score === 180 ? 'text-gold' : 'text-green'}" style="font-weight:700;margin-right:8px">
            ${m.score === 180 ? '★ 180 ★' : m.score}
          </span>
          <span>${m.player_name}</span>
        </div>
        <span class="text-muted" style="font-size:11px">
          ${new Date(m.created_at).toLocaleDateString()}
        </span>
      </div>
    `).join('')
  }

  appEl.innerHTML = `
    <div class="anim-fade-in">
      <h1>HALL OF FAME</h1>

      <div class="grid-2 gap-5">
        <!-- Leaderboard -->
        <div>
          <div class="card">
            <h2>LEADERBOARD</h2>
            <div id="leaderboard-content">${renderLeaderboard()}</div>
          </div>
        </div>

        <!-- Right column -->
        <div>
          <!-- Head to Head -->
          <div class="card mb-5">
            <h2>HEAD TO HEAD</h2>
            <div class="flex gap-2 mb-4" style="align-items:center">
              <select class="input" id="h2h-a" style="flex:1">
                ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
              <span style="font-family:var(--font-pixel);font-size:10px;color:var(--magenta)">VS</span>
              <select class="input" id="h2h-b" style="flex:1">
                ${players.map((p, i) => `<option value="${p.id}" ${i === 1 ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
              <button class="btn btn-secondary" id="h2h-btn">GO</button>
            </div>
            <div id="h2h-result" class="text-muted" style="font-size:12px">Select two players</div>
          </div>

          <!-- Milestones -->
          <div class="card">
            <h2>RECENT HIGHLIGHTS</h2>
            <div id="milestones">${renderMilestones()}</div>
          </div>
        </div>
      </div>
    </div>
  `

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort
      document.getElementById('leaderboard-content').innerHTML = renderLeaderboard()
      // Re-bind sort buttons after re-render
      bindSortBtns()
    })
  })

  function bindSortBtns() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sortBy = btn.dataset.sort
        document.getElementById('leaderboard-content').innerHTML = renderLeaderboard()
        bindSortBtns()
      })
    })
  }

  // Head to head
  document.getElementById('h2h-btn').addEventListener('click', async () => {
    const a = Number(document.getElementById('h2h-a').value)
    const b = Number(document.getElementById('h2h-b').value)
    if (a === b) {
      document.getElementById('h2h-result').innerHTML =
        `<span class="text-red">Select two different players</span>`
      return
    }
    try {
      const result = await api.stats.headToHead(a, b)
      const pA = players.find(p => p.id === a)
      const pB = players.find(p => p.id === b)
      document.getElementById('h2h-result').innerHTML = `
        <div class="flex-between mt-3">
          <div class="text-center" style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:18px;color:var(--cyan)">${result.wins_a}</div>
            <div style="font-size:11px">${pA?.name}</div>
          </div>
          <div class="text-muted" style="font-size:11px;padding:0 12px">${result.total_games} games</div>
          <div class="text-center" style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:18px;color:var(--magenta)">${result.wins_b}</div>
            <div style="font-size:11px">${pB?.name}</div>
          </div>
        </div>
      `
    } catch (err) {
      document.getElementById('h2h-result').textContent = err.message
    }
  })
}
