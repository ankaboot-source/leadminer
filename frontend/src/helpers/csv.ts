import { stringify } from "csv-stringify/browser/esm";

function getLocalizedCsvSeparator() {
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

export function getCsvStr<T>(
  columns: { key: keyof T; header: string }[],
  rows: T[]
) {
  return new Promise<string>((resolve, reject) => {
    stringify(
      rows,
      {
        columns: columns.map(({ key, header }) => ({
          key: String(key),
          header,
        })),
        bom: true,
        delimiter: getLocalizedCsvSeparator(),
        header: true,
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }
    );
  });
}

export function escapedelimiters(
  text: string,
  delimiters: string[] = [";"]
): string {
  if (delimiters.find((d) => text.includes(d))) {
    return `"${text}"`;
  }

  return text;
}
