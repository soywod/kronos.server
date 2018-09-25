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

const port: number = +(process.env.PORT || 5000)

type User = any
type Device = any

interface Task {
  id: number
  desc: string
  tags: string[]
  active: number
  last_active: number
  due: number
  done: number
  worktime: number
}

interface SocketData {
  database: r.Connection
  socket: net.Socket
  session_id: string
  payload?: string
}

type Payload =
  | HandshakePayload
  | LoginPayload
  | ReadAllPayload
  | WriteAllPayload
  | CreatePayload
  | UpdatePayload
  | DeletePayload

interface AuthPayload {
  user_id: string
  device_id: string
}

interface HandshakePayload {
  type: 'handshake'
  key: string
}

interface LoginPayload {
  type: 'login'
  user_id?: string
  device_id?: string
}

type ReadAllPayload = AuthPayload & {
  type: 'read-all'
}

type WriteAllPayload = AuthPayload & {
  type: 'write-all'
  tasks: Task[]
  version: number
}

type CreatePayload = AuthPayload & {
  type: 'create'
  task: Task
  version: number
}

type UpdatePayload = AuthPayload & {
  type: 'update'
  task: Task
  version: number
}

type DeletePayload = AuthPayload & {
  type: 'delete'
  task_id: number
  version: number
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
      await on_socket_data_(params_)
    } catch (e) {
      send_error(socket, session_id, e.message)
      console.warn(e)
    }
  }
}

async function on_socket_data_(data: SocketData) {
  const {socket, session_id} = data

  const payload = parse_payload(data)
  if (! payload) throw new Error('missing data type')

  if (payload.type === 'handshake') {
    session.enable_ws(session_id)

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Accept: ' + payload.key,
      '',
      '',
    ]

    return socket.write(response.join('\r\n'))
  }

  if (payload.type === 'login') {
    const {user, device} = await login({...data, ...payload})
    return await watch({...data, user, device})
  }

  switch (payload.type) {
    case 'read-all':
      return await read_all({...data, ...payload})
    case 'write-all':
      return await write_all({...data, ...payload})
    case 'create':
      return await create({...data, ...payload})
    case 'update':
      return await update({...data, ...payload})
    case 'delete':
      return await delete_({...data, ...payload})
    default:
      throw new Error('invalid data type')
  }
}

function parse_payload(data: SocketData) {
  return (tcp.parse(data) || ws.parse(data) || null)
}

async function login(data: SocketData & LoginPayload) {
  const {database, socket, session_id} = data

  const user_id = data.user_id || await $user.create(database)
  const user = await $user.read(database, user_id)

  const device_id = data.device_id || await $device.create(database, user_id)
  const device = await $device.read(database, device_id)

  await $device.connect(database, device_id)
  session.set_device(session_id, device_id)

  send_success(socket, session_id, {
    device_id,
    type: 'login',
    user_id,
    version: user.version,
  })

  return {user, device}
}

async function watch(data: SocketData & User & Device) {
  const {socket, session_id} = data
  const on_change = (changes: any) => {
    send_success(socket, session_id, changes)
  }

  await $task.watch({...data, on_change})
}

async function read_all(data: SocketData & ReadAllPayload) {
  const {database, socket, session_id, user_id} = data
  const tasks = await $task.read_all(database, user_id)
  return send_success(socket, session_id, {type: 'read-all', tasks})
}

async function write_all(data: SocketData & WriteAllPayload) {
  const {database, socket, tasks, version, user_id} = data
  await $task.write_all(database, user_id, tasks)
  await $user.set_version({database, user_id, version})
}

async function create(data: SocketData & CreatePayload) {
  const {database, socket, user_id, version} = data
  const task = parse_task(data.task)(user_id)
  await $task.create(socket, task)
  await $user.set_version(data)
}

async function update(data: SocketData & UpdatePayload) {
  const {database, socket, user_id, version} = data
  const task = parse_task(data.task)(user_id)
  await $task.update(database, task)
  await $user.set_version(data)
}

async function delete_(data: SocketData & DeletePayload) {
  const {database, socket, user_id, version} = data
  const task_id = parse_task_id(data.task_id)
  await $task.delete_(database, task_id, user_id)
  await $user.set_version(data)
}

function parse_task_id(id: any) {
  if (! id) throw new Error('missing task id')
  if (typeof id !== 'number') throw new Error('invalid task id')

  return id as number
}

function parse_task(task: any) {
  return (user_id: string) => {
    if (! task) throw new Error('missing task')

    parse_task_id(task.id)

    if (! task.desc) throw new Error('missing task desc')
    if (typeof task.desc !== 'string') throw new Error('invalid task desc')

    if (! task.tags) throw new Error('missing task tags')
    if (task.tags && ! Array.isArray(task.tags)) throw new Error('invalid task tags')

    if (task.active && typeof task.active !== 'number') throw new Error('invalid task active')
    if (task.last_active && typeof task.last_active !== 'number') throw new Error('invalid task last_active')
    if (task.due && typeof task.due !== 'number') throw new Error('invalid task due')
    if (task.done && typeof task.done !== 'number') throw new Error('invalid task done')
    if (task.worktime && typeof task.worktime !== 'number') throw new Error('invalid task worktime')

    return {
      ...task,
      active: task.active || 0,
      done: task.done || 0,
      due: task.due || 0,
      last_active: task.last_active || 0,
      user_id,
      worktime: task.worktime || 0,
    } as Task
  }
}

function send_success(socket: net.Socket, session_id: string, data: object = {}) {
  return send(socket, session_id, {success: true, ...data})
}

function send_error(socket: net.Socket, session_id: string, error: string) {
  return send(socket, session_id, {success: false, error})
}

function send(socket: net.Socket, session_id: string, data: object) {
  const response = session.ws_enabled(session_id)
    ? ws.format(data)
    : tcp.format(data)

  return socket.write(response)
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
