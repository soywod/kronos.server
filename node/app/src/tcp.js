// -------------------------------------------------------------- # Public API #

function parse(raw_input) {
  try {
    const data = JSON.parse(raw_input)

    return {
      ...data,
      task: data.task || {},
      tasks: data.tasks || [],
      version: data.version || Date.now(),
      task_id: data.task_id || 0,
      user_id: data.user_id || "",
      device_id: data.device_id || "",
    }
  } catch (e) {
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
