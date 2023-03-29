const headerRegexName =
  /(?<name>(,\b|\s|^)[\p{L}"'\w\s(),.&:()|-]{1,100})?(?<t>\s|^)/u;
const headerRegexAddress =
  /<?(?<address>(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?))>?,/;
const bodyRegex =
  /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>|")/gi;
const listRegex = /<[^<]{1,255}>$/;

// eslint-disable-next-line
const headerRegex = new RegExp(
  headerRegexName.source + headerRegexAddress.source,
  'giu'
);

module.exports = {
  FLICKR_BASE_58_CHARSET:
    '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', // Defines the character set used in FlickrBase58 encoding.
  MAX_REDIS_PUBLISH_RETRIES_COUNT: 3,
  REDIS_STREAM_NAME: 'imap-messages',
  REDIS_CONSUMER_GROUP_NAME: 'imap-group',
  MAX_WORKER_TIMEOUT: 600000,
  REGEX_HEADER: headerRegex, // Regex to extract emails from header fields (FROM, TO, CC, BCC)
  REGEX_BODY: bodyRegex, //  Regex to extract emails from body
  REGEX_LIST_ID: listRegex, // Extracts id from header field list-id
  REGEX_REMOVE_QUOTES: /^(['"])(?<name>.*)\1$/, // Removes surrounding quotes from input. EX: "name", 'name'
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES: ['newsletter'],
  NOREPLY_EMAIL_ADDRESS_INCLUDES: [
    'accusereception',
    'alerts',
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
    'wordpress'
  ],
  EXCLUDED_IMAP_FOLDERS: ['[Gmail]', '[Mailspring]']
};
