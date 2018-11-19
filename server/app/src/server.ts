import * as net from 'net'
import * as r from 'rethinkdb'

import {Event as DatabaseEvent} from './database'
import {Device} from './device'
import {Task} from './task'
import {User} from './user'

import * as $device from './device'
import * as $session from './session'
import * as $task from './task'
import * as $tcp from './tcp'
import * as $user from './user'
import * as $websocket from './websocket'

// ------------------------------------------------------------- # Private API #

const port = (process.env.PORT || 5000) as number

export interface SocketData {
  database: r.Connection
  socket: net.Socket
  session_id: string
  payload?: string
}

export type Payload =
  | PayloadHandshake
  | PayloadLogin
  | PayloadReadAll
  | PayloadWriteAll
  | PayloadCreate
  | PayloadUpdate
  | PayloadDelete

export interface PayloadAuth {
  user_id: string
  device_id: string
}

export interface PayloadHandshake {
  type: 'handshake'
  key: string
}

export interface PayloadLogin {
  type: 'login'
  user_id?: string
  device_id?: string
}

export type PayloadReadAll = PayloadAuth & {
  type: 'read-all'
}

export type PayloadWriteAll = PayloadAuth & {
  type: 'write-all'
  tasks: Task[]
  version: number
}

export type PayloadCreate = PayloadAuth & {
  type: 'create'
  task: Task
  version: number
}

export type PayloadUpdate = PayloadAuth & {
  type: 'update'
  task: Task
  version: number
}

export type PayloadDelete = PayloadAuth & {
  type: 'delete'
  task_id: number
  version: number
}

interface WatchParams {
  data: SocketData
  device: Device
  user: User
}

function on_create_server(database: r.Connection) {
  return (socket: net.Socket) => {
    const session_id = $session.create()
    console.log(`New session '${session_id}'`)

    const data: SocketData = {database, socket, session_id}
    socket.on('data', on_socket_data(data))
    socket.on('end',  on_socket_end(data))
  }
}

function on_socket_end(data: SocketData) {
  const {database, session_id} = data

  return async () => {
    const device_id = $session.delete_(session_id)

    if (device_id) {
      console.log(`End session '${session_id}'`)
      await $device.disconnect({database, device_id})
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
    $session.enable_websocket(session_id)

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
    return watch({data, user, device})
  }

  switch (payload.type) {
    case 'read-all':
      return read_all({...data, ...payload})
    case 'write-all':
      return write_all({...data, ...payload})
    case 'create':
      return create({...data, ...payload})
    case 'update':
      return update({...data, ...payload})
    case 'delete':
      return delete_({...data, ...payload})
    default:
      throw new Error('invalid data type')
  }
}

function parse_payload(data: SocketData) {
  return ($tcp.parse(data) || $websocket.parse(data)) as Payload | null
}

async function login(data: SocketData & PayloadLogin) {
  const {database, socket, session_id} = data

  const user_id = data.user_id || await $user.create({database})
  const user = await $user.read({database, user_id})

  const device_id = data.device_id || await $device.create({database, user_id})
  const device = await $device.read({database, device_id})

  await $device.connect({database, device_id})
  $session.update_device(session_id, device_id)

  send_success(socket, session_id, {
    device_id,
    type: 'login',
    user_id,
    version: user.version,
  })

  return {user, device}
}

async function watch(params: WatchParams) {
  const {device, user} = params
  const {database, socket, session_id} = params.data
  const on_change = (changes: DatabaseEvent) =>
    send_success(socket, session_id, changes)

  await $task.watch({database, user, device, on_change})
}

async function read_all(data: SocketData & PayloadReadAll) {
  const {database, socket, session_id, user_id} = data
  const tasks = await $task.read_all({database, user_id})
  return send_success(socket, session_id, {type: 'read-all', tasks})
}

async function write_all(data: SocketData & PayloadWriteAll) {
  const {database, tasks, version, user_id} = data
  await $task.write_all({database, user_id, tasks})
  await $user.update_version({database, user_id, version})
}

async function create(data: SocketData & PayloadCreate) {
  const {database, user_id} = data
  const task = parse_task(data.task)(user_id)
  await $task.create({database, task, user_id})
  await $user.update_version(data)
}

async function update(data: SocketData & PayloadUpdate) {
  const {database, user_id} = data
  const task = parse_task(data.task)(user_id)
  await $task.update({database, task, user_id})
  await $user.update_version(data)
}

async function delete_(data: SocketData & PayloadDelete) {
  const {database, user_id} = data
  const task_id = parse_task_id(data.task_id)
  await $task.delete_({database, task_id, user_id})
  await $user.update_version(data)
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
  const response = $session.websocket_enabled(session_id)
    ? $websocket.format(data)
    : $tcp.format(data)

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
