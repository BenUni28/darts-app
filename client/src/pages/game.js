import { api } from '../api.js'
import { navigate } from '../router.js'

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

function getCheckout(remaining) { return CHECKOUTS[remaining] ?? null }

const CRICKET_SEGMENTS = [20, 19, 18, 17, 16, 15, 25]

// --- Dart-by-dart helpers ---
function dartScore(segment, multiplier) {
  if (segment === 0)  return 0
  if (segment === 25) return multiplier === 2 ? 50 : 25
  return segment * multiplier
}

function dartLabel(segment, multiplier) {
  if (segment === 0)                        return 'MISS'
  if (segment === 25 && multiplier === 2)   return 'DB'
  if (segment === 25)                       return 'BULL'
  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S'
  return `${prefix}${segment}`
}

// ─── Keyboard shortcode helpers ──────────────────────────────────────────────
function parseShortcode(buf) {
  if (!buf) return null
  const b = buf.toLowerCase()
  if (b === '0' || b === 'm')              return { segment: 0,  multiplier: 1 }
  if (b === 'b')                           return { segment: 25, multiplier: 1 }
  if (b === 'db')                          return { segment: 25, multiplier: 2 }
  if (/^\d{1,2}$/.test(b)) {
    const n = Number(b)
    if (n >= 1 && n <= 20)                 return { segment: n,  multiplier: 1 }
    if (n === 25)                          return { segment: 25, multiplier: 1 }
  }
  if (/^t\d{1,2}$/.test(b)) {
    const n = Number(b.slice(1))
    if (n >= 1 && n <= 20)                 return { segment: n,  multiplier: 3 }
  }
  if (/^d\d{1,2}$/.test(b)) {
    const n = Number(b.slice(1))
    if (n >= 1 && n <= 20)                 return { segment: n,  multiplier: 2 }
    if (n === 25)                          return { segment: 25, multiplier: 2 }
  }
  return null
}

function isAutoComplete(buf) {
  if (!buf) return false
  const b = buf.toLowerCase()
  if (b === '0' || b === 'm' || b === 'b' || b === 'db') return true
  if (/^\d{2}$/.test(b)) { const n = Number(b); return (n >= 10 && n <= 20) || n === 25 }
  if (/^[td]\d{2}$/.test(b)) {
    const n = Number(b.slice(1))
    if (b[0] === 't') return n >= 10 && n <= 20
    if (b[0] === 'd') return (n >= 10 && n <= 20) || n === 25
  }
  return false
}

function couldBeValid(buf) {
  if (!buf) return true
  const b = buf.toLowerCase()
  if (b === 't' || b === 'd' || b === 'm' || b === 'b' || b === 'db') return true
  if (/^\d$/.test(b))  return true
  if (/^\d{2}$/.test(b)) { const n = Number(b); return (n >= 10 && n <= 25) }
  if (/^t\d$/.test(b))  { const n = Number(b[1]); return n >= 1 && n <= 9 }
  if (/^t\d{2}$/.test(b)) { const n = Number(b.slice(1)); return n >= 10 && n <= 20 }
  if (/^d\d$/.test(b))  { const n = Number(b[1]); return n >= 1 && n <= 9 }
  if (/^d\d{2}$/.test(b)) { const n = Number(b.slice(1)); return (n >= 10 && n <= 20) || n === 25 }
  return false
}

