import groupEmailMessage from './group';
import linkedinEmailMessage from './linkedin';
import newsletterEmailMessage from './newsletter';
import transactionalEmailMessage from './transactional';
import { EmailMessageTagExtractor } from './types';

const messageTaggingRules: EmailMessageTagExtractor[] = [
  linkedinEmailMessage,
  newsletterEmailMessage,
  groupEmailMessage,
  transactionalEmailMessage // Always keep transactional as the last rule to check
];

export default messageTaggingRules;
