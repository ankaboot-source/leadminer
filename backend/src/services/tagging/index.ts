import groupEmailMessage from './group';
import linkedinEmailMessage from './linkedin';
import transactionalEmailMessage from './transactional';
import { EmailMessageTagExtractor } from './types';

const messageTaggingRules: EmailMessageTagExtractor[] = [
  groupEmailMessage,
  linkedinEmailMessage,
  transactionalEmailMessage // Always keep transactional as the last rule to check
];

export default messageTaggingRules;
