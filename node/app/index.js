const rdb  = require("rethinkdb")
const uuid = require("uuid")
const {createServer: create_server} = require("net")

const sessions = {}
const port = 5000 || process.env.PORT
const rdb_config = {
  host: "rethinkdb",
  db  : "kronos"
}

rdb
  .connect(rdb_config)
  .then(start_server)
  .catch(err => on_server_error)

// -------------------------------------------------------------- // Function //

function start_server(conn) {
  const server = create_server(on_server_create(conn))

  server.on("error", on_server_error)
  server.listen(port, on_server_listen)
}

function on_server_create(conn) {
  return (client) => {
    const session_id = uuid.v4()
    sessions[session_id] = null
    console.log(`New session "${session_id}"`)

    const params = {conn, session_id, client}
    client.on("end", on_client_end(params))
    client.on("data", on_client_data(params))
  }
}

function on_client_end({conn, session_id}) {
  return async () => {
    const device_id = sessions[session_id]
    delete sessions[session_id]
    console.log(`End session "${session_id}"`)

    if (device_id) {
      console.log(`Disconnect device "${session_id}"`)
      await disconnect_device({conn, device_id})
    }
  }
}

function parse_raw_data(raw_data) {
  try {
    return JSON.parse(raw_data)
  } catch(err) {
    throw new Error("invalid-data")
  }
}

function on_client_data(params) {
  return async (raw_data) => {
    const {client, session_id} = params
    const params_ = {...params, raw_data}

    try {
      await on_client_data_(params_)
    }
    catch ({message}) {
      console.warn(session_id, message)
      error(client, message)
    }
  }
}

async function on_client_data_({conn, client, session_id, raw_data}) {
  const json_data = parse_raw_data(raw_data)

  let {type, user_id = "", device_id = ""} = json_data
  if (! type) throw new Error("missing-type")

  if (type === "identification") {
    if (! user_id) user_id = await create_user(conn)
    const user = await rdb.table("user").get(user_id).run(conn)
    if (! user) throw new Error("invalid-user")

    if (! device_id) device_id = await create_device({conn, user_id})
    const device = await rdb.table("device").get(device_id).run(conn)
    if (! device) throw new Error("invalid-device")

    sessions[session_id] = device_id

    return success(client, {user_id, device_id})
  }

  const user   = await rdb.table("user").get(user_id).run(conn)
  const device = await rdb.table("device").get(device_id).run(conn)

  if (! user) throw new Error("invalid-user")
  if (! device) throw new Error("invalid-device")
  if (! device.connected) throw new Error("device-disconnected")

  if (type === "task-list") {
    const cursor = await rdb.table("task").filter({user_id}).run(conn)
    const tasks = await cursor.toArray()

    return success(client, {tasks})
  }

  throw new Error("invalid-type")
}

function success(client, data) {
  return client_send(client, {success: true, ...data})
}

function error(client, error) {
  return client_send(client, {success: false, error})
}

function client_send(client, data) {
  return client.write(JSON.stringify(data))
}

async function connect_device({conn, device_id}) {
  try {
    await toggle_device({conn, device_id, connected: true})
  } catch(err) {
    throw new Error("error-connect-device")
  }
}

async function disconnect_device({conn, device_id}) {
  try {
    await toggle_device({conn, device_id, connected: false})
  } catch(err) {
    throw new Error("error-disconnect-device")
  }
}

function toggle_device({conn, device_id, connected}) {
  return rdb.table("device")
    .get(device_id)
    .update({connected})
    .run(conn)
}

async function create_user(conn) {
  const id     = uuid.v4()
  const status = await rdb.table("user").insert({id}).run(conn)

  if (! status.inserted) {
    throw new Error("error-create-user")
  }

  return id
}

async function create_device({conn, user_id}) {
  const id     = uuid.v4()
  const data   = {id, user_id, connected: true}
  const status = await rdb.table("device").insert(data).run(conn)

  if (! status.inserted) {
    throw new Error("error-create-device")
  }

  return id
}

function on_server_error(err) {
  throw err
}

function on_server_listen() {
  console.log(`Kronos socket listening on port ${port}...`)
}
