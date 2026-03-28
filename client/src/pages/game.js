import { api } from '../api.js'
import { navigate } from '../router.js'

// Checkout suggestions are fetched from the server via a static lookup
// already defined in services/checkout.js — we mirror a small version here
// for instant display (no extra round-trip needed for the UI).
const CHECKOUTS = {
  170:'T20 T20 DB', 167:'T20 T19 DB', 164:'T20 T18 DB', 161:'T20 T17 DB',
  160:'T20 T20 D20', 158:'T20 T20 D19', 157:'T20 T19 D20', 156:'T20 T20 D18',
  155:'T20 T19 D19', 154:'T20 T18 D20', 153:'T20 T19 D18', 152:'T20 T20 D16',
  151:'T20 T17 D20', 150:'T20 T20 D15', 149:'T20 T19 D16', 148:'T20 T20 D14',
  147:'T20 T17 D18', 146:'T20 T18 D16', 145:'T20 T15 D20', 144:'T20 T20 D12',
  143:'T20 T17 D16', 142:'T20 T14 D20', 141:'T20 T19 D12', 140:'T20 T20 D10',
  139:'T20 T13 D20', 138:'T20 T18 D12', 137:'T20 T19 D10', 136:'T20 T20 D8',
  135:'T20 T17 D12', 134:'T20 T14 D16', 133:'T20 T19 D8', 132:'T20 T16 D12',
  131:'T20 T13 D16', 130:'T20 T18 D8', 129:'T19 T16 D12', 128:'T18 T18 D11',
  127:'T20 T17 D8', 126:'T19 T19 D6', 125:'T20 T15 D10', 124:'T20 T16 D8',
  123:'T19 T16 D9', 122:'T18 T18 D7', 121:'T20 T11 D14', 120:'T20 S20 D20',
  119:'T20 S19 D20', 118:'T20 S18 D20', 117:'T20 S17 D20', 116:'T20 S16 D20',
  115:'T20 S15 D20', 114:'T20 S14 D20', 113:'T20 S13 D20', 112:'T20 S12 D20',
  111:'T20 S11 D20', 110:'T20 DB', 109:'T20 D25', 108:'T20 D24', 107:'T19 D25',
  106:'T20 D23', 105:'T20 D22', 104:'T18 D25', 103:'T19 D23', 102:'T20 D21',
  101:'T17 D25', 100:'T20 D20', 99:'T19 S10 D16', 98:'T20 D19', 97:'T19 D20',
  96:'T20 D18', 95:'T19 D19', 94:'T18 D20', 93:'T19 D18', 92:'T20 D16',
  91:'T17 D20', 90:'T20 D15', 89:'T19 D16', 88:'T20 D14', 87:'T17 D18',
  86:'T18 D16', 85:'T15 D20', 84:'T20 D12', 83:'T17 D16', 82:'T14 D20',
  81:'T19 D12', 80:'T20 D10', 79:'T13 D20', 78:'T18 D12', 77:'T19 D10',
  76:'T20 D8', 75:'T17 D12', 74:'T14 D16', 73:'T19 D8', 72:'T16 D12',
  71:'T13 D16', 70:'T18 D8', 69:'T19 D6', 68:'T20 D4', 67:'T17 D8',
  66:'T10 D18', 65:'T15 D10', 64:'T16 D8', 63:'T13 D12', 62:'T10 D16',
  61:'T15 D8', 60:'S20 D20', 59:'S19 D20', 58:'S18 D20', 57:'S17 D20',
  56:'S16 D20', 55:'S15 D20', 54:'S14 D20', 53:'S13 D20', 52:'S20 D16',
  51:'S19 D16', 50:'DB', 40:'D20', 38:'D19', 36:'D18', 34:'D17', 32:'D16',
  30:'D15', 28:'D14', 26:'D13', 24:'D12', 22:'D11', 20:'D10', 18:'D9',
  16:'D8', 14:'D7', 12:'D6', 10:'D5', 8:'D4', 6:'D3', 4:'D2', 2:'D1'
}

function getCheckout(remaining) {
  return CHECKOUTS[remaining] ?? null
}

