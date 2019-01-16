import {
  Payload,
  PayloadAuth,
  PayloadCreate,
  PayloadDelete,
  PayloadLogin,
  PayloadReadAll,
  PayloadUpdate,
  PayloadWriteAll,
} from './types/Payload'

function parseAuthPayload(payload: PayloadAuth) {
  const user_id = payload.user_id || ''
  const device_id = payload.device_id || ''

  return {
    device_id,
    user_id,
  }
}

function parsePayload<P extends Payload>(payload: Payload) {
  return {
    ...payload,
    ...parseAuthPayload(payload as PayloadAuth),
  } as P
}

export function parse(payloadStr: string) {
  try {
    const payload = JSON.parse(payloadStr || '{}') as Payload

    switch (payload.type) {
      case 'login':
        return parsePayload<PayloadLogin>(payload)
      case 'read-all':
        return parsePayload<PayloadReadAll>(payload)
      case 'write-all':
        return parsePayload<PayloadWriteAll>(payload)
      case 'create':
        return parsePayload<PayloadCreate>(payload)
      case 'update':
        return parsePayload<PayloadUpdate>(payload)
      case 'delete':
        return parsePayload<PayloadDelete>(payload)
      default:
        throw new Error('invalid payload type')
    }
  } catch (_) {
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
