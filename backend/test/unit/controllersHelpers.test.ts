import { describe, expect, it, jest } from '@jest/globals';
import { getUser, getXImapHeaderField } from '../../src/controllers/helpers';
import InMemoryImapUsers from '../fakes/db/InMemoryImapUsers';
import InMemoryOAuthUsers from '../fakes/db/InMemoryOAuthUsers';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

describe('controllers.helpers.getXImapHeaderField', () => {
  it('should return an error if the x-imap-credentials header is missing', () => {
    const headers = {};
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe(
      'An x-imap-credentials header field is required.'
    );
  });

  it('should return an error if the x-imap-credentials header is not in correct JSON format', () => {
    const headers = { 'x-imap-credentials': 'invalid json' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe(
      'x-imap-credentials header field is not in correct JSON format'
    );
  });

  it('should return an error if the x-imap-credentials header is missing required fields', () => {
    const headers = { 'x-imap-credentials': '{"id": "123"}' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe(
      'x-imap-credentials header is missing required field. Check (host, email, password) OR (access_token)'
    );
  });

  it('should return data when passing (email, host, password) to x-imap-credentials', () => {
    const headers = {
      'x-imap-credentials':
        '{"email": "test@gmail.com","host": "123","password":"testing"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(error).toBeNull();
    expect(data).toEqual({
      email: 'test@gmail.com',
      host: '123',
      password: 'testing'
    });
  });

  it('should return data when passing (access_token) to x-imap-credentials', () => {
    const headers = {
      'x-imap-credentials': '{"access_token": "test@gmail.com"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(error).toBeNull();
    expect(data).toEqual({
      access_token: 'test@gmail.com'
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
