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

export function initRouter(appEl) {
  async function render() {
    const hash = window.location.hash || '#/'
    const match = matchRoute(hash)

    // Highlight active nav link
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.route === (hash.replace('#', '') || '/'))
    })

    if (!match) {
      appEl.innerHTML = `<div class="loading">404 — page not found</div>`
      return
    }

    appEl.innerHTML = `<div class="loading">LOADING</div>`
    try {
      await match.handler(appEl, match.params)
    } catch (err) {
      console.error(err)
      appEl.innerHTML = `<div class="loading text-red">ERROR: ${err.message}</div>`
    }
  }

  window.addEventListener('hashchange', render)
  render()
}
