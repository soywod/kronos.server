import isString from 'lodash/fp/isString'
import net from 'net'

import * as $device from './device'
import * as $session from './session'
import * as $task from './task'
import * as $tcp from './tcp'
import * as $user from './user'
import * as $ws from './ws'

import {
  Payload,
  PayloadCreate,
  PayloadDelete,
  PayloadLogin,
  PayloadUpdate,
  PayloadWriteAll,
} from './types/Payload'
import {Task} from './types/Task'

// ---------------------------------------------------------- # Handle request #

export function handleRequest(socket: net.Socket) {
  const sessionId = $session.create()

  socket.on('data', handleSocketData)
  socket.on('end', handleSocketEnd)
  socket.on('error', handleSocketError)

  async function _handleSocketData(payloadStr: string) {
    const payload = parsePayloadStr(payloadStr)

    if (!payload) {
      console.error(payloadStr)
      throw new Error('invalid payload')
    }

    switch (payload.type) {
      case 'handshake':
        return handleHandshakeRequest(payload.key)
      case 'login':
        return handleLoginRequest(payload)
      case 'read-all':
        return handleReadAllRequest()
      case 'write-all':
        return handleWriteAllRequest(payload)
      case 'create':
        return handleCreateRequest(payload)
      case 'update':
        return handleUpdateRequest(payload)
      case 'delete':
        return handleDeleteRequest(payload)
      default:
        console.error(payload)
        throw new Error(`invalid payload type`)
    }
  }

  function handleHandshakeRequest(key: string) {
    $session.enableWS(sessionId)

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Accept: ' + key,
      '',
      '',
    ].join('\r\n')

    send(response)
  }

  async function handleLoginRequest(payload: PayloadLogin) {
    const userId = payload.user_id || (await $user.create())
    const user = await $user.read(userId)

    const deviceId = payload.device_id || (await $device.create(user))
    const device = await $device.connect(deviceId)
    await $session.setDevice(sessionId, device)

    await $task.watch(sessionId, send)

    send({
      device_id: deviceId,
      type: 'login',
      user_id: userId,
      version: user.version,
    })
  }

  async function handleReadAllRequest() {
    const userId = $session.getUserId(sessionId)
    const tasks = await $task.readAll(userId)
    const version = await $user.getVersion(userId)

    send({type: 'read-all', tasks, version})
  }

  async function handleWriteAllRequest(payload: PayloadWriteAll) {
    const {tasks, version} = payload
    const userId = $session.getUserId(sessionId)

    await $user.setVersion(userId, version)
    await $task.writeAll(userId, tasks)
  }

  async function handleCreateRequest(payload: PayloadCreate) {
    const {version} = payload
    const userId = $session.getUserId(sessionId)
    const task = parseTask(payload.task)

    await $user.setVersion(userId, version)
    await $task.create(userId, task)
  }

  async function handleUpdateRequest(payload: PayloadUpdate) {
    const {version} = payload
    const userId = $session.getUserId(sessionId)
    const task = parseTask(payload.task)

    await $user.setVersion(userId, version)
    await $task.update(userId, task)
  }

  async function handleDeleteRequest(payload: PayloadDelete) {
    const {version} = payload
    const task_index = parseTaskIndex(payload.task_index)
    const userId = $session.getUserId(sessionId)

    await $user.setVersion(userId, version)
    await $task.delete(userId, task_index)
  }

  async function handleSocketData(payloadStr: string) {
    try {
      await _handleSocketData(payloadStr)
    } catch (error) {
      sendError(error.message)
      console.warn(error)
    }
  }

  async function handleSocketEnd() {
    try {
      const device = await $session.getDevice(sessionId)
      await $device.disconnect(device.id)
      await $session.delete(sessionId)
    } catch (error) {
      console.error(error)
    }
  }

  async function handleSocketError(event: Event) {
    console.error(event)
    return await handleSocketEnd()
  }

  function send(data: string | object) {
    return isString(data) ? _sendStr(data) : _sendObj({success: true, ...data})
  }

  function sendError(error: string) {
    return _sendObj({success: false, error})
  }

  function _sendStr(data: string) {
    return socket.write(data)
  }

  function _sendObj(data: object) {
    const response = $session.isModeWS(sessionId)
      ? $ws.format(data)
      : $tcp.format(data)

    return socket.write(response)
  }
}

function parsePayloadStr(payloadStr: string) {
  return ($tcp.parse(payloadStr) || $ws.parse(payloadStr)) as Payload | null
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
