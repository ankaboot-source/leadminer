import { describe, expect, it } from '@jest/globals';

import { toCamelCase } from '../../src/db/helpers';
import parametrizedInsertInto from '../../src/db/node-postgres/helpers';

describe('db.helpers.toCamelCase()', () => {
  it('should convert snake_case to CamelCase, but leave "_" at the beginning of the string', () => {
    expect(toCamelCase('_hello_world')).toBe('_helloWorld');
  });

  it('should convert snake_case to CamelCase', () => {
    expect(toCamelCase('hello_world')).toBe('helloWorld');
  });

  it('should return the same input if cant be converted to CamelCase', () => {
    expect(toCamelCase('helloworld')).toBe('helloworld');
    expect(toCamelCase('_helloworld')).toBe('_helloworld');
  });

  it('should return the same string if the input is not in snake_case', () => {
    expect(toCamelCase('helloWorld')).toBe('helloWorld');
    expect(toCamelCase('HelloWorld')).toBe('HelloWorld');
    expect(toCamelCase('')).toBe('');
  });
});

describe('db.node-postgres.helpers.parametrizedInsertInto()', () => {
  it('should return a parametrized insert statement for a given table and fields', () => {
    const result = parametrizedInsertInto('users', [
      'name',
      'email',
      'password'
    ]);
    expect(result).toBe(
      'INSERT INTO users("name","email","password") VALUES($1,$2,$3)'
    );
  });
  it('should handle empty fields array', () => {
    const result = parametrizedInsertInto('users', []);
    expect(result).toBe('');
  });
  it('should handle single field', () => {
    const result = parametrizedInsertInto('users', ['name']);
    expect(result).toBe('INSERT INTO users("name") VALUES($1)');
  });
});
