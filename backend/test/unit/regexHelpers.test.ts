import { describe, expect, it, jest, test } from '@jest/globals';
import { check } from 'recheck';
import {
  REGEX_LIST_ID,
  REGEX_REMOVE_QUOTES,
  REGEX_CLEAN_NAME_FROM_UNWANTED_WORDS
} from '../../src/utils/constants';
import {
  cleanName,
  extractNameAndEmail,
  extractNameAndEmailFromBody
} from '../../src/services/extractors/helpers';
import testData from '../testData.json';

jest.mock('../../src/config', () => {});

async function testRegexSafety(regexSource: string, regexFlags: string) {
  const diagnostics = await check(regexSource, regexFlags);

  if (diagnostics.status === 'vulnerable') {
    const vulParts = diagnostics.hotspot.map(
      (i) =>
        ` index(${i.start}, ${i.end}): ${regexSource.slice(i.start, i.end)}`
    );

    const messageError = `
      Regex is vulnerable! 
      - Complexity: ${diagnostics.complexity.type} 
      - Attack string: ${diagnostics.attack.pattern} 
      - Vulnerable parts: ${vulParts}
    `;
    // eslint-disable-next-line no-console
    console.error(messageError);
  }

  expect(diagnostics.status).toBe('safe');
}

describe('Regex redos checker', () => {
  const regex = [
    REGEX_LIST_ID,
    REGEX_REMOVE_QUOTES,
    REGEX_CLEAN_NAME_FROM_UNWANTED_WORDS
  ];

  test.concurrent.each(regex)(
    'Regex %p with flags %p should be REDOS safe',
    async (re) => {
      await testRegexSafety(re.source, re.flags);
    }
  );
});

