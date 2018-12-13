import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import Device from './types/Device'

// ------------------------------------------------------------------ # Create #

interface CreateParams {
  database: rdb.Connection
  user_id: string
}

async function create(params: CreateParams) {
  const {database, user_id} = params

  const id = uuid()
  const device = {id, user_id, connected: true}

  const status = await rdb
    .table('device')
    .insert(device)
    .run(database)

  if (!status.inserted) {
    throw new Error('device create')
  }

  return id
}

// -------------------------------------------------------------------- # Read #

interface ReadParams {
  database: rdb.Connection
  device_id: string
}

async function read(params: ReadParams) {
  const {database, device_id} = params

  const device = await rdb
    .table('device')
    .get(device_id)
    .run(database)

  if (!device) throw new Error('device not found')

  return device as Device
}

// ------------------------------------------------------ # Connect/disconnect #

interface ToggleParams {
  database: rdb.Connection
  device_id: string
  connected: boolean
}

function toggle(params: ToggleParams) {
  const {database, device_id, connected} = params

  rdb
    .table('device')
    .get(device_id)
    .update({connected})
    .run(database)
}

interface ConnectParams {
  database: rdb.Connection
  device_id: string
}

async function connect(params: ConnectParams) {
  try {
    const {database, device_id} = params
    await toggle({database, device_id, connected: true})
  } catch (_) {
    throw new Error('device connect failed')
  }
}

interface DisconnectParams {
  database: rdb.Connection
  device_id: string
}

async function disconnect(params: DisconnectParams) {
  try {
    const {database, device_id} = params
    await toggle({database, device_id, connected: false})
  } catch (_) {
    throw new Error('device disconnect failed')
  }
}

export default {connect, create, disconnect, toggle, read}
