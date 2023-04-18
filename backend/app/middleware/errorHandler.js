function errorHandler(err, _, res, _next) {
  const response = {
    data: null,
    error: {
      message: err.message,
      errors: err.errors
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.message = err;
  }
  return res.status(err.code ?? 500).send(response);
}

module.exports = {
  errorHandler
};
