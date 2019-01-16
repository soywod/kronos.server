import {Task} from './Task'

interface PayloadAuth {
  user_id: string
  device_id: string
}

interface PayloadHandshake {
  type: 'handshake'
  key: string
}

interface PayloadLogin {
  type: 'login'
  user_id?: string
  device_id?: string
}

type PayloadReadAll = PayloadAuth & {
  type: 'read-all'
}

type PayloadWriteAll = PayloadAuth & {
  type: 'write-all'
  tasks: Task[]
  version: number
}

type PayloadCreate = PayloadAuth & {
  type: 'create'
  task: Task
  version: number
}

type PayloadUpdate = PayloadAuth & {
  type: 'update'
  task: Task
  version: number
}

type PayloadDelete = PayloadAuth & {
  type: 'delete'
  task_index: string
  version: number
}

type Payload =
  | PayloadCreate
  | PayloadDelete
  | PayloadHandshake
  | PayloadLogin
  | PayloadReadAll
  | PayloadUpdate
  | PayloadWriteAll

export {
  Payload,
  PayloadAuth,
  PayloadCreate,
  PayloadDelete,
  PayloadHandshake,
  PayloadLogin,
  PayloadReadAll,
  PayloadUpdate,
  PayloadWriteAll,
}
