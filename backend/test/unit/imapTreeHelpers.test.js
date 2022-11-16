const { expect } = require('chai');
const imapTreeHelpers = require('../../app/utils/helpers/imapTreeHelpers');
const dataTest = require('../testData.json');

describe('imapTreeHelpers.createFlatTreeFromImap(imapTree)', () => {
  const imapTreeExample = dataTest.imapTreeExample;
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
    const Output = imapTreeHelpers.createFlatTreeFromImap(imapTreeExample);
    Object.keys(Output).forEach((key) => {
      if (!Output[`${key}`].parent) Output[`${key}`].parent = null 
    })
    expect(Output).to.have.deep.members(expectedOutput);
  });
});

describe('imapTreeHelpers.BuildFinaltTree(foldersFlatArray, UserEmail)', () => {
  it('should build a valid tree', () => {
    
    const expectedOutput = [
      {
        label: 'email@example.com',
        children: [
          { label: 'Brouillons', path: '', total: 0 },
          {
            label: 'INBOX',
            path: 'INBOX',
            total: 3,
            children: [
              {"label": "mars", "path": "INBOX/mars", "total": 1},
              {"label": "Administratif", "path": "INBOX/Administratif","total": 1}
            ]
          },
          { label: 'Spam', path: 'Spam', total: 1 }
        ],
        total: 5
      }
    ] 

    const flattree =  imapTreeHelpers.createFlatTreeFromImap(dataTest.imapTreeExample)
    // add total to folders acts like AddTotalPerFolder (EmailAccountMiner.js)
    Object.keys(flattree).forEach((key) => {
      flattree[`${key}`].total = flattree[`${key}`].label === 'Brouillons' ? 0: 1
    })
    const output = imapTreeHelpers.BuildFinaltTree(flattree, "email@example.com");
    expect(output).to.have.deep.members(expectedOutput);
  });
});
