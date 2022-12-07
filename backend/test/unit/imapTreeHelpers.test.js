const { expect } = require('chai');
const imapTreeHelpers = require('../../app/utils/helpers/imapTreeHelpers');
const dataTest = require('../testData.json');

describe('imapTreeHelpers.createFlatTreeFromImap(imapTree)', () => {
  const { imapTreeExample } = dataTest;
  const expectedOutput = [
    { label: 'Brouillons', path: 'Brouillons', parent: null },
    { label: 'INBOX', path: 'INBOX', parent: null },
    {
      label: 'mars',
      path: 'INBOX/mars',
      parent: { label: 'INBOX', path: 'INBOX', parent: null }
    },
    {
      label: 'Administratif',
      path: 'INBOX/Administratif',
      parent: { label: 'INBOX', path: 'INBOX', parent: null }
    },
    { label: 'Spam', path: 'Spam', parent: null }
  ];

  it('should return valid flat array', () => {
    const output = imapTreeHelpers.createFlatTreeFromImap(
      imapTreeExample,
      null
    );
    expect(output).to.eql(expectedOutput);
  });
});

// TODO - Rework tree parsing algorithm
describe.skip('imapTreeHelpers.buildFinalTree(foldersFlatArray, userEmail)', () => {
  it('should build a valid tree', () => {
    const input = [
      {
        label: 'Brouillons',
        path: 'Brouillons',
        total: 0,
        cumulativeTotal: 0
      },
      {
        label: 'INBOX',
        path: 'INBOX',
        total: 0,
        cumulativeTotal: 0
      },
      {
        label: 'mars',
        path: 'INBOX/mars',
        parent: { label: 'INBOX', path: 'INBOX', total: 0, cumulativeTotal: 0 },
        total: 1,
        cumulativeTotal: 1
      },
      {
        label: 'Administratif',
        path: 'INBOX/Administratif',
        parent: { label: 'INBOX', path: 'INBOX', total: 0, cumulativeTotal: 0 },
        total: 1,
        cumulativeTotal: 1
      },
      {
        label: 'Spam',
        path: 'Spam',
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
            path: 'Brouillons',
            total: 0,
            cumulativeTotal: 0
          },
          {
            label: 'INBOX',
            path: 'INBOX',
            cumulativeTotal: 2,
            total: 0,
            children: [
              {
                label: 'mars',
                path: 'INBOX/mars',
                total: 1,
                cumulativeTotal: 1
              },
              {
                label: 'Administratif',
                path: 'INBOX/Administratif',
                total: 1,
                cumulativeTotal: 1
              }
            ]
          },
          { label: 'Spam', path: 'Spam', total: 1, cumulativeTotal: 1 }
        ],
        total: 3
      }
    ];
    const output = imapTreeHelpers.buildFinalTree(input, 'email@example.com');
    expect(output).to.eql(expectedOutput);
  });
});
