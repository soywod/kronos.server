import rdb from 'rethinkdb'

import * as $database from './database'
import * as $session from './session'
import * as $user from './user'

import {DatabaseEvent} from './types/Database'
import {Task} from './types/Task'

const changesOptions = {
  changefeedQueueSize: 100000,
  includeInitial: false,
  includeOffsets: false,
  includeStates: true,
  includeTypes: true,
  squash: false,
}

// ---------------------------------------------------------------- # Read all #

export async function readAll(userId: string) {
  const cursor = await rdb
    .table('task')
    .filter((task: any) => task('index').match(`^${userId}#`))
    .run($database.curr())

  console.log(`Task readAll '${userId}'`)
  return await cursor.toArray()
}

// --------------------------------------------------------------- # Write all #

export async function writeAll(userId: string, tasks: Task[]) {
  await rdb
    .table('task')
    .filter((task: any) => task('index').match(`^${userId}`))
    .delete()
    .run($database.curr())

  await rdb
    .table('task')
    .insert(tasks)
    .run($database.curr())

  console.log(`Task writeAll '${userId}'`)
}

// ------------------------------------------------------------------ # Create #

export async function create(userId: string, task: Task) {
  try {
    const status = await rdb
      .table('task')
      .insert(task)
      .run($database.curr())

    if (!status.inserted) {
      throw new Error('task create')
    }

    console.log(`Task create '${userId}'`)
  } catch (error) {
    console.error(error)
    throw new Error('task create')
  }
}

// ------------------------------------------------------------------ # Update #

export async function update(userId: string, task: Task) {
  try {
    const query = rdb.table('task').get(task.index)

    if (!(await query.run($database.curr()))) {
      throw new Error('task not found')
    }

    await query.update(task).run($database.curr())

    console.log(`Task update '${userId}'`)
  } catch (e) {
    console.error(e)
    throw new Error('task update')
  }
}

// ------------------------------------------------------------------ # Delete #

export {_delete as delete}

async function _delete(userId: string, task_index: string) {
  try {
    const query = rdb.table('task').get(task_index)

    if (!(await query.run($database.curr()))) {
      throw new Error('task not found')
    }

    const status = await query.delete().run($database.curr())

    if (!status.deleted) {
      throw new Error('task delete')
    }

    console.log(`Task delete '${userId}'`)
  } catch (e) {
    console.error(e)
    throw new Error('task delete')
  }
}

// ------------------------------------------------------------------- # Watch #

type OnChange = (changes: DatabaseEvent) => void

export async function watch(sessionId: string, handleChange: OnChange) {
  const device = $session.getDevice(sessionId)
  const userId = device.user_id

  await rdb
    .table('task')
    .filter((task: any) => task('index').match(`^${userId}#`))
    .changes(changesOptions)
    .run($database.curr(), (runError, cursor) => {
      if (runError) {
        console.error(runError)
        throw new Error('task watch run')
      }

      cursor.each(async (eachError, changes) => {
        if (eachError) {
          console.error(eachError)
          throw new Error('task watch each')
        }

        const version = await $user.getVersion(userId)
        $session.setCursor(sessionId, cursor)

        switch (changes.type) {
          case 'add':
            return handleChange({
              device_id: device.id,
              task: changes.new_val,
              type: 'create',
              version,
            })

          case 'change':
            return handleChange({
              device_id: device.id,
              task: changes.new_val,
              type: 'update',
              version,
            })

          case 'remove':
            return handleChange({
              device_id: device.id,
              task_index: changes.old_val.index,
              type: 'delete',
              version,
            })

          default:
            return
        }
      })
    })

  console.log(`Task watch '${device.id}'`)
}
