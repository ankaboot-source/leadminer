import {
  groupEmailMessage,
  chatEmailMessage,
  newsletterEmailMessage,
  transactionalEmailMessage
} from './tags';
import { Tag } from './types';
import EmailMessageTagging from './engines/EmailMessageEngine';

const tags: Tag[] = [
  chatEmailMessage,
  newsletterEmailMessage,
  groupEmailMessage,
  transactionalEmailMessage // Always keep transactional as the last rule to check
];

const EmailTaggingEngine = new EmailMessageTagging(tags);

export default EmailTaggingEngine;
