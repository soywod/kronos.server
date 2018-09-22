import * as net from 'net'
import * as r from 'rethinkdb'
import * as uuid from 'uuid'

const tcp = require('./tcp')
const ws  = require('./ws')

const $task    = require('./task')
const $user    = require('./user')
const $device  = require('./device')

const session = require('./session')

// ------------------------------------------------------------- # Private API #

const port = +(process.env.PORT || 5000)

interface SocketData {
  database: r.Connection
  socket: net.Socket
  session_id: string
  payload?: string
}

function on_create_server(database: r.Connection) {
  return (socket: net.Socket) => {
    const session_id = session.create()
    console.log(`New session '${session_id}'`)

    const data: SocketData = {database, socket, session_id}
    socket.on('data', on_socket_data(data))
    socket.on('end',  on_socket_end(data))
  }
}

function on_socket_end(data: SocketData) {
  const {database, session_id} = data

  return async () => {
    const device_id = session.delete_(session_id)

    if (device_id) {
      console.log(`End session '${session_id}'`)
      await $device.disconnect(database, device_id)
      console.log(`Disconnect device '${session_id}'`)
    }
  }
}

function on_socket_data(data: SocketData) {
  const {socket, session_id} = data

  return async (payload: string) => {
    const params_ = {...data, payload}

    try {
      await on_client_data_(params_)
    } catch (e) {
      send_error(socket, session_id, e.message)
      console.warn(e.message)
    }
  }
}

async function on_client_data_(data: SocketData) {
  const data = parse_raw_data(raw_data)
  if (! data.type) throw new Error('missing data type')

  const {type, user_id, device_id, task, tasks, task_id, version} = data

  if (data.type === 'handshake') {
    session.enable_ws(session_id)

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Accept: ' + data.key,
      '',
      '',
    ]

    return client.write(response.join('\r\n'))
  }

  if (data.type === 'login') {
    const {user, device}
      = await login({conn, client, user_id, device_id, session_id})

    return await watch({conn, client, session_id, user, device})
  }

  switch (type) {
    case 'read-all':
      return await read_all({conn, client, session_id, user_id})
    case 'write-all':
      return await write_all({conn, user_id, tasks, version})
    case 'create':
      return await create({conn, user_id, task, version})
    case 'update':
      return await update({conn, user_id, task, version})
    case 'delete':
      return await delete_({conn, user_id, task_id, version})
    default:
      throw new Error('invalid data type')
  }
}

function parse_raw_data(raw_data) {
  return tcp.parse(raw_data) || ws.parse(raw_data) || {}
}

async function watch(params) {
  const {client, session_id} = params
  const on_change = data => {
    send_success(client, session_id, data)
  }

  await $task.watch({...params, on_change})
}

async function read_all({conn, client, session_id, user_id}) {
  const tasks = await $task.read_all(conn, user_id)
  return send_success(client, session_id, {type: 'read-all', tasks})
}

async function write_all({conn, user_id, tasks, version}) {
  await $task.write_all(conn, user_id, tasks)
  await $user.set_version({conn, user_id, version})
}

async function create(params) {
  const {conn, client, user_id, version} = params
  const task = parse_task(params.task)(user_id)
  await $task.create(conn, task)
  await $user.set_version({conn, user_id, version})
}

async function update(params) {
  const {conn, client, user_id, version} = params
  const task = parse_task(params.task)(user_id)
  await $task.update(conn, task)
  await $user.set_version({conn, user_id, version})
}

async function delete_(params) {
  const {conn, client, user_id, version} = params
  const task_id = parse_task_id(params.task_id)
  await $task.delete_(conn, task_id, user_id)
  await $user.set_version({conn, user_id, version})
}

async function login(params) {
  const {conn, client, session_id} = params

  const user_id = params.user_id || await $user.create(conn)
  const user = await $user.read(conn, user_id)

  const device_id = params.device_id || await $device.create(conn, user_id)
  const device = await $device.read(conn, device_id)

  await $device.connect(conn, device_id)
  session.set_device(session_id, device_id)

  send_success(client, session_id, {
    type: 'login',
    user_id,
    device_id,
    version: user.version,
  })

  return {user, device}
}

function parse_task_id(id) {
  if (! id) throw new Error('missing task id')
  if (typeof id !== 'number') throw new Error('invalid task id')

  return id
}

function parse_task(obj) {
  return (user_id) => {
    if (! obj) throw new Error('missing task')

    parse_task_id(obj.id)

    if (! obj.desc) throw new Error('missing task desc')
    if (typeof obj.desc !== 'string') throw new Error('invalid task desc')

    if (! obj.tags) throw new Error('missing task tags')
    if (obj.tags && ! Array.isArray(obj.tags)) throw new Error('invalid task tags')

    if (obj.active && typeof obj.active !== 'number') throw new Error('invalid task active')
    if (obj.last_active && typeof obj.last_active !== 'number') throw new Error('invalid task last_active')
    if (obj.due && typeof obj.due !== 'number') throw new Error('invalid task due')
    if (obj.done && typeof obj.done !== 'number') throw new Error('invalid task done')
    if (obj.worktime && typeof obj.worktime !== 'number') throw new Error('invalid task worktime')

    return {
      ...obj,
      active: obj.active || 0,
      last_active: obj.last_active || 0,
      due: obj.due || 0,
      done: obj.done || 0,
      worktime: obj.worktime || 0,
      user_id,
    }
  }
}

function send_success(client, session_id, data = {}) {
  return send(client, session_id, {success: true, ...data})
}

function send_error(client, session_id, error) {
  return send(client, session_id, {success: false, error})
}

function send(client, session_id, data) {
  const response = session.ws_enabled(session_id)
    ? ws.format(data)
    : tcp.format(data)

  return client.write(response)
}

function on_listen() {
  console.log(`Kronos server listening on port ${port}...`)
}

// -------------------------------------------------------------- # Public API #

export function start(database: r.Connection) {
  const server = net.createServer(on_create_server(database))

  server.on('error', on_error)
  server.listen(port, on_listen)
}

export function on_error(e: Error) {
  console.error(e)
}
