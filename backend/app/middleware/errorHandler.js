function errorHandler(err, _, res, _next) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  const response = {
    data: null,
    error: {
      message: err.message
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.message = err;
  }
  return res.status(code).send(response);
}

module.exports = {
  errorHandler
};
