import * as r from 'rethinkdb'
import {v4 as uuid} from 'uuid'

// ------------------------------------------------------------- # Private API #

interface WithDatabase {
  database: r.Connection
}

interface WithUserId {
  user_id: string
}

interface WithVersion {
  version: number
}

type CreateParams = WithDatabase
type ReadParams = WithDatabase & WithUserId
type UpdateVersionParams = WithDatabase & WithUserId & WithVersion

export interface User {
  id: string
  version: number
  hide_done: boolean
  sync_host: string
}

// -------------------------------------------------------------- # Public API #

export async function create(params: CreateParams) {
  const {database} = params

  const id = uuid()
  const user = {id, version: -1}

  const status = await r.table('user').insert(user).run(database)
  if (! status.inserted) {
    throw new Error('user create failed')
  }

  return id
}

export async function read(params: ReadParams) {
  const {database, user_id} = params

  const user = await r.table('user')
    .get(user_id)
    .run(database) as User

  if (! user) throw new Error('user not found')

  return user
}

export async function update_version(params: UpdateVersionParams) {
  const {database, user_id, version} = params

  await r
    .table('user')
    .get(user_id)
    .update({version})
    .run(database)
}
