import { initRouter, addRoute } from './router.js'
import { homePage }     from './pages/home.js'
import { gamePage }     from './pages/game.js'
import { playersPage }  from './pages/players.js'
import { statsPage }    from './pages/stats.js'
import { trainingPage } from './pages/training.js'

// Register all routes
addRoute('/',          homePage)
addRoute('/players',   playersPage)
addRoute('/stats',     statsPage)
addRoute(/^\/game\/(?<id>\d+)$/,          gamePage)
addRoute(/^\/training\/(?<playerId>\d+)$/, trainingPage)

// Boot the router
const appEl = document.getElementById('app')
initRouter(appEl)
