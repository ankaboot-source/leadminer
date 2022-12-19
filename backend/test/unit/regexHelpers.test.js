const { expect } = require('chai');
const { checkSync } = require('recheck');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const testData = require('../testData.json');


describe('Regex redos checker', () => {

    const regex = regExHelpers.getRegEx()
    let messageError = 'Regex is vulnerable !'
    
    regex.map((r) => {
      it('regex should be REDOS safe', () => {
        const result = checkSync(r.source, r.flags)  // checks for regex safety
        
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
  
  it('should return a valid array of emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });

  it('should return only valid emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.randomEmails);
    expect(output).to.eql(testData.validrandomEmails.split(' '));
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('should return valid name and email as object', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
  });
});
