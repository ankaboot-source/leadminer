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

/**
 * Checks if a particular header field has a value from a given list of possible values
 * @param header - Header object.
 * @param headerField - A header key.
 * @param headerValues - A list of possible header values.
 * @returns
 */
export function hasHeaderWithValue(
  header: any,
  headerField: string,
  headerValues: string[]
) {
  const headerValue = getSpecificHeader(header, [headerField]);
  return (
    headerValue &&
    headerValues.some((value) =>
      headerValue[0].toLocaleLowerCase().includes(value)
    )
  );
}

/**
 * Checks if a particular header field starts with one of the prefixes
 * @param header - Header object.
 * @param prefixes - A list of possible header key prefixes.
 * @returns
 */
export function hasHeaderFieldStartsWith(header: any, prefixes: string[]) {
  const headerFields = Object.keys(header);
  return headerFields.some((field) =>
    prefixes.some((prefix) => field.toLowerCase().startsWith(prefix))
  );
}

/**
 * Gets the message ID from a parsed IMAP header. If the header does not contain a message ID,
 * a generated ID will be returned.
 *
 * @param parsedHeader - The parsed header object.
 * @returns The message ID.
 */
export function getMessageId(parsedHeader: any) {
  const [messageId] = parsedHeader['message-id'] || [];
  if (messageId) {
    return messageId;
  }
  // We generate a pseudo message-id with the format
  // date@return_path_domain
  const { date: [date] = '', 'return-path': [returnPath] = [] } = parsedHeader;
  const returnPathDomain =
    returnPath?.split('@')[1]?.replace('>', '') || 'NO-RETURN-PATH';
  const unknownId = `UNKNOWN ${Date.parse(date)}@${returnPathDomain}`;
  return unknownId;
}
