# Kronos.server

A realtime server for [Kronos protocol](https://github.com/kronos-io/kronos).

## TODO

  - [ ] Rewrite all in TypeScript
    - [X] database.js
    - [ ] device.js
    - [X] index.js
    - [X] server.js
    - [ ] session.js
    - [ ] task.js
    - [X] tcp.js
    - [ ] user.js
    - [ ] ws.js
  - [ ] Split everything as much as possible (KISS & DRY)
  - [ ] Refactor to respect the [Kronos protocol](https://github.com/kronos-io/kronos)

## Table of contents

  * [Connect](#connect)
  * [Request](#request)
    * [Login](#login)
      * [Input](#input)
      * [Output](#output)
    * [Read all](#read-all)
      * [Input](#input-1)
      * [Output](#output-1)
    * [Write all](#write-all)
      * [Input](#input-2)
      * [Output](#output-2)
    * [Create](#create)
      * [Input](#input-3)
      * [Output](#output-3)
    * [Update](#update)
      * [Input](#input-4)
      * [Output](#output-4)
    * [Delete](#delete)
      * [Input](#input-5)
      * [Output](#output-5)
    * [Error](#error)
  * [Database event](#database-event)
    * [Create](#create-1)
    * [Update](#update-1)
    * [Delete](#delete-1)

## Connect

Kronos.server is a realtime server that handles basic socket and web socket
requests. Here some exemples in different languages on how to open a
socket connection:

| Language | Code | Link
| --- | --- | --- |
| JavaScript (Node.js) | `socket.connect(port[, host][, connectListener])` | [https://nodejs.org](https://nodejs.org/api/net.html#net_socket_connect_port_host_connectlistener)
| JavaScript (Browser) | `new WebSocket(url[, protocols])` | [https://developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
| Vim8+ | `ch_open({address} [, {options}])` | [http://vimhelp.appspot.com](http://vimhelp.appspot.com/channel.txt.html#channel-open)
| Neovim | `sockconnect({mode}, {address}, {opts})` | [https://neovim.io/](https://neovim.io/doc/user/eval.html#sockconnect())
| C | `int socket(int domain, int type, int protocol);` | [http://man7.org](http://man7.org/linux/man-pages/man2/socket.2.html)

## Request

Once connected, the client can send requests. A request is a simple stringified
JSON.

### Login

Authenticates a user.

#### Input

```typescript
interface Login {
  type: 'login'
  user_id?: string    // If omitted, auto-generated
  device_id?: string  // If omitted, auto-generated
}
```

#### Output

```typescript
interface Login {
  success: boolean
  type: 'login'
  user_id: string
  device_id: string
  version: string
}
```

### Read all

Reads the server database.

#### Input

```typescript
interface ReadAll {
  type: 'read-all'
  user_id: string
  device_id: string
}
```

#### Output

```typescript
interface ReadAll {
  success: boolean
  type: 'read-all'
  tasks: Task[] // (1)
}
```
(1) [Task](https://github.com/kronos-io/kronos#task)

### Write all

Writes the entire client locale database to the server database.

#### Input

```typescript
interface WriteAll {
  success: boolean
  type: 'write-all'
  data: Database // (1)
  user_id: string
  device_id: string
}
```
(1) [Database](https://github.com/kronos-io/kronos#database)

#### Output

No output generated.

### Create

Adds a new task into the database. Triggers a [notification](#create-1).

#### Input

```typescript
interface Create {
  type: 'create'
  task: Task // (1)
  user_id: string
  device_id: string
}
```
(1) [Task](https://github.com/kronos-io/kronos#task)

#### Output

No output generated.

### Update

#### Input

Updates a task from database. Triggers a [notification](#update-1).

```typescript
interface Update {
  type: 'update'
  task: Task // (1)
  user_id: string
  device_id: string
}
```
(1) [Task](https://github.com/kronos-io/kronos#task)

#### Output

No output generated.

### Delete

#### Input

Deletes a task from database. Triggers a [notification](#delete-1).

```typescript
interface Delete {
  type: 'delete'
  task_id: number
  user_id: string
  device_id: string
}
```

#### Output

No output generated.

### Error

When an error occurres, the server sends a special stringified JSON request:

```typescript
interface Error {
  success: false
  error: string
}
```

## Database event

Kronos server uses a realtime database called
[RethinkDB](https://www.rethinkdb.com/). When a task is created / updated /
deleted, a notification is sent to all connected user's devices.

### Create

```typescript
interface Create {
  type: 'create'
  task: Task // (1)
  device_id: string
  version: string
}
```
(1) [Task](https://github.com/kronos-io/kronos#task)

### Update

```typescript
interface Update {
  type: 'update'
  task: Task // (1)
  device_id: string
  version: string
}
```
(1) [Task](https://github.com/kronos-io/kronos#task)

### Delete

```typescript
interface Delete {
  type: 'delete'
  task_id: number
  device_id: string
  version: string
}
```
