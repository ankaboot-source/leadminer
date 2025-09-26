/**
 * Gets the message ID from a parsed IMAP header. If the header does not contain a message ID,
 * a generated ID will be returned.
 *
 * @param parsedHeader - The parsed header object.
 * @returns The message ID.
 */
export function getMessageId(parsedHeader: any): string {
  const [messageId] = parsedHeader['message-id'] || [];
  if (messageId) {
    return messageId;
  }
  // We generate a pseudo message-id with the format
  // date@return_path_domain
  const { date: [date] = '', 'return-path': [returnPath] = [] } = parsedHeader;
  const returnPathDomain =
    returnPath?.split('@')[1]?.replace('>', '') ?? 'NO-RETURN-PATH';
  const unknownId = `UNKNOWN ${Date.parse(date)}@${returnPathDomain}`;
  return unknownId;
}

/**
 * Gets the first matching header value from a list of header fields if it exists.
 * @param header - Header object.
 * @param headerFields - A list of possible header fields.
 * @returns Header value or null.
 */
export function getSpecificHeader(header: any, headerFields: string[]) {
  for (const headerField of headerFields) {
    const firstMatch =
      header[`${headerField}`] || header[`${headerField.toLocaleLowerCase()}`];

    if (firstMatch !== undefined) {
      return firstMatch;
    }
  }
  return null;
}
