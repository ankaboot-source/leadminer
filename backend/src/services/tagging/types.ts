export const MESSAGING_FIELDS = [
  'to',
  'from',
  'cc',
  'bcc',
  'reply-to',
  'reply_to',
  'list-post'
] as const;

type MessagingField = typeof MESSAGING_FIELDS[number];
//
export type DomainType = 'provider' | 'custom';

type EmailMessageTag = 'transactional' | 'newsletter' | 'group' | 'linkedin';
type EmailAddressTag =
  | 'no-reply'
  | 'newsletter'
  | 'professional'
  | 'personal'
  | 'transactional';
type ContactTag = EmailMessageTag | EmailAddressTag;

type TagSource = 'refined';

export interface TaggingStratetgy {
  readonly tags: Tag[];

  extractTags({
    header,
    body,
    emailAddress,
    emaildomainType,
    emailFoundIn
  }: any): any;
}

export interface EmailMessageContent {
  header: any;
  body?: string;
  emailAddress?: string;
  emailDomainType?: string;
  emailFoundIn?: MessagingField;
}

export interface Tag {
  name: ContactTag;
  reachable: number;
  source?: TagSource;
  rules: TaggingCondition[];
}

export interface TaggingCondition {
  checkCondition(emailMessageContent: EmailMessageContent): boolean;
}
