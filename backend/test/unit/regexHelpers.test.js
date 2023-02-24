const { expect } = require('chai');
const { check } = require('recheck');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const {
  REGEX_BODY,
  REGEX_LIST_ID
} = require('../../app/utils/constants');

const testData = require('../testData.json');

describe('Regex redos checker', () => {
  const regex = [REGEX_BODY, REGEX_LIST_ID];

  regex.forEach((r) => {
    it('regex should be REDOS safe', async () => {
      let messageError = 'Regex is vulnerable !';

      const { attack, complexity, hotspot, status } = await check(
        r.source,
        r.flags
      );

      if (status === 'vulnerable') {
        // Constructs helpful error message
        const vulParts = hotspot.map((i) => {
          return ` index(${i.start}, ${i.end}): ${r.source.slice(
            i.start,
            i.end
          )}`;
        });
        messageError += ` \n\t- Complixity: ${complexity.type} \n\t- Attack string: ${attack.pattern} \n\t- Vulnerable parts: ${vulParts}\n\t`;
      }
      expect(status, messageError).to.eq('safe');
    });
  });
});

describe('regExHelpers.extractEmailsFromBody(text)', () => {
  it('Should return a valid array of emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });

  it('Should return only valid emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(
      testData.randomEmails
    );
    expect(output).to.eql(testData.validrandomEmails.split(' '));
  });
});

describe('regExHelpers.extractName', () => {
  it('should return empty string if name do not exists', () => {
    const name = regExHelpers.extractName('john.doe@example.com');
    expect(name).to.equal('');
  });

  it('should return the name from an email address with a quoted name', () => {
    const name = regExHelpers.extractName('"John Doe" <john.doe@example.com>');
    expect(name).to.equal('John Doe');
  });

  it('should properly clean double and signle quotes if exists', () => {
    const input = [
      '"John Doe" <john.doe@example.com>',
      "'John Doe' <john.doe@example.com>",
      "'John' Doe' <john.doe@example.com>",
      '""John" Doe" <john.doe@example.com>',
      "''John' Doe' <john.doe@example.com>"
    ];
    const output = [
      'John Doe',
      'John Doe',
      "John' Doe",
      '"John" Doe',
      "'John' Doe"
    ];
    input.forEach((testInput, index) => {
      expect(regExHelpers.extractName(testInput)).to.equal(output[index]);
    });
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('should return an array of email addresses objects ', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.eql(testData.expectedEmailNameAddress);
  });

  it('should return an array wit one object containing name, identifier, address and domain', () => {
    const output = regExHelpers.extractNameAndEmail(
      'this is myyyyyyyyyyyyyyyy name <tester+123@leadminer.io>'
    );
    expect(output).to.eql([
      {
        name: 'this is myyyyyyyyyyyyyyyy name',
        identifier: 'tester+123',
        address: 'tester+123@leadminer.io',
        domain: 'leadminer.io'
      }
    ]);
  });

  it('should return an empty name and valid identifier, address and domain. If name not found.', () => {
    const output = regExHelpers.extractNameAndEmail('<tester@leadminer.io>');
    expect(output).to.eql([
      {
        name: '',
        identifier: 'tester',
        address: 'tester@leadminer.io',
        domain: 'leadminer.io'
      }
    ]);
  });

  it('should return an empty name and valid identifier, address and domain. If name === address', () => {
    const output = regExHelpers.extractNameAndEmail(
      'tester@leadminer.io <tester@leadminer.io>'
    );
    expect(output).to.eql([
      {
        name: '',
        identifier: 'tester',
        address: 'tester@leadminer.io',
        domain: 'leadminer.io'
      }
    ]);
  });

  it('should return an empty array on falsy input.', () => {
    const output = regExHelpers.extractNameAndEmail('');
    expect(output).to.be.empty;
  });
});
