export interface EmailMessageContent {
  header: any;
  body?: string;
}

export interface TaggingCondition {
  checkCondition(emailMessageContent: EmailMessageContent): boolean;
}

export interface TaggingRule {
  fields: MessagingField[];
  conditions: TaggingCondition[];
}

export type TagSource =
  | 'refined'
  | 'refined#message_header'
  | 'refined#email_address';
export interface Tag {
  name: ContactTag;
  reachable: number;
  source?: TagSource;
}

export const MESSAGING_FIELDS = [
  'to',
  'from',
  'cc',
  'bcc',
  'reply-to',
  'reply_to',
  'list-post'
] as const;

export type MessagingField = typeof MESSAGING_FIELDS[number];

export type EmailMessageTag =
  | 'transactional'
  | 'newsletter'
  | 'group'
  | 'linkedin';
export type EmailAddressTag =
  | 'no-reply'
  | 'newsletter'
  | 'professional'
  | 'personal'
  | 'transactional'
  | 'role'
  | 'airbnb';

export type ContactTag = EmailMessageTag | EmailAddressTag;

export type DomainType = 'provider' | 'custom';

export interface EmailMessageTagExtractor {
  tag: Tag;
  requiredConditions?: TaggingCondition[];
  /**
   * If any of the following rules is true, this tag applies to contacts extracted from the given fields.
   */
  rulesToCheck: TaggingRule[];
}
