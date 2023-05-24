import { describe, expect, it } from '@jest/globals';
import { getXImapHeaderField } from '../../src/controllers/helpers';

describe('controllers.helpers.getXImapHeaderField', () => {
  it('should return an error if the x-imap-login header is missing', () => {
    const headers = {};
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('An x-imap-login header field is required.');
  });

  it('should return an error if the x-imap-login header is not in correct JSON format', () => {
    const headers = { 'x-imap-login': 'invalid json' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'x-imap-login header field is not in correct JSON format'
    );
  });

  it('should return an error if the x-imap-login header is missing required fields', () => {
    const headers = { 'x-imap-login': '{"id": "123"}' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'x-imap-login header field is missing required fields (email, id)'
    );
  });
  it('should return an error if the x-imap-login header is missing the access_token or password field', () => {
    const headers = {
      'x-imap-login': '{"email": "test@gmail.com","id": "123"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'x-imap-login header field is missing the access_token or password field'
    );
  });
  it('should return data if the x-imap-login header is valid', () => {
    const headers = {
      'x-imap-login':
        '{"email": "test@gmail.com","id": "123","access_token":"access_token"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(error).toBeNull();
    expect(data).toEqual({
      email: 'test@gmail.com',
      id: '123',
      access_token: 'access_token'
    });
  });
});

// describe('controllers.helpers.getUser', () => {
//   it('throws an error if no parameters are passed', () => {
//     const message =
//       'At least one parameter is required { access_token, id, email }.';
//     expect(() => getUser({}, {}, {})).toThrowError(new Error(message));
//   });

//   it('returns a Google user by email', async () => {
//     const user = await getUser(
//       { access_token: 'google', email: 'googleuser@example.com' },
//       db
//     );
//     expect(user).toEqual({
//       id: 1,
//       email: 'googleuser@example.com',
//       name: 'Google User'
//     });
//   });

//   it('returns an IMAP user by ID', async () => {
//     const user = await getUser({ id: 2 }, db);
//     expect(user).toEqual({
//       id: 2,
//       email: 'imapuser@example.com',
//       name: 'IMAP User'
//     });
//   });

//   it('returns an IMAP user by email if no access token or ID is provided', async () => {
//     const user = await getUser({ email: 'imapuser@example.com' }, db);
//     expect(user).toEqual({
//       id: 3,
//       email: 'imapuser@example.com',
//       name: 'IMAP User'
//     });
//   });
// });
