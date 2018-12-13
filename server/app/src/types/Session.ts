import rdb from 'rethinkdb'

interface Session {
  id: string
  device_id: string | null
  cursor: rdb.Cursor | null
  mode: 'tcp' | 'ws'
}

interface Sessions {
  [id: string]: Session
}

export default Session
export {Sessions}
