const create_hash = require("crypto").createHash
const tcp = require("./tcp")

// -------------------------------------------------------------- # Public API #

function parse(raw_input) {
  const input = Buffer.from(raw_input)
  const request = parse_http_request(input.toString())

  if (request) {
    // TODO check valid handshake request
    const input_key = request.headers['Sec-WebSocket-Key']
    const output_key = create_hash('sha1')
      .update(input_key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
      .digest('base64')

    return {type: 'handshake', key: output_key}
  }

  const data_len = input.readUInt8(1) & 0b01111111
  const mask = input.slice(2, 6)
  const data_encoded = input.slice(6)
  const data = []

  for (let i = 0; i < data_encoded.length; i++) {
    data.push(data_encoded[i] ^ mask[i % 4])
  }

  return tcp.parse(Buffer.from(data).toString())
}

function format(payload) {
  const payload_str = tcp.format(payload)
  const payload_len = payload_str.length

  let frame_header

  if (payload_len <= 125) {
    frame_header = Buffer.from([0b010000001, payload_len])
  } else if (payload_len < (Math.pow(2, 16))) {
    const payload_len_16 = Buffer.alloc(2)
    payload_len_16.writeUInt16BE(payload_len)

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

module.exports = {
  parse,
  format,
}

// ------------------------------------------------------------- # Private API #

function parse_http_request(raw_input) {
  const [header, data] = raw_input.split('\r\n\r\n')
  if (! header.length) return null

  const header_lines = header.split('\r\n')
  if (! header.length) return null

  const [method, url, protocol] = header_lines[0].split(' ')
  if (method.toUpperCase() !== 'GET') return null
  if (url.toUpperCase() !== '/') return null
  if (protocol.toUpperCase() !== 'HTTP/1.1') return null

  const headers = header_lines
    .reduce((headers, h) => {
      if (h.indexOf(":") === -1) return headers
      const [key, val] = h.split(": ")
      return {...headers, [key]: val}
    }, {})

  return {
    method,
    url,
    protocol,
    headers,
    data,
  }
}

// From https://github.com/websockets/utf-8-validate
function is_valid_utf8(buf) {
  const len = buf.length
  let i = 0

  while (i < len) {
    if (buf[i] < 0x80) i++
    else if ((buf[i] & 0xe0) === 0xc0) {
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0
      ) return false
      else i += 2
    } else if ((buf[i] & 0xf0) === 0xe0) {
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80 ||
        buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0
      ) return false
      else i += 3
    } else if ((buf[i] & 0xf8) === 0xf0) {
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80 ||
        buf[i] === 0xf4 && buf[i + 1] > 0x8f || buf[i] > 0xf4
      ) return false
      else i += 4
    } else return false
  }

  return true
}
