const { groupEmailMessage } = require('./group');
const { newsletterEmailMessage } = require('./newsletter');
const { transactionalEmailMessage } = require('./transactional');

const messageTaggingRules = [
  transactionalEmailMessage,
  newsletterEmailMessage,
  groupEmailMessage
];

module.exports = {
  messageTaggingRules
};
