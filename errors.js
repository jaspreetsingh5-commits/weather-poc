class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isHttpError(err) {
  return err instanceof HttpError;
}

module.exports = { HttpError, isHttpError };
