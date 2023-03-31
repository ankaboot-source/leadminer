const { groupEmailMessage } = require('./group');
const { linkedinEmailMessage } = require('./linkedin');
const { newsletterEmailMessage } = require('./newsletter');
const { transactionalEmailMessage } = require('./transactional');

const messageTaggingRules = [
  newsletterEmailMessage,
  groupEmailMessage,
  linkedinEmailMessage,
  transactionalEmailMessage // Always keep transactional as the last rule to check
];

module.exports = {
  messageTaggingRules
};
