// Global error handler — catches anything thrown in route handlers.
// Must be registered LAST in Express (after all routes).

export function errorHandler(err, req, res, next) {
  console.error('[error]', err.message)

  // SQLite constraint violations (e.g. duplicate player name)
  if (err.message?.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Already exists', detail: err.message })
  }

  if (err.message?.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({ error: 'Invalid reference', detail: err.message })
  }

  // Application-level errors thrown with a status code
  if (err.status) {
    return res.status(err.status).json({ error: err.message })
  }

  res.status(500).json({ error: 'Internal server error' })
}

// Shortcut to create an HTTP error
export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}
