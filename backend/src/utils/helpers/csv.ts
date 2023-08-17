import { stringify } from 'csv-stringify';

export default function getCsvStr<T>(
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
