/**
 * Parses a date string in the format specified in the Internet Message Format (RFC 5322)
 * @param {string} date - The date string, should be in the format "day-of-week, dd Mon yyyy hh:mm:ss timezone" or any valid format as per the RFC.
 * @returns {string | null} - The date and time parts of the ISO format string, or null if the date string is not valid.
 */
function parseDate(date) {
 
  const timezoneRegex = /(UTC|CEST)[+-]\d{4}/g;
  const dateWithoutTimezone = date.replace(timezoneRegex, '');

  // Use the Date.parse() method to check if the date string is valid
  if (isNaN(Date.parse(dateWithoutTimezone))) {
    return null;
  }
  const dateFromString = new Date(dateWithoutTimezone);
  const ISODate = dateFromString.toISOString();
  // Return the date and time parts of the ISO format string
  return `${ISODate.substring(0, 10)} ${ISODate.substring(11, 16)}`;
}

module.exports = { parseDate };
