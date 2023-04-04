/**
 * Gets the message ID from the parsed header object.
 *
 * @param {Object} parsedHeader - The parsed header object.
 * @returns {string} The message ID.
 */
function getMessageId(parsedHeader) {
    const [messageId] = parsedHeader['message-id'] || [];
    if (messageId) {
        return messageId;
    }
    // We generate a pseudo message-id with the format
    // date@return_path_domain
    const { 'date': [date] = '', 'return-path': [returnPath] = [] } = parsedHeader;
    const returnPathDomain = returnPath?.split('@')[1]?.replace('>', '') || '';
    const unknownId = `UNKNOWN ${Date.parse(date)}@${returnPathDomain}`;
    parsedHeader['message-id'] = [unknownId];
    return unknownId;
}

module.exports = {
    getMessageId
};