// ─── Rules content ───────────────────────────────────────────────────────────
const RULES = {
  '501': [
    { title: 'ZIEL', text: 'Reduziere dein Score von 501 auf exakt 0. Erster der auf Null kommt gewinnt das Leg.' },
    { title: 'DOUBLE OUT', text: 'Du musst mit einem Double (oder Bullseye) auf exakt 0 abschließen. Andernfalls ist der Wurf ein Bust.' },
    { title: 'BUST', text: 'Wirfst du mehr als dein aktueller Rest, oder landest du auf 1 oder nicht auf einem Double, zählt die gesamte Runde nicht.' },
    { title: 'RUNDE', text: 'Pro Runde hat jeder Spieler 3 Würfe. Die Punkte werden zusammengezählt und vom Rest abgezogen.' },
    { title: 'FINISH', text: 'Checkouts von 170 abwärts sind möglich. Das höchste Checkout ist T20 T20 DB = 170.' },
  ],
  '301': [
    { title: 'ZIEL', text: 'Wie 501, aber du startest bei 301. Kürzeres Spiel, schnellere Runden.' },
    { title: 'DOUBLE OUT', text: 'Auch hier gilt: Abschluss auf einem Double oder Bullseye.' },
    { title: 'BUST', text: 'Selbe Regel wie bei 501 — zu hoch, auf 1, oder kein Double = Bust.' },
  ],
  'Cricket': [
    { title: 'SEGMENTE', text: 'Gespielt wird auf die Felder 15, 16, 17, 18, 19, 20 und Bull (25/50). Alle anderen Felder zählen nicht.' },
    { title: 'ÖFFNEN', text: '3 Treffer auf einem Feld öffnen ("schließen") es für dich. Single = 1, Double = 2, Triple = 3 Treffer.' },
    { title: 'PUNKTE', text: 'Sobald du ein Feld geöffnet hast, bringt jeder weitere Treffer Punkte — solange der Gegner das Feld noch nicht selbst geschlossen hat.' },
    { title: 'GESCHLOSSEN', text: 'Wenn alle Spieler ein Feld geöffnet haben, ist es für alle geschlossen. Dann können keine Punkte mehr darauf erzielt werden.' },
    { title: 'SIEG', text: 'Wer als Erster alle 7 Felder geöffnet hat UND gleich viele oder mehr Punkte als alle Gegner hat, gewinnt das Leg.' },
    { title: 'PUNKTE AUFHOLEN', text: 'Liegt ein Gegner in Punkten vorne, musst du noch Punkte sammeln, bevor du gewinnen kannst — auch wenn du alle Felder schon offen hast.' },
  ]
}

