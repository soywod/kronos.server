import Task from './Task'

interface DatabaseEventCommon {
  device_id: string
  version: number
}

type DatabaseEventCreate = DatabaseEventCommon & {
  type: 'create'
  task: Task
}

type DatabaseEventDelete = DatabaseEventCommon & {
  type: 'delete'
  task_index: string
}

type DatabaseEventUpdate = DatabaseEventCommon & {
  type: 'update'
  task: Task
}

type DatabaseEvent =
  | DatabaseEventCreate
  | DatabaseEventDelete
  | DatabaseEventUpdate

export {DatabaseEvent}
