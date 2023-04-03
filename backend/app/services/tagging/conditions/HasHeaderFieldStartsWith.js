const {
  hasHeaderFieldStartsWith
} = require('../../../utils/helpers/emailMessageHelpers');

class HasHeaderFieldStartsWith {
  constructor(possibleHeaderPrefixes) {
    this.possibleHeaderPrefixes = possibleHeaderPrefixes;
  }

  checkRule({ header }) {
    return hasHeaderFieldStartsWith(header, this.possibleHeaderPrefixes);
  }
}

module.exports = {
  HasHeaderFieldStartsWith
};
