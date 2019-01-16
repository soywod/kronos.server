import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import {User, Users} from './types/User'

import * as $database from './database'

const users: Users = {}

// ------------------------------------------------------------------ # Create #

export async function create() {
  const id = uuid()
  const user: User = {id, version: -1}

  const status = await rdb
    .table('user')
    .insert(user)
    .run($database.curr())

  if (!status.inserted) {
    throw new Error('user create')
  }

  return (users[id] = user).id
}

// -------------------------------------------------------------------- # Read #

export async function read(id: string) {
  if (users[id]) {
    return users[id]
  }

  const user = (await rdb
    .table('user')
    .get(id)
    .run($database.curr())) as User

  if (!user) {
    throw new Error('user not found')
  }

  return (users[id] = user)
}

export async function getVersion(id: string) {
  const user = await read(id)
  return user.version
}

// ------------------------------------------------------------------ # Update #

export async function setVersion(id: string, version: number) {
  const user = await read(id)

  await rdb
    .table('user')
    .get(user.id)
    .update({version: user.version = version})
    .run($database.curr())

  console.log(`User setVersion ${version} - ${id}`)
}
