const rdb  = require("rethinkdb")
const uuid = require("uuid").v4

// ------------------------------------------------------------ // Public API //

async function add(conn, user_id) {
  const id     = uuid.v4()
  const data   = {id, user_id, connected: true}
  const status = await rdb.table("device").insert(data).run(conn)

  if (! status.inserted) {
    throw new Error("device-create")
  }

  return id
}

async function read(conn, id) {
  const device = await rdb.table("device").get(id).run(conn)
  if (! device) throw new Error("device-not-found")

  return device
}

async function connect(conn, id) {
  try {
    await toggle(conn, id, true)
  } catch (e) {
    throw new Error("device-connect")
  }
}

async function disconnect(conn, id) {
  try {
    await toggle(conn, id, false)
  } catch (e) {
    throw new Error("device-disconnect")
  }
}

module.exports = {
  add,
  read,
  connect,
  disconnect,
}

// ----------------------------------------------------------- // Private API //

function toggle(conn, id, connected) {
  rdb.table("device")
    .get(id)
    .update({connected})
    .run(conn)
}
