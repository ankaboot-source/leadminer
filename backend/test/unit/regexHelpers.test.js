import { describe, expect, it } from '@jest/globals';
import { check } from 'recheck';
import {
  REGEX_BODY,
  REGEX_LIST_ID,
  REGEX_REMOVE_QUOTES
} from '../../src/utils/constants';
import {
  cleanName,
  extractNameAndEmail,
  extractNameAndEmailFromBody
} from '../../src/utils/helpers/regexpHelpers';
import testData from '../testData.json';

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
        const vulParts = hotspot.map(
          (i) =>
            ` index(${i.start}, ${i.end}): ${r.source.slice(i.start, i.end)}`
        );
        messageError += ` \n\t- Complixity: ${complexity.type} \n\t- Attack string: ${attack.pattern} \n\t- Vulnerable parts: ${vulParts}\n\t`;
      }
      expect(status).toBe('safe', messageError);
    });
  });
});

describe('regExHelpers.extractEmailsFromBody(text)', () => {
  // TODO: Update unit tests for body
  it('Should return a valid array of emails', () => {
    const output = extractNameAndEmailFromBody(testData.emailBody);
    expect(output).toEqual(testData.expectedForBodyExtraction);
  });

  it('Should return only valid emails', () => {
    const output = extractNameAndEmailFromBody(testData.randomEmails);
    expect(output).toEqual(testData.validrandomEmails.split(' '));
  });
});

