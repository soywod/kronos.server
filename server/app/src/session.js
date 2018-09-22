const uuid = require("uuid").v4

const sessions = {}

// -------------------------------------------------------------- # Public API #

function create() {
  const session_id = uuid()
  sessions[session_id] = {device_id: null, ws: false}
  return session_id
}

function set_device(session_id, device_id) {
  sessions[session_id].device_id = device_id
}

function enable_ws(session_id) {
  sessions[session_id].ws = true
}

function ws_enabled(session_id) {
  return sessions[session_id] && sessions[session_id].ws
}

function delete_(session_id) {
  const session = sessions[session_id] || {}
  delete sessions[session_id]
  return session.device_id
}

module.exports = {
  create,
  set_device,
  enable_ws,
  ws_enabled,
  delete_,
}
