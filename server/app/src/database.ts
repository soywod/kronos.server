import rdb from 'rethinkdb'

const config: rdb.ConnectionOptions = {
  host: process.env.DB_HOST || 'database',
  db: process.env.DB_NAME || 'kronos',
}

function connect() {
  return rdb.connect(config)
}

export default {connect}