describe('regExHelpers.extractEmailsFromBody(text)', () => {
  // TODO: Update unit tests for body
  it('Should return a valid array of emails', () => {
    const output = extractNameAndEmailFromBody(testData.emailBody).map(
      ({ address }) => address
    );
    expect([...new Set(output)]).toEqual(testData.expectedForBodyExtraction);
  });

  it('Should return only valid emails', () => {
    const output = extractNameAndEmailFromBody(testData.randomEmails).map(
      ({ address }) => address
    );
    expect([...new Set(output)]).toEqual(testData.validrandomEmails.split(' '));
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

  it('should remove "via" and the text after it', () => {
    const inputs = ['Leadminer via nextcloud', 'Leadminer (via nextcloud)'];

    inputs.forEach((name) => {
      const output = cleanName(name);
      expect(output).toBe('Leadminer');
    });
  });

  it('should remove "(Google) | (Drive) | (Google Drive)" and the text after it', () => {
    const inputs = [
      'Leadminer (google)',
      'Leadminer (Google)',
      'Leadminer (drive)',
      'Leadminer (Drive)',
      'Leadminer (google drive)',
      'Leadminer (Google Drive)'
    ];

    inputs.forEach((name) => {
      const output = cleanName(name);
      expect(output).toBe('Leadminer');
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
    const { input, output } = testCase;
    expect(extractNameAndEmail(input)).toEqual(output);
  });

  it('Should return valid object with empty name if there is none.', () => {
    const generalOutput = [
      {
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

    testCases.forEach(({ input, output }) => {
      const resultOutput = extractNameAndEmail(input);
      expect(resultOutput).toEqual(output);
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

    testCases.forEach(({ input, output }) => {
      const resultOutput = extractNameAndEmail(input)
        .map(({ name }) => (name !== undefined ? name : 'empty'))
        .join(', ');
      expect(resultOutput).toEqual(output);
    });
  });

  it('should return valid object if the name is in this format "<text><space><email>"', () => {
    const expectedOutput = {
      name: 'Leadminer Test leadminer@Teamankaboot.fr',
      identifier: 'leadminer',
      address: 'leadminer@teamankaboot.fr',
      domain: 'teamankaboot.fr'
    };
    const testCases = [
      {
        description: 'Case when email is surrounded with <>',
        input:
          '"Leadminer Test leadminer@Teamankaboot.fr" <leadminer@teamankaboot.fr>'
      },
      {
        description: 'Case when email is not surrounded with <>',
        input:
          '"Leadminer Test leadminer@Teamankaboot.fr" leadminer@teamankaboot.fr'
      }
    ];

    testCases.forEach(({ input }) => {
      const [resultOutput] = extractNameAndEmail(input);
      expect(resultOutput).toEqual(expectedOutput);
    });
  });

  it('should return valid object if the name is a list of emails"', () => {
    const expectedOutput = {
      name: 'leadminer1@Teamankaboot.fr, leadminer2@Teamankaboot.fr, leadminer3@Teamankaboot.fr',
      identifier: 'leadminer',
      address: 'leadminer@teamankaboot.fr',
      domain: 'teamankaboot.fr'
    };
    const testCases = [
      {
        description: 'Case when email is surrounded with <>',
        input:
          '"leadminer1@Teamankaboot.fr, leadminer2@Teamankaboot.fr, leadminer3@Teamankaboot.fr" <leadminer@teamankaboot.fr>'
      },
      {
        description: 'Case when email is not surrounded with <>',
        input:
          '"leadminer1@Teamankaboot.fr, leadminer2@Teamankaboot.fr, leadminer3@Teamankaboot.fr" leadminer@teamankaboot.fr'
      }
    ];

    testCases.forEach(({ input }) => {
      const [resultOutput] = extractNameAndEmail(input);
      expect(resultOutput).toEqual(expectedOutput);
    });
  });

  it('should correclty split emails if they are seperated with commas only', () => {
    const testStrings = [
      'leadminer1@teamankaboot.fr',
      '<leadminer2@teamankaboot.fr>',
      '"Leadminer 3" leadminer3@teamankaboot.fr',
      '"Leadminer 4" <leadminer4@teamankaboot.fr>'
    ];

    const testCase = {
      input: testStrings.join(','),
      output: [
        {
          identifier: 'leadminer1',
          address: 'leadminer1@teamankaboot.fr',
          domain: 'teamankaboot.fr'
        },
        {
          identifier: 'leadminer2',
          address: 'leadminer2@teamankaboot.fr',
          domain: 'teamankaboot.fr'
        },
        {
          name: 'Leadminer 3',
          identifier: 'leadminer3',
          address: 'leadminer3@teamankaboot.fr',
          domain: 'teamankaboot.fr'
        },
        {
          name: 'Leadminer 4',
          identifier: 'leadminer4',
          address: 'leadminer4@teamankaboot.fr',
          domain: 'teamankaboot.fr'
        }
      ]
    };

    const output = extractNameAndEmail(testCase.input);
    expect(output).toEqual(testCase.output);
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
            input: `"Hello${char}There" <${email}>`,
            output: `Hello${char}There`
          },
          {
            input: `"Hello${char}There" ${email}`,
            output: `Hello${char}There`
          },
          {
            input: `"Hello ${char} There" <${email}>`,
            output: `Hello ${char} There`
          },
          {
            input: `"Hello ${char} There" ${email}`,
            output: `Hello ${char} There`
          },
          {
            input: `"Hello ${char}There" <${email}>`,
            output: `Hello ${char}There`
          },
          {
            input: `"Hello ${char}There" ${email}`,
            output: `Hello ${char}There`
          }
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

    testCases.forEach(({ input, output }) => {
      const resultOutput = extractNameAndEmail(input)
        .map(({ name }) => (name !== undefined ? name : 'EMPTY'))
        .join(', ');
      expect(resultOutput).toEqual(output);
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
      const startsWithInput = `"userName${char}" user@email.com`;
      const endsWithInput = `"${char}userName" user@email.com`;

      const startsWithResult = extractNameAndEmail(startsWithInput);
      const endsWithResult = extractNameAndEmail(endsWithInput);

      expect(startsWithResult[0].name).toBe('userName');
      expect(endsWithResult[0].name).toBe('userName');
    }
  );
});
