/**
 * compareDates() takes two dates as arguments and returns true if the first date is greater than the second date
 * @param date1 - The first date to compare.
 * @param date2 - The date to compare to.
 * @returns a boolean value.
 */
function compareDates(date1, date2) {
  const d1 = Date.parse(date1),
    d2 = Date.parse(date2);

  return d1 > d2;
}

module.exports = {
  compareDates
};
