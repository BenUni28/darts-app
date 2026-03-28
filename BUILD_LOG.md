# Darts-App — Build Log

Every step taken to build this project, in order, with explanations.
This file is updated as the project progresses.

---

## PHASE 0 — Planning & Setup

### Step 1 — `git init`
**What it does:** Initializes an empty Git repository in the current folder.
Git is a version control system. It tracks every change you make to files over time.
You can always go back to any previous state, see what changed and when, and collaborate
with others. The `.git/` folder it creates is where all that history lives — never
delete it manually.

### Step 2 — `git checkout -b main`
**What it does:** Creates and switches to a branch called `main`.
A branch is like a parallel version of your project. `main` is the convention for
the primary stable branch. Later you'll create feature branches (e.g. `feature/cricket`)
to work on things without breaking `main`, then merge them in when ready.

### Step 3 — `.gitignore`
**What it does:** Tells Git which files and folders to never track.
Some things should never go into version control:
- `node_modules/` — thousands of dependency files, reproducible with `npm install`
- `data/*.db` — your live SQLite database (contains real data, can be huge)
- `.env` — environment secrets (API keys, passwords — NEVER commit these)
Git will completely ignore everything listed here.

---

## PHASE 1 — Project Scaffolding

### Step 4 — Folder structure
**What it does:** Creates the skeleton of the project.
Good folder structure separates concerns: server code from client code, database
queries from business logic, routes from services. This makes the project navigable
as it grows and makes it obvious where new code should go.

```
darts-app/
├── server/           ← Node.js + Express backend
│   ├── db/           ← everything database-related
│   │   ├── queries/  ← raw SQL functions, one file per domain
│   │   └── migrations/ ← versioned schema changes
│   ├── routes/       ← HTTP route handlers (URL → function)
│   └── services/     ← pure business logic (no DB calls here)
├── client/           ← Vite frontend (HTML, JS, CSS)
│   └── src/
│       ├── pages/    ← one JS file per screen
│       └── components/ ← reusable UI pieces
└── data/             ← SQLite .db file lives here (git-ignored)
```

### Step 5 — `npm init` / `package.json`
**What it does:** Creates the project's manifest file.
`package.json` records: the project name, version, scripts (like `npm run dev`),
and all dependencies. When someone clones your repo, they run `npm install` and
this file tells npm exactly what to download.

### Step 6 — Install dependencies
**What it does:** Downloads and installs all required packages.

**Backend packages:**
- `express` — minimal HTTP server framework; handles routing, middleware, request/response
- `better-sqlite3` — synchronous SQLite driver; queries return results directly (no async complexity)
- `cors` — allows the frontend (on a different port) to talk to the backend
- `helmet` — sets secure HTTP headers automatically

**Frontend / build packages:**
- `vite` — blazing-fast dev server and build tool; handles hot-reload, bundling
- `concurrently` — runs the backend and frontend dev server at the same time with one command

**Dev packages:**
- `nodemon` — restarts the server automatically when you save a file

---

## PHASE 2 — Database Setup

### Step 7 — `server/db/schema.sql`
**What it does:** Defines every table, column, and index in the database.
This is the single source of truth for your data structure. Writing it as a `.sql`
file (not JavaScript) means you can run it directly with the `sqlite3` CLI tool
to inspect it, and it's human-readable as documentation.

**Tables created:**
| Table | Purpose |
|---|---|
| `players` | Every registered player (name, created date, active flag) |
| `games` | One game session (type: 501/301/Cricket, status, winner) |
| `game_players` | Which players are in which game and in what turn order |
| `legs` | One leg within a game (games can be best-of-N) |
| `turns` | One player's 3-dart visit: score, bust flag, remaining |
| `darts` | Individual dart throws within a turn (for deep stats) |
| `cricket_state` | Marks per segment per player (Cricket only) |
| `player_stats` | Pre-calculated stats cache for fast leaderboard reads |

### Step 8 — `server/db/connection.js`
**What it does:** Opens the SQLite database file and configures it for use.
This file runs once at server start. It:
1. Opens (or creates) `data/darts.db`
2. Sets `PRAGMA foreign_keys = ON` — SQLite has foreign keys OFF by default; this enforces referential integrity (e.g. you can't add a turn for a player that doesn't exist)
3. Sets `PRAGMA journal_mode = WAL` — Write-Ahead Logging; better performance for concurrent reads while writing
4. Runs `schema.sql` to create all tables if they don't exist yet

### Step 9 — First migration: `001_initial.sql`
**What it does:** Records the initial schema as a versioned migration.
A migration is a numbered, ordered SQL file that describes a change to the schema.
Why this matters: once the app is running with real data, you can't just re-run
`schema.sql` (it would fail — tables already exist). Migrations let you evolve the
schema safely. The convention is: never edit a migration after it's been applied;
always add a new numbered file for changes.

---

## PHASE 3 — Backend API

### Step 10 — `server/services/scoring.js`
**What it does:** Implements the pure scoring logic for X01 games (501/301).
This is the heart of the game. Given a player's current remaining score and the
score they just threw, it calculates:
- New remaining (remaining - score thrown)
- Whether it's a **bust** (went below 0, or hit exactly 1 with double-out rule, or hit 0 without a double)
- Whether it's a **win** (remaining hits exactly 0 on a valid double)

This function has NO database calls — it's pure input/output. That makes it easy
to test and reason about independently.

