function notFound(req, res, next) {
  res.status(404);
  const error = new Error(
    `The endpoint you are trying to reach (${req.originalUrl}) does not exist.`
  );
  next(error);
}

module.exports = {
  notFound
};
