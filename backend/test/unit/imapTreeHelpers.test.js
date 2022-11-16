const { expect } = require('chai');
const imapTreeHelpers = require('../../app/utils/helpers/imapTreeHelpers');
const dataTest = require('../testData.json');

describe('imapTreeHelpers.createFlatTreeFromImap(imapTree)', () => {
  const imapTreeExample = dataTest.imapTreeExample;
  const expectedOutput = [
    { label: 'Brouillons', path: 'Brouillons', parent: undefined },
    { label: 'INBOX', path: 'INBOX', parent: undefined },
    {
      label: 'mars',
      path: 'INBOX/mars',
      parent: { label: 'INBOX', path: 'INBOX', parent: undefined }
    },
    {
      label: 'Administratif',
      path: 'INBOX/Administratif',
      parent: { label: 'INBOX', path: 'INBOX', parent: undefined }
    },
    { label: 'Spam', path: 'Spam', parent: undefined }
  ];  

  it('should return valid flat array', () => {
    const Output = imapTreeHelpers.createFlatTreeFromImap(imapTreeExample);
    expect(Output).to.have.deep.members(expectedOutput);
  });
});

describe('imapTreeHelpers.BuildFinaltTree(foldersFlatArray, UserEmail)', () => {
  it('should build a valid tree', () => {
    
    const expectedOutput = [
      {
        label: 'email@example.com',
        children: [
          { label: 'Brouillons', path: 'Brouillons', total: 1 },
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
      flattree[`${key}`].total = 1
    })
    const output = imapTreeHelpers.BuildFinaltTree(flattree, "email@example.com");
    expect(output).to.have.deep.members(expectedOutput);
  });
});
