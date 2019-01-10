import net from 'net'
import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import DatabaseEvent from './types/Database'
import Device from './types/Device'
import Payload, {
  PayloadCreate,
  PayloadDelete,
  PayloadLogin,
  PayloadReadAll,
  PayloadUpdate,
  PayloadWriteAll,
} from './types/Payload'
import Session from './types/Session'
import SocketData from './types/SocketData'
import Task from './types/Task'
import User from './types/User'

import $device from './device'
import $task from './task'
import $tcp from './tcp'
import $user from './user'
import $ws from './ws'

// ------------------------------------------------------------- # Private API #

const port = (process.env.PORT || 5000) as number

function handleCreateServer(database: rdb.Connection) {
  return (socket: net.Socket) => {
    const session: Session = {
      id: uuid(),
      device_id: null,
      cursor: null,
      mode: 'tcp',
    }

    console.log(`New session '${session.id}'`)

    const data: SocketData = {database, socket, session}
    socket.on('data', handleSocketData(data))
    socket.on('end', handleSocketEnd(data))
    socket.on('error', handleSocketEnd(data))
  }
}

function handleSocketEnd(data: SocketData) {
  const {database, session} = data

  return async () => {
    const {id: sessionId, device_id} = session
    console.log(`End session '${sessionId}'`)

    if (device_id) {
      await $device.disconnect({database, device_id})
      console.log(`Disconnect device '${device_id}'`)
    }
  }
}

function handleSocketData(data: SocketData) {
  const {socket, session} = data

  return async (payload: string) => {
    const params = {...data, payload}

    try {
      await _handleSocketData(params)
    } catch (error) {
      sendError(socket, session, error.message)
      console.warn(error)
    }
  }
}

async function _handleSocketData(data: SocketData) {
  const {socket, session} = data

  const payload = parsePayload(data)
  if (!payload) throw new Error('missing data type')

  if (payload.type === 'handshake') {
    session.mode = 'ws'

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
      return readAll({...data, ...payload})
    case 'write-all':
      return writeAll({...data, ...payload})
    case 'create':
      return create({...data, ...payload})
    case 'update':
      return update({...data, ...payload})
    case 'delete':
      return _delete({...data, ...payload})
    default:
      throw new Error('invalid data type')
  }
}

function parsePayload(data: SocketData) {
  return ($tcp.parse(data) || $ws.parse(data)) as Payload | null
}

async function login(data: SocketData & PayloadLogin) {
  const {database, socket, session} = data

  const user_id = data.user_id || (await $user.create({database}))
  const user = await $user.read({database, user_id})

  const device_id =
    data.device_id || (await $device.create({database, user_id}))
  const device = await $device.read({database, device_id})

  await $device.connect({database, device_id})
  session.device_id = device_id

  sendSuccess(socket, session, {
    device_id,
    user_id,
    type: 'login',
    version: user.version,
  })

  return {user, device}
}

interface WatchParams {
  data: SocketData
  user: User
  device: Device
}

async function watch(params: WatchParams) {
  const {device, user} = params
  const {database, socket, session} = params.data
  const on_change = async (changes: DatabaseEvent) =>
    sendSuccess(socket, session, changes)

  await $task.watch({database, user, device, session, on_change})
}

async function readAll(data: SocketData & PayloadReadAll) {
  const {database, socket, session, user_id} = data
  const tasks = await $task.readAll({database, user_id})
  const version = (await $user.read({database, user_id})).version
  return sendSuccess(socket, session, {type: 'read-all', tasks, version})
}

async function writeAll(data: SocketData & PayloadWriteAll) {
  const {database, tasks, version, user_id} = data
  await $task.writeAll({database, user_id, tasks})
  await $user.update({database, user_id, version})
}

async function create(data: SocketData & PayloadCreate) {
  const {database} = data
  const task = parseTask(data.task)
  await $task.create({database, task})
  await $user.update(data)
}

async function update(data: SocketData & PayloadUpdate) {
  const {database} = data
  const task = parseTask(data.task)
  await $task.update({database, task})
  await $user.update(data)
}

async function _delete(data: SocketData & PayloadDelete) {
  const {database} = data
  const task_index = parseTaskIndex(data.task_index)
  await $task.delete({database, task_index})
  await $user.update(data)
}

function parseTaskIndex(index: any) {
  if (!index) throw new Error('missing task index')
  if (typeof index !== 'string') throw new Error('invalid task index')

  return index as string
}

function parseTask(task: any) {
  if (!task) throw new Error('missing task')

  parseTaskIndex(task.index)

  if (!task.id) throw new Error('missing task id')
  if (typeof task.id !== 'number') throw new Error('invalid task id')

  if (!task.desc) throw new Error('missing task desc')
  if (typeof task.desc !== 'string') throw new Error('invalid task desc')

  if (!task.tags) throw new Error('missing task tags')
  if (task.tags && !Array.isArray(task.tags))
    throw new Error('invalid task tags')

  if (task.start && !Array.isArray(task.start))
    throw new Error('invalid task start')
  if (task.stop && !Array.isArray(task.stop))
    throw new Error('invalid task stop')
  if (task.active && typeof task.active !== 'number')
    throw new Error('invalid task active')
  if (task.due && typeof task.due !== 'number')
    throw new Error('invalid task due')
  if (task.done && typeof task.done !== 'number')
    throw new Error('invalid task done')
  if (task.worktime && typeof task.worktime !== 'number')
    throw new Error('invalid task worktime')

  return {
    ...task,
    active: task.active || 0,
    start: task.start || [],
    stop: task.stop || [],
    due: task.due || 0,
    done: task.done || 0,
  } as Task
}

function sendSuccess(socket: net.Socket, session: Session, data: object = {}) {
  return send(socket, session, {success: true, ...data})
}

function sendError(socket: net.Socket, session: Session, error: string) {
  return send(socket, session, {success: false, error})
}

function send(socket: net.Socket, session: Session, data: object) {
  const response = session.mode === 'ws' ? $ws.format(data) : $tcp.format(data)
  return socket.write(response)
}

function handleListen() {
  console.log(`Kronos server listening on port ${port}...`)
}

function handleStart(database: rdb.Connection) {
  const server = net.createServer(handleCreateServer(database))

  server.on('error', handleError)
  server.listen(port, handleListen)
}

function handleError(error: Error) {
  console.error(error)
}

export default {handleStart, handleError}
