import {
  Payload,
  PayloadAuth,
  PayloadCreate,
  PayloadDelete,
  PayloadLogin,
  PayloadReadAll,
  PayloadUpdate,
  PayloadWriteAll,
  SocketData,
} from './server'

// ------------------------------------------------------------- # Private API #

function parse_auth_payload(payload: Payload) {
  const user_id = (payload as PayloadAuth).user_id || ''
  const device_id = (payload as PayloadAuth).device_id || ''

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
      case 'login': return parse_payload<PayloadLogin>(payload)
      case 'read-all': return parse_payload<PayloadReadAll>(payload)
      case 'write-all': return parse_payload<PayloadWriteAll>(payload)
      case 'create': return parse_payload<PayloadCreate>(payload)
      case 'update': return parse_payload<PayloadUpdate>(payload)
      case 'delete': return parse_payload<PayloadDelete>(payload)
      default: throw new Error('invalid payload type')
    }
  } catch (e) {
    console.warn(e, data.payload)
    return null
  }
}

export function format(payload: object) {
  try {
    return JSON.stringify(payload) + '\n'
  } catch (e) {
    return ''
  }
}
