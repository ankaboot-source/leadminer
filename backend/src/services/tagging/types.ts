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

export interface Tag {
  name: ContactTag;
  reachable: number;
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
export type EmailAddressTag = 'no-reply' | 'newsletter';
export type ContactTag = EmailMessageTag | EmailAddressTag;

export interface EmailMessageTagExtractor {
  tag: Tag;
  requiredConditions?: TaggingCondition[];
  /**
   * If any of the following rules is true, this tag applies to contacts extracted from the given fields.
   */
  rulesToCheck: TaggingRule[];
}
