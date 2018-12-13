import $database from './database'
import $server from './server'

$database
  .connect()
  .then($server.handleStart)
  .catch($server.handleError)
