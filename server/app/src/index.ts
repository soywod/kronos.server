import {connect} from './database'
import {handleError, handleStart} from './server'

connect()
  .then(handleStart)
  .catch(handleError)
