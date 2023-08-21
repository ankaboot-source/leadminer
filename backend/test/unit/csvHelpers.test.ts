import { describe, expect, it } from '@jest/globals';
import {
  getLocalizedCsvSeparator,
  getCsvStr
} from '../../src/utils/helpers/csv';

describe('getLocalizedCsvSeparator', () => {
  it('should return ; for supported languages', () => {
    expect(getLocalizedCsvSeparator('fr-FR')).toBe(';');
    expect(getLocalizedCsvSeparator('de-DE')).toBe(';');
    expect(getLocalizedCsvSeparator('es-ES')).toBe(';');
    expect(getLocalizedCsvSeparator('pt-PT')).toBe(';');
    expect(getLocalizedCsvSeparator('it-IT')).toBe(';');
  });

  it('should return , for unsupported languages', () => {
    expect(getLocalizedCsvSeparator('en-US')).toBe(',');
    expect(getLocalizedCsvSeparator('ja-JP')).toBe(',');
  });

  it('should return default when string is empty', () => {
    expect(getLocalizedCsvSeparator('')).toBe(',');
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
