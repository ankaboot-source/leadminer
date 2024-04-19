import { describe, expect, it, jest } from '@jest/globals';
import {
  buildFinalTree,
  createFlatTreeFromImap
} from '../../src/utils/helpers/imapTreeHelpers';
import dataTest from '../testData.json';

jest.mock('../../src/config', () => {});

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
