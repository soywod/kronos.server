// -------------------------------------------------------------- # Public API #

function parse(data) {
  try {
    const payload = JSON.parse(data.payload)

    return {
      ...payload,
      task: payload.task || {},
      tasks: payload.tasks || [],
      version: payload.version || Date.now(),
      task_id: payload.task_id || 0,
      user_id: payload.user_id || "",
      device_id: payload.device_id || "",
    }
  } catch (e) {
    console.warn(e, data)
    return null
  }
}

function format(output) {
  try {
    return JSON.stringify(output) + '\n'
  } catch (e) {
    return ''
  }
}

module.exports = {
  parse,
  format,
}

// ------------------------------------------------------------- # Private API #
