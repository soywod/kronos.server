import * as r from 'rethinkdb'

// ------------------------------------------------------------- # Private API #

const config: r.ConnectionOptions = {
  db  : process.env.DB_NAME || 'kronos',
  host: process.env.DB_HOST || 'database',
}

// -------------------------------------------------------------- # Public API #

export function connect(): Promise<r.Connection> {
  return r.connect(config)
}
