import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// In production (Railway) DATABASE_PATH points to the persistent volume.
// In dev it falls back to the local data/ folder.
const DB_PATH = process.env.DATABASE_PATH ?? join(__dirname, '../../data/darts.db')
const MIGRATIONS_DIR = join(__dirname, 'migrations')

// Open (or create) the SQLite database file.
// The { verbose } option logs every SQL statement to the console in dev —
// remove it in production if you don't want the noise.
const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
})

// PRAGMA foreign_keys = ON
// SQLite ships with foreign key enforcement OFF by default.
// This turns it on so ON DELETE CASCADE / RESTRICT rules actually work.
db.pragma('foreign_keys = ON')

// PRAGMA journal_mode = WAL
// WAL (Write-Ahead Logging) allows readers and a writer to coexist.
// Default is DELETE mode which locks the whole file on every write.
db.pragma('journal_mode = WAL')

// Run all pending migrations in order.
// Each .sql file in /migrations is run exactly once, tracked in the
// migrations table so we never apply the same file twice.
function runMigrations() {
  // Create migrations tracker if it doesn't exist yet (bootstrapping)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db.prepare('SELECT filename FROM migrations').all().map(r => r.filename)
  )

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort() // ensures 001, 002, 003... order

  for (const file of files) {
    if (applied.has(file)) continue

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

    // Run each migration inside a transaction — if any statement fails,
    // the whole migration rolls back and the file is NOT marked as applied.
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file)
    })()

    console.log(`[db] applied migration: ${file}`)
  }
}

runMigrations()

export default db
