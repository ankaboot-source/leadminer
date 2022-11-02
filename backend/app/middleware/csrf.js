const csrf = require('csurf');

const csrfProtection = csrf({ cookie: true });

function csrfHandler(req, res, next) {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  res.locals._csrf = req.csrfToken();
  next();
}

module.exports = {
  csrfProtection,
  csrfHandler
};
