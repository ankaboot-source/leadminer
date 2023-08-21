import { describe, expect, it, test } from '@jest/globals';
import {
  getLocalizedCsvSeparator,
  getCsvStr
} from '../../src/utils/helpers/csv';

describe('getLocalizedCsvSeparator', () => {
  test.each([
    ['fr-FR', ';'],
    ['de-DE', ';'],
    ['es-ES', ';'],
    ['pt-PT', ';'],
    ['it-IT', ';'],
    ['en-US', ','],
    ['ja-JP', ',']
  ])('should return ; for language %s', (language, expectedSeparator) => {
    expect(getLocalizedCsvSeparator(language)).toBe(expectedSeparator);
  });

  it('should return default for falsy strings', () => {
    expect(getLocalizedCsvSeparator('')).toBe(',');
    expect(getLocalizedCsvSeparator('test')).toBe(',');
  });
});

describe('getCsvStr', () => {
  it('should generate a CSV string with the specified delimiter', async () => {
    const delimiter = ',';
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 }
    ];
    const csvString = await getCsvStr(
      [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' }
      ],
      rows,
      delimiter
    );

    expect(csvString).toContain('"Name","Age"');
    expect(csvString).toContain('"Alice",30');
    expect(csvString).toContain('"Bob",25');
  });
});
