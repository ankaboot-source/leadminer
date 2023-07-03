import { describe, expect, it, jest } from '@jest/globals';
import { getUser } from '../../src/controllers/helpers';
import InMemoryImapUsers from '../fakes/db/InMemoryImapUsers';
import InMemoryOAuthUsers from '../fakes/db/InMemoryOAuthUsers';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

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
