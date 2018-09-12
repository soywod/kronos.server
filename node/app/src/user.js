const rdb  = require("rethinkdb")
const uuid = require("uuid").v4

// ------------------------------------------------------------ // Public API //

async function add(conn) {
  const id = uuid()
  const status = await rdb.table("user").insert({id}).run(conn)

  if (! status.inserted) {
    throw new Error("user-add")
  }

  return id
}

async function read(conn, id) {
  const user = await rdb.table("user").get(id).run(conn)
  if (! user) throw new Error("user-not-found")

  return user
}

module.exports = {
  add,
  read,
}
