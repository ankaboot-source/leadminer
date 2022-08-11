/**
 * parseDate takes a date string, replaces the timezone with a fixed timezone, creates a date object from the
 * string, and returns the date in ISO format
 * @param date - The date string to be parsed.
 * @returns A string with the date and time in ISO format.
 */
function parseDate(date) {
  const tempDate = date
    .replaceAll(/ CEST-(.*)| CEST/g, '+0200')
    .replace(/ UTC-(.*)/i, '');
  const dateFromString = new Date(tempDate);
  /* istanbul ignore else */
  if (isNaN(Date.parse(dateFromString)) == false) {
    const ISODate = dateFromString.toISOString();
    return `${ISODate.substring(0, 10)} ${ISODate.substring(11, 16)}`;
  }
}

/**
 * compareDates() takes two dates as arguments and returns true if the first date is greater than the second date
 * @param date1 - The first date to compare.
 * @param date2 - The date to compare to.
 * @returns a boolean value.
 */
function compareDates(date1, date2) {
  const d1 = Date.parse(date1);
  const d2 = Date.parse(date2);
  return d1 > d2;
}

module.exports = {
  compareDates,
  parseDate,
};
