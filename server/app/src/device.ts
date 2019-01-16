import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import {Device} from './types/Device'
import {User} from './types/User'

import * as $database from './database'

// ------------------------------------------------------------------ # Create #

export async function create(user: User) {
  const id = uuid()

  const status = await rdb
    .table('device')
    .insert({id, user_id: user.id, connected: true})
    .run($database.curr())

  if (!status.inserted) {
    throw new Error('device create failed')
  }

  return id
}

// ------------------------------------------------------ # Connect/disconnect #

async function toggleConnection(id: string, connected: boolean) {
  await rdb
    .table('device')
    .get(id)
    .update({connected})
    .run($database.curr())

  const device = (await rdb
    .table('device')
    .get(id)
    .run($database.curr())) as Device

  if (!device) {
    throw new Error('device not found')
  }

  return device
}

export async function connect(id: string) {
  try {
    const device = await toggleConnection(id, true)
    console.log(`device connect '${id}'`)

    return device
  } catch (error) {
    console.error(error)
    throw new Error('device connect failed')
  }
}

export async function disconnect(id: string) {
  try {
    const device = await toggleConnection(id, false)
    console.log(`device disconnect '${id}'`)

    return device
  } catch (error) {
    console.error(error)
    throw new Error('device disconnect failed')
  }
}
