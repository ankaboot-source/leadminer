// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function errorHandler(err, req, res, next) {
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
  return res.status(code).send(response);
}
