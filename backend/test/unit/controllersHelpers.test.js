const { expect } = require('chai');
const { getXImapHeaderField, getUser } = require('../../app/controllers/helpers');

describe('controllers.helpers.getXImapHeaderField', () => {
  it('should return an error if the x-imap-login header is missing', () => {
    const headers = {};
    const { data, error } = getXImapHeaderField(headers);
    expect(data).to.be.null;
    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal('An x-imap-login header field is required.');
  });

  it('should return an error if the x-imap-login header is not in correct JSON format', () => {
    const headers = { 'x-imap-login': 'invalid json' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).to.be.null;
    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(
      'x-imap-login header field is not in correct JSON format'
    );
  });

  it('should return an error if the x-imap-login header is missing required fields', () => {
    const headers = { 'x-imap-login': '{"id": "123"}' };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).to.be.null;
    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(
      'x-imap-login header field is missing required fields (email, id)'
    );
  });
  it('should return an error if the x-imap-login header is missing the access_token or password field', () => {
    const headers = {
      'x-imap-login': '{"email": "test@gmail.com","id": "123"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(data).to.be.null;
    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(
      'x-imap-login header field is missing the access_token or password field'
    );
  });
  it('should return data if the x-imap-login header is valid', () => {
    const headers = {
      'x-imap-login':
        '{"email": "test@gmail.com","id": "123","access_token":"access_token"}'
    };
    const { data, error } = getXImapHeaderField(headers);
    expect(error).to.be.null;
    expect(data).to.deep.equal({
      email: 'test@gmail.com',
      id: '123',
      access_token: 'access_token'
    });
  });
});


describe('controllers.helpers.getUser', () => {

  const db = {
    getGoogleUserByEmail: (email) => {
      // Mock implementation for getting a Google user by email
      let result = null

      if (email === 'googleuser@example.com') {
        result = {
          id: 1,
          email: 'googleuser@example.com',
          name: 'Google User',
        };
      }
      return Promise.resolve(result)
    },

    getImapUserById: (id) => {
      // Mock implementation for getting an IMAP user by ID
      let result = null

      if (id === 2) {
        result = {
          id: 2,
          email: 'imapuser@example.com',
          name: 'IMAP User',
        };
      }
      return Promise.resolve(result)
    },

    getImapUserByEmail: (email) => {
      // Mock implementation for getting an IMAP user by email
      let result = null

      if (email === 'imapuser@example.com') {
        result = {
          id: 3,
          email: 'imapuser@example.com',
          name: 'IMAP User',
        };
      }
      return Promise.resolve(result)
    },
  }

  it('throws an error if no parameters are passed', () => {
    const message = 'At least one parameter is required { access_token, id, email }.'
    expect(
      () => getUser({}, db)).to.throw(message);
  });

  it('returns a Google user by email', async () => {
    const user = await getUser({ access_token: 'google', email: 'googleuser@example.com' }, db);
    expect(user).to.deep.equal({ id: 1, email: 'googleuser@example.com', name: 'Google User' });
  });

  it('returns an IMAP user by ID', async () => {
    const user = await getUser({ id: 2 }, db);
    expect(user).to.deep.equal({ id: 2, email: 'imapuser@example.com', name: 'IMAP User' });
  });

  it('returns an IMAP user by email if no access token or ID is provided', async () => {
    const user = await getUser({ email: 'imapuser@example.com' }, db);
    expect(user).to.deep.equal({ id: 3, email: 'imapuser@example.com', name: 'IMAP User' });
  });

})