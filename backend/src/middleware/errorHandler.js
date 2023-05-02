export default function errorHandler(err, _, res, next) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
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
  res.status(code).send(response);
  next(err);
}