export async function gamePage(appEl, params) {
  const gameId = Number(params.id)
  let game = await api.games.get(gameId)

  const isCricket = game.game_type === 'Cricket'

  // Persisted across games — irrelevant for Cricket (always dart×dart there)
  let inputMode = isCricket ? 'dart' : (localStorage.getItem('darts-input-mode') ?? 'visit')

  // Visit-entry state
  let visitInput = ''

  // Dart-by-dart state
  let selectedMult = 1
  let dartEntries  = []
  let kbBuffer     = ''

  // ─── Cricket marks helper ────────────────────────────────────────────────────
  function marksSymbol(marks) {
    if (marks === 0) return ''
    if (marks === 1) return '/'
    if (marks === 2) return 'X'
    return '●'  // 3 = closed
  }

  // ─── Cricket scoreboard / marks table ────────────────────────────────────────
  function cricketBoardHTML() {
    const cs = game.cricketState ?? {}
    const players = game.players

    // Points total per player
    const totals = players.map(p => {
      const pState = cs[p.id] ?? {}
      return CRICKET_SEGMENTS.reduce((sum, seg) => sum + (pState[seg]?.points ?? 0), 0)
    })

    return `
      <div class="cricket-board mb-5">
        <!-- Player name header row -->
        <div class="cricket-header">
          <div class="cricket-seg-label"></div>
          ${players.map((p, i) => `
            <div class="cricket-player-col ${p.id === game.currentPlayerId ? 'active' : ''}">
              <div class="cricket-player-name">${p.avatar ?? '🎯'} ${p.name}</div>
              <div class="cricket-points" id="score-${p.id}">${totals[i]}</div>
            </div>
          `).join('')}
        </div>

        <!-- Segment rows -->
        ${CRICKET_SEGMENTS.map(seg => {
          const allClosed = players.every(p => (cs[p.id]?.[seg]?.marks ?? 0) >= 3)
          return `
            <div class="cricket-row ${allClosed ? 'cricket-row-closed' : ''}">
              <div class="cricket-seg-label">${seg === 25 ? 'BULL' : seg}</div>
              ${players.map(p => {
                const marks = cs[p.id]?.[seg]?.marks ?? 0
                const pts   = cs[p.id]?.[seg]?.points ?? 0
                return `
                  <div class="cricket-cell ${marks >= 3 ? 'cricket-closed' : ''}">
                    <span class="cricket-marks">${marksSymbol(marks)}</span>
                    ${pts > 0 ? `<span class="cricket-pts">+${pts}</span>` : ''}
                  </div>
                `
              }).join('')}
            </div>
          `
        }).join('')}

        <!-- Totals footer -->
        <div class="cricket-row cricket-totals-row">
          <div class="cricket-seg-label">PTS</div>
          ${players.map((p, i) => `
            <div class="cricket-cell"><strong class="text-gold">${totals[i]}</strong></div>
          `).join('')}
        </div>

        ${game.legs_to_win > 1 ? `
          <div class="cricket-row" style="border-top:1px solid var(--border)">
            <div class="cricket-seg-label" style="font-size:8px">LEGS</div>
            ${players.map(p => `
              <div class="cricket-cell" style="font-size:10px">${p.legs_won}</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  // ─── X01 Scoreboard HTML ─────────────────────────────────────────────────────
  function scoreboardHTML() {
    return game.players.map(p => `
      <div class="player-card ${p.id === game.currentPlayerId ? 'active' : ''}">
        <div class="player-name">${p.avatar ?? '🎯'} ${p.name}</div>
        ${game.legs_to_win > 1
          ? `<div class="text-muted mb-3" style="font-size:11px">LEGS: ${p.legs_won}</div>`
          : ''}
        <div class="score-value score-xl" id="score-${p.id}">${p.remaining}</div>
      </div>
    `).join('')
  }

  // ─── Visit input HTML ────────────────────────────────────────────────────────
  function visitInputHTML() {
    return `
      <div class="text-center mb-4">
        <div class="score-value score-lg" id="visit-display">${visitInput || '—'}</div>
        <div class="text-muted mt-2" style="font-size:10px;letter-spacing:1px">SUMME ALLER 3 WÜRFE</div>
      </div>
      <div class="numpad mb-4">
        ${[7,8,9,4,5,6,1,2,3].map(n =>
          `<button class="numpad-btn" data-num="${n}">${n}</button>`
        ).join('')}
        <button class="numpad-btn" data-num="0">0</button>
        <button class="numpad-btn btn-enter" id="visit-enter">ENTER</button>
        <button class="numpad-btn btn-clear" id="visit-clear">C</button>
      </div>
    `
  }

  // ─── Keyboard preview HTML (dart mode) ──────────────────────────────────────
  function kbPreviewHTML() {
    if (!kbBuffer) {
      return `<span class="kb-hint">⌨ t20 · d16 · 18 · b · db · 0</span>`
    }
    const parsed = parseShortcode(kbBuffer)
    const dartInfo = parsed
      ? ` → <span class="kb-dart">${dartLabel(parsed.segment, parsed.multiplier)} (${dartScore(parsed.segment, parsed.multiplier)})</span>`
      : ' <span class="kb-hint">?</span>'
    const enterHint = parsed && !isAutoComplete(kbBuffer)
      ? ' <span class="kb-hint">— ENTER</span>'
      : ''
    return `<span class="kb-buffer">⌨ ${kbBuffer.toUpperCase()}</span>${dartInfo}${enterHint}`
  }

  function updateKbPreview() {
    const el = document.getElementById('kb-preview')
    if (el) el.innerHTML = kbPreviewHTML()
  }

  // Updates the checkout hint after each dart in X01 mode.
  function updateCheckoutHint(remaining) {
    const el = document.getElementById('checkout-hint')
    if (!el) return
    const checkout = remaining > 1 && remaining <= 170 ? getCheckout(remaining) : null
    if (checkout) {
      el.querySelector('.checkout-hint-darts').innerHTML =
        checkout.split(' ').map(d => `<span class="checkout-dart">${d}</span>`).join('')
      el.style.display = ''
    } else {
      el.style.display = 'none'
    }
  }

  // ─── Dart-by-dart input HTML ─────────────────────────────────────────────────
  function dartInputHTML(currentPlayer) {
    const total     = dartEntries.reduce((s, d) => s + d.score, 0)
    const remaining = currentPlayer?.remaining ?? 0
    const preview   = remaining - total
    const isBust    = !isCricket && dartEntries.length > 0 && (preview < 0 || preview === 1)
    const isCheckout= !isCricket && dartEntries.length > 0 && preview === 0
    const done      = dartEntries.length >= 3

    // In Cricket mode only show relevant segments; in X01 show all 1-20
    const segments = isCricket ? [20, 19, 18, 17, 16, 15] : [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]

    return `
      <!-- 3 dart slots -->
      <div class="dart-slots mb-4">
        ${[0, 1, 2].map(i => {
          const d        = dartEntries[i]
          const isActive = i === dartEntries.length && !done
          return `
            <div class="dart-slot ${d ? 'filled' : ''} ${isActive ? 'active' : ''}">
              <div class="dart-slot-label">${d ? d.label : '—'}</div>
              <div class="dart-slot-score">${d ? d.score : ''}</div>
            </div>
          `
        }).join('')}
        <div class="dart-slot-total ${isBust ? 'text-red' : isCheckout ? 'text-gold' : 'text-cyan'}">
          ${isBust ? 'BUST!' : isCheckout ? '★ OUT!' : `= ${total}`}
        </div>
      </div>

      <!-- Keyboard shortcode preview -->
      <div class="kb-preview" id="kb-preview">${kbPreviewHTML()}</div>

      <!-- Multiplier -->
      <div class="multiplier-row mb-3">
        ${[['1','SINGLE'],['2','DOUBLE'],['3','TRIPLE']].map(([v, label]) => `
          <button class="mult-btn ${selectedMult === Number(v) ? 'active' : ''}" data-mult="${v}">
            ×${v} ${label}
          </button>
        `).join('')}
      </div>

      <!-- Segment grid -->
      <div class="segment-grid mb-4">
        ${segments.map(n => `
          <button class="seg-btn" data-seg="${n}" ${done ? 'disabled' : ''}>${n}</button>
        `).join('')}
        <button class="seg-btn seg-bull" data-seg="25" ${done ? 'disabled' : ''}>BULL</button>
        <button class="seg-btn seg-miss" data-seg="0"  ${done ? 'disabled' : ''}>MISS</button>
      </div>

      <!-- Actions -->
      <div class="flex gap-2" style="justify-content:center">
        <button class="btn btn-ghost"   id="dart-remove" ${dartEntries.length === 0 ? 'disabled' : ''}>↩ REMOVE</button>
        <button class="btn btn-primary" id="dart-enter"  ${dartEntries.length === 0 ? 'disabled' : ''}>ENTER</button>
      </div>
    `
  }

  // ─── Full page render ────────────────────────────────────────────────────────
  function renderPage() {
    if (game.status === 'completed') { renderSummary(); return }

    const currentPlayer = game.players.find(p => p.id === game.currentPlayerId)
    const checkout = !isCricket && (currentPlayer?.remaining <= 170)
      ? getCheckout(currentPlayer.remaining) : null

    appEl.innerHTML = `
      <div class="anim-fade-in">
        <div class="flex-between mb-5">
          <h1>${game.game_type} — LEG ${game.activeLeg?.leg_number ?? 1}</h1>
          <div class="flex gap-2">
            <button class="btn btn-ghost"   id="rules-btn">? RULES</button>
            <button class="btn btn-ghost"   id="undo-btn">↩ UNDO</button>
            <button class="btn btn-danger"  id="abandon-btn">✕ QUIT</button>
          </div>
        </div>

        ${isCricket
          ? cricketBoardHTML()
          : `<div class="scoreboard-row mb-5" data-players="${game.players.length}">
               ${scoreboardHTML()}
             </div>`
        }

        <!-- Checkout hint (X01 only) -->
        ${!isCricket ? `
          <div id="checkout-hint" class="checkout-hint mb-4"${checkout ? '' : ' style="display:none"'}>
            <div class="checkout-hint-label">★ CHECKOUT ★</div>
            <div class="checkout-hint-darts">
              ${checkout ? checkout.split(' ').map(d => `<span class="checkout-dart">${d}</span>`).join('') : ''}
            </div>
          </div>
        ` : ''}

        <!-- Mode toggle (X01 only — Cricket always uses dart×dart) -->
        ${!isCricket ? `
          <div class="input-mode-toggle mb-4">
            <button class="mode-btn ${inputMode === 'visit' ? 'active' : ''}" data-mode="visit">VISIT</button>
            <button class="mode-btn ${inputMode === 'dart'  ? 'active' : ''}" data-mode="dart">DART × DART</button>
          </div>
        ` : ''}

        <div class="text-muted text-center mb-4" style="font-size:10px;letter-spacing:1px">
          ${currentPlayer ? currentPlayer.name.toUpperCase() + "'S TURN" : ''}
        </div>

        <!-- Input area -->
        <div id="input-area">
          ${inputMode === 'visit' ? visitInputHTML() : dartInputHTML(currentPlayer)}
        </div>
      </div>
    `

    bindAll(currentPlayer)
  }

  // ─── Register one dart (shared by click and keyboard) ───────────────────────
  function addDart(segment, multiplier, currentPlayer) {
    if (dartEntries.length >= 3) return
    const mult = segment === 0 ? 1 : (segment === 25 && multiplier === 3) ? 2 : multiplier
    dartEntries.push({
      segment, multiplier: mult,
      score: dartScore(segment, mult),
      label: dartLabel(segment, mult)
    })
    selectedMult = 1

    // X01 bust/win early-exit logic
    let autoSubmit = dartEntries.length === 3
    if (!isCricket) {
      const total   = dartEntries.reduce((s, d) => s + d.score, 0)
      const preview = currentPlayer.remaining - total
      const isBust  = preview < 0 || preview === 1
      const isWin   = preview === 0
      if (isBust || isWin) autoSubmit = true
      // Update checkout hint for the remaining score after this dart
      if (!isBust && !isWin) {
        // Re-render input area first so hint element exists, then update it
        document.getElementById('input-area').innerHTML = dartInputHTML(currentPlayer)
        bindInputArea(currentPlayer)
        updateCheckoutHint(preview)
      } else {
        document.getElementById('input-area').innerHTML = dartInputHTML(currentPlayer)
        bindInputArea(currentPlayer)
        const el = document.getElementById('checkout-hint')
        if (el) el.style.display = 'none'
      }
    } else {
      document.getElementById('input-area').innerHTML = dartInputHTML(currentPlayer)
      bindInputArea(currentPlayer)
    }

    if (autoSubmit) {
      setTimeout(() => submitDarts(currentPlayer), 700)
    }
  }

  // ─── Keyboard handler for dart-by-dart mode ──────────────────────────────────
  function handleDartKeyboard(key, currentPlayer) {
    if (dartEntries.length >= 3) return

    if (key === 'Escape') { kbBuffer = ''; updateKbPreview(); return }
    if (key === 'Backspace') { kbBuffer = kbBuffer.slice(0, -1); updateKbPreview(); return }

    if (key === 'Enter') {
      const dart = parseShortcode(kbBuffer)
      if (dart) { kbBuffer = ''; addDart(dart.segment, dart.multiplier, currentPlayer) }
      return
    }

    const ch = key.toLowerCase()
    if (!'0123456789tdmb'.includes(ch)) return
    const next = kbBuffer + ch
    if (!couldBeValid(next)) return
    kbBuffer = next

    if (isAutoComplete(kbBuffer)) {
      const dart = parseShortcode(kbBuffer)
      if (dart) { kbBuffer = ''; addDart(dart.segment, dart.multiplier, currentPlayer); return }
    }
    updateKbPreview()
  }

  // ─── Rules modal ─────────────────────────────────────────────────────────────
  function showRulesModal() {
    const rules = RULES[game.game_type] ?? []
    const overlay = document.createElement('div')
    overlay.id = 'rules-modal'
    overlay.innerHTML = `
      <div class="rules-paper">
        <div class="rules-title">★ ${game.game_type} RULES ★</div>
        <div class="rules-body">
          ${rules.map(r => `
            <div class="rules-section">
              <div class="rules-section-title">${r.title}</div>
              <div class="rules-section-text">${r.text}</div>
            </div>
          `).join('')}
        </div>
        <div class="text-center mt-5">
          <button class="btn btn-primary" id="rules-close-btn">✕ CLOSE</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)
    document.getElementById('rules-close-btn').addEventListener('click', () => overlay.remove())
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
  }

  // ─── Bind all events ─────────────────────────────────────────────────────────
  function bindAll(currentPlayer) {
    document.getElementById('rules-btn').addEventListener('click', showRulesModal)

    // Mode toggle (X01 only)
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        inputMode = btn.dataset.mode
        localStorage.setItem('darts-input-mode', inputMode)
        visitInput = ''; dartEntries = []; selectedMult = 1; kbBuffer = ''
        document.getElementById('input-area').innerHTML =
          inputMode === 'visit' ? visitInputHTML() : dartInputHTML(currentPlayer)
        document.querySelectorAll('.mode-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === inputMode))
        bindInputArea(currentPlayer)
      })
    })

    bindInputArea(currentPlayer)

    document.getElementById('undo-btn').addEventListener('click', async () => {
      try {
        const result = await api.games.undo(gameId)
        game = result.game
        visitInput = ''; dartEntries = []; kbBuffer = ''
        renderPage()
      } catch (err) { alert(err.message) }
    })

    document.getElementById('abandon-btn').addEventListener('click', async () => {
      if (!confirm('Abandon this game?')) return
      await api.games.abandon(gameId)
      navigate('/')
    })

    document.onkeydown = (e) => {
      if (inputMode === 'visit') {
        if (e.key >= '0' && e.key <= '9')
          document.querySelector(`.numpad-btn[data-num="${e.key}"]`)?.click()
        if (e.key === 'Enter')     document.getElementById('visit-enter')?.click()
        if (e.key === 'Backspace') document.getElementById('visit-clear')?.click()
      } else {
        if (['Backspace','Enter','Escape'].includes(e.key) ||
            '0123456789tdmb'.includes(e.key.toLowerCase())) e.preventDefault()
        handleDartKeyboard(e.key, currentPlayer)
      }
    }
  }

  // ─── Bind only the input area ────────────────────────────────────────────────
  function bindInputArea(currentPlayer) {
    if (inputMode === 'visit') {
      document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (visitInput.length >= 3) return
          const next = visitInput + btn.dataset.num
          if (Number(next) > 180) return
          visitInput = next
          document.getElementById('visit-display').textContent = visitInput || '—'
        })
      })
      document.getElementById('visit-clear').addEventListener('click', () => {
        visitInput = ''
        document.getElementById('visit-display').textContent = '—'
      })
      document.getElementById('visit-enter').addEventListener('click', async () => {
        const score = Number(visitInput)
        if (!visitInput || !currentPlayer) return
        visitInput = ''
        await doSubmit(currentPlayer, score, [])
      })
    } else {
      document.querySelectorAll('.mult-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedMult = Number(btn.dataset.mult)
          document.querySelectorAll('.mult-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.mult === btn.dataset.mult))
        })
      })
      document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (dartEntries.length >= 3) return
          addDart(Number(btn.dataset.seg), selectedMult, currentPlayer)
        })
      })
      document.getElementById('dart-remove')?.addEventListener('click', () => {
        dartEntries.pop(); kbBuffer = ''
        document.getElementById('input-area').innerHTML = dartInputHTML(currentPlayer)
        bindInputArea(currentPlayer)
      })
      document.getElementById('dart-enter')?.addEventListener('click', () => {
        if (dartEntries.length === 0) return
        submitDarts(currentPlayer)
      })
    }
  }

  async function submitDarts(currentPlayer) {
    const score = dartEntries.reduce((s, d) => s + d.score, 0)
    const darts = dartEntries.map(({ segment, multiplier, score }) =>
      ({ segment, multiplier, score }))
    dartEntries = []
    await doSubmit(currentPlayer, score, darts)
  }

  async function doSubmit(currentPlayer, score, darts) {
    try {
      const result = await api.games.submit(gameId, {
        player_id: currentPlayer.id, score, darts
      })
      game = result.game

      if (result.isBust) {
        flashScore(currentPlayer.id, 'bust')
      } else if (result.isWin) {
        flashScore(currentPlayer.id, 'win')
        showWinAnimation(currentPlayer.name, result.gameComplete)
      } else {
        flashScore(currentPlayer.id, 'normal')
      }

      setTimeout(() => renderPage(), result.isWin ? 3000 : 300)
    } catch (err) {
      alert(err.message)
      renderPage()
    }
  }

  // ─── Game summary ────────────────────────────────────────────────────────────
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
      const newGame = await api.games.create({
        game_type:    game.game_type,
        player_ids:   game.players.sort((a,b) => a.turn_order - b.turn_order).map(p => p.id),
        legs_to_win:  game.legs_to_win,
        double_out:   game.double_out
      })
      navigate(`/game/${newGame.id}`)
    })
  }

  function flashScore(playerId, type) {
    const el = document.getElementById(`score-${playerId}`)
    if (!el) return
    el.classList.remove('anim-score-flash', 'anim-bust-shake', 'score-bust', 'score-win')
    void el.offsetWidth
    if      (type === 'bust') el.classList.add('anim-bust-shake', 'score-bust')
    else if (type === 'win')  el.classList.add('anim-win-pulse',  'score-win')
    else                      el.classList.add('anim-score-flash')
  }

  // ─── Win animation ───────────────────────────────────────────────────────────
  function showWinAnimation(playerName, isGameWin) {
    const COLORS = ['#00f5ff', '#ff00aa', '#aaff00', '#ffd700', '#ff2244', '#ffffff']
    const particles = Array.from({ length: 60 }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist  = 80 + Math.random() * 280
      const size  = [4, 4, 8, 8, 12][Math.floor(Math.random() * 5)]
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const delay = Math.floor(Math.random() * 400)
      return `<div class="win-px" style="
        background:${color}; width:${size}px; height:${size}px;
        left:calc(50% + ${(Math.random() - 0.5) * 120}px);
        top:calc(50% + ${(Math.random() - 0.5) * 80}px);
        --dx:${(Math.cos(angle) * dist).toFixed(0)}px;
        --dy:${(Math.sin(angle) * dist).toFixed(0)}px;
        animation-delay:${delay}ms;
      "></div>`
    }).join('')

    const overlay = document.createElement('div')
    overlay.id = 'win-anim'
    overlay.innerHTML = `
      ${particles}
      <div class="win-anim-content">
        <div class="win-anim-stars">★ ★ ★</div>
        <div class="win-anim-title">${isGameWin ? 'CHAMPION!' : 'CHECKOUT!'}</div>
        <div class="win-anim-name">${playerName}</div>
        <div class="win-anim-sub">${isGameWin ? 'WINS THE MATCH' : 'WINS THE LEG'}</div>
      </div>
    `
    document.body.appendChild(overlay)

    setTimeout(() => {
      const wave2 = Array.from({ length: 30 }, () => {
        const angle = Math.random() * Math.PI * 2
        const dist  = 60 + Math.random() * 200
        const size  = [4, 8][Math.floor(Math.random() * 2)]
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        const el    = document.createElement('div')
        el.className = 'win-px'
        el.style.cssText = `
          background:${color}; width:${size}px; height:${size}px;
          left:calc(50% + ${(Math.random() - 0.5) * 140}px);
          top:calc(50% + ${(Math.random() - 0.5) * 100}px);
          --dx:${(Math.cos(angle) * dist).toFixed(0)}px;
          --dy:${(Math.sin(angle) * dist).toFixed(0)}px;
        `
        return el
      })
      wave2.forEach(el => overlay.appendChild(el))
    }, 500)

    setTimeout(() => overlay.classList.add('win-anim-out'), 2400)
    setTimeout(() => overlay.remove(), 2900)
    overlay.addEventListener('click', () => {
      overlay.classList.add('win-anim-out')
      setTimeout(() => overlay.remove(), 400)
    })
  }

  window.addEventListener('hashchange', () => { document.onkeydown = null }, { once: true })
  renderPage()
}
