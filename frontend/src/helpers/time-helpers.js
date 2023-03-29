export function timeConversion(timeInSeconds) {
  if (timeInSeconds >= 3600) {
    return [
      Math.floor(timeInSeconds / 3600),
      "hours",
      Math.round((timeInSeconds % 3600) / 60),
      "minutes",
      Math.round((timeInSeconds % 3600) % 60),
      "seconds",
    ].join(" ");
  } else if (timeInSeconds >= 60) {
    return [
      Math.round((timeInSeconds % 3600) / 60),
      "minutes",
      Math.round((timeInSeconds % 3600) % 60),
      "seconds",
    ].join(" ");
  } else {
    return [Math.round((timeInSeconds % 3600) % 60), "seconds"].join(" ");
  }
}
