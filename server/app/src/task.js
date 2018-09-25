const rdb  = require("rethinkdb")
const uuid = require("uuid").v4

// -------------------------------------------------------------- # Public API #

async function read_all(conn, user_id) {
  const cursor = await rdb.table("task").filter({user_id}).run(conn)
  return await cursor.toArray()
}

async function write_all(conn, user_id, tasks) {
  await rdb.table("task").filter({user_id}).delete().run(conn)
  await rdb.table("task").insert(with_user_id(tasks, user_id)).run(conn)
}

async function create(conn, task) {
  try {
    const status = await rdb
      .table("task")
      .insert(with_index(task))
      .run(conn)

    if (! status.inserted) throw new Error()
  } catch (e) {
    throw new Error("task create failed")
  }
}

async function update(conn, task) {
  const query = rdb
    .table("task")
    .get(with_index(task).index)

  if (! await query.run(conn)) {
    throw new Error("task not found")
  }

  try {
    await query.update(task).run(conn)
  } catch (e) {
    throw new Error("task update failed")
  }
}

async function delete_(conn, task_id, user_id) {
  const query = rdb
    .table("task")
    .get(with_index({id: task_id, user_id}).index)

  if (! await query.run(conn)) {
    throw new Error("task not found")
  }

  try {
    const status = await query.delete().run(conn)
    if (! status.deleted) throw new Error()
  } catch (e) {
    throw new Error("task delete failed")
  }
}

async function watch({database, user, device, on_change}) {
  const {id: user_id, version} = user
  const {id: device_id} = device

  await rdb
    .table("task")
    .filter({user_id})
    .changes()
    .run(database, (err, cursor) => {
      if (err) throw new Error("task watch failed")

      cursor.each((err, changes) => {
        if (err) throw new Error("task watch failed")

        if (! changes.old_val) {
          const payload = {task: changes.new_val, device_id, version}
          on_change({type: "create", ...payload})
        }
        
        else if (! changes.new_val) {
          const payload = {task_id: changes.old_val.id, device_id, version}
          on_change({type: "delete", ...payload})
        }
        
        else {
          const payload = {task: changes.new_val, device_id, version}
          on_change({type: "update", ...payload})
        }
      })
    })
}

module.exports = {
  read_all,
  write_all,
  create,
  update,
  delete_,
  watch,
}

// ------------------------------------------------------------- # Private API #

function with_index(task) {
  return {
    ...task,
    index: `${task.id}-${task.user_id}`,
  }
}

function with_user_id(tasks, user_id) {
  return tasks.map(task => ({
    ...task,
    user_id,
    index: `${task.id}-${user_id}`,
  }))
}