### Step 11 — `server/services/checkout.js`
**What it does:** Returns the suggested checkout combination for any score 2–170.
A pre-built lookup table of the optimal 1, 2, and 3-dart checkouts.
Displayed in-game when a player is within checkout range (≤170).

### Step 12 — `server/db/queries/` files
**What it does:** Wraps all raw SQL in named JavaScript functions.
Example: instead of writing the same JOIN query everywhere, you write it once:
```js
// queries/players.js
function getPlayerWithStats(id) {
  return db.prepare(`
    SELECT p.*, ps.* FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.id = ?
  `).get(id);
}
```
Keeping SQL in these files means routes stay clean, and all your SQL is in one place
to review and optimize.

### Step 13 — `server/routes/` files
**What it does:** Maps HTTP requests to database queries and services.
A route handler receives a request (with URL params, body data), calls the right
service/query functions, and sends back a JSON response.
Example flow for submitting a turn:
```
POST /api/games/3/turns
  → validate body
  → scoring.js: calculate remaining + bust flag
  → db transaction: INSERT turn + darts + maybe UPDATE leg/game
  → return updated game state
```

---

## PHASE 4 — Frontend

### Step 14 — `vite.config.js`
**What it does:** Configures the Vite frontend build tool.
Sets up the dev server to proxy `/api` requests to the Express backend (so the
frontend can call `/api/players` and Vite forwards it to `localhost:3001`).
This means you only deal with one URL in the frontend code.

### Step 15 — Retro Arcade CSS design system
**What it does:** Establishes the visual language of the app.
A design system defines the colors, fonts, spacing, and component styles once,
then everything else uses those variables. Using CSS custom properties (`--color-neon-cyan`)
means you can change the whole look by editing one file.

**Retro Arcade palette:**
- Background: `#0a0a0f` (deep black)
- Accent 1: `#00f5ff` (neon cyan)
- Accent 2: `#ff00aa` (hot magenta)
- Scores: `#aaff00` (neon yellow-green)
- Danger/Bust: `#ff2244` (neon red)
- Fonts: Press Start 2P (pixel headers), Orbitron (body)
- Effects: CRT scanlines, neon glow, score flash animations

### Step 16 — Page: Home / Setup
**What it does:** The game setup screen.
Features (based on top darts apps research):
- Select game type (501, 301, Cricket)
- Select number of legs (1, best of 3, best of 5)
- Double-out toggle
- Add 2–8 players (from saved players or quick-add)
- Bull-off option to decide starting player
- Quick-start with last used settings

### Step 17 — Page: Active Game
**What it does:** The main scoreboard shown during play.
This is the most important screen. Features:
- Large score display per player (remaining score is the hero number)
- Active player highlighted with animated indicator
- 3-dart input numpad (smart: disables impossible scores based on remaining)
- Checkout suggestions shown when ≤170 remaining
- Per-turn average update after every visit
- Undo last turn button (critical — miskeys happen constantly)
- Bust animation + "BUST!" text when score busts
- Win animation with arcade fanfare

### Step 18 — Page: Game Summary
**What it does:** End-of-game results screen.
Shown when a leg/game is won. Displays:
- Winner highlighted
- Final averages per player
- High score of the match (e.g. "MAX: 180!")
- Checkout scored
- Option to play again (same settings) or go to home

### Step 19 — Page: Players
**What it does:** Player management screen.
- List all players with their stats summary
- Add new player (just a name)
- Click a player to see their full stats profile

### Step 20 — Page: Stats / Leaderboard
**What it does:** Hall of fame screen.
- 3-dart average leaderboard
- Win rate leaderboard
- 180s count
- Best checkout
- Head-to-head record between any two players
- Game history with score details

---

## PHASE 5 — Polish & QoL

### Step 21 — Undo system
**What it does:** Lets players correct miskeyed scores instantly.
Deletes the last inserted turn (and its darts) and recalculates state.
Implemented as a database transaction — either fully reverted or not at all.

### Step 22 — Sound effects (optional)
**What it does:** Arcade audio feedback.
- Score entered: retro blip
- Bust: descending notes
- Win: 8-bit fanfare
- 180: special chime

### Step 23 — PWA setup
**What it does:** Makes the web app installable on mobile/desktop like a native app.
Adds a `manifest.json` and service worker so the app can be added to the home screen
and used offline (viewing history, at minimum).

### Step 24 — First full commit
**What it does:** Saves a complete snapshot of the project to git history.
After the scaffold is working end-to-end (start a game, enter scores, win),
we commit everything. Convention: commit early, commit often. Each commit should
represent one logical unit of work.

---

## Database Concepts — Learning Milestones

| Milestone | When | What You'll Learn |
|---|---|---|
| Run `EXPLAIN QUERY PLAN` on a players query | Phase 2 | How SQLite decides to use (or not use) an index |
| Write a JOIN across 3 tables | Phase 3 | How relational data is assembled at query time |
| Write a transaction for turn submission | Phase 3 | Atomicity — all-or-nothing database operations |
| Write a CTE for player averages | Phase 4 | Readable complex queries with `WITH` clauses |
| Write a window function for leaderboard | Phase 4 | `RANK()`, `ROW_NUMBER()`, aggregate over partitions |
| Write migration `002_...sql` | Phase 5 | Safe schema evolution on a live database |
| Denormalize stats into `player_stats` | Phase 4 | When breaking normal form is the right call |

---

*This file is maintained by Claude Code and updated as each step is completed.*
