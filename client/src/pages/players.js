import { api } from '../api.js'

export async function playersPage(appEl) {
  async function render() {
    const players = await api.players.list()

    appEl.innerHTML = `
      <div class="anim-fade-in">
        <div class="flex-between mb-5">
          <h1>PLAYERS</h1>
          <button class="btn btn-primary" id="add-player-btn">+ ADD PLAYER</button>
        </div>

        <!-- Add player form (hidden by default) -->
        <div id="add-form" class="card mb-5" style="display:none">
          <h2>NEW PLAYER</h2>
          <div class="flex gap-4 mt-4">
            <input class="input" id="player-name-input" placeholder="Enter name..." maxlength="32" />
            <select class="input" id="player-avatar-input" style="width:auto;min-width:80px">
              <option value="🎯">🎯</option>
              <option value="🏹">🏹</option>
              <option value="⚡">⚡</option>
              <option value="🔥">🔥</option>
              <option value="💀">💀</option>
              <option value="👾">👾</option>
              <option value="🤖">🤖</option>
              <option value="🦅">🦅</option>
            </select>
            <button class="btn btn-primary" id="save-player-btn">SAVE</button>
            <button class="btn btn-ghost" id="cancel-player-btn">CANCEL</button>
          </div>
          <div id="add-error" class="text-red mt-3" style="font-size:11px"></div>
        </div>

        <!-- Player list -->
        ${players.length === 0
          ? `<div class="card text-center text-muted" style="padding:48px">
               <div style="font-family:var(--font-pixel);font-size:12px">NO PLAYERS YET</div>
               <div class="mt-4" style="font-size:12px">Add your first player above</div>
             </div>`
          : `<table class="table">
               <thead>
                 <tr>
                   <th>PLAYER</th>
                   <th>GAMES</th>
                   <th>WINS</th>
                   <th>AVG</th>
                   <th>180s</th>
                   <th>BEST OUT</th>
                   <th></th>
                 </tr>
               </thead>
               <tbody>
                 ${players.map(p => `
                   <tr>
                     <td>
                       <span style="font-size:18px">${p.avatar ?? '🎯'}</span>
                       <strong style="margin-left:8px">${p.name}</strong>
                     </td>
                     <td>${p.games_played}</td>
                     <td>${p.games_won}</td>
                     <td class="text-green">${p.avg_per_turn ?? '—'}</td>
                     <td>${p.count_180 > 0 ? `<span class="text-gold">★ ${p.count_180}</span>` : '—'}</td>
                     <td>${p.best_checkout > 0 ? p.best_checkout : '—'}</td>
                     <td>
                       <button class="btn btn-danger archive-btn"
                               data-id="${p.id}" data-name="${p.name}"
                               style="font-size:8px;padding:4px 8px">
                         ✕
                       </button>
                     </td>
                   </tr>
                 `).join('')}
               </tbody>
             </table>`
        }
      </div>
    `

    // Toggle add form
    document.getElementById('add-player-btn').addEventListener('click', () => {
      document.getElementById('add-form').style.display = 'block'
      document.getElementById('player-name-input').focus()
    })

    document.getElementById('cancel-player-btn')?.addEventListener('click', () => {
      document.getElementById('add-form').style.display = 'none'
    })

    document.getElementById('save-player-btn')?.addEventListener('click', async () => {
      const name   = document.getElementById('player-name-input').value.trim()
      const avatar = document.getElementById('player-avatar-input').value
      const errEl  = document.getElementById('add-error')

      if (!name) { errEl.textContent = 'Name is required'; return }

      try {
        await api.players.create({ name, avatar })
        render() // re-render the whole page with the new player
      } catch (err) {
        errEl.textContent = err.message
      }
    })

    // Submit on Enter key in input
    document.getElementById('player-name-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('save-player-btn').click()
    })

    // Archive (soft-delete) buttons
    document.querySelectorAll('.archive-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name
        if (!confirm(`"${name}" archivieren? Der Spieler wird aus der Liste entfernt, die Spielhistorie bleibt erhalten.`)) return
        await api.players.update(Number(btn.dataset.id), { is_active: 0 })
        render()
      })
    })
  }

  await render()
}
