const rdb  = require("rethinkdb")
const uuid = require("uuid").v4

// ------------------------------------------------------------ // Public API //

async function list(conn, user_id) {
  const cursor = await rdb.table("task").filter({user_id}).run(conn)
  return await cursor.toArray()
}

async function add(conn, task) {
  try {
    const status = await rdb.table("task").insert(task).run(conn)
    if (! status.inserted) throw new Error()
  } catch (e) {
    throw new Error("task-fail-add")
  }
}

async function update(conn, task) {
  if (! await rdb.table("task").get(task.id).run(conn)) {
    throw new Error("task-not-found")
  }

  try {
    await rdb.table("task").get(task.id).update(task).run(conn)
  } catch (e) {
    throw new Error("task-fail-update")
  }
}

async function delete_(conn, task_id) {
  if (! await rdb.table("task").get(task_id).run(conn)) {
    throw new Error("task-not-found")
  }

  try {
    const status = await rdb.table("task").get(task_id).delete().run(conn)
    if (! status.deleted) throw new Error()
  } catch (e) {
    throw new Error("task-fail-delete")
  }
}

async function watch({conn, client, user_id, device_id, on_change}) {
  await rdb
    .table("task")
    .filter({user_id})
    .changes()
    .run(conn, (err, cursor) => {
      if (err) throw new Error("task-fail-watch")

      cursor.each((err, changes) => {
        if (err) throw new Error("task-fail-watch")

        if (! changes.old_val) {
          on_change({type: "add", task: changes.new_val})
        } else if (! changes.new_val) {
          on_change({type: "delete", task: changes.old_val})
        } else {
          on_change({type: "update", task: changes.new_val})
        }
      })
    })
}

module.exports = {
  list,
  add,
  update,
  delete_,
  watch,
}
