import {Cursor} from 'rethinkdb'
import {v4 as uuid} from 'uuid'

// ------------------------------------------------------------------- # Types #

interface Session {
  cursor: Cursor | null
  device_id: string | null
  websocket_enabled: boolean
}

interface Sessions {
  [id: string]: Session
}

// ----------------------------------------------------------------- # Methods #

const sessions: Sessions = {}

function set_cursor(id: string, cursor: Cursor) {
  if (id in sessions) {
    sessions[id].cursor = cursor
  }
}

function create() {
  const session_id = uuid()
  sessions[session_id] = {cursor: null, device_id: null, websocket_enabled: false}

  return session_id
}

function update_device(session_id: string, device_id: string) {
  sessions[session_id].device_id = device_id
}

function enable_websocket(session_id: string) {
  sessions[session_id].websocket_enabled = true
}

function websocket_enabled(session_id: string) {
  return sessions[session_id] && sessions[session_id].websocket_enabled
}

function _delete(id: string) {
  if (!(id in sessions)) {
    return null
  }

  const session = sessions[id]
  const device_id = sessions[id].device_id

  if (session.cursor) {
    session.cursor.close()
  }

  delete sessions[id]
  return device_id
}

export default {
  create,
  delete: _delete,
  enable_websocket,
  set_cursor,
  update_device,
  websocket_enabled,
}
