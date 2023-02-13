export function localSeparator() {
  const locale = navigator.languages[2].substring(0, 2);
  let sep;
  switch (locale) {
    case "fr":
    case "de":
    case "es":
    case "pt":
    case "it":
      sep = ";";
      break;
    default:
      sep = ",";
      break;
  }
  return sep;
}
