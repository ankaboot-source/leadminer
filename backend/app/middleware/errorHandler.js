function errorHandler(err, _, res, _next) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  const response = {
    message: err.message,
    code,
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }
  return res.status(code).send(response);
}

module.exports = {
  errorHandler
};
