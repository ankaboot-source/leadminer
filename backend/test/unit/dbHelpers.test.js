const { toCamelCase } = require('../../app/db/helpers');
const { expect } = require('chai');

describe('toCamelCase', () => {
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