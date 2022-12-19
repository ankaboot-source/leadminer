const { expect } = require('chai');
const { check } = require('recheck');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const testData = require('../testData.json');


describe('Regex redos checker', () => {

    const regex = regExHelpers.getRegEx()
    let messageError = 'Regex is vulnerable !'
    
    regex.map((r) => {
      it('regex should be REDOS safe', async () => {
        const result = await check(r.source, r.flags)
        
        if (result.status === 'vulnerable'){  // Constructs helpful error message
          const attack = result.attack.pattern
          const complexity = result.complexity.type
          vulParts = result.hotspot.map((i) => {return ` index(${i.start}, ${i.end}): ${r.source.slice(i.start, i.end)}`})
          messageError += ` \n\t- Complixity: ${complexity} \n\t- Attack string: ${attack} \n\t- Vulnerable parts: ${vulParts}\n\t`
        }
        expect(result, messageError).to.deep.have.property('status', 'safe')
    })
  })

})

describe('regExHelpers.extractEmailsFromBody(text)', () => {
  
  it('Should return a valid array of emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });

  it('Should return only valid emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.randomEmails);
    expect(output).to.eql(testData.validrandomEmails.split(' '));
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('Should return objects with valid emails', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);

  });

  it('Should return array with one valid object', () => {
    // Test with all information
    let output = regExHelpers.extractNameAndEmail("this is myyyyyyyyyyyyyyyy name <tester@testing.com>");
    expect(output).to.have.deep.members([{name:'this is myyyyyyyyyyyyyyyy name', identifier: 'tester', address:'tester@testing.com'}]);

    // test only with email
    output = regExHelpers.extractNameAndEmail("<tester@testing.com>");
    expect(output).to.have.deep.members([{name:'', identifier: 'tester', address:'tester@testing.com'}]);

  })
});