export async function gamePage(appEl, params) {
  const gameId = Number(params.id)
  let game = await api.games.get(gameId)
  let inputValue = ''

  function renderPage() {
    if (game.status === 'completed') {
      renderSummary()
      return
    }

    const currentPlayer = game.players.find(p => p.id === game.currentPlayerId)
    const checkout = currentPlayer && currentPlayer.remaining <= 170
      ? getCheckout(currentPlayer.remaining)
      : null

    appEl.innerHTML = `
      <div class="anim-fade-in">
        <div class="flex-between mb-5">
          <h1>${game.game_type} — LEG ${game.activeLeg?.leg_number ?? 1}</h1>
          <div class="flex gap-2">
            <button class="btn btn-ghost" id="undo-btn">↩ UNDO</button>
            <button class="btn btn-danger" id="abandon-btn">✕ QUIT</button>
          </div>
        </div>

        <!-- Scoreboard -->
        <div class="${game.players.length === 2 ? 'grid-2' : 'grid-3'} gap-4 mb-5" id="scoreboard">
          ${game.players.map(p => {
            const isActive = p.id === game.currentPlayerId
            const avg = p.remaining !== undefined
              ? '' : ''
            return `
              <div class="player-card ${isActive ? 'active' : ''}">
                <div class="player-name">${p.avatar ?? '🎯'} ${p.name}</div>
                ${game.legs_to_win > 1 ? `<div class="text-muted mb-3" style="font-size:11px">LEGS: ${p.legs_won}</div>` : ''}
                <div class="score-value score-xl" id="score-${p.id}">${p.remaining}</div>
              </div>
            `
          }).join('')}
        </div>

        <!-- Checkout hint -->
        ${checkout ? `
          <div class="checkout-hint mb-4">
            <div class="checkout-hint-label">★ CHECKOUT ★</div>
            <div class="checkout-hint-darts">
              ${checkout.split(' ').map(d => `<span class="checkout-dart">${d}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Input display -->
        <div class="text-center mb-4">
          <div class="score-value score-lg" id="input-display">${inputValue || '—'}</div>
          <div class="text-muted mt-4" style="font-size:11px">
            ${currentPlayer ? `${currentPlayer.name.toUpperCase()}'S TURN` : ''}
          </div>
        </div>

        <!-- Numpad -->
        <div class="numpad mb-5" id="numpad">
          ${[7,8,9,4,5,6,1,2,3].map(n => `
            <button class="numpad-btn" data-num="${n}">${n}</button>
          `).join('')}
          <button class="numpad-btn" data-num="0">0</button>
          <button class="numpad-btn btn-enter" id="enter-btn">ENTER</button>
          <button class="numpad-btn btn-clear" id="clear-btn">C</button>
        </div>
      </div>
    `

    bindGameEvents(currentPlayer)
  }

  function renderSummary() {
    const winner = game.players.find(p => p.id === game.winner_id)
    appEl.innerHTML = `
      <div class="anim-fade-in text-center">
        <h1 class="anim-win-pulse" style="color:var(--gold)">★ GAME OVER ★</h1>
        <div class="card mt-5 mb-5">
          <div class="score-value score-lg text-gold mb-4">${winner?.name ?? 'Unknown'}</div>
          <div style="font-size:11px;color:var(--muted)">WINS THE MATCH</div>
        </div>
        <div class="grid-2 gap-4 mb-5">
          ${game.players.map(p => `
            <div class="card">
              <div class="player-name">${p.avatar ?? '🎯'} ${p.name}</div>
              <div class="text-muted mt-3" style="font-size:11px">LEGS WON: ${p.legs_won}</div>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-4" style="justify-content:center">
          <button class="btn btn-primary" id="play-again-btn">PLAY AGAIN</button>
          <button class="btn btn-ghost" onclick="window.location.hash='/'">HOME</button>
        </div>
      </div>
    `

    document.getElementById('play-again-btn')?.addEventListener('click', async () => {
      const playerIds = game.players
        .sort((a, b) => a.turn_order - b.turn_order)
        .map(p => p.id)
      const newGame = await api.games.create({
        game_type: game.game_type,
        player_ids: playerIds,
        legs_to_win: game.legs_to_win,
        double_out: game.double_out
      })
      navigate(`/game/${newGame.id}`)
    })
  }

  function bindGameEvents(currentPlayer) {
    // Numpad digit buttons
    document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (inputValue.length >= 3) return
        inputValue += btn.dataset.num
        document.getElementById('input-display').textContent = inputValue || '—'
      })
    })

    // Clear
    document.getElementById('clear-btn')?.addEventListener('click', () => {
      inputValue = ''
      document.getElementById('input-display').textContent = '—'
    })

    // Enter — submit turn
    document.getElementById('enter-btn')?.addEventListener('click', async () => {
      const score = Number(inputValue)
      if (!inputValue || isNaN(score) || !currentPlayer) return

      inputValue = ''
      document.getElementById('input-display').textContent = '—'

      try {
        const result = await api.games.submit(gameId, {
          player_id: currentPlayer.id,
          score
        })

        game = result.game

        // Animate the updated score
        if (result.isBust) {
          flashScore(currentPlayer.id, 'bust')
        } else if (result.isWin) {
          flashScore(currentPlayer.id, 'win')
        } else {
          flashScore(currentPlayer.id, 'normal')
        }

        setTimeout(() => renderPage(), result.gameComplete ? 1500 : 300)
      } catch (err) {
        alert(err.message)
        renderPage()
      }
    })

    // Undo
    document.getElementById('undo-btn')?.addEventListener('click', async () => {
      try {
        const result = await api.games.undo(gameId)
        game = result.game
        renderPage()
      } catch (err) {
        alert(err.message)
      }
    })

    // Abandon
    document.getElementById('abandon-btn')?.addEventListener('click', async () => {
      if (!confirm('Abandon this game?')) return
      await api.games.abandon(gameId)
      navigate('/')
    })

    // Keyboard support
    document.onkeydown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        document.querySelector(`.numpad-btn[data-num="${e.key}"]`)?.click()
      }
      if (e.key === 'Enter') document.getElementById('enter-btn')?.click()
      if (e.key === 'Backspace' || e.key === 'Escape') document.getElementById('clear-btn')?.click()
    }
  }

  function flashScore(playerId, type) {
    const el = document.getElementById(`score-${playerId}`)
    if (!el) return
    el.classList.remove('anim-score-flash', 'anim-bust-shake', 'score-bust', 'score-win')
    void el.offsetWidth // trigger reflow to restart animation

    if (type === 'bust') {
      el.classList.add('anim-bust-shake', 'score-bust')
    } else if (type === 'win') {
      el.classList.add('anim-win-pulse', 'score-win')
    } else {
      el.classList.add('anim-score-flash')
    }
  }

  // Clean up keyboard listener on navigation away
  window.addEventListener('hashchange', () => { document.onkeydown = null }, { once: true })

  renderPage()
}
