export function getLocalizedCsvSeparator() {
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

/**
 * Decodes a string with HTML entities to its corresponding characters.
 *
 * @param {string} text - The string to decode.
 * @returns {string} The decoded string.
 */
export function decodeHTMLEntities(text) {
  var textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  return textArea.value;
}
