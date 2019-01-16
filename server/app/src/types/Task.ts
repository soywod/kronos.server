interface Task {
  index: string
  id: number
  desc: string
  tags: string[]
  active: boolean
  start: number[]
  stop: number[]
  due: number
  done: number
}

export {Task}
