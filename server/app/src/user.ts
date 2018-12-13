import rdb from 'rethinkdb'
import {v4 as uuid} from 'uuid'

import User from './types/User'

// ------------------------------------------------------------------ # Create #

interface CreateParams {
  database: rdb.Connection
}

async function create(params: CreateParams) {
  const {database} = params

  const id = uuid()
  const user = {id, version: -1}

  const status = await rdb
    .table('user')
    .insert(user)
    .run(database)
  if (!status.inserted) {
    throw new Error('user create failed')
  }

  return id
}

// -------------------------------------------------------------------- # Read #

interface ReadParams {
  database: rdb.Connection
  user_id: string
}

async function read(params: ReadParams) {
  const {database, user_id} = params

  const user = await rdb
    .table('user')
    .get(user_id)
    .run(database)

  if (!user) throw new Error('user not found')

  return user as User
}

// ------------------------------------------------------------------ # Update #

interface UpdateParams {
  database: rdb.Connection
  user_id: string
  version: number
}

async function update(params: UpdateParams) {
  const {database, user_id, version} = params

  await rdb
    .table('user')
    .get(user_id)
    .update({version})
    .run(database)
}

export default {create, read, update}
