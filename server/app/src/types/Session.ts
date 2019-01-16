import rdb from 'rethinkdb'

import {Device} from './Device'

interface Session {
  id: string
  device: Device | null
  cursor: rdb.Cursor | null
  mode: 'tcp' | 'ws'
}

interface Sessions {
  [id: string]: Session
}

export {Session, Sessions}
