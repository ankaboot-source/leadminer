function errorHandler(err, _, res, _next) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  const response = {
    message: err.message,
    statusCode
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  return res.status(statusCode).send(response);
}

module.exports = {
  errorHandler
};
