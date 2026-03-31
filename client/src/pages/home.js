import { api } from '../api.js'
import { navigate } from '../router.js'

export async function homePage(appEl) {
  const players = await api.players.list()

  appEl.innerHTML = `
    <div class="anim-fade-in">
      <h1>★ NEW GAME ★</h1>

      <div class="home-grid gap-5">
        <!-- LEFT: Game settings -->
        <div class="home-left">
          <div class="card mb-4">
            <h2 class="mb-4">GAME TYPE</h2>
            <div class="flex gap-2" id="game-type-btns">
              <button class="btn btn-primary type-btn active" data-type="501">501</button>
              <button class="btn btn-ghost  type-btn" data-type="301">301</button>
              <button class="btn btn-ghost  type-btn" data-type="Cricket">CRICKET</button>
            </div>
          </div>

          <div class="card mb-4">
            <h2 class="mb-4">LEGS</h2>
            <div class="flex gap-2" id="legs-btns">
              <button class="btn btn-primary legs-btn active" data-legs="1">1</button>
              <button class="btn btn-ghost  legs-btn" data-legs="3">BEST OF 3</button>
              <button class="btn btn-ghost  legs-btn" data-legs="5">BEST OF 5</button>
            </div>
          </div>

          <div class="card" id="double-out-card">
            <h2 class="mb-4">DOUBLE OUT</h2>
            <div class="flex gap-2">
              <button class="btn btn-primary double-btn active" data-double="1">ON</button>
              <button class="btn btn-ghost  double-btn" data-double="0">OFF</button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Player selection + Spotify -->
        <div class="home-right">
          <div class="card mb-4">
            <h2 class="mb-2">PLAYERS</h2>
            <p class="text-muted mb-4" style="font-size:11px">Select 2–8 players in throw order</p>

            <div id="player-list">
              ${players.length === 0
                ? `<p class="text-muted" style="font-size:11px">No players yet. <a href="#/players" class="text-cyan">Add some first.</a></p>`
                : players.map(p => `
                  <div class="player-select-row flex-between mb-3" data-id="${p.id}">
                    <span class="player-select-name">${p.avatar ?? '🎯'} ${p.name}</span>
                    <button class="btn btn-ghost select-btn" data-id="${p.id}">ADD</button>
                  </div>
                `).join('')
              }
            </div>

            <div class="mt-4">
              <h3 class="mb-3">SELECTED (throw order)</h3>
              <div id="selected-players">
                <p class="text-muted" style="font-size:11px">None selected</p>
              </div>
            </div>
          </div>

          <!-- Placeholder — the real Spotify iframe floats here via JS -->
          <div id="spotify-placeholder" class="card spotify-card" style="height:114px"></div>
        </div>
      </div>

      <div class="mt-5 text-center">
        <button class="btn btn-primary btn-lg" id="start-btn" disabled>★ START GAME ★</button>
      </div>

    </div>
  `

  // --- State ---
  let gameType = '501'
  let legsToWin = 1
  let doubleOut = 1
  const selectedIds = []

  // --- Toggle helpers ---
  function setActive(groupSelector, activeEl) {
    document.querySelectorAll(groupSelector).forEach(b => {
      b.classList.toggle('active', b === activeEl)
      b.classList.toggle('btn-primary', b === activeEl)
      b.classList.toggle('btn-ghost', b !== activeEl)
    })
  }

  function renderSelected() {
    const el = document.getElementById('selected-players')
    if (selectedIds.length === 0) {
      el.innerHTML = `<p class="text-muted" style="font-size:11px">None selected</p>`
    } else {
      el.innerHTML = selectedIds.map((id, i) => {
        const p = players.find(x => x.id === id)
        return `
          <div class="flex-between mb-2" style="font-size:12px">
            <span>${i + 1}. ${p.avatar ?? '🎯'} ${p.name}</span>
            <button class="btn btn-ghost" style="font-size:8px;padding:2px 6px"
              onclick="window.__removePlayer(${id})">✕</button>
          </div>
        `
      }).join('')
    }
    document.getElementById('start-btn').disabled = selectedIds.length < 2
  }

  window.__removePlayer = (id) => {
    const idx = selectedIds.indexOf(id)
    if (idx !== -1) selectedIds.splice(idx, 1)
    // Re-enable the ADD button for this player
    const btn = document.querySelector(`.select-btn[data-id="${id}"]`)
    if (btn) { btn.textContent = 'ADD'; btn.disabled = false }
    renderSelected()
  }

  // --- Event bindings ---
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gameType = btn.dataset.type
      setActive('.type-btn', btn)
      // Hide double-out for Cricket
      document.getElementById('double-out-card').style.display =
        gameType === 'Cricket' ? 'none' : ''
    })
  })

  document.querySelectorAll('.legs-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      legsToWin = Number(btn.dataset.legs)
      setActive('.legs-btn', btn)
    })
  })

  document.querySelectorAll('.double-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      doubleOut = Number(btn.dataset.double)
      setActive('.double-btn', btn)
    })
  })

  document.querySelectorAll('.select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id)
      if (selectedIds.length >= 8) return
      selectedIds.push(id)
      btn.textContent = `#${selectedIds.length}`
      btn.disabled = true
      renderSelected()
    })
  })

  document.getElementById('start-btn').addEventListener('click', async () => {
    const game = await api.games.create({
      game_type: gameType,
      player_ids: selectedIds,
      legs_to_win: legsToWin,
      double_out: doubleOut
    })
    navigate(`/game/${game.id}`)
  })
}
