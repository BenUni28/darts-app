// Hash-based router.
// Routes are defined as { path, render } where render(params) returns an HTML string
// and optionally calls mount(el) for event binding after insertion into the DOM.

const routes = []

export function addRoute(path, handler) {
  routes.push({ path, handler })
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/'
  for (const route of routes) {
    if (route.path instanceof RegExp) {
      const m = path.match(route.path)
      if (m) return { handler: route.handler, params: m.groups ?? {} }
    }
    if (route.path === path) {
      return { handler: route.handler, params: {} }
    }
  }
  return null
}

export function navigate(path) {
  window.location.hash = path
}

// Move the persistent Spotify bar to match the on-page placeholder (home)
// or shrink it to a fixed corner widget (all other pages).
function positionSpotifyBar(isHome) {
  const bar = document.getElementById('spotify-bar')
  if (!bar) return

  if (isHome) {
    // Snap to the placeholder's exact viewport position
    const placeholder = document.getElementById('spotify-placeholder')
    if (!placeholder) return
    const r = placeholder.getBoundingClientRect()
    bar.style.top    = r.top  + 'px'
    bar.style.left   = r.left + 'px'
    bar.style.width  = r.width + 'px'
    bar.style.height = r.height + 'px'
    bar.style.bottom = 'auto'
    bar.style.right  = 'auto'
    bar.classList.remove('spotify-floating')
  } else {
    bar.style.top    = 'auto'
    bar.style.left   = 'auto'
    bar.style.width  = '300px'
    bar.style.height = '114px'
    bar.style.bottom = '0'
    bar.style.right  = '0'
    bar.classList.add('spotify-floating')
  }
}

export function initRouter(appEl) {
  async function render() {
    const hash = window.location.hash || '#/'
    const match = matchRoute(hash)
    const isHome = (hash === '#/' || hash === '#' || hash === '')

    // Highlight active nav link
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.route === (hash.replace('#', '') || '/'))
    })

    if (!match) {
      appEl.innerHTML = `<div class="loading">404 — page not found</div>`
      positionSpotifyBar(false)
      return
    }

    appEl.innerHTML = `<div class="loading">LOADING</div>`
    try {
      await match.handler(appEl, match.params)
      // After the page has rendered, position the Spotify bar
      // (small delay so the placeholder is in the DOM and has its final size)
      setTimeout(() => positionSpotifyBar(isHome), 60)
    } catch (err) {
      console.error(err)
      appEl.innerHTML = `<div class="loading text-red">ERROR: ${err.message}</div>`
    }
  }

  window.addEventListener('hashchange', render)
  render()
}
