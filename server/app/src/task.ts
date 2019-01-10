import omit from 'lodash/fp/omit'
import rdb from 'rethinkdb'

import DatabaseEvent from './types/Database'
import Device from './types/Device'
import Session from './types/Session'
import Task from './types/Task'
import User from './types/User'

const changesOptions = {
  changefeedQueueSize: 100000,
  includeInitial: false,
  includeOffsets: false,
  includeStates: true,
  includeTypes: true,
  squash: false,
}

// ---------------------------------------------------------------- # Read all #

interface ReadAllParams {
  database: rdb.Connection
  user_id: string
}

async function readAll(params: ReadAllParams) {
  const {database, user_id} = params
  const cursor = await rdb
    .table('task')
    .filter({user_id})
    .run(database)
  return await cursor.toArray()
}

// --------------------------------------------------------------- # Write all #

interface WriteAllParams {
  database: rdb.Connection
  user_id: string
  tasks: Task[]
}

async function writeAll(params: WriteAllParams) {
  const {database, tasks, user_id} = params

  await rdb
    .table('task')
    .filter({user_id})
    .delete()
    .run(database)

  await rdb
    .table('task')
    .insert(tasks)
    .run(database)
}

// ------------------------------------------------------------------ # Create #

interface CreateParams {
  database: rdb.Connection
  task: Task
}

async function create(params: CreateParams) {
  const {database, task} = params

  try {
    const status = await rdb
      .table('task')
      .insert(task)
      .run(database)

    if (!status.inserted) throw new Error()
  } catch (error) {
    console.error(error)
    throw new Error('task create failed')
  }
}

// ------------------------------------------------------------------ # Update #

interface UpdateParams {
  database: rdb.Connection
  task: Task
}

async function update(params: UpdateParams) {
  const {database, task} = params

  const query = rdb.table('task').get(task.index)

  if (!(await query.run(database))) {
    throw new Error('task not found')
  }

  try {
    await query.update(task).run(database)
  } catch (e) {
    throw new Error('task update failed')
  }
}

// ------------------------------------------------------------------ # Delete #

interface DeleteParams {
  database: rdb.Connection
  task_index: string
}

async function _delete(params: DeleteParams) {
  const {database, task_index} = params

  const query = rdb.table('task').get(task_index)

  if (!(await query.run(database))) {
    throw new Error('task not found')
  }

  try {
    const status = await query.delete().run(database)
    if (!status.deleted) throw new Error()
  } catch (e) {
    throw new Error('task delete failed')
  }
}

// ------------------------------------------------------------------- # Watch #

interface WatchParams {
  database: rdb.Connection
  user: User
  device: Device
  session: Session
  on_change: (changes: DatabaseEvent) => void
}

async function watch(params: WatchParams) {
  const {database, user, device, on_change, session} = params
  const {id: user_id, version} = user
  const {id: device_id} = device

  await rdb
    .table('task')
    .filter((task: any) => task('index').match(`^${user_id}#`))
    .changes(changesOptions)
    .run(database, (error_run, cursor) => {
      if (error_run) throw new Error('task watch failed')

      cursor.each((error_each, changes) => {
        if (error_each) throw new Error('task watch each cursor failed')
        session.cursor = cursor
        let payload

        switch (changes.type) {
          case 'add':
            payload = {
              device_id,
              version,
              task: omit('user_id')(changes.new_val),
            }
            return on_change({type: 'create', ...payload})

          case 'change':
            payload = {
              device_id,
              version,
              task: omit('user_id')(changes.new_val),
            }
            return on_change({type: 'update', ...payload})

          case 'remove':
            payload = {task_index: changes.old_val.index, device_id, version}
            return on_change({type: 'delete', ...payload})

          default:
            return
        }
      })
    })
}

export default {create, update, readAll, watch, writeAll, delete: _delete}
