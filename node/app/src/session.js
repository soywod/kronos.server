const uuid = require("uuid").v4

const sessions = {}

// -------------------------------------------------------------- # Public API #

function create() {
  const session_id = uuid()
  sessions[session_id] = null
  return session_id
}

function update(session_id, device_id) {
  sessions[session_id] = device_id
}

function delete_(session_id) {
  const device_id = sessions[session_id] || null
  delete sessions[session_id]
  return device_id
}

module.exports = {
  create,
  update,
  delete_,
}
