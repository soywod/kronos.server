import {connect} from 'rethinkdb'

const {start, on_error} = require('./server')

const params = {
  db: 'kronos',
  host: 'rethinkdb',
}

connect(params)
  .then(start)
  .catch(on_error)
