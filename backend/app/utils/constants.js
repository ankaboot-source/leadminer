const headerRegexName = /(?<name>[\p{L}\w\s'"@.]{1,100})?/;
const headerRegexAddress = /<{1}(?<address>(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?))>{1}/;
const bodyRegex = /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>|")/gi;
const listRegex = /<[^<]{1,255}>$/;


const RE = RegExp;
// Used to get around this warning:  Found non-literal argument to RegExp Constructor security/detect-non-literal-regexp.
// As we have to break headerRegex into smaller parts because the line will be too long and raise eslint error.
const headerRegex = new RE(headerRegexName.source + headerRegexAddress.source, 'giu');

module.exports = {
  MAX_REDIS_PUBLISH_RETRIES_COUNT: 3,
  REDIS_STREAM_NAME: 'imap-messages',
  REDIS_CONSUMER_GROUP_NAME: 'imap-group',
  MAX_WORKER_TIMEOUT: 600000,
  REGEX_HEADER: headerRegex, // Regex to extract emails from header fields (FROM, TO, CC, BCC)
  REGEX_BODY: bodyRegex, //  Regex to extract emails from body
  REGEX_LIST_ID: listRegex, // Extracts id from header field list-id
  EMAIL_HEADERS_NOREPLY: [
    'accusereception',
    'alerts',
    'alert',
    'auto-confirm',
    'donotreply',
    'do-notreply',
    'do-not-reply',
    'FeedbackForm',
    'mail daemon',
    'maildaemon',
    'mailer daemon',
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
  EMAIL_HEADERS_NEWSLETTER: ['list-unsubscribe', 'list-id,list'],
  EMAIL_HEADERS_TRANSACTIONAL: [
    'feedback-id',
    'x-feedback-id',
    'x-mandrill-user',
    'x-mailer: mailchimp *',
    'X-LinkedIn-*',
    'x-mailer: ec-messenger*',
    'x-mailer: nlserver *',
    'x-marketoid',
    'x-campaignid',
    'x-Mailgun*',
    'x-job'
  ],
  EMAIL_HEADERS_MAILING_LIST: ['list-post'],
  EXCLUDED_IMAP_FOLDERS: ['[Gmail]']
};
