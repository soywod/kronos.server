import {connect} from './database'

import {on_error, start} from './server'

connect()
  .then(start)
  .catch(on_error)
