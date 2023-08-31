const headerRegexName = /(?<name>^(?:[^<]{1,300}))?/;
const headerRegexAddress =
  /(\s|^)<?(?<address>(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}))>?$/;
const headerRegexEmailSplitPattern = /,\s?(?=(?:[^"]*"[^"]*")*[^"]*$)/g;

const bodyRegex =
  /(?<=<|\s|^|"mailto:)(?<address>(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18})(?=$|\s|>|"))/gi;
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
export const REDIS_EMAIL_VERIFICATION_QUEUE = 'email-verification-queue';
export const MAX_WORKER_TIMEOUT = 600000;
export const MX_RESOLVER_TIMEOUT_MS = 3000;
export const REGEX_HEADER_EMAIL_SPLIT_PATTERN = headerRegexEmailSplitPattern;
export const REGEX_HEADER = headerRegex;
export const REGEX_BODY = bodyRegex;
export const REGEX_LIST_ID = listRegex;
export const REGEX_CLEAN_NAME_FROM_UNWANTED_WORDS =
  /\s(\(?(via\s?.{1,20}?)|\((Google|Drive)\s?.{0,20}\))$/i;
export const REGEX_REMOVE_QUOTES = /^(['"])(?<name>.*)\1$/;
export const EXCLUDED_IMAP_FOLDERS = ['[Gmail]', '[Mailspring]'];

// Tagging

export enum REACHABILITY {
  DIRECT_PERSON = 1,
  MANY_OR_INDIRECT_PERSON = 2,
  UNSURE = 3,
  NONE = 0
}

export const CHAT_EMAIL_ADDRESS_INCLUDES = [
  '@reply.airbnb.com',
  '@reply.linkedin.com',
  '@messagerie.leboncoin.fr',
  '@mail.2dehands.beto',
  '@reply.facebook.com'
];
export const NEWSLETTER_EMAIL_ADDRESS_INCLUDES = [
  '@campaigns.',
  'newsletter@',
  '@newsletter',
  'newsletters@',
  '@newsletters',
  '@substack.io'
]; // add newletter domains;
export const GROUP_EMAIL_ADDRESS_INCLUDES = [
  '@lists.',
  '@listes.',
  '@sympa.',
  '@gaggle.email',
  '@groups.io',
  '@framalistes.org',
  '@groups.google.com',
  '@yahoogroupes.fr',
  '@googlegroups.fr',
  '@list.attac.org'
];
export const TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES = [
  'reply.github',
  '@boards.trello.com',
  'bot@',
  'bounce@',
  'unsub-',
  'unsubscribe',
  'unsubscribe-',
  '@bnc3.mailjet.com',
  '@group.calendar.google.com',
  'wordpress@',
  'receipts+',
  'updates@',
  'confirmation-commande@amazon.fr',
  'transaction@notice.aliexpress.com',
  'order-update@amazon.',
  'shipment-tracking@amazon.',
  'payments-update@amazon.',
  'primenow-reply@amazon.',
  'confirmation@',
  'ship-confirm@',
  'order_confirm@',
  'commandes@',
  'commande@',
  'orders@',
  'replies@',
  'infos.fr@',
  'postmaster@',
  'feedback@',
  'mail@',
  'connect@',
  'livraison@'
];
export const NOREPLY_EMAIL_ADDRESS_INCLUDES = [
  'accusereception',
  'alert',
  'auto-confirm',
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
  'notreply',
  'donotreply',
  'do-notreply',
  'do-not-reply',
  'do_not_reply',
  'notification',
  'notifications',
  'notifications-noreply',
  'notify',
  'pasdereponse',
  'password',
  'reply-',
  'send-as-noreply',
  'systemalert',
  'no-response'
];
export const ROLE_EMAIL_ADDRESS_INCLUDES = [
  '@info.',
  'information@',
  'info@',
  'infos@',
  'hello@',
  'welcome@',
  'contact@',
  'news@',
  'sales@',
  'bonjour@',
  'greetings@',
  'spam@',
  'abuse@',
  'all@',
  'admin@',
  'root@',
  'account@',
  'boutique@',
  'recrutement@',
  'team@',
  'communication@',
  'hr@',
  'marketing@',
  'carreer@',
  'formation@',
  'bienvenue@',
  'marketing@',
  'hey@',
  'support-',
  'support@',
  '@support.',
  '@support',
  '.zendesk.com',
  '.intercom-mail.com',
  'help@',
  'customercare@',
  'community@',
  'web@',
  'service-client@',
  'serviceclient@',
  'windows@',
  'commercial@',
  'customer.service@',
  'developpement@',
  'webmaster@'
];
