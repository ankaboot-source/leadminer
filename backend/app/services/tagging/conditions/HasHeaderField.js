const {
  getSpecificHeader
} = require('../../../utils/helpers/emailMessageHelpers');

class HasHeaderField {
  constructor(possibleHeaderFields) {
    this.possibleHeaderFields = possibleHeaderFields;
  }

  checkRule({ header }) {
    return getSpecificHeader(header, this.possibleHeaderFields) !== null;
  }
}

module.exports = {
  HasHeaderField
};
