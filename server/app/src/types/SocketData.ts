import net from 'net'
import rdb from 'rethinkdb'

import Session from './Session'

interface SocketData {
  database: rdb.Connection
  socket: net.Socket
  session: Session
  payload?: string
}

export default SocketData
