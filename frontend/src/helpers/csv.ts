export default function getLocalizedCsvSeparator() {
  const locale = navigator.language.substring(0, 2);
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
