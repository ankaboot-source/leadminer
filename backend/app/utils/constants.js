
const headerRegex = /(?<=<|\s|^)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>)/;
const bodyRegex = /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>|")/gi;
const listRegex = /<.*>/g

module.exports = {
  REDIS_MESSAGES_CHANNEL: 'messages-channel',
  MAX_WORKER_TIMEOUT: 600000,
  REGEX_HEADER: headerRegex, // Regex to extract emails from header fields (FROM, TO, CC, BCC)
  REGEX_BODY: bodyRegex, //  Regex to extract emails from body
  REGEX_LIST_ID: listRegex  // Extracts id from header field list-id
};
