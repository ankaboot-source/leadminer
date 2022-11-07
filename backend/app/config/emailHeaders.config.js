const config = require('config');

const noreplyHeaders =
  process.env.EMAIL_HEADERS_NOREPLY?.split(',') ??
  config.get('email_types.noreply').split(',');

const newsletterHeaders =
  process.env.EMAIL_HEADERS_NEWSLETTER?.split(',') ??
  config.get('email_types.newsletter').split(',');

const transactionalHeaders =
  process.env.EMAIL_HEADERS_TRANSACTIONAL?.split(',') ??
  config.get('email_types.transactional').split(',');

module.exports = {
  noreplyHeaders,
  newsletterHeaders,
  transactionalHeaders
};
