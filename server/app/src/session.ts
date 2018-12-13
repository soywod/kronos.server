import {v4 as uuid} from 'uuid'

import Session, {Sessions} from './types/Session'

const sessions: Sessions = {}

function create() {
  const id = uuid()
  const session: Session = {
    id,
    device_id: null,
    cursor: null,
    mode: 'tcp',
  }

  sessions[id] = session
  return session
}

function update(id: string, session: Partial<Session>) {
  const curr_session = sessions[id]
  sessions[id] = {...curr_session, ...session}
}

function _delete(id: string) {
  if (!(id in sessions)) {
    return null
  }

  const session = sessions[id]
  const device_id = session.device_id

  if (session.cursor) {
    session.cursor.close()
  }

  delete sessions[id]
  return device_id
}

export default {
  create,
  update,
  delete: _delete,
}
