const { expect } = require('chai');
const { toCamelCase } = require('../../app/db/helpers');
const {
  parametrizedInsertInto
} = require('../../app/db/node-postgres/helpers');

describe('db.helpers.toCamelCase()', () => {
  it('should convert snake_case to CamelCase, but leave "_" at the beginning of the string', () => {
    expect(toCamelCase('_hello_world')).to.equal('_helloWorld');
  });

  it('should convert snake_case to CamelCase', () => {
    expect(toCamelCase('hello_world')).to.equal('helloWorld');
  });

  it('should return the same input if cant be converted to CamelCase', () => {
    expect(toCamelCase('helloworld')).to.equal('helloworld');
    expect(toCamelCase('_helloworld')).to.equal('_helloworld');
  });

  it('should return the same string if the input is not in snake_case', () => {
    expect(toCamelCase('helloWorld')).to.equal('helloWorld');
    expect(toCamelCase('HelloWorld')).to.equal('HelloWorld');
    expect(toCamelCase('')).to.equal('');
  });
});

describe('db.node-postgres.helpers.parametrizedInsertInto()', () => {
  it('should return a parametrized insert statement for a given table and fields', () => {
    const result = parametrizedInsertInto('users', [
      'name',
      'email',
      'password'
    ]);
    expect(result).to.equal(
      'INSERT INTO users("name","email","password") VALUES($1,$2,$3)'
    );
  });
  it('should handle empty fields array', () => {
    const result = parametrizedInsertInto('users', []);
    expect(result).to.equal('');
  });
  it('should handle single field', () => {
    const result = parametrizedInsertInto('users', ['name']);
    expect(result).to.equal(`INSERT INTO users("name") VALUES($1)`);
  });
});
