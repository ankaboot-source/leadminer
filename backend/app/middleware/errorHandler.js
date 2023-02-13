function errorHandler(err, _, res, _next) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;

  return res.status(code).send({
    message: err.message,
    code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  });
}

module.exports = {
  errorHandler
};
