const { groupEmailMessage } = require('./group');
const { linkedinEmailMessage } = require('./linkedin');
const { newsletterEmailMessage } = require('./newsletter');
const { transactionalEmailMessage } = require('./transactional');

const messageTaggingRules = [
  newsletterEmailMessage,
  groupEmailMessage,
  transactionalEmailMessage,
  linkedinEmailMessage
];

module.exports = {
  messageTaggingRules
};
