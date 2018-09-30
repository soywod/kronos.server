import {v4 as uuid} from 'uuid'

// ------------------------------------------------------------- # Private API #

interface Session {
  device_id: string | null
  websocket_enabled: boolean
}

interface Sessions {
  [session_id: string]: Session
}

const sessions = {} as Sessions

// -------------------------------------------------------------- # Public API #

export function create() {
  const session_id = uuid()
  sessions[session_id] = {device_id: null, websocket_enabled: false}
  return session_id
}

export function update_device(session_id: string, device_id: string) {
  sessions[session_id].device_id = device_id
}

export function enable_websocket(session_id: string) {
  sessions[session_id].websocket_enabled = true
}

export function websocket_enabled(session_id: string) {
  return sessions[session_id] && sessions[session_id].websocket_enabled
}

export function delete_(session_id: string) {
  const session = sessions[session_id] || {device_id: null}
  delete sessions[session_id]
  return session.device_id
}