describe('regexHelpers.cleanName', () => {
  it('should return empty string if name do not exists', () => {
    const name = cleanName('');
    expect(name).toBe('');
  });

  it('should properly trim white spaces if they exist', () => {
    const testCases = [
      {
        input: ['"\'John Doe\'"', '"John Doe"', "'John Doe'"],
        output: 'John Doe'
      },
      {
        input: ['John Doe', 'John Doe ', ' John Doe', ' John Doe '],
        output: 'John Doe'
      },
      {
        input: ["John' Doe", "John' Doe ", " John' Doe", " John' Doe "],
        output: "John' Doe"
      },
      {
        input: ['John" Doe"', 'John" Doe" ', ' John" Doe"', ' John" Doe" '],
        output: 'John" Doe"'
      },
      {
        input: ["'John Doe'", "'John Doe' ", " 'John Doe'", " 'John Doe' "],
        output: 'John Doe'
      },
      {
        input: [
          '"\'John Doe\'"',
          '"\'John Doe\'" ',
          ' "\'John Doe\'"',
          ' "\'John Doe\'" ',
          'John&#32Doe', // &#32 HTML-Entities for space
          '\\"John Doe\\"'
        ],
        output: 'John Doe'
      },
      {
        input: ['L&#39ENCLUME'],
        output: "L'ENCLUME"
      }
    ];

    testCases.forEach(({ input, output }) => {
      input.forEach((name) => {
        const functionOutput = cleanName(name);
        expect(functionOutput).toBe(output);
      });
    });
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('Should return an array of valid objects ', () => {
    const output = extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).toEqual(testData.expectedEmailNameAddress);
  });

  it('Should return an array with one valid object', () => {
    const testCase = {
      description: 'Case when have valid name and email.',
      input: 'this is myyyyyyyyyyyyyyyy name <tester+123@leadminer.io>',
      output: [
        {
          name: 'this is myyyyyyyyyyyyyyyy name',
          identifier: 'tester+123',
          address: 'tester+123@leadminer.io',
          domain: 'leadminer.io'
        }
      ]
    };
    const { description, input, output } = testCase;
    expect(extractNameAndEmail(input)).toEqual(output, description);
  });

  it('Should return valid object with empty name if there is none.', () => {
    const generalOutput = [
      {
        name: '',
        identifier: 'leadminer',
        address: 'leadminer@teamankaboot.fr',
        domain: 'Teamankaboot.fr'
      }
    ];
    const testCases = [
      {
        description: 'Case where there is no name and email without <>',
        input: 'leadminer@Teamankaboot.fr',
        output: generalOutput
      },
      {
        description: 'Case where there is no name and email with <>',
        input: '<leadminer@Teamankaboot.fr>',
        output: generalOutput
      },
      {
        description: 'Case where name is also email and email without <>',
        input: 'leadminer@Teamankaboot.fr leadminer@Teamankaboot.fr',
        output: generalOutput
      },
      {
        description: 'Case where name is also email and email with <>',
        input: 'leadminer@Teamankaboot.fr <leadminer@Teamankaboot.fr>',
        output: generalOutput
      }
    ];

    testCases.forEach(({ input, output, description }) => {
      const resultOutput = extractNameAndEmail(input);
      expect(resultOutput).toEqual(output, description);
    });
  });

  it('Should properly extract and return valid names', () => {
    const testCases = [
      {
        description: 'Case where one email and not suurounded with <>',
        input: 'leadminer@Teamankaboot.fr',
        output: 'empty'
      },
      {
        description: 'Case where one email and suurounded with <>',
        input: '<leadminer@Teamankaboot.fr>',
        output: 'empty'
      },
      {
        description:
          'Case where name equal email and email is not surrounded with <>',
        input: 'leadminer@Teamankaboot.fr leadminer@Teamankaboot.fr',
        output: 'empty'
      },
      {
        description:
          'Case where name equal email and email is surrounded with <>',
        input: 'leadminer@Teamankaboot.fr <leadminer@Teamankaboot.fr>',
        output: 'empty'
      },
      {
        description:
          'Case where there is a name and email is not surrounded with <>',
        input: 'Hello There leadminer@Teamankaboot.fr',
        output: 'Hello There'
      },
      {
        description:
          'Case where there is a name and email is surrounded with <>',
        input: 'Hello There <leadminer@Teamankaboot.fr>',
        output: 'Hello There'
      },
      {
        description:
          'Case when multiple emails with nested formats, starting with email not surrounded with <>',
        input:
          'leadminer@Teamankaboot.fr, <leadminer@Teamankaboot.fr>, leadminer@Teamankaboot.fr leadminerTeam@ankaboot.fr, leadminer@Teamankaboot.fr <leadminer@Teamankaboot.fr>, Hello There leadminer@Teamankaboot.fr, Hello There <leadminer@Teamankaboot.fr>, Hello-There (leadminer) leadminer@Teamankaboot.fr',
        output:
          'empty, empty, leadminer@Teamankaboot.fr, empty, Hello There, Hello There, Hello-There (leadminer)'
      },
      {
        description:
          'Case when multiple emails with nested formats, starting with email surrounded with <>',
        input:
          '<leadminer@Teamankaboot.fr>, leadminer@Teamankaboot.fr, leadminer@Teamankaboot.fr leadminerTeam@ankaboot.fr, leadminer@Teamankaboot.fr <leadminer@Teamankaboot.fr>, Hello There leadminer@Teamankaboot.fr, Hello There <leadminer@Teamankaboot.fr>, Hello-There (leadminer) leadminer@Teamankaboot.fr',
        output:
          'empty, empty, leadminer@Teamankaboot.fr, empty, Hello There, Hello There, Hello-There (leadminer)'
      }
    ];

    testCases.forEach(({ input, output, description }) => {
      const resultOutput = extractNameAndEmail(input)
        .map(({ name }) => (name !== '' ? name : 'empty'))
        .join(', ');
      expect(resultOutput).toEqual(output, description);
    });
  });

  it('should pass cases when names have special chars', () => {
    const specialChars = ['-', '()', ':', '|', '&', '@', ','];
    const email = 'leadminer@Teamankaboot.fr';

    const testCases = specialChars
      .map((char) => {
        const testStrings = [
          { input: `${email}`, output: 'EMPTY' },
          { input: `<${email}>`, output: 'EMPTY' },
          {
            input: `Hello${char}There <${email}>`,
            output: `Hello${char}There`
          },
          { input: `Hello${char}There ${email}`, output: `Hello${char}There` },
          {
            input: `Hello ${char} There <${email}>`,
            output: `Hello ${char} There`
          },
          {
            input: `Hello ${char} There ${email}`,
            output: `Hello ${char} There`
          },
          {
            input: `Hello ${char}There <${email}>`,
            output: `Hello ${char}There`
          },
          { input: `Hello ${char}There ${email}`, output: `Hello ${char}There` }
        ];

        return [
          {
            description: `Cases where multiple emails and name contains special char ${char}`,
            input: testStrings.map(({ input }) => input).join(', '),
            output: testStrings.map(({ output }) => output).join(', ')
          },
          ...testStrings.map((testCase) => ({
            description: `Cases where single email and name contains special char ${char}`,
            input: testCase.input,
            output: testCase.output
          }))
        ];
      })
      .flat();

    testCases.forEach(({ input, output, description }) => {
      const resultOutput = extractNameAndEmail(input)
        .map(({ name }) => (name !== '' ? name : 'EMPTY'))
        .join(', ');
      expect(resultOutput).toEqual(output, description);
    });
  });

  it('Should return an empty array on falsy input', () => {
    const falsyInput = ['', ' ', '...', 'char', 'only name'];
    falsyInput.forEach((input) => {
      expect(extractNameAndEmail(input)).toHaveLength(0);
    });
  });

  it('Should return the correct email object for a list-post header format', () => {
    const input = '<mailto:ga_montreuil_info@lists.riseup.net>';
    const expectedEmail = {
      name: '',
      address: 'ga_montreuil_info@lists.riseup.net',
      identifier: 'ga_montreuil_info',
      domain: 'lists.riseup.net'
    };

    const result = extractNameAndEmail(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expectedEmail);
  });

  it.each([{ char: ',' }, { char: ';' }])(
    'Should not include names with trailing $char',
    ({ char }) => {
      const startsWithInput = `userName${char} user@email.com`;
      const endsWithInput = `${char}userName user@email.com`;

      const startsWithResult = extractNameAndEmail(startsWithInput);
      const endsWithResult = extractNameAndEmail(endsWithInput);

      expect(startsWithResult[0].name).toBe('userName');
      expect(endsWithResult[0].name).toBe('userName');
    }
  );
});
