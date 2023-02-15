const { expect } = require('chai');
const { getXImapHeaderField } = require('../../app/controllers/helpers');

describe('getXImapHeaderField', () => {
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
