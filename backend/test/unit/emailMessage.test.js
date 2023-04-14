const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage');
const { groupEmailMessage } = require('../../app/services/tagging/group');
const { linkedinEmailMessage } = require('../../app/services/tagging/linkedin');
const {
  newsletterEmailMessage
} = require('../../app/services/tagging/newsletter');
const {
  transactionalEmailMessage
} = require('../../app/services/tagging/transactional');

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
    const [transactionalRules] = transactionalEmailMessage.rulesToApply;
    const [groupRules] = groupEmailMessage.rulesToApply;
    const [linkedinRules] = linkedinEmailMessage.rulesToApply;
    const [newsletterRules] = newsletterEmailMessage.rulesToApply;

    let header = {};
    beforeEach(() => {
      header = {
        'message-id': ['<test_message_id>'],
        subject: ['Test Subject'],
        to: ['test@example.com'],
        from: ['sender@example.com']
      };
    });

    transactionalRules.conditions[0].possibleHeaderPrefixes.forEach(
      (prefix) => {
        it(`Should include transactional if it has a header field with "${prefix}" as prefix`, () => {
          header[`${prefix}-test`] = ['test'];
          const message = new EmailMessage({}, '', 1, header, {}, '');

          expect(message.messageTags).to.deep.equal([
            {
              name: 'transactional',
              reachable: 2,
              source: 'refined',
              fields: transactionalRules.fields
            }
          ]);
        });
      }
    );

    transactionalRules.conditions[1].values.forEach((value) => {
      it(`Should include transactional if it has an "x-mailer" field with "${value}" as value`, () => {
        header['x-mailer'] = [value];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'transactional',
            reachable: 2,
            source: 'refined',
            fields: transactionalRules.fields
          }
        ]);
      });
    });

    transactionalRules.conditions[2].values.forEach((value) => {
      it(`Should include transactional if it has an "auto-submitted" field with "${value}" as value`, () => {
        header['auto-submitted'] = [value];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'transactional',
            reachable: 2,
            source: 'refined',
            fields: transactionalRules.fields
          }
        ]);
      });
    });

    transactionalRules.conditions[3].values.forEach((value) => {
        it(`Should include transactional if it has an "x-gnd-status" field with "${value}" as value`, () => {
          header['x-gnd-status'] = [value];
          const message = new EmailMessage({}, '', 1, header, {}, '');
  
          expect(message.messageTags).to.deep.equal([
            {
              name: 'transactional',
              reachable: 2,
              source: 'refined',
              fields: transactionalRules.fields
            }
          ]);
        });
      });

      transactionalRules.conditions[4].values.forEach((value) => {
        it(`Should include transactional if it has an "x-spam-flag" field with "${value}" as value`, () => {
          header['x-spam-flag'] = [value];
          const message = new EmailMessage({}, '', 1, header, {}, '');
  
          expect(message.messageTags).to.deep.equal([
            {
              name: 'transactional',
              reachable: 2,
              source: 'refined',
              fields: transactionalRules.fields
            }
          ]);
        });
      });

    groupRules.conditions[0].possibleHeaderFields.forEach((field) => {
      it(`Should include group if it has a "${field}" header field`, () => {
        header[field] = ['test'];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'group',
            reachable: 2,
            source: 'refined',
            fields: groupRules.fields
          }
        ]);
      });
    });

    newsletterRules.conditions[0].possibleHeaderFields.forEach((field) => {
      it(`Should include newsletter if it has a "${field}" header field`, () => {
        header[field] = ['test'];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'newsletter',
            reachable: 2,
            source: 'refined',
            fields: newsletterRules.fields
          }
        ]);
      });
    });

    groupRules.conditions[1].values.forEach((value) => {
      it(`Should include group if it has a "precedence" field with "${value}" as value`, () => {
        header.precedence = [value];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'group',
            reachable: 2,
            source: 'refined',
            fields: groupRules.fields
          }
        ]);
      });
    });

    linkedinRules.conditions[0].values.forEach((value) => {
      it(`Should include linkedin if it has a "x-linkedin-class" field with "${value}" as value`, () => {
        header['x-linkedin-class'] = [value];
        const message = new EmailMessage({}, '', 1, header, {}, '');

        expect(message.messageTags).to.deep.equal([
          {
            name: 'linkedin',
            reachable: 2,
            source: 'refined',
            fields: linkedinRules.fields
          }
        ]);
      });
    });

    it('Should be empty if there are no tags', () => {
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

      expect(message.messageTags).to.be.empty;
    });
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
