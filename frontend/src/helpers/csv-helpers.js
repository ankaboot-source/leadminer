export function getLocalizedCsvSeparator() {
  const locale = navigator.languages[2].substring(0, 2);
  switch (locale) {
    case "fr":
    case "de":
    case "es":
    case "pt":
    case "it":
      return ";";
    default:
      return ",";
  }
}
