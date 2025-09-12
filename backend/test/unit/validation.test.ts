import { expect, test} from '@jest/globals';
import validateType from '../../src/utils/helpers/validation';


/* TESTING EMPTY VALUE */
test('null/undefined value triggers error', () => {
    expect(validateType('port', null, 'number')).toEqual('port is required.');
});


/* TESTING NUMBER VALIDATION */
test('accepts a positive number properly', () => {
    expect(validateType('port', 8808, 'number')).toBeNull();
});

test('rejects a negative number', () => {
    expect(validateType('port', -1, 'number')).toEqual('port must be a valid positive number.');
});

test('rejects 0', () => {
    expect(validateType('port', 0, 'number')).toEqual('port must be a valid positive number.');
});

test('rejects a value that is not a number', () => {
    expect(validateType('port', 'error', 'number')).toEqual('port must be a valid positive number.');
});


/* TESTING BOOLEAN VALIDATION */
test('accepts a true boolean properly', () => {
    expect(validateType('secure', true, 'boolean')).toBeNull();
});

test('accepts a false boolean properly', () => {
    expect(validateType('secure', false, 'boolean')).toBeNull();
});

test('rejects nonboolean values', () => {
    expect(validateType('secure', 'error', 'boolean')).toEqual('secure must be true or false.');
});


/* TESTING STRING[] VALIDATION */
test('accepts a string[] properly', () => {
    expect(validateType('email', ['t','e','s','t','@','e','m','a','i','l','.','c','o','m'], 'string[]')).toBeNull();
});

test('rejects a nonstring array value', () => {
    expect(validateType('email', [1, 2, 3], 'string[]')).toEqual('email must be an array of non-empty strings.');
});


/* TESTING STRING VALIDATION */
test('accepts a string properly', () => {
    expect(validateType('email', 'test@email.com', 'string')).toBeNull();
});

test('rejects a nonstring value', () => {
    expect(validateType('email', [1, 2, 3], 'string')).toEqual('email must be a non-empty string.');
});