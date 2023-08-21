import { stringify } from 'csv-stringify';

export function getLocalizedCsvSeparator(locale: string) {
  const language = locale.substring(0, 2);

  switch (language) {
    case 'fr':
    case 'de':
    case 'es':
    case 'pt':
    case 'it':
      return ';';
    default:
      return ',';
  }
}

export function getCsvStr<T>(
  columns: { key: keyof T; header: string }[],
  rows: T[],
  delimiter: string
) {
  return new Promise<string>((resolve, reject) => {
    stringify(
      rows,
      {
        columns: columns.map(({ key, header }) => ({
          key: String(key),
          header
        })),
        bom: true,
        delimiter,
        header: true,
        quoted_string: true
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
