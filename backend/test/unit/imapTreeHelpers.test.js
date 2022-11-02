const { expect } = require('chai');
const imapTreeHelpers = require('../../app/utils/helpers/imapTreeHelpers');
const dataTest = require('../testData.json');

describe('imapTreeHelpers.createTreeFromImap(imapTree)', () => {
  const imapTreeExample = dataTest.imapTreeExample;
  const expectedOutput = [
    { label: 'Brouillons' },
    {
      label: 'INBOX',
      children: [{ label: 'mars' }, { label: 'Administratif' }]
    },
    { label: 'Spam' }
  ];

  it('should return valid tree', () => {
    const Output = imapTreeHelpers.createTreeFromImap(imapTreeExample);
    expect(Output).to.have.deep.members(expectedOutput);
  });
});
describe('imapTreeHelpers.addPathPerFolder(imapTree, imapTreeFromImapServer)', () => {
  it('should add path for each folder', () => {
    const expectedOutput = [
      { label: 'Brouillons', path: 'Brouillons' },

      {
        label: 'INBOX',
        path: 'INBOX',
        children: [
          { label: 'mars', path: 'INBOX/mars' },
          { label: 'Administratif', path: 'INBOX/Administratif' }
        ]
      },
      { label: 'Spam', path: 'Spam' }
    ];
    const tree = [
      { label: 'Brouillons' },

      {
        label: 'INBOX',
        children: [{ label: 'mars' }, { label: 'Administratif' }]
      },
      { label: 'Spam' }
    ];
    const output = imapTreeHelpers.addPathPerFolder(tree, tree);
    expect(output).to.have.deep.members(expectedOutput);
  });
});
