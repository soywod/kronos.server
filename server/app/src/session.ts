import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import {Device} from './types/Device'
import {Sessions} from './types/Session'

const sessions: Sessions = {}

// ------------------------------------------------------------------ # Create #

export function create() {
  const id = uuid()
  const device = null
  const cursor = null
  const mode = 'tcp'

  sessions[id] = {id, device, cursor, mode}

  console.log(`Session create '${id}'`)

  return id
}

// -------------------------------------------------------------------- # Read #

function read(id: string) {
  const session = sessions[id]

  if (!session) {
    throw new Error('session not found')
  }

  return session
}

export function isModeWS(id: string) {
  const session = sessions[id]
  return session.mode === 'ws'
}

export function getDevice(id: string) {
  const session = read(id)

  if (!session.device) {
    throw new Error('device not found')
  }

  return session.device
}

export function getUserId(id: string) {
  const device = getDevice(id)
  return device.user_id
}

// ------------------------------------------------------------------ # Update #

export function enableWS(id: string) {
  const session = read(id)

  session.mode = 'ws'
  console.log(`Session enableWS '${id}'`)
}

export function setCursor(id: string, cursor: rdb.Cursor) {
  const session = read(id)

  session.cursor = cursor
  console.log(`Session setCursor '${id}'`)
}

export function setDevice(id: string, device: Device) {
  const session = read(id)

  session.device = device
  console.log(`Session setCursor '${id}'`)
}

// ------------------------------------------------------------------ # Delete #

export {_delete as delete}

async function _delete(id: string) {
  const session = read(id)

  if (session.cursor) {
    session.cursor.close()
  }

  delete sessions[session.id]
  console.log(`Session delete '${id}'`)
}
