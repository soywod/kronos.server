const rdb  = require("rethinkdb")
const uuid = require("uuid").v4

// -------------------------------------------------------------- # Public API #

async function create(conn) {
  const id = uuid()
  const status = await rdb
    .table("user")
    .insert({id, version: 0})
    .run(conn)

  if (! status.inserted) {
    throw new Error("user create failed")
  }

  return id
}

async function read(conn, id) {
  const user = await rdb.table("user").get(id).run(conn)
  if (! user) throw new Error("user not found")

  return user
}

async function set_version({conn, user_id, version}) {
  await rdb
    .table("user")
    .get(user_id)
    .update({version})
    .run(conn)
}

async function get_version(conn, id) {
  const user = await rdb
    .table("user")
    .get(id)
    .run(conn)

  if (! user ) throw new Error("user not found")
  return user.version
}

module.exports = {
  create,
  read,
  set_version,
  get_version,
}
