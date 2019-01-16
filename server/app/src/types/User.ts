interface User {
  id: string
  version: number
}

interface Users {
  [id: string]: User
}

export {User, Users}
