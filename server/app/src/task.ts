import * as r from 'rethinkdb'

import {Event as DatabaseEvent} from './database'
import {Device} from './device'
import $session from './session'
import {User} from './user'

// ------------------------------------------------------------- # Private API #

export interface Task {
  id: number
  desc: string
  tags: string[]
  active: number
  last_active: number
  due: number
  done: number
  worktime: number
}

interface WithDatabase {
  database: r.Connection
}

interface WithUserId {
  user_id: string
}

interface WithTask {
  task: Task
}

interface WithTaskId {
  task_id: number
}

interface WithTasks {
  tasks: Task[]
}

type ReadAllParams  = WithDatabase & WithUserId
type WriteAllParams = WithDatabase & WithTasks & WithUserId
type CreateParams   = WithDatabase & WithTask & WithUserId
type UpdateParams   = WithDatabase & WithTask & WithUserId
type DeleteParams   = WithDatabase & WithTaskId & WithUserId

type WithIndexParams  = WithTask & WithUserId
type WithUserIdParams = WithTasks & WithUserId

type WatchParams = WithDatabase & {
  user: User
  device: Device
  session_id: string
  on_change: (changes: DatabaseEvent) => void
}

const changesOptions = {
  changefeedQueueSize: 100000,
  includeInitial: false,
  includeOffsets: false,
  includeStates: true,
  includeTypes: true,
  squash: false,
}

function with_index(params: WithIndexParams) {
  const {task, user_id} = params

  return {
    ...task,
    index: `${task.id}-${user_id}`,
  }
}

function with_user_id(params: WithUserIdParams) {
  const {tasks, user_id} = params

  return tasks.map(task => ({
    ...task,
    index: `${task.id}-${user_id}`,
    user_id,
  }))
}

// -------------------------------------------------------------- # Public API #

export async function read_all(params: ReadAllParams) {
  const {database, user_id} = params
  const cursor = await r.table('task').filter({user_id}).run(database)
  return await cursor.toArray()
}

export async function write_all(params: WriteAllParams) {
  const {database, tasks, user_id} = params
  await r.table('task').filter({user_id}).delete().run(database)
  await r.table('task').insert(with_user_id({tasks, user_id})).run(database)
}

export async function create(params: CreateParams) {
  const {database, task, user_id} = params

  try {
    const status = await r
      .table('task')
      .insert(with_index({task, user_id}))
      .run(database)

    if (! status.inserted) throw new Error()
  } catch (e) {
    throw new Error('task create failed')
  }
}

export async function update(params: UpdateParams) {
  const {database, task, user_id} = params

  const query = r
    .table('task')
    .get(with_index({task, user_id}).index)

  if (! await query.run(database)) {
    throw new Error('task not found')
  }

  try {
    await query.update(task).run(database)
  } catch (e) {
    throw new Error('task update failed')
  }
}

export async function delete_(params: DeleteParams) {
  const {database, task_id, user_id} = params

  const query = r
    .table('task')
    .get(`${task_id}-${user_id}`)

  if (! await query.run(database)) {
    throw new Error('task not found')
  }

  try {
    const status = await query.delete().run(database)
    if (! status.deleted) throw new Error()
  } catch (e) {
    throw new Error('task delete failed')
  }
}

export async function watch(params: WatchParams) {
  const {database, user, device, on_change, session_id} = params
  const {id: user_id, version} = user
  const {id: device_id} = device

  await r
    .table('task')
    .filter({user_id})
    .changes(changesOptions)
    .run(database, (error_run, cursor) => {
      if (error_run) throw new Error('task watch failed')

      cursor.each((error_each, changes) => {
        if (error_each) throw new Error('task watch each cursor failed')
        $session.set_cursor(session_id, cursor)
        let payload

        switch (changes.type) {
          case 'add':
            payload = {task: changes.new_val, device_id, version}
            return on_change({type: 'create', ...payload})

          case 'change':
            payload = {task: changes.new_val, device_id, version}
            return on_change({type: 'update', ...payload})

          case 'remove':
            payload = {task_id: changes.old_val.id, device_id, version}
            return on_change({type: 'delete', ...payload})

          default:
            return
        }
      })
    })
}
