import groupEmailMessage from './group';
import linkedinEmailMessage from './linkedin';
import newsletterEmailMessage from './newsletter';
import transactionalEmailMessage from './transactional';

const messageTaggingRules = [
  newsletterEmailMessage,
  groupEmailMessage,
  linkedinEmailMessage,
  transactionalEmailMessage // Always keep transactional as the last rule to check
];

export default messageTaggingRules;
