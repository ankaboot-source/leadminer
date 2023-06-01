import { describe, expect, it, jest } from '@jest/globals';
import { getUser, getXImapHeaderField } from '../../src/controllers/helpers';
import InMemoryImapUsers from '../fakes/db/InMemoryImapUsers';
import InMemoryOAuthUsers from '../fakes/db/InMemoryOAuthUsers';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

describe('controllers.helpers.getXImapHeaderField', () => {
  it('should return an error if the x-imap-login header is missing', () => {
    const headers = {};
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe('An x-imap-login header field is required.');
  });

  it('should return an error if the x-imap-login header is not in correct JSON format', () => {
    const headers = { 'x-imap-login': 'invalid json' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe(
      'x-imap-login header field is not in correct JSON format'
    );
  });

  it('should return an error if the x-imap-login header is missing required fields', () => {
    const headers = { 'x-imap-login': '{"id": "123"}' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe(
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
    expect(error!.message).toBe(
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

describe('controllers.helpers.getUser', () => {
  it('throws an error if no parameters are passed', () => {
    const fakeImapUsers = new InMemoryImapUsers();
    const fakeOAuthUsers = new InMemoryOAuthUsers();
    const message =
      'At least one parameter is required { access_token, id, email }.';

    expect(() => getUser({}, fakeImapUsers, fakeOAuthUsers)).toThrowError(
      new Error(message)
    );
  });

  it('returns a Google user by email', async () => {
    const fakeImapUsers = new InMemoryImapUsers();
    const fakeOAuthUsers = new InMemoryOAuthUsers();
    fakeOAuthUsers.create({
      email: 'googleuser@example.com',
      refreshToken: 'refreshToken'
    });

    const user = await getUser(
      { access_token: 'google', email: 'googleuser@example.com' },
      fakeImapUsers,
      fakeOAuthUsers
    );

    expect(user).toEqual({
      id: '0',
      email: 'googleuser@example.com',
      refresh_token: 'refreshToken'
    });
  });

  it('returns an IMAP user by ID', async () => {
    const fakeImapUsers = new InMemoryImapUsers();
    const fakeOAuthUsers = new InMemoryOAuthUsers();
    fakeImapUsers.create({
      email: 'imapuser@example.com',
      host: 'host',
      port: 993,
      tls: true
    });
    const user = await getUser({ id: '0' }, fakeImapUsers, fakeOAuthUsers);

    expect(user).toEqual({
      id: '0',
      email: 'imapuser@example.com',
      host: 'host',
      port: 993,
      tls: true
    });
  });

  it('returns an IMAP user by email if no access token or ID is provided', async () => {
    const fakeImapUsers = new InMemoryImapUsers();
    const fakeOAuthUsers = new InMemoryOAuthUsers();
    fakeImapUsers.create({
      email: 'imapuser@example.com',
      host: 'host',
      port: 993,
      tls: true
    });

    const user = await getUser(
      { email: 'imapuser@example.com' },
      fakeImapUsers,
      fakeOAuthUsers
    );

    expect(user).toEqual({
      id: '0',
      email: 'imapuser@example.com',
      host: 'host',
      port: 993,
      tls: true
    });
  });
});

// });
