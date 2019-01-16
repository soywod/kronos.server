import net from 'net'

import {handleRequest} from './socket'

const port = Number(process.env.PORT || 5000)

// ------------------------------------------------------------ # Handle start #

export function handleStart() {
  const server = net.createServer(handleRequest)

  server.on('error', handleError)
  server.listen(port, handleListen)
}

// ------------------------------------------------------------ # Handle error #

export function handleError(error: Error) {
  console.error(error)
}

// ----------------------------------------------------------- # Handle listen #

function handleListen() {
  console.log(`Kronos server listening on port ${port}...`)
}
