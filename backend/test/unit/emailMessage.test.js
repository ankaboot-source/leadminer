const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage');

describe('Email Message', () => {
  describe('references', () => {
    it('should return an empty array if no references are present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        { 'message-id': 'test' },
        {},
        'folder'
      );
      expect(message.references).to.deep.equal([]);
    });

    it('should return an array of references if they are present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        { 'message-id': 'test', references: ['<r1>'] },
        {},
        'folder'
      );

      expect(message.references).to.deep.equal(['<r1>']);
    });

    it('should handle spaces between references', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        { 'message-id': 'test', references: ['<r1> <r2> <r3>'] },
        {},
        'folder'
      );
      expect(message.references).to.deep.equal(['<r1>', '<r2>', '<r3>']);
    });
  });

  describe('listId', () => {
    const LIST_ID_FORMAT_RFC = [
      'List Header Mailing List <list-header.nisto.com>',
      '<commonspace-users.list-id.within.com>',
      '"Lena\'s Personal Joke List " <lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>',
      '"An internal CMU List" <0Jks9449.list-id.cmu.edu>',
      '<da39efc25c530ad145d41b86f7420c3b.052000.localhost>'
    ];
    const CORRECT_LIST_IDS = [
      '<list-header.nisto.com>',
      '<commonspace-users.list-id.within.com>',
      '<lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>',
      '<0Jks9449.list-id.cmu.edu>',
      '<da39efc25c530ad145d41b86f7420c3b.052000.localhost>'
    ];
    const TEST_INPUTS_SHOULD_FAIL = [
      'Text ithout list-id',
      '"Text" ithout list-id',
      ''
    ];

    LIST_ID_FORMAT_RFC.forEach((listIdHeaderField, index) => {
      it(`Should return <listID>:string for list-id header fields = ${listIdHeaderField}`, () => {
        const message = new EmailMessage(
          {},
          '',
          1,
          {
            'message-id': 'test',
            'list-post': [''],
            'list-id': [listIdHeaderField]
          },
          {},
          ''
        );

        expect(message.listId).to.equal(CORRECT_LIST_IDS[index]);
      });
    });

    TEST_INPUTS_SHOULD_FAIL.forEach((testInput) => {
      it(`Should return empty string for falsy list-id value = ${
        testInput === '' ? 'empty-string' : testInput
      }`, () => {
        const message = new EmailMessage(
          {},
          '',
          1,
          {
            'message-id': 'test',
            'list-post': [''],
            'list-id': [testInput]
          },
          {},
          ''
        );
        expect(message.listId).to.equal('');
      });
    });

    it('Should return empty string in the absence of list-post header field', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          'list-id': ['']
        },
        {},
        ''
      );

      expect(message.listId).to.equal('');
    });

    it('Should return empty string in the absence of list-id header field', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          'list-post': ['']
        },
        {},
        ''
      );

      expect(message.listId).to.equal('');
    });
  });

  describe('date', () => {
    it('should return the date in UTC format if date is present and valid', () => {
      const date = new Date().toUTCString();
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          date: [`${date}`]
        },
        {},
        ''
      );

      expect(message.date).to.equal(date);
    });

    it('should return null if the date is not present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test'
        },
        {},
        ''
      );

      expect(message.date).to.be.null;
    });

    it('should return null if the date is not a valid date', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          date: ['not a date']
        },
        {},
        ''
      );

      expect(message.date).to.be.null;
    });
  });

  describe('messagingFields', () => {
    it('should return an empty object if no messaging fields are present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test'
        },
        {},
        ''
      );

      expect(message.messagingFields).to.deep.equal({});
    });

    it('should return an object with messaging fields if they are present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          to: ['test@example.com'],
          from: ['sender@example.com'],
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com']
        },
        {},
        ''
      );

      expect(message.messagingFields).to.deep.equal({
        to: 'test@example.com',
        from: 'sender@example.com',
        bcc: 'bcc@example.com',
        cc: 'cc@example.com'
      });
    });

    it('should return an object with messaging fields if they are present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': 'test',
          subject: ['Test Subject'],
          to: ['test@example.com'],
          from: ['sender@example.com']
        },
        {},
        ''
      );

      expect(message.messagingFields).to.deep.equal({
        to: 'test@example.com',
        from: 'sender@example.com'
      });
    });
  });

  describe('messageId', () => {
    it('should return the message-id field if it is present in the header', () => {
      const message = new EmailMessage(
        {},
        '',
        1,
        {
          'message-id': ['<test_message_id>'],
          subject: ['Test Subject'],
          to: ['test@example.com'],
          from: ['sender@example.com']
        },
        {},
        ''
      );

      expect(message.messageId).to.equal('<test_message_id>');
    });
  });

  describe('messageTags', () => {
    it('should tag transactional when is transactional, not newsletter and not list', () => {});

    it("shouldn't tag transactional if is newsletter of is list", () => {});

    it('should return an empty array if there is no tags', () => {});
  });
});

describe('EmailMessage.constructPersonPocTags()', () => {
  const email = {
    address: 'test@example.com',
    identifier: 'test_identifier',
    name: 'Test Name'
  };

  it('should return a person object with the correct properties when fieldName is "from"', () => {
    const result = EmailMessage.constructPersonPocTags(email, [], 'from');
    expect(result).to.have.property('person');
    expect(result.person).to.have.property('name', 'Test Name');
    expect(result.person).to.have.property('email', 'test@example.com');
    expect(result.person)
      .to.have.property('identifiers')
      .that.deep.equals(['test_identifier']);
  });

  it('should return a pointOfContact object with the correct properties when fieldName is "to"', () => {
    const result = EmailMessage.constructPersonPocTags(email, [], 'to');
    expect(result).to.have.property('pointOfContact');
    expect(result.pointOfContact).to.have.property('name', 'Test Name');
    expect(result.pointOfContact).to.have.property('_to', true);
    expect(result.pointOfContact).to.have.property('_from', false);
  });

  it('should return a tags array', () => {
    const tags = [
      { name: 'test', label: 'test label', reachable: 2, type: 'test type' }
    ];
    const result = EmailMessage.constructPersonPocTags(email, tags, 'from');
    expect(result).to.have.property('tags').that.deep.equals(tags);
  });
});
