const headerRegexName = /(?<name>^(?:[^<]{1,50}))?/;
const headerRegexAddress =
  /(\s|^)<?(?<address>(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}))>?/;
const headerRegexEmailSplitPattern = /(?<=\S+@\S+\.\S+),\s/g;
const bodyRegex =
  /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18})(?=$|\s|>|")/gi;
const listRegex = /<[^<]{1,255}>$/;

// eslint-disable-next-line
const headerRegex = new RegExp(
  headerRegexName.source + headerRegexAddress.source,
  'iu'
);

export const FLICKR_BASE_58_CHARSET =
  '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
export const MAX_REDIS_PUBLISH_RETRIES_COUNT = 3;
export const REDIS_PUBSUB_COMMUNICATION_CHANNEL = 'stream-management';
export const REDIS_STREAMS_CONSUMER_GROUP = 'imap-consumers-group';
export const MAX_WORKER_TIMEOUT = 600000;
export const MX_RESOLVER_TIMEOUT_MS = 3000;
export const REGEX_HEADER_EMAIL_SPLIT_PATTERN = headerRegexEmailSplitPattern;
export const REGEX_HEADER = headerRegex;
export const REGEX_BODY = bodyRegex;
export const REGEX_LIST_ID = listRegex;
export const REGEX_REMOVE_QUOTES = /^(['"])(?<name>.*)\1$/;
export const NEWSLETTER_EMAIL_ADDRESS_INCLUDES = ['newsletter'];
export const TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES = ['reply.github'];
export const NOREPLY_EMAIL_ADDRESS_INCLUDES = [
  'accusereception',
  'alert',
  'auto-confirm',
  'donotreply',
  'do-notreply',
  'do-not-reply',
  'feedbackform',
  'maildaemon',
  'mailer-daemon',
  'mailermasters',
  'ne_pas_repondre',
  'nepasrepondre',
  'ne-pas-repondre',
  'no.reply',
  'no_reply',
  'noreply',
  'no-reply',
  'notification',
  'notifications',
  'notifications-noreply',
  'notify',
  'pasdereponse',
  'password',
  'reply-',
  'send-as-noreply',
  'support',
  'systemalert',
  'unsubscribe',
  'no-response'
];
export const EXCLUDED_IMAP_FOLDERS = ['[Gmail]', '[Mailspring]'];
