import {createHash} from 'crypto'

import {PayloadHandshake} from './types/Payload'
import SocketData from './types/SocketData'

import $tcp from './tcp'

interface Headers {
  [key: string]: string
}

// TODO find external lib
function parseHttpRequest(data: string) {
  const [header, body] = data.split('\r\n\r\n')
  if (!header.length) return null

  const header_lines = header.split('\r\n')
  if (!header.length) return null

  const [method, url, protocol] = header_lines[0].split(' ')
  if (method.toUpperCase() !== 'GET') return null
  if (url.toUpperCase() !== '/') return null
  if (protocol.toUpperCase() !== 'HTTP/1.1') return null

  const headers = header_lines.reduce(
    (H, h) => {
      if (h.indexOf(':') === -1) return H
      const [key, val] = h.split(': ')
      return {...H, [key]: val}
    },
    {} as Headers,
  )

  return {
    body,
    headers,
    method,
    protocol,
    url,
  }
}

function parse(data: SocketData) {
  const payload = Buffer.from(data.payload || '')
  const request = parseHttpRequest(payload.toString())

  if (request) {
    const input_key = request.headers['Sec-WebSocket-Key'] as string
    const output_key = createHash('sha1')
      .update(input_key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'utf8')
      .digest('base64')

    return {type: 'handshake', key: output_key} as PayloadHandshake
  }

  const mask = payload.slice(2, 6)
  const payload_encoded = payload.slice(6)
  const output = []

  for (let i = 0; i < payload_encoded.length; i++) {
    output.push(payload_encoded[i] ^ mask[i % 4])
  }

  return $tcp.parse({
    ...data,
    payload: Buffer.from(output).toString(),
  })
}

function format(payload: object) {
  const payload_str = $tcp.format(payload)
  const payload_len = payload_str.length

  let frame_header

  if (payload_len <= 125) {
    frame_header = Buffer.from([0b010000001, payload_len])
  } else if (payload_len < Math.pow(2, 16)) {
    const payload_len_16 = Buffer.alloc(2)
    payload_len_16.writeUInt16BE(payload_len, 0)

    frame_header = Buffer.concat([
      Buffer.from([0b010000001, 126]),
      payload_len_16,
    ])
  } else {
    const payload_len_64 = Buffer.alloc(8)
    payload_len_64.writeUInt32BE(payload_len >> 8, 0)
    payload_len_64.writeUInt32BE(payload_len & 0x00ff, 4)

    frame_header = Buffer.concat([
      Buffer.from([0b010000001, 127]),
      payload_len_64,
    ])
  }

  const frame_payload = Buffer.from(payload_str)
  return Buffer.concat([frame_header, frame_payload])
}

export default {format, parse}
