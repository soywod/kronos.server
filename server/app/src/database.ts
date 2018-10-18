import * as r from 'rethinkdb'

import {Task} from './task'

// ------------------------------------------------------------- # Private API #

interface EventCreate {
  type: 'create'
  task: Task
}

interface EventUpdate {
  type: 'update'
  task: Task
}

interface EventDelete {
  type: 'delete'
  task_id: string
}

const config: r.ConnectionOptions = {
  db  : process.env.DB_NAME || 'kronos',
  host: process.env.DB_HOST || 'database',
}

// -------------------------------------------------------------- # Public API #

export type Event = (EventCreate | EventUpdate | EventDelete) & {
  device_id: string
  version: number
}

export function connect(): Promise<r.Connection> {
  return r.connect(config)
}
