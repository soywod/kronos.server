interface Task {
  index: string
  id: number
  desc: string
  tags: string[]
  active: number
  last_active: number
  due: number
  done: number
  worktime: number
}

export default Task
