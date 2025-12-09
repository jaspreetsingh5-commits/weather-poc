const SERVICE_NAME = "weather-service-task";

function createLogger(baseFields = {}) {
  const fields = { service: SERVICE_NAME, ...baseFields };

  const emit = (level, message, meta = {}) => {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...fields,
      ...meta
    };
    const line = JSON.stringify(payload);
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    info: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
    child: (extraFields = {}) => createLogger({ ...fields, ...extraFields })
  };
}

const logger = createLogger();

module.exports = { logger, createLogger };
