import * as r from 'rethinkdb'
import {v4 as uuid} from 'uuid'

// ------------------------------------------------------------- # Private API #

interface WithDatabase {
  database: r.Connection
}

interface WithUserId {
  user_id: string
}

interface WithDeviceId {
  device_id: string
}

interface WithConnected {
  connected: boolean
}

type CreateParams = WithDatabase & WithUserId
type ReadParams = WithDatabase & WithDeviceId
type ConnectParams = ReadParams
type DisconnectParams = ReadParams
type ToggleParams = ReadParams & WithConnected

export interface Device {
  id: string
  user_id: string
  connected: boolean
}

function toggle(params: ToggleParams) {
  const {database, device_id, connected} = params

  r.table('device')
    .get(device_id)
    .update({connected})
    .run(database)
}

// -------------------------------------------------------------- # Public API #

export async function create(params: CreateParams) {
  const {database, user_id} = params

  const id = uuid()
  const device = {id, user_id, connected: true}

  const status = await r.table('device')
    .insert(device)
    .run(database)

  if (! status.inserted) {
    throw new Error('device create')
  }

  return id
}

export async function read(params: ReadParams) {
  const {database, device_id} = params

  const device = await r.table('device')
    .get(device_id)
    .run(database) as Device

  if (! device) throw new Error('device not found')

  return device
}

export async function connect(params: ConnectParams) {
  try {
    const {database, device_id} = params
    await toggle({database, device_id, connected: true})
  } catch (e) {
    throw new Error('device connect failed')
  }
}

export async function disconnect(params: DisconnectParams) {
  try {
    const {database, device_id} = params
    await toggle({database, device_id, connected: false})
  } catch (e) {
    throw new Error('device disconnect failed')
  }
}
