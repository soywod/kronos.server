import rdb from 'rethinkdb'

let instance: rdb.Connection | null = null
const conf: rdb.ConnectionOptions = {
  host: process.env.DB_HOST || 'database',
  db: process.env.DB_NAME || 'kronos',
}

// ----------------------------------------------------------------- # Connect #

export async function connect() {
  instance = await rdb.connect(conf)
  return curr
}

// -------------------------------------------------------- # Current instance #

export function curr() {
  if (!instance) throw new Error('database not ready')
  return instance
}
