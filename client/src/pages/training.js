import { api } from '../api.js'
import { navigate } from '../router.js'

// ─── Dart helpers (mirrored from game.js) ────────────────────────────────────
function dartScore(segment, multiplier) {
  if (segment === 0)  return 0
  if (segment === 25) return multiplier === 2 ? 50 : 25
  return segment * multiplier
}

function dartLabel(segment, multiplier) {
  if (segment === 0)                      return 'MISS'
  if (segment === 25 && multiplier === 2) return 'DB'
  if (segment === 25)                     return 'BULL'
  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S'
  return `${prefix}${segment}`
}

function parseShortcode(buf) {
  if (!buf) return null
  const b = buf.toLowerCase()
  if (b === '0' || b === 'm')  return { segment: 0,  multiplier: 1 }
  if (b === 'b')               return { segment: 25, multiplier: 1 }
  if (b === 'db')              return { segment: 25, multiplier: 2 }
  if (/^\d{1,2}$/.test(b)) {
    const n = Number(b)
    if (n >= 1 && n <= 20) return { segment: n,  multiplier: 1 }
    if (n === 25)          return { segment: 25, multiplier: 1 }
  }
  if (/^t\d{1,2}$/.test(b)) {
    const n = Number(b.slice(1))
    if (n >= 1 && n <= 20) return { segment: n, multiplier: 3 }
  }
  if (/^d\d{1,2}$/.test(b)) {
    const n = Number(b.slice(1))
    if (n >= 1 && n <= 20) return { segment: n,  multiplier: 2 }
    if (n === 25)          return { segment: 25, multiplier: 2 }
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
  if (/^\d$/.test(b))   return true
  if (/^\d{2}$/.test(b))   { const n = Number(b); return n >= 10 && n <= 25 }
  if (/^t\d$/.test(b))     { const n = Number(b[1]); return n >= 1 && n <= 9 }
  if (/^t\d{2}$/.test(b))  { const n = Number(b.slice(1)); return n >= 10 && n <= 20 }
  if (/^d\d$/.test(b))     { const n = Number(b[1]); return n >= 1 && n <= 9 }
  if (/^d\d{2}$/.test(b))  { const n = Number(b.slice(1)); return (n >= 10 && n <= 20) || n === 25 }
  return false
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export async function trainingPage(appEl, params) {
  const playerId = Number(params.playerId)
  let player = null
  if (playerId > 0) {
    try { player = await api.players.get(playerId) } catch { /* anon */ }
  }

  const playerName   = player?.name   ?? 'GUEST'
  const playerAvatar = player?.avatar ?? '🎯'

  // ─── Session state ──────────────────────────────────────────────────────────
  const visits     = []   // [{ darts: [...], total: number }]
  let currentDarts = []
  let selectedMult = 1
  let kbBuffer     = ''

  // ─── Computed stats ─────────────────────────────────────────────────────────
  function totalScored()  { return visits.reduce((s, v) => s + v.total, 0) }
  function avg3Dart()     { return visits.length ? (totalScored() / visits.length).toFixed(1) : '0.0' }
  function highestVisit() { return visits.length ? Math.max(...visits.map(v => v.total)) : 0 }

  // ─── Live stats bar ─────────────────────────────────────────────────────────
  function refreshStats() {
    const el = document.getElementById('live-stats')
    if (!el) return
    el.innerHTML = `
      <div class="training-stat">
        <div class="training-stat-val">${visits.length}</div>
        <div class="training-stat-lbl">BESUCHE</div>
      </div>
      <div class="training-stat">
        <div class="training-stat-val text-cyan">${avg3Dart()}</div>
        <div class="training-stat-lbl">3-DART AVG</div>
      </div>
      <div class="training-stat">
        <div class="training-stat-val text-gold">${highestVisit()}</div>
        <div class="training-stat-lbl">HÖCHSTE</div>
      </div>
      <div class="training-stat">
        <div class="training-stat-val">${totalScored()}</div>
        <div class="training-stat-lbl">GESAMT</div>
      </div>
    `
  }

  // ─── Input area HTML ────────────────────────────────────────────────────────
  function kbPreviewHTML() {
    if (!kbBuffer) return `<span class="kb-hint">⌨ t20 · d16 · 18 · b · db · 0</span>`
    const parsed = parseShortcode(kbBuffer)
    const info = parsed
      ? ` → <span class="kb-dart">${dartLabel(parsed.segment, parsed.multiplier)} (${dartScore(parsed.segment, parsed.multiplier)})</span>`
      : ' <span class="kb-hint">?</span>'
    const enterHint = parsed && !isAutoComplete(kbBuffer) ? ' <span class="kb-hint">— ENTER</span>' : ''
    return `<span class="kb-buffer">⌨ ${kbBuffer.toUpperCase()}</span>${info}${enterHint}`
  }

  function inputAreaHTML() {
    const total    = currentDarts.reduce((s, d) => s + d.score, 0)
    const done     = currentDarts.length >= 3
    const segments = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]

    return `
      <div class="dart-slots mb-4">
        ${[0, 1, 2].map(i => {
          const d        = currentDarts[i]
          const isActive = i === currentDarts.length && !done
          return `
            <div class="dart-slot ${d ? 'filled' : ''} ${isActive ? 'active' : ''}">
              <div class="dart-slot-label">${d ? d.label : '—'}</div>
              <div class="dart-slot-score">${d ? d.score : ''}</div>
            </div>
          `
        }).join('')}
        <div class="dart-slot-total text-cyan">= ${total}</div>
      </div>

      <div class="kb-preview" id="kb-preview">${kbPreviewHTML()}</div>

      <div class="multiplier-row mb-3">
        ${[['1','SINGLE'],['2','DOUBLE'],['3','TRIPLE']].map(([v, label]) => `
          <button class="mult-btn ${selectedMult === Number(v) ? 'active' : ''}" data-mult="${v}">
            ×${v} ${label}
          </button>
        `).join('')}
      </div>

      <div class="segment-grid mb-4">
        ${segments.map(n => `
          <button class="seg-btn" data-seg="${n}" ${done ? 'disabled' : ''}>${n}</button>
        `).join('')}
        <button class="seg-btn seg-bull" data-seg="25" ${done ? 'disabled' : ''}>BULL</button>
        <button class="seg-btn seg-miss" data-seg="0"  ${done ? 'disabled' : ''}>MISS</button>
      </div>

      <div class="flex gap-2" style="justify-content:center">
        <button class="btn btn-ghost"   id="dart-remove" ${currentDarts.length === 0 ? 'disabled' : ''}>↩ REMOVE</button>
        <button class="btn btn-primary" id="dart-enter"  ${currentDarts.length === 0 ? 'disabled' : ''}>ENTER</button>
      </div>
    `
  }

  // ─── Main page render ───────────────────────────────────────────────────────
  function renderPage() {
    appEl.innerHTML = `
      <div class="anim-fade-in">
        <div class="flex-between mb-5">
          <h1>★ TRAINING ★</h1>
          <div class="flex gap-2">
            <button class="btn btn-danger" id="end-btn">■ AUSWERTUNG</button>
            <button class="btn btn-ghost" onclick="window.location.hash='/'">HOME</button>
          </div>
        </div>

        <div class="card text-center mb-4">
          <div class="player-name">${playerAvatar} ${playerName}</div>
        </div>

        <div class="training-stats-bar mb-5" id="live-stats"></div>

        <div id="input-area"></div>
      </div>
    `
    refreshStats()
    updateInputArea()
    bindPage()
  }

  function updateInputArea() {
    const el = document.getElementById('input-area')
    if (el) { el.innerHTML = inputAreaHTML(); bindInput() }
  }

  function updateKbPreview() {
    const el = document.getElementById('kb-preview')
    if (el) el.innerHTML = kbPreviewHTML()
  }

  // ─── Event binding ──────────────────────────────────────────────────────────
  function bindInput() {
    document.querySelectorAll('.mult-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMult = Number(btn.dataset.mult)
        document.querySelectorAll('.mult-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mult === btn.dataset.mult))
      })
    })
    document.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => addDart(Number(btn.dataset.seg), selectedMult))
    })
    document.getElementById('dart-remove')?.addEventListener('click', () => {
      currentDarts.pop(); kbBuffer = ''; updateInputArea()
    })
    document.getElementById('dart-enter')?.addEventListener('click', () => {
      if (currentDarts.length > 0) recordVisit()
    })
  }

  function bindPage() {
    document.getElementById('end-btn').addEventListener('click', () => {
      if (visits.length === 0) { alert('Noch keine Besuche aufgezeichnet.'); return }
      renderSummary()
    })
    document.onkeydown = (e) => {
      if (['Backspace','Enter','Escape'].includes(e.key) ||
          '0123456789tdmb'.includes(e.key.toLowerCase())) e.preventDefault()
      handleKeyboard(e.key)
    }
  }

  // ─── Dart registration ──────────────────────────────────────────────────────
  function addDart(segment, multiplier) {
    if (currentDarts.length >= 3) return
    const mult = segment === 0 ? 1 : (segment === 25 && multiplier === 3) ? 2 : multiplier
    currentDarts.push({
      segment, multiplier: mult,
      score: dartScore(segment, mult),
      label: dartLabel(segment, mult)
    })
    selectedMult = 1
    updateInputArea()
    if (currentDarts.length === 3) setTimeout(recordVisit, 700)
  }

  function recordVisit() {
    if (currentDarts.length === 0) return
    const darts = [...currentDarts]
    visits.push({ darts, total: darts.reduce((s, d) => s + d.score, 0) })
    currentDarts = []; selectedMult = 1; kbBuffer = ''
    updateInputArea()
    refreshStats()
  }

  function handleKeyboard(key) {
    if (currentDarts.length >= 3) return
    if (key === 'Escape')    { kbBuffer = ''; updateKbPreview(); return }
    if (key === 'Backspace') { kbBuffer = kbBuffer.slice(0, -1); updateKbPreview(); return }
    if (key === 'Enter') {
      const dart = parseShortcode(kbBuffer)
      if (dart) { kbBuffer = ''; addDart(dart.segment, dart.multiplier) }
      else if (currentDarts.length > 0) recordVisit()
      return
    }
    const ch = key.toLowerCase()
    if (!'0123456789tdmb'.includes(ch)) return
    const next = kbBuffer + ch
    if (!couldBeValid(next)) return
    kbBuffer = next
    if (isAutoComplete(kbBuffer)) {
      const dart = parseShortcode(kbBuffer)
      if (dart) { kbBuffer = ''; addDart(dart.segment, dart.multiplier); return }
    }
    updateKbPreview()
  }

  // ─── End-session summary ────────────────────────────────────────────────────
  function renderSummary() {
    document.onkeydown = null

    const allDarts = visits.flatMap(v => v.darts)
    const total    = totalScored()
    const avg      = avg3Dart()
    const high     = highestVisit()

    const count180 = visits.filter(v => v.total === 180).length
    const count140 = visits.filter(v => v.total >= 140 && v.total < 180).length
    const count100 = visits.filter(v => v.total >= 100 && v.total < 140).length
    const count60  = visits.filter(v => v.total >= 60  && v.total < 100).length
    const countLow = visits.filter(v => v.total <  60).length

    const triples = allDarts.filter(d => d.multiplier === 3).length
    const doubles = allDarts.filter(d => d.multiplier === 2 && d.segment !== 0).length
    const singles = allDarts.filter(d => d.multiplier === 1 && d.segment !== 0).length
    const misses  = allDarts.filter(d => d.segment === 0).length

    const segFreq = {}
    for (const d of allDarts) {
      if (d.segment === 0) continue
      segFreq[d.segment] = (segFreq[d.segment] ?? 0) + 1
    }
    const topSegs = Object.entries(segFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([seg, cnt]) => `
        <div class="flex-between mb-3" style="font-size:12px">
          <span class="text-cyan">${seg === '25' ? 'BULL' : seg}</span>
          <span>${cnt}×</span>
        </div>
      `).join('')

    const pct = (n) => visits.length ? Math.round(n / visits.length * 100) + '%' : '0%'

    appEl.innerHTML = `
      <div class="anim-fade-in">
        <h1 class="text-center mb-4" style="color:var(--gold)">★ AUSWERTUNG ★</h1>
        <div class="text-center mb-5" style="font-size:12px;color:var(--muted)">${playerAvatar} ${playerName}</div>

        <div class="grid-2 gap-4 mb-5">
          <div class="card text-center">
            <div class="score-value score-lg text-cyan">${avg}</div>
            <div class="text-muted mt-2" style="font-size:10px">3-DART AVERAGE</div>
          </div>
          <div class="card text-center">
            <div class="score-value score-lg text-gold">${high}</div>
            <div class="text-muted mt-2" style="font-size:10px">HÖCHSTER BESUCH</div>
          </div>
          <div class="card text-center">
            <div class="score-value score-md">${visits.length}</div>
            <div class="text-muted mt-2" style="font-size:10px">BESUCHE</div>
          </div>
          <div class="card text-center">
            <div class="score-value score-md">${total}</div>
            <div class="text-muted mt-2" style="font-size:10px">GESAMT PUNKTE</div>
          </div>
        </div>

        <div class="grid-2 gap-4 mb-5">
          <div class="card">
            <h2 class="mb-4">SCORE VERTEILUNG</h2>
            ${[
              ['180',     count180, '#00f5ff'],
              ['140–179', count140, '#aaff00'],
              ['100–139', count100, '#ffd700'],
              ['60–99',   count60,  '#ff8800'],
              ['0–59',    countLow, '#888888'],
            ].map(([label, cnt, color]) => `
              <div class="flex-between mb-3" style="font-size:12px">
                <span style="color:${color}">${label}</span>
                <span>${cnt} <span class="text-muted">(${pct(cnt)})</span></span>
              </div>
            `).join('')}
          </div>

          <div>
            <div class="card mb-4">
              <h2 class="mb-4">DART TYPEN</h2>
              ${[
                ['TRIPLE', triples, 'text-cyan'],
                ['DOUBLE', doubles, 'text-gold'],
                ['SINGLE', singles, ''],
                ['MISS',   misses,  'text-red'],
              ].map(([label, cnt, cls]) => `
                <div class="flex-between mb-2" style="font-size:12px">
                  <span class="${cls}">${label}</span>
                  <span>${cnt}</span>
                </div>
              `).join('')}
            </div>

            <div class="card">
              <h2 class="mb-4">TOP SEGMENTE</h2>
              ${topSegs || '<div class="text-muted" style="font-size:11px">—</div>'}
            </div>
          </div>
        </div>

        <div class="flex gap-4" style="justify-content:center">
          <button class="btn btn-primary" id="new-session-btn">NEUE SESSION</button>
          <button class="btn btn-ghost" onclick="window.location.hash='/'">HOME</button>
        </div>
      </div>
    `

    document.getElementById('new-session-btn').addEventListener('click', () => {
      visits.length = 0
      currentDarts = []; selectedMult = 1; kbBuffer = ''
      renderPage()
    })
  }

  window.addEventListener('hashchange', () => { document.onkeydown = null }, { once: true })
  renderPage()
}
