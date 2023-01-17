const chai = require('chai');
const assert = chai.assert;

const { findEmailAddressType } = require('../../app/utils/helpers/minedDataHelpers')

describe('minedDataHelpers.findEmailAddressType()', () => {
    it('should return "Professional" for custom domain type', () => {
        const type = findEmailAddressType('leadminer@leadminer.io', ['leadminer'], 'custom');
        assert.equal(type, 'Professional');
    });

    it('should return "Personal" for provider domain type', () => {
        const type = findEmailAddressType('leadminer@gmail.com', ['leadminer'], 'provider');
        assert.equal(type, 'Personal');
    });

    it('should return an empty string for invalid input or low matching score', () => {
        const type = findEmailAddressType('sam@gmail.com', '', 'provider');
        assert.equal(type, '');
    });
});
