const rdb = require("rethinkdb")

const {start, on_error} = require("./server")

rdb
  .connect({host: "rethinkdb", db: "kronos"})
  .then(start)
  .catch(on_error)
