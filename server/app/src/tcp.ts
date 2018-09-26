import {
  AuthPayload,
  CreatePayload,
  DeletePayload,
  LoginPayload,
  Payload,
  ReadAllPayload,
  SocketData,
  UpdatePayload,
  WriteAllPayload,
} from './server'

// ------------------------------------------------------------- # Private API #

function parse_auth_payload(payload: Payload) {
  const user_id = (payload as AuthPayload).user_id || ''
  const device_id = (payload as AuthPayload).device_id || ''

  return {
    device_id,
    user_id,
  }
}

function parse_payload<P extends Payload>(payload: Payload) {
  return {
    ...payload,
    ...parse_auth_payload(payload),
  } as P
}

// -------------------------------------------------------------- # Public API #

export function parse(data: SocketData) {
  try {
    const payload = JSON.parse(data.payload || '{}') as Payload

    switch (payload.type) {
      case 'login': return parse_payload<LoginPayload>(payload)
      case 'read-all': return parse_payload<ReadAllPayload>(payload)
      case 'write-all': return parse_payload<WriteAllPayload>(payload)
      case 'create': return parse_payload<CreatePayload>(payload)
      case 'update': return parse_payload<UpdatePayload>(payload)
      case 'delete': return parse_payload<DeletePayload>(payload)
      default: throw new Error('invalid payload type')
    }
  } catch (e) {
    console.warn(e, data.payload)
    return null
  }
}

export function format(data: object) {
  try {
    return JSON.stringify(data) + '\n'
  } catch (e) {
    return ''
  }
}
