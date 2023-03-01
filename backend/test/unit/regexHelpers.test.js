const { expect } = require('chai');
const { check } = require('recheck');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const {
  REGEX_BODY,
  REGEX_LIST_ID,
  REGEX_REMOVE_QUOTES
} = require('../../app/utils/constants');

const testData = require('../testData.json');

describe('Regex redos checker', () => {
  const regex = [REGEX_BODY, REGEX_LIST_ID, REGEX_REMOVE_QUOTES];

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
    const name = regExHelpers.cleanName('');
    expect(name).to.equal('');
  });

  it('should properly clean double and single quotes if they exist', () => {
    const input = ['"\'John Doe\'"', '"John Doe"', "'John Doe'"];
    const expectedOutput = ['John Doe', 'John Doe', 'John Doe'];

    input.forEach((testInput, index) => {
      const actualOutput = regExHelpers.cleanName(testInput);
      expect(actualOutput).to.equal(expectedOutput[index]);
    });
  });

  it('should properly trim white spaces if they exist', () => {
    const input = [
      'John Doe',
      'John Doe ',
      ' John Doe',
      ' John Doe ',
      "John' Doe",
      "John' Doe ",
      " John' Doe",
      " John' Doe ",
      'John" Doe"',
      'John" Doe" ',
      ' John" Doe"',
      ' John" Doe" ',
      "'John Doe'",
      "'John Doe' ",
      " 'John Doe'",
      " 'John Doe' ",
      '"\'John Doe\'"',
      '"\'John Doe\'" ',
      ' "\'John Doe\'"',
      ' "\'John Doe\'" '
    ];
    const expectedOutput = [
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe',
      "John' Doe",
      "John' Doe",
      "John' Doe",
      "John' Doe",
      'John" Doe"',
      'John" Doe"',
      'John" Doe"',
      'John" Doe"',
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe',
      'John Doe'
    ];

    input.forEach((testInput, index) => {
      const actualOutput = regExHelpers.cleanName(testInput);
      expect(actualOutput).to.equal(expectedOutput[index]);
    });
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('Should return an array of valid objects ', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.eql(testData.expectedEmailNameAddress);
  });

  it('Should return an array with one valid object', () => {
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

  it('Should properly extract and return valid names', () => {
    const testCases = [
      'leadminer@Teamankaboot.fr',
      '<leadminer@Teamankaboot.fr>',
      'leadminer@Teamankaboot.fr leadminerTeam@ankaboot.fr',
      'leadminer@Teamankaboot.fr <leadminer@Teamankaboot.fr>',
      'Hello There leadminer@Teamankaboot.fr',
      'Hello There <leadminer@Teamankaboot.fr>',
      'Hello-There (leadminer) <leadminer@Teamankaboot.fr>'
    ];
    const expectedNames = [
      '',
      '',
      '',
      '',
      'Hello There',
      'Hello There',
      'Hello-There (leadminer)'
    ];
    testCases.forEach((testCase, index) => {
      const output = regExHelpers.extractNameAndEmail(testCase);
      expect(output[0].name).to.equal(expectedNames[index]);
    });
  });

  it('Should return valid object with empty name if there is none.', () => {
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

  it('Should return a valid object and empty name if name === email.', () => {
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

  it('Should return an empty array on falsy input', () => {
    const falsyInput = ['', ' ', '...', 'char', 'only name'];
    falsyInput.forEach((input) => {
      expect(regExHelpers.extractNameAndEmail(input)).to.be.empty;
    });
  });
});
