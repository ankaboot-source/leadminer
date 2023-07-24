export function convertToUTC(date: Date) {
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth(); // Note: Months are 0-indexed (0 - January, 11 - December).
  const utcDate = date.getUTCDate();
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const utcSeconds = date.getUTCSeconds();
  const utcMilliseconds = date.getUTCMilliseconds();

  const utcDateObject = new Date(
    Date.UTC(
      utcYear,
      utcMonth,
      utcDate,
      utcHours,
      utcMinutes,
      utcSeconds,
      utcMilliseconds
    )
  );

  return utcDateObject;
}

export function differenceInDays(date1: Date, date2: Date) {
  // Convert both dates to UTC to avoid issues
  const utcDate1 = convertToUTC(date1);
  const utcDate2 = convertToUTC(date2);

  // Calculate the difference in milliseconds
  const differenceInMilliseconds = Math.abs(
    utcDate2.getTime() - utcDate1.getTime()
  );

  // Convert milliseconds to days
  return differenceInMilliseconds / (1000 * 60 * 60 * 24);
}
