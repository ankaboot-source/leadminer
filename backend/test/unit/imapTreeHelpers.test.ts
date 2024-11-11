import { describe, expect, it, jest } from '@jest/globals';
import {
  buildFinalTree,
  createFlatTreeFromImap
} from '../../src/utils/helpers/imapTreeHelpers';
import dataTest from '../testData.json';
import logger from '../../src/utils/logger';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

// Mock the logger module inline within jest.mock
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn()
}));

describe('imapTreeHelpers.createFlatTreeFromImap(imapTree)', () => {
  const { imapTreeExample } = dataTest;
  const expectedOutput = [
    {
      label: 'Brouillons',
      key: 'Brouillons',
      attribs: ['\\Drafts', '\\HasNoChildren']
    },
    { label: 'INBOX', key: 'INBOX', attribs: ['\\HasChildren'] },
    {
      label: 'mars',
      key: 'INBOX/mars',
      parent: {
        label: 'INBOX',
        key: 'INBOX',
        attribs: ['\\HasChildren']
      },
      attribs: ['\\Junk', '\\HasNoChildren']
    },
    {
      label: 'Administratif',
      key: 'INBOX/Administratif',
      parent: {
        label: 'INBOX',
        key: 'INBOX',
        attribs: ['\\HasChildren']
      },
      attribs: ['\\Junk', '\\HasNoChildren']
    },
    {
      label: 'Spam',
      key: 'Spam',
      attribs: ['\\Junk', '\\HasNoChildren']
    }
  ];

  it('should return valid flat array', () => {
    // @ts-expect-error There is a problem with the type definitions of node-imap.. We can safely ignore it to keep these tests.
    const output = createFlatTreeFromImap(imapTreeExample);
    expect(output).toEqual(expectedOutput);
  });

  it('should separate with the provided delimiter', () => {
    const imapTreeWithCustomDelimiter = {
      INBOX: {
        attribs: ['\\HasChildren'],
        delimiter: ':',
        children: {
          subfolder1: {
            attribs: ['\\Junk', '\\HasNoChildren'],
            delimiter: '/',
            children: null,
            parent: null
          },
          subfolder2: {
            attribs: ['\\Junk', '\\HasNoChildren'],
            delimiter: '.',
            children: null,
            parent: null
          }
        },
        parent: null
      }
    };

    const expectedOutputWithCustomDelimiter = [
      {
        label: 'INBOX',
        key: 'INBOX',
        attribs: ['\\HasChildren']
      },
      {
        label: 'subfolder1',
        key: 'INBOX/subfolder1',
        parent: {
          label: 'INBOX',
          key: 'INBOX',
          attribs: ['\\HasChildren']
        },
        attribs: ['\\Junk', '\\HasNoChildren']
      },
      {
        label: 'subfolder2',
        key: 'INBOX.subfolder2',
        parent: {
          label: 'INBOX',
          key: 'INBOX',
          attribs: ['\\HasChildren']
        },
        attribs: ['\\Junk', '\\HasNoChildren']
      }
    ];

    // @ts-expect-error There is a problem with the type definitions of node-imap.. We can safely ignore it to keep these tests.
    const output = createFlatTreeFromImap(imapTreeWithCustomDelimiter);
    expect(output).toEqual(expectedOutputWithCustomDelimiter);
  });

  it("should log a warning if delimiter is missing and default to '/'", () => {
    const imapTreeWithMissingDelimiter = {
      INBOX: {
        attribs: ['\\HasChildren'],
        delimiter: ':',
        children: {
          subfolder1: {
            attribs: ['\\Junk', '\\HasNoChildren'],
            delimiter: '',
            children: null,
            parent: null
          },
          subfolder2: {
            attribs: ['\\Junk', '\\HasNoChildren'],
            delimiter: '',
            children: null,
            parent: null
          }
        },
        parent: null
      }
    };

    const expectedOutputWithDefaultDelimiter = [
      {
        label: 'INBOX',
        key: 'INBOX',
        attribs: ['\\HasChildren']
      },
      {
        label: 'subfolder1',
        key: 'INBOX/subfolder1',
        parent: {
          label: 'INBOX',
          key: 'INBOX',
          attribs: ['\\HasChildren']
        },
        attribs: ['\\Junk', '\\HasNoChildren']
      },
      {
        label: 'subfolder2',
        key: 'INBOX/subfolder2',
        parent: {
          label: 'INBOX',
          key: 'INBOX',
          attribs: ['\\HasChildren']
        },
        attribs: ['\\Junk', '\\HasNoChildren']
      }
    ];

    // @ts-expect-error There is a problem with the type definitions of node-imap.. We can safely ignore it to keep these tests.
    const output = createFlatTreeFromImap(imapTreeWithMissingDelimiter);
    expect(output).toEqual(expectedOutputWithDefaultDelimiter);
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });
});

// TODO - Rework tree parsing algorithm
describe.skip('imapTreeHelpers.buildFinalTree(foldersFlatArray, userEmail)', () => {
  it('should build a valid tree', () => {
    const input = [
      {
        label: 'Brouillons',
        key: 'Brouillons',
        total: 0,
        cumulativeTotal: 0
      },
      {
        label: 'INBOX',
        key: 'INBOX',
        total: 0,
        cumulativeTotal: 0
      },
      {
        label: 'mars',
        key: 'INBOX/mars',
        parent: { label: 'INBOX', key: 'INBOX', total: 0, cumulativeTotal: 0 },
        total: 1,
        cumulativeTotal: 1
      },
      {
        label: 'Administratif',
        key: 'INBOX/Administratif',
        parent: { label: 'INBOX', key: 'INBOX', total: 0, cumulativeTotal: 0 },
        total: 1,
        cumulativeTotal: 1
      },
      {
        label: 'Spam',
        key: 'Spam',
        total: 1,
        cumulativeTotal: 1
      }
    ];
    const expectedOutput = [
      {
        label: 'email@example.com',
        children: [
          {
            label: 'Brouillons',
            key: 'Brouillons',
            total: 0,
            cumulativeTotal: 0
          },
          {
            label: 'INBOX',
            key: 'INBOX',
            cumulativeTotal: 2,
            total: 0,
            children: [
              {
                label: 'mars',
                key: 'INBOX/mars',
                total: 1,
                cumulativeTotal: 1
              },
              {
                label: 'Administratif',
                key: 'INBOX/Administratif',
                total: 1,
                cumulativeTotal: 1
              }
            ]
          },
          { label: 'Spam', key: 'Spam', total: 1, cumulativeTotal: 1 }
        ],
        total: 3
      }
    ];
    const output = buildFinalTree(input, 'email@example.com');
    expect(output).toEqual(expectedOutput);
  });
});
